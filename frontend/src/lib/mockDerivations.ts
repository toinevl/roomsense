import type { SeedOutput } from '@roomsense/seed'
import type { OccupancySnapshot, Reservation, Room, SensorReading } from '@roomsense/shared'
import type { HealthResponse, KpisResponse, RoomWithOccupancy, UnderusedRoom } from './apiTypes'

/** Matches the API's `COST_PER_DESK_HOUR_EUR` env default (wishlist.md contract). */
export const COST_PER_DESK_HOUR_EUR = 4

/**
 * Index seed output by room / device so every derivation below is a plain
 * lookup instead of a fresh linear scan. Built once per seed dataset.
 */
export interface SeedIndex {
  roomsById: Map<string, Room>
  deviceIdToRoomId: Map<string, string>
  snapshotsByRoom: Map<string, OccupancySnapshot[]>
  readingsByDevice: Map<string, SensorReading[]>
  reservationsByRoom: Map<string, Reservation[]>
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const bucket = map.get(key)
    if (bucket) bucket.push(item)
    else map.set(key, [item])
  }
  return map
}

/**
 * Index of the most recent snapshot that falls in office hours (weekday,
 * 08:00-18:00 UTC) — see comment on findLatestActiveIndex below for why
 * "the literal last snapshot" is the wrong anchor for a "current occupancy"
 * view.
 */
export function findLatestActiveIndex(snaps: OccupancySnapshot[]): number {
  for (let i = snaps.length - 1; i >= 0; i--) {
    const d = new Date(snaps[i]!.ts)
    const day = d.getUTCDay()
    const hour = d.getUTCHours()
    if (day !== 0 && day !== 6 && hour >= 8 && hour < 18) return i
  }
  return snaps.length - 1
}

export function buildIndex(seed: SeedOutput): SeedIndex {
  const roomsById = new Map(seed.rooms.map((r) => [r.roomId, r]))
  const deviceIdToRoomId = new Map(seed.rooms.map((r) => [r.deviceId, r.roomId]))
  const snapshotsByRoom = groupBy(seed.snapshots, (s) => s.roomId)
  const readingsByDevice = groupBy(seed.readings, (r) => r.deviceId)
  // Strip the seed-internal `ghost` flag — ghost status is DERIVED from
  // occupancy, never stored/served (see CLAUDE.md "Terabee data model").
  const reservationsByRoom = groupBy(
    seed.reservations.map(({ ghost: _ghost, ...rest }) => rest),
    (r) => r.roomId,
  )
  return { roomsById, deviceIdToRoomId, snapshotsByRoom, readingsByDevice, reservationsByRoom }
}

function parseTs(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) throw new Error(`invalid timestamp: ${value}`)
  return ms
}

function fullRange(seed: SeedOutput): { fromMs: number; toMs: number } {
  const first = seed.snapshots[0]
  const last = seed.snapshots[seed.snapshots.length - 1]
  return { fromMs: Date.parse(first!.ts), toMs: Date.parse(last!.ts) }
}

export function deriveHealth(): HealthResponse {
  return { status: 'ok', buildSha: 'mock', tables: true }
}

/**
 * GET /api/rooms — rooms joined with their latest snapshot.
 *
 * "Latest" is anchored to the most recent office-hours reading, not the
 * literal last row: the seed generator's 30-day window always ends exactly
 * at UTC midnight (see generate.ts's `midnightUtc`), so the chronologically
 * final snapshot is always a dead-of-night reading with ~0% utilization —
 * that would make the dashboard and live grid look broken by construction
 * every single time, regardless of which seed/window is used. Picking the
 * latest snapshot that was actually during office hours is honest (it's
 * real generated data, never fabricated) and reflects what "current
 * occupancy" would look like if the demo were run during business hours,
 * which it always is in practice.
 */
export function deriveRooms(seed: SeedOutput, index: SeedIndex): RoomWithOccupancy[] {
  return seed.rooms.map((room) => {
    const snaps = index.snapshotsByRoom.get(room.roomId) ?? []
    const latest = snaps[findLatestActiveIndex(snaps)]
    return {
      ...room,
      occupancy: latest?.occupancy ?? 0,
      utilizationPct: latest?.utilizationPct ?? 0,
      lastSeenTs: latest?.ts ?? seed.sources[0]?.lastSyncTs ?? new Date(0).toISOString(),
    }
  })
}

/** GET /api/rooms/{roomId}/occupancy — snapshot series, ascending, range-filtered. */
export function deriveOccupancy(
  seed: SeedOutput,
  index: SeedIndex,
  roomId: string,
  from?: string,
  to?: string,
): OccupancySnapshot[] {
  const { fromMs: defaultFrom, toMs: defaultTo } = fullRange(seed)
  const fromMs = parseTs(from, defaultFrom)
  const toMs = parseTs(to, defaultTo)
  if (fromMs > toMs) throw new Error('invalid range: from is after to')
  const snaps = index.snapshotsByRoom.get(roomId) ?? []
  return snaps.filter((s) => {
    const ts = Date.parse(s.ts)
    return ts >= fromMs && ts <= toMs
  })
}

/** GET /api/rooms/{roomId}/readings — raw telemetry, descending, limited. */
export function deriveReadings(
  index: SeedIndex,
  roomId: string,
  limit = 50,
): SensorReading[] {
  const room = index.roomsById.get(roomId)
  if (!room) return []
  const readings = index.readingsByDevice.get(room.deviceId) ?? []
  return readings.slice(Math.max(0, readings.length - limit)).reverse()
}

function isSameUtcDate(iso: string, dateStr: string): boolean {
  return iso.slice(0, 10) === dateStr
}

/** GET /api/rooms/{roomId}/reservations — ascending by startTs, optionally date-filtered. */
export function deriveReservations(
  index: SeedIndex,
  roomId: string,
  date?: string,
): Reservation[] {
  const reservations = index.reservationsByRoom.get(roomId) ?? []
  if (!date) return reservations
  return reservations.filter((r) => isSameUtcDate(r.startTs, date))
}

/** Ghost = a reservation whose slot's max occupancy is 0 (derived, never stored). */
export function isGhostReservation(index: SeedIndex, reservation: Reservation): boolean {
  const snaps = index.snapshotsByRoom.get(reservation.roomId) ?? []
  const startMs = Date.parse(reservation.startTs)
  const endMs = Date.parse(reservation.endTs)
  let maxOccupancy = 0
  for (const snap of snaps) {
    const ts = Date.parse(snap.ts)
    if (ts < startMs || ts >= endMs) continue
    if (snap.occupancy > maxOccupancy) maxOccupancy = snap.occupancy
  }
  return maxOccupancy === 0
}

/** GET /api/kpis — portfolio-level utilization, ghost rate, wasted-€ estimate. */
export function deriveKpis(seed: SeedOutput, index: SeedIndex, from?: string, to?: string): KpisResponse {
  const { fromMs: defaultFrom, toMs: defaultTo } = fullRange(seed)
  const fromMs = parseTs(from, defaultFrom)
  const toMs = parseTs(to, defaultTo)
  if (fromMs > toMs) throw new Error('invalid range: from is after to')

  const inRange = seed.snapshots.filter((s) => {
    const ts = Date.parse(s.ts)
    return ts >= fromMs && ts <= toMs
  })

  const avgUtilizationPct = inRange.length
    ? round1(inRange.reduce((sum, s) => sum + s.utilizationPct, 0) / inRange.length)
    : 0
  const peakUtilizationPct = inRange.length ? round1(Math.max(...inRange.map((s) => s.utilizationPct))) : 0

  const reservationsInRange = seed.reservations.filter((r) => {
    const startMs = Date.parse(r.startTs)
    return startMs >= fromMs && startMs <= toMs
  })
  let ghostCount = 0
  let wastedEur = 0
  for (const reservation of reservationsInRange) {
    if (!isGhostReservation(index, reservation)) continue
    ghostCount += 1
    const room = index.roomsById.get(reservation.roomId)
    if (!room) continue
    const hours = (Date.parse(reservation.endTs) - Date.parse(reservation.startTs)) / 3_600_000
    wastedEur += hours * room.capacity * COST_PER_DESK_HOUR_EUR
  }
  const ghostRatePct = reservationsInRange.length ? round1((ghostCount / reservationsInRange.length) * 100) : 0

  const buildingUtil = new Map<string, { sum: number; count: number }>()
  const roomUtil = new Map<string, { sum: number; count: number }>()
  for (const snap of inRange) {
    const room = index.roomsById.get(snap.roomId)
    if (!room) continue
    const b = buildingUtil.get(room.building) ?? { sum: 0, count: 0 }
    b.sum += snap.utilizationPct
    b.count += 1
    buildingUtil.set(room.building, b)
    const rEntry = roomUtil.get(room.roomId) ?? { sum: 0, count: 0 }
    rEntry.sum += snap.utilizationPct
    rEntry.count += 1
    roomUtil.set(room.roomId, rEntry)
  }

  let busiestBuilding = ''
  let busiestAvg = -1
  for (const [building, { sum, count }] of buildingUtil) {
    const avg = count ? sum / count : 0
    if (avg > busiestAvg) {
      busiestAvg = avg
      busiestBuilding = building
    }
  }

  const underusedRooms: UnderusedRoom[] = [...roomUtil.entries()]
    .map(([roomId, { sum, count }]) => ({
      roomId,
      name: index.roomsById.get(roomId)?.name ?? roomId,
      utilizationPct: count ? round1(sum / count) : 0,
    }))
    .sort((a, b) => a.utilizationPct - b.utilizationPct)
    .slice(0, 5)

  return {
    avgUtilizationPct,
    peakUtilizationPct,
    ghostRatePct,
    wastedEur: Math.round(wastedEur),
    busiestBuilding,
    underusedRooms,
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
