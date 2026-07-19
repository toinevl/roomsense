import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { z } from 'zod'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { getTableClient, TABLE_NAMES } from '../lib/tables'

/**
 * GET /api/kpis?from=ISO&to=ISO → portfolio-wide KPIs over the window.
 *
 * Returns:
 *   avgUtilizationPct  — mean of utilizationPct across all snapshots in window
 *   peakUtilizationPct — max of (occupancy/capacity*100) across all snapshots
 *   ghostRatePct       — ghost-reservation-hours / total-reservation-hours * 100
 *   wastedEur          — sum over ghost reservations of (clippedHours * room.capacity * COST_PER_DESK_HOUR_EUR)
 *   busiestBuilding    — building with highest avg utilization (ties → alphabetical)
 *   underusedRooms     — 5 rooms with lowest avg utilization (roomId, name, utilizationPct)
 *
 * A reservation is a GHOST if the maximum occupancy across that room's
 * snapshots whose ts falls in [res.startTs, res.endTs) is 0. Both reservation
 * hours and ghost hours are clipped to the [from, to] window.
 *
 * For demo scale (15 rooms × ~43k snapshots / 30 days) we full-scan each
 * table and filter in memory — simpler than per-room inverted-ticks range
 * scans and trivially fast at this size.
 */

const QuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
})

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

export async function kpisHandler(
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

  const costPerDeskHourEur = Number(process.env.COST_PER_DESK_HOUR_EUR ?? '4')

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
    type Res = { roomId: string; startMs: number; endMs: number }
    const reservations: Res[] = []
    const resClient = getTableClient(TABLE_NAMES.reservations)
    for await (const entity of resClient.listEntities<ReservationEntity>({})) {
      const startMs = Date.parse(entity.startTs)
      const endMs = Date.parse(entity.endTs)
      if (endMs <= fromMs || startMs >= toMs) continue
      if (!rooms.has(entity.roomId)) continue
      reservations.push({ roomId: entity.roomId, startMs, endMs })
    }

    // 4. Compute metrics in one pass over the in-memory data.

    // avgUtilizationPct = mean of utilizationPct across all snapshots.
    const avgUtilizationPct =
      snapshots.length === 0
        ? 0
        : round2(
            snapshots.reduce((sum, s) => sum + s.utilizationPct, 0) / snapshots.length,
          )

    // peakUtilizationPct = max of (occupancy / capacity * 100) across snapshots.
    // Clamped to 100 — sensor over-counts can push a small room above its
    // capacity (e.g. 4 people in a 2-seat booth), but reporting "200%
    // utilized" to a C-level audience is misleading. Treat >capacity as
    // "full" semantically.
    let peakRaw = 0
    for (const s of snapshots) {
      const room = rooms.get(s.roomId)
      if (!room || room.capacity <= 0) continue
      const pct = Math.min(100, (s.occupancy / room.capacity) * 100)
      if (pct > peakRaw) peakRaw = pct
    }
    const peakUtilizationPct = round2(peakRaw)

    // Group snapshots by room for ghost calc + per-room averages.
    const snapsByRoom = new Map<string, Snap[]>()
    for (const s of snapshots) {
      const arr = snapsByRoom.get(s.roomId)
      if (arr) arr.push(s)
      else snapsByRoom.set(s.roomId, [s])
    }

    // Ghost + wasted-eur calc.
    let totalHours = 0
    let ghostHours = 0
    let wastedRaw = 0
    for (const r of reservations) {
      const clipStart = Math.max(r.startMs, fromMs)
      const clipEnd = Math.min(r.endMs, toMs)
      const hours = (clipEnd - clipStart) / (60 * 60 * 1000)
      if (hours <= 0) continue
      totalHours += hours
      // Max occupancy across this room's snapshots in [startMs, endMs).
      const roomSnaps = snapsByRoom.get(r.roomId) ?? []
      let maxOcc = 0
      for (const s of roomSnaps) {
        if (s.tsMs >= r.startMs && s.tsMs < r.endMs && s.occupancy > maxOcc) {
          maxOcc = s.occupancy
        }
      }
      if (maxOcc === 0) {
        ghostHours += hours
        const room = rooms.get(r.roomId)
        const cap = room?.capacity ?? 0
        wastedRaw += hours * cap * costPerDeskHourEur
      }
    }
    const ghostRatePct =
      totalHours === 0 ? 0 : round2((ghostHours / totalHours) * 100)
    const wastedEur = round2(wastedRaw)

    // busiestBuilding = building with highest avg utilization across its rooms'
    // snapshots (pooled mean of utilizationPct). Ties → first alphabetical.
    const buildingSum = new Map<string, number>()
    const buildingCount = new Map<string, number>()
    for (const s of snapshots) {
      const room = rooms.get(s.roomId)
      if (!room) continue
      buildingSum.set(room.building, (buildingSum.get(room.building) ?? 0) + s.utilizationPct)
      buildingCount.set(room.building, (buildingCount.get(room.building) ?? 0) + 1)
    }
    let busiestBuilding = ''
    let busiestAvg = -Infinity
    for (const [building, sum] of buildingSum) {
      const count = buildingCount.get(building) ?? 1
      const avg = sum / count
      if (avg > busiestAvg || (avg === busiestAvg && building < busiestBuilding)) {
        busiestAvg = avg
        busiestBuilding = building
      }
    }

    // underusedRooms = 5 rooms with lowest avg utilization.
    const roomAvg: Array<{ roomId: string; name: string; utilizationPct: number }> = []
    for (const [roomId, room] of rooms) {
      const roomSnaps = snapsByRoom.get(roomId) ?? []
      const avg =
        roomSnaps.length === 0
          ? 0
          : roomSnaps.reduce((sum, s) => sum + s.utilizationPct, 0) / roomSnaps.length
      roomAvg.push({ roomId, name: room.name, utilizationPct: round2(avg) })
    }
    roomAvg.sort((a, b) => {
      if (a.utilizationPct !== b.utilizationPct) {
        return a.utilizationPct - b.utilizationPct
      }
      return a.roomId < b.roomId ? -1 : a.roomId > b.roomId ? 1 : 0
    })
    const underusedRooms = roomAvg.slice(0, 5)

    return withCors(
      {
        status: 200,
        jsonBody: {
          avgUtilizationPct,
          peakUtilizationPct,
          ghostRatePct,
          wastedEur,
          busiestBuilding,
          underusedRooms,
        },
      },
      origin,
    )
  } catch (err) {
    logError(ctx, 'kpis: query failed', err)
    return withCors(
      { status: 500, jsonBody: { error: 'Internal server error' } },
      origin,
    )
  }
}

app.http('kpis', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'kpis',
  handler: kpisHandler,
})
