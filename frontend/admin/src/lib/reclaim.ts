import type { Reservation, RoomWithOccupancy } from '../../../src/lib/apiTypes'
import type { RoomStatus } from './roomStatus'

/**
 * "Reclaim now" candidate selection — built entirely from data the Overview
 * page already fetched (per-room status + today's reservations), no extra
 * API calls. Each of the three slots is independent; a slot with no
 * qualifying room is simply omitted (rendered as an explicit empty state by
 * the page), never backfilled with a fabricated placeholder.
 */

export type ReclaimCandidateKind = 'ghost' | 'oversized' | 'offline'

export interface GhostCandidate {
  kind: 'ghost'
  room: RoomWithOccupancy
  reservation: Reservation
  /** False when this is a past-ghost fallback (no room is ghosting *right now*) —
   *  the reservation has already ended, so "release" makes no sense; only
   *  "notify owner" is offered, and the copy is written in the past tense. */
  isCurrentlyActive: boolean
}

export interface OversizedCandidate {
  kind: 'oversized'
  room: RoomWithOccupancy
  reservation: Reservation
  suggestedRoom: RoomWithOccupancy | null
}

export interface OfflineCandidate {
  kind: 'offline'
  room: RoomWithOccupancy
}

export type ReclaimCandidate = GhostCandidate | OversizedCandidate | OfflineCandidate

/** A ghost reservation found outside "right now" (e.g. earlier today), used as the
 *  ghost slot's fallback when no room is *currently* ghosting. */
export interface PastGhostReservation {
  room: RoomWithOccupancy
  reservation: Reservation
}

const OVERSIZED_ATTENDEE_RATIO = 0.3

export function pickGhostCandidate(
  rooms: RoomWithOccupancy[],
  statuses: Map<string, RoomStatus>,
  pastGhosts: PastGhostReservation[],
): GhostCandidate | null {
  let best: GhostCandidate | null = null
  for (const room of rooms) {
    const status = statuses.get(room.roomId)
    if (status?.status !== 'ghost' || !status.activeReservation) continue
    if (!best || status.activeReservation.attendeeCount > best.reservation.attendeeCount) {
      best = { kind: 'ghost', room, reservation: status.activeReservation, isCurrentlyActive: true }
    }
  }
  if (best) return best

  const mostRecent = [...pastGhosts].sort(
    (a, b) => Date.parse(b.reservation.startTs) - Date.parse(a.reservation.startTs),
  )[0]
  return mostRecent
    ? { kind: 'ghost', room: mostRecent.room, reservation: mostRecent.reservation, isCurrentlyActive: false }
    : null
}

export function pickOversizedCandidate(
  rooms: RoomWithOccupancy[],
  statuses: Map<string, RoomStatus>,
): OversizedCandidate | null {
  let best: OversizedCandidate | null = null
  let bestGap = -1
  for (const room of rooms) {
    const status = statuses.get(room.roomId)
    const reservation = status?.activeReservation
    if (!reservation) continue
    if (reservation.attendeeCount > OVERSIZED_ATTENDEE_RATIO * room.capacity) continue
    const gap = room.capacity - reservation.attendeeCount
    if (gap <= bestGap) continue
    const suggestedRoom = pickSuggestedRoom(rooms, room, reservation.attendeeCount)
    best = { kind: 'oversized', room, reservation, suggestedRoom }
    bestGap = gap
  }
  return best
}

function pickSuggestedRoom(
  rooms: RoomWithOccupancy[],
  currentRoom: RoomWithOccupancy,
  attendeeCount: number,
): RoomWithOccupancy | null {
  const candidates = rooms.filter((r) => r.roomId !== currentRoom.roomId && r.capacity >= attendeeCount)
  if (candidates.length === 0) return null
  candidates.sort((a, b) => {
    if (a.capacity !== b.capacity) return a.capacity - b.capacity
    const aSame = a.building === currentRoom.building ? 0 : 1
    const bSame = b.building === currentRoom.building ? 0 : 1
    return aSame - bSame
  })
  return candidates[0] ?? null
}

export function pickOfflineCandidate(
  rooms: RoomWithOccupancy[],
  statuses: Map<string, RoomStatus>,
): OfflineCandidate | null {
  let best: OfflineCandidate | null = null
  for (const room of rooms) {
    const status = statuses.get(room.roomId)
    if (status?.status !== 'offline') continue
    if (!best || Date.parse(room.lastSeenTs) < Date.parse(best.room.lastSeenTs)) {
      best = { kind: 'offline', room }
    }
  }
  return best
}

export interface ReclaimSlots {
  ghost: GhostCandidate | null
  oversized: OversizedCandidate | null
  offline: OfflineCandidate | null
}

/** Always returns all three slots (nullable) rather than a filtered list, so the
 *  panel can render a fixed three-slot layout with an explicit empty state per
 *  slot instead of a variable-length list. */
export function buildReclaimSlots(
  rooms: RoomWithOccupancy[],
  statuses: Map<string, RoomStatus>,
  pastGhosts: PastGhostReservation[],
): ReclaimSlots {
  return {
    ghost: pickGhostCandidate(rooms, statuses, pastGhosts),
    oversized: pickOversizedCandidate(rooms, statuses),
    offline: pickOfflineCandidate(rooms, statuses),
  }
}
