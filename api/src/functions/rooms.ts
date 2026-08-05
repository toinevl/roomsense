import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import type { Room } from '@roomsense/shared'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { getTableClient, TABLE_NAMES } from '../lib/tables'

/**
 * GET /api/rooms → Array<Room & { occupancy, utilizationPct, lastSeenTs }>
 *
 * Returns all rooms joined with their LATEST office-hours OccupancySnapshot.
 * The snapshot RowKey is inverted-ticks, so the lexicographically smallest
 * RowKey in the roomId partition is the newest — a single partition-scan page
 * (see OFFICE_HOURS_SCAN_LIMIT) yields newest-first rows in one round-trip,
 * which we scan for the first weekday-08:00-18:00-UTC match (see
 * latestSnapshotForRoom for why "literal latest" is the wrong anchor).
 *
 * `lastSeenTs` is that snapshot's `ts` as an ISO string. For rooms with no
 * snapshots, `lastSeenTs` is the empty string ('') and occupancy/
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

// How many newest-first rows to scan (in one page/round-trip) looking for an
// office-hours match before giving up and falling back to the literal latest
// row. 400 rows at the seed's 15-min interval is ~4 days of coverage —
// comfortably more than the worst-case gap (a Friday-evening-to-Monday-morning
// weekend, ~62h / ~248 rows) — while staying a single Table Storage page.
const OFFICE_HOURS_SCAN_LIMIT = 400

function isOfficeHoursUtc(iso: string): boolean {
  const d = new Date(iso)
  const day = d.getUTCDay()
  const hour = d.getUTCHours()
  return day !== 0 && day !== 6 && hour >= 8 && hour < 18
}

async function latestSnapshotForRoom(
  roomId: string,
): Promise<{ occupancy: number; utilizationPct: number; lastSeenTs: string }> {
  // Default fallback for a room with no snapshots yet.
  const empty = { occupancy: 0, utilizationPct: 0, lastSeenTs: '' }
  try {
    const client = getTableClient(TABLE_NAMES.snapshots)
    // RowKey is inverted-ticks → table storage returns rows in RowKey ASC,
    // i.e. newest-first. "Latest" is anchored to the most recent office-hours
    // (weekday, 08:00-18:00 UTC) snapshot, not the literal newest row: seeded
    // data windows always end at UTC midnight, so the chronologically last
    // row is always a dead-of-night ~0% reading — that would make the
    // dashboard/live grid look broken by construction, regardless of which
    // seed window is used or when the demo is actually viewed. This mirrors
    // the frontend mock's client-side equivalent (mockDerivations.ts's
    // findLatestActiveIndex) so live and mock modes present the same "current
    // occupancy" semantics. Page through newest-first until the first
    // office-hours match; fall back to the literal newest row if none is
    // found within OFFICE_HOURS_SCAN_LIMIT rows (e.g. a brand-new room with
    // only a few off-hours readings so far).
    const pages = client
      .listEntities<SnapshotEntity>({
        queryOptions: { filter: `PartitionKey eq '${roomId}'` },
      })
      .byPage({ maxPageSize: OFFICE_HOURS_SCAN_LIMIT })

    let literalLatest: SnapshotEntity | undefined
    for await (const page of pages) {
      for (const entity of page) {
        if (!literalLatest) literalLatest = entity
        if (isOfficeHoursUtc(entity.ts)) {
          return {
            occupancy: entity.occupancy,
            utilizationPct: entity.utilizationPct,
            lastSeenTs: entity.ts,
          }
        }
      }
      break // only the first page — see OFFICE_HOURS_SCAN_LIMIT comment
    }
    if (literalLatest) {
      return {
        occupancy: literalLatest.occupancy,
        utilizationPct: literalLatest.utilizationPct,
        lastSeenTs: literalLatest.ts,
      }
    }
    return empty
  } catch (err) {
    // Don't fail the whole listing on one room — degrade to empty.
    return empty
  }
}

/**
 * Fetch all rooms joined with their latest occupancy snapshot, sorted
 * building asc / roomId asc. Extracted from `roomsHandler` so the
 * recommendations endpoint (#38) can reuse the exact same room+occupancy
 * assembly logic instead of duplicating it.
 */
export async function listRoomsWithOccupancy(): Promise<RoomWithLatest[]> {
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

  return Promise.all(
    rooms.map(async (r) => {
      const latest = await latestSnapshotForRoom(r.roomId)
      // Strip table-storage bookkeeping keys before returning.
      const { partitionKey: _pk, rowKey: _rk, ...roomFields } = r
      return { ...roomFields, ...latest }
    }),
  )
}

/** Shape recommendations.ts scores against — an exact alias of RoomWithLatest. */
export type RoomForScoring = RoomWithLatest

export async function roomsHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req.headers.get('origin') ?? undefined)
  }

  try {
    const body = await listRoomsWithOccupancy()

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
