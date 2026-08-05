import type {
  OccupancyPredictionResponse,
  RecommendationsResponse,
  RoomWithOccupancy,
  StreakResponse,
  UnlockInfo,
} from './apiTypes'

/**
 * Mock fixtures + derivation for the gamification features (Phase 3, #38).
 * Mirrors the backend's algorithm (see api/src/functions/recommendations.ts,
 * bookings.ts) independently — this codebase's established convention for
 * mock-vs-live logic (see roomStatus.ts's ghost-derivation docblock).
 */

interface MockBooking {
  userId: string
  roomId: string
  bookedAt: string
}

let MOCK_BOOKINGS: MockBooking[] = [
  { userId: 'user-1', roomId: 'atlas-0.710', bookedAt: '2026-07-30T09:00:00.000Z' },
]

export function __resetMockGamification(): void {
  MOCK_BOOKINGS = [{ userId: 'user-1', roomId: 'atlas-0.710', bookedAt: '2026-07-30T09:00:00.000Z' }]
}

export async function addMockBooking(userId: string, roomId: string, bookedAt: string): Promise<void> {
  MOCK_BOOKINGS.push({ userId, roomId, bookedAt })
}

const REPEAT_WEIGHT = 0.5
const POPULARITY_WEIGHT = 0.3
const DISTANCE_WEIGHT = 0.2
const NEUTRAL_DISTANCE = 0.6

function scoreRoom(
  room: RoomWithOccupancy,
  hasBookedBefore: boolean,
  lastBookingRoom: RoomWithOccupancy | null,
): number {
  const repeatScore = hasBookedBefore ? 1 : 0
  const popularityScore = room.utilizationPct / 100
  const distanceScore = !lastBookingRoom
    ? NEUTRAL_DISTANCE
    : room.building !== lastBookingRoom.building
      ? 0.2
      : room.floor !== lastBookingRoom.floor
        ? 0.6
        : 1.0
  return REPEAT_WEIGHT * repeatScore + POPULARITY_WEIGHT * popularityScore + DISTANCE_WEIGHT * distanceScore
}

export async function getMockRecommendations(
  allRooms: RoomWithOccupancy[],
  userId: string,
  _now: string,
): Promise<RecommendationsResponse> {
  const userBookings = MOCK_BOOKINGS.filter((b) => b.userId === userId)
  const bookedRoomIds = new Set(userBookings.map((b) => b.roomId))
  const sorted = [...userBookings].sort((a, b) => Date.parse(b.bookedAt) - Date.parse(a.bookedAt))
  const lastRoomId = sorted[0]?.roomId ?? null
  const lastBookingRoom = lastRoomId ? (allRooms.find((r) => r.roomId === lastRoomId) ?? null) : null

  const scored = allRooms
    .filter((r) => r.occupancy === 0)
    .map((room) => ({ ...room, score: scoreRoom(room, bookedRoomIds.has(room.roomId), lastBookingRoom) }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.roomId.localeCompare(b.roomId)))

  const [hero, ...rest] = scored
  return { hero: hero ?? null, alternates: rest.slice(0, 2) }
}

function utcDateOnly(iso: string): string {
  return iso.slice(0, 10)
}
function isWeekend(dateOnly: string): boolean {
  const day = new Date(`${dateOnly}T00:00:00.000Z`).getUTCDay()
  return day === 0 || day === 6
}
function previousDateOnly(dateOnly: string): string {
  return new Date(Date.parse(`${dateOnly}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10)
}

function deriveMockStreak(bookings: MockBooking[], referenceTs: string): number {
  const bookedDates = new Set(bookings.map((b) => utcDateOnly(b.bookedAt)))
  let cursor = utcDateOnly(referenceTs)
  let streak = 0
  let isFirstDay = true
  while (true) {
    if (isWeekend(cursor)) {
      cursor = previousDateOnly(cursor)
      isFirstDay = false
      continue
    }
    if (bookedDates.has(cursor)) {
      streak += 1
      cursor = previousDateOnly(cursor)
      isFirstDay = false
      continue
    }
    if (isFirstDay) {
      cursor = previousDateOnly(cursor)
      isFirstDay = false
      continue
    }
    break
  }
  return streak
}

export async function getMockStreak(userId: string, now: string): Promise<StreakResponse> {
  const bookings = MOCK_BOOKINGS.filter((b) => b.userId === userId)
  return {
    userId,
    currentStreakDays: deriveMockStreak(bookings, now),
    longestStreakDays: deriveMockStreak(bookings, now),
    totalBookings: bookings.length,
  }
}

const UNLOCK_THRESHOLDS: Array<{ threshold: number; label: string }> = [
  { threshold: 3, label: 'Early access to RoomSense Wrapped' },
  { threshold: 7, label: '"Regular" badge on your reviews' },
  { threshold: 14, label: 'Shoutout on the Trust page' },
]

export async function getMockUnlocks(userId: string, now: string): Promise<UnlockInfo[]> {
  const streak = await getMockStreak(userId, now)
  return UNLOCK_THRESHOLDS.map((u) => ({ ...u, unlocked: streak.currentStreakDays >= u.threshold }))
}

export async function getMockOccupancyPrediction(
  roomId: string,
  _now: string,
): Promise<OccupancyPredictionResponse> {
  // Deterministic, plausible-looking mock — no snapshot table available
  // client-side; a small fixed pattern is enough for a demo/mock surface.
  return {
    roomId,
    now: { occupancy: 2 },
    plus30m: { occupancy: 3 },
    plus60m: { occupancy: 1 },
  }
}
