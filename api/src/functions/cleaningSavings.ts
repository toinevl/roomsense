import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { z } from 'zod'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { getTableClient, TABLE_NAMES } from '../lib/tables'

/**
 * GET /api/rooms/cleaning-savings?from=ISO&to=ISO → per-room + portfolio
 * cleaning-savings simulation over the window (#65).
 *
 * 100% computed on the fly from existing OccupancySnapshot data — no new
 * persisted table (matches this project's derived-not-stored convention:
 * ghost meetings, #38's streak counter).
 *
 * Simulation, replayed per room in ascending time order over that room's
 * snapshots in [from, to]:
 *   - hoursSinceClean: elapsed calendar time since the last simulated clean.
 *   - capacityHoursSinceClean: cumulative Σ(occupancy * 0.25h) / room.capacity
 *     since the last simulated clean — occupant-hours normalized by room
 *     capacity ("capacity-hours-equivalent"), NOT raw occupant-hours (which
 *     would just proxy room size rather than usage intensity).
 *   - Room is assumed freshly cleaned at t=from (both counters start at 0).
 *   - After each snapshot, if hoursSinceClean >= CLEANING_INTERVAL_DAYS*24 OR
 *     capacityHoursSinceClean >= CLEANING_THRESHOLD_CAPACITY_HOURS, count one
 *     simulated "policy clean" and reset both counters to 0.
 *
 * Baseline for comparison = fixed daily clean, one per room per calendar day
 * in the window: floor((to - from) in days) — exact day-boundary math from
 * the from/to timestamps, not a hardcoded 7.
 *
 * cleansAvoided = max(0, baselineCleans - policyCleans)
 * eurSaved = cleansAvoided * CLEANING_COST_PER_CLEAN_EUR
 *
 * Defaults verified against the real 7-day seed (packages/seed, seed=42,
 * days=7 — same generator + seed the production upload uses): see
 * "Verified defaults" note appended to wishlist #65.
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

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function cleaningSavingsHandler(
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

  const cleaningIntervalDays = Number(process.env.CLEANING_INTERVAL_DAYS ?? '3')
  const cleaningThresholdCapacityHours = Number(
    process.env.CLEANING_THRESHOLD_CAPACITY_HOURS ?? '8',
  )
  const cleaningCostPerCleanEur = Number(process.env.CLEANING_COST_PER_CLEAN_EUR ?? '15')

  // Baseline: fixed daily clean, one per room per calendar day in the window —
  // exact day-boundary math from the from/to timestamps, not a hardcoded 7.
  const baselineCleansPerRoom = Math.floor((toMs - fromMs) / DAY_MS)

  try {
    // 1. Load all rooms into a Map<roomId, Room>.
    const roomsClient = getTableClient(TABLE_NAMES.rooms)
    const rooms = new Map<string, RoomEntity>()
    for await (const entity of roomsClient.listEntities<RoomEntity>({})) {
      rooms.set(entity.roomId, entity)
    }

    // 2. Load all snapshots in [fromMs, toMs] (full scan + in-memory filter).
    type Snap = { roomId: string; tsMs: number; occupancy: number }
    const snapshots: Snap[] = []
    const snapsClient = getTableClient(TABLE_NAMES.snapshots)
    for await (const entity of snapsClient.listEntities<SnapshotEntity>({})) {
      const tsMs = Date.parse(entity.ts)
      if (tsMs < fromMs || tsMs > toMs) continue
      if (!rooms.has(entity.roomId)) continue
      snapshots.push({ roomId: entity.roomId, tsMs, occupancy: entity.occupancy })
    }

    // Group snapshots by room, sorted ascending by ts.
    const snapsByRoom = new Map<string, Snap[]>()
    for (const s of snapshots) {
      const arr = snapsByRoom.get(s.roomId)
      if (arr) arr.push(s)
      else snapsByRoom.set(s.roomId, [s])
    }
    for (const arr of snapsByRoom.values()) {
      arr.sort((a, b) => a.tsMs - b.tsMs)
    }

    // 3. Simulate per room.
    const roomResults: Array<{
      roomId: string
      name: string
      baselineCleans: number
      policyCleans: number
      cleansAvoided: number
      eurSaved: number
    }> = []

    for (const [roomId, room] of rooms) {
      const roomSnaps = snapsByRoom.get(roomId) ?? []

      let hoursSinceClean = 0
      let capacityHoursSinceClean = 0
      let lastTsMs = fromMs
      let policyCleans = 0

      for (const s of roomSnaps) {
        const elapsedHours = (s.tsMs - lastTsMs) / HOUR_MS
        hoursSinceClean += elapsedHours
        if (room.capacity > 0) {
          capacityHoursSinceClean += (s.occupancy * 0.25) / room.capacity
        }
        lastTsMs = s.tsMs

        const intervalFired = hoursSinceClean >= cleaningIntervalDays * 24
        const thresholdFired = capacityHoursSinceClean >= cleaningThresholdCapacityHours
        if (intervalFired || thresholdFired) {
          policyCleans += 1
          hoursSinceClean = 0
          capacityHoursSinceClean = 0
        }
      }

      const cleansAvoided = Math.max(0, baselineCleansPerRoom - policyCleans)
      const eurSaved = round2(cleansAvoided * cleaningCostPerCleanEur)

      roomResults.push({
        roomId,
        name: room.name,
        baselineCleans: baselineCleansPerRoom,
        policyCleans,
        cleansAvoided,
        eurSaved,
      })
    }

    roomResults.sort((a, b) => (a.roomId < b.roomId ? -1 : a.roomId > b.roomId ? 1 : 0))

    const totals = roomResults.reduce(
      (acc, r) => ({
        baselineCleans: acc.baselineCleans + r.baselineCleans,
        policyCleans: acc.policyCleans + r.policyCleans,
        cleansAvoided: acc.cleansAvoided + r.cleansAvoided,
        eurSaved: round2(acc.eurSaved + r.eurSaved),
      }),
      { baselineCleans: 0, policyCleans: 0, cleansAvoided: 0, eurSaved: 0 },
    )

    return withCors(
      {
        status: 200,
        jsonBody: { rooms: roomResults, totals },
      },
      origin,
    )
  } catch (err) {
    logError(ctx, 'cleaningSavings: query failed', err)
    return withCors(
      { status: 500, jsonBody: { error: 'Internal server error' } },
      origin,
    )
  }
}

app.http('cleaningSavings', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'rooms/cleaning-savings',
  handler: cleaningSavingsHandler,
})
