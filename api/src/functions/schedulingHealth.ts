import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { z } from 'zod'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { getTableClient, TABLE_NAMES } from '../lib/tables'

/**
 * GET /api/rooms/scheduling-health?from=ISO&to=ISO → per-room scheduling
 * health over the window, for ALL rooms (unlike /kpis's `underusedRooms`,
 * which stays capped to the bottom 5 — untouched by this endpoint).
 *
 * Returns three independent metrics per room, deliberately NOT combined
 * into a composite score (budget-holder trust > a clever formula, per
 * wishlist #47-#55):
 *
 *   ghostRatePct     — % of this room's reservation-HOURS in [from,to] that
 *                       were ghosts. Same ghost logic as kpis.ts (a
 *                       reservation is a ghost if the max occupancy across
 *                       that room's snapshots within [startMs, endMs) is 0),
 *                       scoped per room instead of portfolio-wide.
 *   oversizedRatePct — % of this room's reservations (by COUNT) where
 *                       attendeeCount <= OVERSIZED_ATTENDEE_RATIO * capacity.
 *   utilizationPct   — mean of snapshot utilizationPct for this room in
 *                       range (same calc as kpis.ts's underusedRooms
 *                       per-room average, applied to every room).
 *
 * Both reservation hours and ghost hours are clipped to the [from, to]
 * window, same as kpis.ts. Rooms with zero reservations/snapshots in range
 * report 0 for every metric (guarded against division by zero).
 *
 * For demo scale (15 rooms x ~43k snapshots / 30 days) we full-scan each
 * table and filter in memory — same style as kpis.ts.
 *
 * Wishlist #64.
 */

const QuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
})

/**
 * Mirrors frontend/admin/src/lib/reclaim.ts's OVERSIZED_ATTENDEE_RATIO
 * constant. Re-declared here (not imported) — the api package cannot import
 * across the api/frontend build boundary. Keep this in sync manually if
 * reclaim.ts's constant ever changes.
 */
const OVERSIZED_ATTENDEE_RATIO = 0.3

type RoomEntity = {
  partitionKey: string
  rowKey: string
  roomId: string
  building: string
  floor: number
  name: string
  capacity: number
  deviceId: string
  outlookAddress: string
  sourceId: string
}

type SnapshotEntity = {
  partitionKey: string
  rowKey: string
  roomId: string
  ts: string
  occupancy: number
  utilizationPct: number
  intervalMinutes: number
}

type ReservationEntity = {
  partitionKey: string
  rowKey: string
  roomId: string
  subject: string
  organizer: string
  startTs: string
  endTs: string
  attendeeCount: number
  sourceId: string
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function schedulingHealthHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = req.headers.get('origin') ?? undefined

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(origin)
  }

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

  const fromMs = Date.parse(from)
  const toMs = Date.parse(to)
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) {
    return withCors(
      { status: 400, jsonBody: { error: 'Invalid range: from must be before to' } },
      origin,
    )
  }

  try {
    // 1. Load all rooms into a Map<roomId, Room>.
    const roomsClient = getTableClient(TABLE_NAMES.rooms)
    const rooms = new Map<string, RoomEntity>()
    for await (const entity of roomsClient.listEntities<RoomEntity>({})) {
      rooms.set(entity.roomId, entity)
    }

    // 2. Load all snapshots in [fromMs, toMs] (full scan + in-memory filter).
    type Snap = { roomId: string; tsMs: number; occupancy: number; utilizationPct: number }
    const snapshots: Snap[] = []
    const snapsClient = getTableClient(TABLE_NAMES.snapshots)
    for await (const entity of snapsClient.listEntities<SnapshotEntity>({})) {
      const tsMs = Date.parse(entity.ts)
      if (tsMs < fromMs || tsMs > toMs) continue
      if (!rooms.has(entity.roomId)) continue
      snapshots.push({
        roomId: entity.roomId,
        tsMs,
        occupancy: entity.occupancy,
        utilizationPct: entity.utilizationPct,
      })
    }

    // 3. Load all reservations overlapping [fromMs, toMs].
    type Res = { roomId: string; startMs: number; endMs: number; attendeeCount: number }
    const reservations: Res[] = []
    const resClient = getTableClient(TABLE_NAMES.reservations)
    for await (const entity of resClient.listEntities<ReservationEntity>({})) {
      const startMs = Date.parse(entity.startTs)
      const endMs = Date.parse(entity.endTs)
      if (endMs <= fromMs || startMs >= toMs) continue
      if (!rooms.has(entity.roomId)) continue
      reservations.push({
        roomId: entity.roomId,
        startMs,
        endMs,
        attendeeCount: entity.attendeeCount,
      })
    }

    // 4. Group snapshots/reservations by room.
    const snapsByRoom = new Map<string, Snap[]>()
    for (const s of snapshots) {
      const arr = snapsByRoom.get(s.roomId)
      if (arr) arr.push(s)
      else snapsByRoom.set(s.roomId, [s])
    }
    const resByRoom = new Map<string, Res[]>()
    for (const r of reservations) {
      const arr = resByRoom.get(r.roomId)
      if (arr) arr.push(r)
      else resByRoom.set(r.roomId, [r])
    }

    // 5. Compute the three independent metrics per room.
    const roomsOut: Array<{
      roomId: string
      name: string
      building: string
      ghostRatePct: number
      oversizedRatePct: number
      utilizationPct: number
    }> = []

    for (const [roomId, room] of rooms) {
      const roomSnaps = snapsByRoom.get(roomId) ?? []
      const roomRes = resByRoom.get(roomId) ?? []

      // utilizationPct = mean of snapshot utilizationPct for this room in range.
      const utilizationPct =
        roomSnaps.length === 0
          ? 0
          : round2(roomSnaps.reduce((sum, s) => sum + s.utilizationPct, 0) / roomSnaps.length)

      // ghostRatePct (hours-based) + oversizedRatePct (count-based), one pass
      // over this room's reservations.
      let totalHours = 0
      let ghostHours = 0
      let oversizedCount = 0
      for (const r of roomRes) {
        if (r.attendeeCount <= OVERSIZED_ATTENDEE_RATIO * room.capacity) {
          oversizedCount += 1
        }

        const clipStart = Math.max(r.startMs, fromMs)
        const clipEnd = Math.min(r.endMs, toMs)
        const hours = (clipEnd - clipStart) / (60 * 60 * 1000)
        if (hours <= 0) continue
        totalHours += hours

        // Max occupancy across this room's snapshots in [startMs, endMs).
        let maxOcc = 0
        for (const s of roomSnaps) {
          if (s.tsMs >= r.startMs && s.tsMs < r.endMs && s.occupancy > maxOcc) {
            maxOcc = s.occupancy
          }
        }
        if (maxOcc === 0) ghostHours += hours
      }

      const ghostRatePct = totalHours === 0 ? 0 : round2((ghostHours / totalHours) * 100)
      const oversizedRatePct =
        roomRes.length === 0 ? 0 : round2((oversizedCount / roomRes.length) * 100)

      roomsOut.push({
        roomId,
        name: room.name,
        building: room.building,
        ghostRatePct,
        oversizedRatePct,
        utilizationPct,
      })
    }

    // Sort by roomId for determinism (same sort-key rationale as /api/sources).
    roomsOut.sort((a, b) => a.roomId.localeCompare(b.roomId))

    return withCors({ status: 200, jsonBody: { rooms: roomsOut } }, origin)
  } catch (err) {
    logError(ctx, 'schedulingHealth: query failed', err)
    return withCors(
      { status: 500, jsonBody: { error: 'Internal server error' } },
      origin,
    )
  }
}

app.http('schedulingHealth', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'rooms/scheduling-health',
  handler: schedulingHealthHandler,
})
