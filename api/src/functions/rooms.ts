import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import type { Room } from '@roomsense/shared'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { getTableClient, TABLE_NAMES } from '../lib/tables'

/**
 * GET /api/rooms → Array<Room & { occupancy, utilizationPct, lastSeenTs }>
 *
 * Returns all rooms joined with their LATEST OccupancySnapshot. The snapshot
 * RowKey is inverted-ticks, so the lexicographically smallest RowKey in the
 * roomId partition is the newest — a `maxPageSize: 1` partition scan yields it
 * in one round-trip.
 *
 * `lastSeenTs` is the latest snapshot's `ts` as an ISO string. For rooms with
 * no snapshots, `lastSeenTs` is the empty string ('') and occupancy/
 * utilizationPct fall back to 0 — the contract types `lastSeenTs: string`, and
 * an empty string is the unambiguous "no data" marker that the frontend can
 * check with `=== ''` without juggling `string | null`.
 *
 * Order: building asc, then roomId asc. Always 200, even on an empty table
 * (returns []).
 */

type RoomWithLatest = Room & {
  occupancy: number
  utilizationPct: number
  lastSeenTs: string
}

type RoomEntity = Room & { partitionKey: string; rowKey: string }
type SnapshotEntity = {
  partitionKey: string
  rowKey: string
  ts: string
  occupancy: number
  utilizationPct: number
  intervalMinutes: number
}

async function latestSnapshotForRoom(
  roomId: string,
): Promise<{ occupancy: number; utilizationPct: number; lastSeenTs: string }> {
  // Default fallback for a room with no snapshots yet.
  const empty = { occupancy: 0, utilizationPct: 0, lastSeenTs: '' }
  try {
    const client = getTableClient(TABLE_NAMES.snapshots)
    // RowKey is inverted-ticks → table storage returns rows in RowKey ASC,
    // i.e. newest-first. `maxPageSize: 1` lives on PageSettings, not on
    // listEntities options (the SDK type confirms this), so we go through
    // byPage and take the first row of the first page — one round-trip.
    const pages = client
      .listEntities<SnapshotEntity>({
        queryOptions: { filter: `PartitionKey eq '${roomId}'` },
      })
      .byPage({ maxPageSize: 1 })
    for await (const page of pages) {
      if (page.length > 0) {
        const entity = page[0]
        return {
          occupancy: entity.occupancy,
          utilizationPct: entity.utilizationPct,
          lastSeenTs: entity.ts,
        }
      }
      break
    }
    return empty
  } catch (err) {
    // Don't fail the whole listing on one room — degrade to empty.
    return empty
  }
}

export async function roomsHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req.headers.get('origin') ?? undefined)
  }

  try {
    const client = getTableClient(TABLE_NAMES.rooms)
    const rooms: RoomEntity[] = []
    for await (const entity of client.listEntities<RoomEntity>()) {
      rooms.push(entity)
    }

    // Order: building asc, then roomId asc. Locale-independent compare on the
    // ASCII partition/row keys — names are never used for ordering.
    rooms.sort((a, b) =>
      a.building < b.building ? -1 : a.building > b.building ? 1 : a.roomId < b.roomId ? -1 : a.roomId > b.roomId ? 1 : 0,
    )

    const body: RoomWithLatest[] = await Promise.all(
      rooms.map(async (r) => {
        const latest = await latestSnapshotForRoom(r.roomId)
        // Strip table-storage bookkeeping keys before returning.
        const { partitionKey: _pk, rowKey: _rk, ...roomFields } = r
        return { ...roomFields, ...latest }
      }),
    )

    return withCors(
      {
        status: 200,
        jsonBody: body,
      },
      req.headers.get('origin') ?? undefined,
    )
  } catch (err) {
    logError(ctx, 'rooms: failed to list rooms', err)
    return withCors(
      { status: 500, jsonBody: { error: 'Internal server error' } },
      req.headers.get('origin') ?? undefined,
    )
  }
}

app.http('rooms', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'rooms',
  handler: roomsHandler,
})
