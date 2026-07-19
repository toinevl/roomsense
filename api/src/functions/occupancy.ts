import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { invertedTicks, type OccupancySnapshot, type Room } from '@roomsense/shared'
import { z } from 'zod'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { getTableClient, TABLE_NAMES } from '../lib/tables'

/**
 * GET /api/rooms/{roomId}/occupancy?from=ISO&to=ISO → OccupancySnapshot[]
 *
 * Range query over OccupancySnapshots. The RowKey is inverted-ticks
 * (TICKS_MAX - epochMs, zero-padded to 14), so a lexicographic RowKey range
 * maps directly onto a time range and is serviced by the partition index
 * without a full scan.
 *
 * Inverted ticks DECREASE as time advances: an earlier `from` produces a
 * LARGER inverted-ticks value than a later `to`. So the in-range band is
 *   RowKey ge invertedTicks(to)   (the SMALLER inverted value = later bound)
 *   RowKey le invertedTicks(from) (the LARGER inverted value = earlier bound)
 * Both bounds are zero-padded to 14 chars, so lexicographic compare == numeric compare.
 *
 * Table storage returns RowKey ASC (newest-first); the contract asks for ASC
 * by ts, so we re-sort in memory before returning.
 *
 * Validation: 400 on missing/unparseable `from`/`to`, or `from >= to`. 404 if
 * roomId is unknown. 200 with [] on a valid range that contains no snapshots.
 */

const QuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
})

type RoomEntity = Room & { partitionKey: string; rowKey: string }
type SnapshotEntity = {
  partitionKey: string
  rowKey: string
  ts: string
  occupancy: number
  utilizationPct: number
  intervalMinutes: number
  roomId: string
}

/**
 * Room existence check (shared idiom with rooms.ts, not yet extracted to lib —
 * duplicated deliberately until the third endpoint makes the pattern stable).
 *
 * Rooms uses PartitionKey=building, RowKey=roomId, so "does this room exist"
 * is a RowKey eq scan across partitions. Take the first row.
 */
async function roomExists(roomId: string): Promise<boolean> {
  const client = getTableClient(TABLE_NAMES.rooms)
  const pages = client
    .listEntities<RoomEntity>({
      queryOptions: { filter: `RowKey eq '${roomId}'` },
    })
    .byPage({ maxPageSize: 1 })
  for await (const page of pages) {
    return page.length > 0
  }
  return false
}

export async function occupancyHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = req.headers.get('origin') ?? undefined

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(origin)
  }

  const roomId = req.params.roomId
  if (!roomId) {
    return withCors({ status: 400, jsonBody: { error: 'Missing roomId' } }, origin)
  }

  // 1. Validate query params with zod first — unparseable ISO → 400.
  const parsed = QuerySchema.safeParse({
    from: req.query.get('from'),
    to: req.query.get('to'),
  })
  if (!parsed.success) {
    return withCors(
      {
        status: 400,
        jsonBody: { error: 'Invalid query parameters', details: parsed.error.flatten() },
      },
      origin,
    )
  }
  const { from, to } = parsed.data

  // 2. Range sanity — zod's .datetime() catches garbage but not from >= to.
  const fromMs = Date.parse(from)
  const toMs = Date.parse(to)
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) {
    return withCors(
      { status: 400, jsonBody: { error: 'Invalid range: from must be before to' } },
      origin,
    )
  }

  try {
    // 3. 404 before doing snapshot work — cheap Rooms scan.
    if (!(await roomExists(roomId))) {
      return withCors({ status: 404, jsonBody: { error: `Room not found: ${roomId}` } }, origin)
    }

    // 4. Range query via inverted-ticks RowKey bounds.
    // Inverted ticks DECREASE with time, so the later `to` has the SMALLER
    // inverted value. The in-range band is [invertedTicks(to), invertedTicks(from)].
    const fromInverted = invertedTicks(fromMs)
    const toInverted = invertedTicks(toMs)
    const filter = `PartitionKey eq '${roomId}' and RowKey ge '${toInverted}' and RowKey le '${fromInverted}'`

    const client = getTableClient(TABLE_NAMES.snapshots)
    const out: OccupancySnapshot[] = []
    for await (const entity of client.listEntities<SnapshotEntity>({
      queryOptions: { filter },
    })) {
      // intervalMinutes is z.literal(15) in the shared schema; Table Storage
      // round-trips it as a plain number, so we narrow at the boundary.
      out.push({
        roomId: entity.roomId,
        ts: entity.ts,
        occupancy: entity.occupancy,
        utilizationPct: entity.utilizationPct,
        intervalMinutes: 15,
      })
    }

    // RowKey ASC from the service = newest-first; contract wants ASC by ts.
    out.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))

    return withCors({ status: 200, jsonBody: out }, origin)
  } catch (err) {
    logError(ctx, 'occupancy: query failed', err)
    return withCors(
      { status: 500, jsonBody: { error: 'Internal server error' } },
      origin,
    )
  }
}

app.http('occupancyByRoom', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'rooms/{roomId}/occupancy',
  handler: occupancyHandler,
})
