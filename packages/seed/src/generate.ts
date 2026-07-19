import type {
  OccupancySnapshot,
  Reservation,
  Room,
  SensorReading,
  Source,
} from '@roomsense/shared'
import { buildSources, ORGANIZERS, OUTLOOK_SOURCE, ROOMS, SUBJECTS, TERABEE_SOURCE } from './fixtures'

/**
 * Seed-internal extension: whether this reservation was generated as a
 * "ghost meeting" (booked, nobody showed). The flag is NOT uploaded —
 * in the live system ghostness is derived by joining reservations
 * against occupancy, exactly like the KPI endpoint does.
 */
export type SeedReservation = Reservation & { ghost: boolean }

export interface SeedOutput {
  rooms: Room[]
  readings: SensorReading[]
  snapshots: OccupancySnapshot[]
  reservations: SeedReservation[]
  sources: Source[]
}

export interface GenerateOptions {
  seed: number
  days?: number
  /** Generation covers the `days` full UTC days before this moment's midnight. */
  end?: Date
}

/** Deterministic PRNG (mulberry32) so identical seeds give identical datasets. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const INTERVAL_MS = 15 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const INTERVALS_PER_DAY = 96
const RESET_HOUR = 4 // device counters reset daily at 04:00 UTC

const GHOST_RATE = 0.2
const SLOT_BOOK_RATE = 0.6
const WALKIN_RATE_WEEKDAY = 0.1
const WALKIN_RATE_WEEKEND = 0.005

function midnightUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function isWeekend(epochMs: number): boolean {
  const day = new Date(epochMs).getUTCDay()
  return day === 0 || day === 6
}

export function generate(opts: GenerateOptions): SeedOutput {
  const days = opts.days ?? 30
  const end = midnightUtc(opts.end ?? new Date())
  const start = end - days * DAY_MS
  const rng = mulberry32(opts.seed)

  const readings: SensorReading[] = []
  const snapshots: OccupancySnapshot[] = []
  const reservations: SeedReservation[] = []

  for (const room of ROOMS) {
    const total = days * INTERVALS_PER_DAY
    const occ = new Int32Array(total)

    // 1. Reservation-driven usage (weekdays, hourly slots 08:00-17:00).
    for (let day = 0; day < days; day++) {
      const dayStart = start + day * DAY_MS
      if (isWeekend(dayStart)) continue
      let slot = 8
      while (slot <= 16) {
        if (rng() < SLOT_BOOK_RATE) {
          let durH = rng() < 0.3 ? 2 : 1
          if (slot + durH > 18) durH = 1
          const attendees = 2 + Math.floor(rng() * Math.max(1, Math.min(room.capacity, 8) - 1))
          const ghost = rng() < GHOST_RATE
          const organizer = ORGANIZERS[Math.floor(rng() * ORGANIZERS.length)]
          const subject = SUBJECTS[Math.floor(rng() * SUBJECTS.length)]
          const startTs = dayStart + slot * 3600_000
          reservations.push({
            roomId: room.roomId,
            subject,
            organizer,
            startTs: new Date(startTs).toISOString(),
            endTs: new Date(startTs + durH * 3600_000).toISOString(),
            attendeeCount: attendees,
            sourceId: OUTLOOK_SOURCE,
            ghost,
          })
          if (!ghost) {
            const actual = Math.max(1, Math.round(attendees * (0.8 + 0.4 * rng())))
            const from = day * INTERVALS_PER_DAY + slot * 4
            const to = from + durH * 4
            for (let i = from; i < to; i++) occ[i] += actual
          }
          slot += durH + (rng() < 0.3 ? 1 : 0)
        } else {
          slot++
        }
      }
    }

    // 2. Walk-ins: unreserved usage the sensors see but Outlook doesn't.
    for (let day = 0; day < days; day++) {
      const dayStart = start + day * DAY_MS
      const rate = isWeekend(dayStart) ? WALKIN_RATE_WEEKEND : WALKIN_RATE_WEEKDAY
      for (let hour = 8; hour < 18; hour++) {
        if (rng() < rate) {
          const n = 1 + Math.floor(rng() * 3)
          const from = day * INTERVALS_PER_DAY + hour * 4
          for (let i = from; i < from + 4; i++) occ[i] += n
        }
      }
    }

    // Clamp: a sensor can slightly overcount, but rooms have physical limits.
    for (let i = 0; i < total; i++) {
      if (occ[i] > room.capacity + 2) occ[i] = room.capacity + 2
    }

    // 3. Derive cumulative Terabee counters (count_in/count_out, daily 04:00 reset)
    //    and per-interval snapshots.
    let cumIn = 0
    let cumOut = 0
    let prevOcc = 0
    const batteryStart = 100 - rng() * 3
    for (let i = 0; i < total; i++) {
      const ts = start + i * INTERVAL_MS
      const d = new Date(ts)
      if (d.getUTCHours() === RESET_HOUR && d.getUTCMinutes() === 0) {
        cumIn = 0
        cumOut = 0
        prevOcc = 0
      }
      const delta = occ[i] - prevOcc
      if (delta > 0) cumIn += delta
      else cumOut -= delta
      prevOcc = occ[i]

      const iso = d.toISOString()
      readings.push({
        deviceId: room.deviceId,
        ts: iso,
        countIn: cumIn,
        countOut: cumOut,
        flags: 0,
        batteryPct: Math.round((batteryStart - 12 * (i / total) + (rng() - 0.5)) * 10) / 10,
        rssi: -70 + Math.round((rng() - 0.5) * 20),
        snr: Math.round((5 + rng() * 7) * 4) / 4,
        sourceId: TERABEE_SOURCE,
      })
      snapshots.push({
        roomId: room.roomId,
        ts: iso,
        occupancy: occ[i],
        utilizationPct: Math.round((1000 * occ[i]) / room.capacity) / 10,
        intervalMinutes: 15,
      })
    }
  }

  return {
    rooms: ROOMS,
    readings,
    snapshots,
    reservations,
    sources: buildSources(new Date(end).toISOString()),
  }
}
