import type { OccupancySnapshot, Reservation, RoomWithOccupancy } from '../../../src/lib/apiTypes'

/**
 * Per-room lifecycle status for the admin Overview + Rooms pages. Shared by
 * both so status/text derivation only happens once per room per mount.
 *
 * Ghost derivation mirrors the existing convention (dashboard.ts's
 * loadBookedVsUsed, live.ts's loadReservationsOverlay): a reservation is a
 * ghost when the max measured occupancy during its time window is 0. Never
 * a stored flag — see CLAUDE.md.
 */
export type RoomLifecycleStatus = 'free' | 'in-use' | 'ghost' | 'offline'

export interface RoomStatus {
  roomId: string
  status: RoomLifecycleStatus
  activeReservation: Reservation | null
  /** e.g. "until 15:00", "for the rest of today", "Until 14:30", "— not booked". Deliberately
   *  does not restate the status word — the caller renders `${STATUS_LABEL} · ${untilText}`,
   *  so a leading "Free"/"In use" here would double up (#60). */
  untilText: string
  /** e.g. "0 people" or "6 people · 8 booked". Never includes a CO2 figure — no such field in the schema. */
  footerText: string
}

export interface RoomStatusInput {
  room: RoomWithOccupancy
  /** Anchor "now" for the whole admin view — never Date.now(), see roomFreshness.ts. */
  referenceTs: string
  /** This room's reservations for referenceTs's UTC date. */
  reservationsToday: Reservation[]
  /** Occupancy snapshots covering at least the window an active reservation could have started in. */
  recentOccupancy: OccupancySnapshot[]
}

export const OFFLINE_THRESHOLD_MS = 60 * 60 * 1000

const hourMinuteFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
})

function hourMinuteUtc(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return hourMinuteFormatter.format(d)
}

export function maxOccupancyDuring(occupancy: OccupancySnapshot[], startMs: number, endMs: number): number {
  let peak = 0
  for (const snap of occupancy) {
    const ts = Date.parse(snap.ts)
    if (ts < startMs || ts > endMs) continue
    if (snap.occupancy > peak) peak = snap.occupancy
  }
  return peak
}

function findActiveReservation(reservations: Reservation[], referenceMs: number): Reservation | null {
  return (
    reservations.find((r) => Date.parse(r.startTs) <= referenceMs && referenceMs < Date.parse(r.endTs)) ?? null
  )
}

function findNextReservation(reservations: Reservation[], referenceMs: number): Reservation | null {
  const upcoming = reservations
    .filter((r) => Date.parse(r.startTs) > referenceMs)
    .sort((a, b) => Date.parse(a.startTs) - Date.parse(b.startTs))
  return upcoming[0] ?? null
}

export function computeRoomStatus(input: RoomStatusInput): RoomStatus {
  const { room, referenceTs, reservationsToday, recentOccupancy } = input
  const referenceMs = Date.parse(referenceTs)
  const roomId = room.roomId

  const isOffline = referenceMs - Date.parse(room.lastSeenTs) > OFFLINE_THRESHOLD_MS
  if (isOffline) {
    return {
      roomId,
      status: 'offline',
      activeReservation: null,
      untilText: `Sensor offline since ${hourMinuteUtc(room.lastSeenTs)}`,
      footerText: `${room.occupancy} people · no data`,
    }
  }

  const activeReservation = findActiveReservation(reservationsToday, referenceMs)

  if (activeReservation) {
    const startMs = Math.max(Date.parse(activeReservation.startTs), referenceMs - OFFLINE_THRESHOLD_MS * 4)
    const maxOcc = maxOccupancyDuring(recentOccupancy, startMs, referenceMs)
    const status: RoomLifecycleStatus = maxOcc === 0 ? 'ghost' : 'in-use'
    return {
      roomId,
      status,
      activeReservation,
      untilText: `Until ${hourMinuteUtc(activeReservation.endTs)}`,
      footerText: `${room.occupancy} people · ${activeReservation.attendeeCount} booked`,
    }
  }

  if (room.occupancy > 0) {
    return {
      roomId,
      status: 'in-use',
      activeReservation: null,
      untilText: '— not booked',
      footerText: `${room.occupancy} people`,
    }
  }

  const next = findNextReservation(reservationsToday, referenceMs)
  return {
    roomId,
    status: 'free',
    activeReservation: null,
    untilText: next ? `until ${hourMinuteUtc(next.startTs)}` : 'for the rest of today',
    footerText: `${room.occupancy} people`,
  }
}

/** Minutes until this free room's next booking, or Infinity if none today. Used by the
 *  "Free right now" KPI tile's 45+-minute sub-copy. */
export function minutesUntilNextBooking(
  reservationsToday: Reservation[],
  referenceTs: string,
): number {
  const referenceMs = Date.parse(referenceTs)
  const next = findNextReservation(reservationsToday, referenceMs)
  if (!next) return Infinity
  return (Date.parse(next.startTs) - referenceMs) / 60_000
}
