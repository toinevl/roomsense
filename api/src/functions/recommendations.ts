import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import type { UserBooking } from '@roomsense/shared'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { ensureTable, TABLE_NAMES } from '../lib/tables'
import { listRoomsWithOccupancy, type RoomForScoring } from './rooms'

/**
 * Phase 3 #38 — GET /api/recommendations?userId= → top 3 free rooms by
 * score. Weighting: repeat 50% + popularity 30% + distance 20% (see spec).
 */

const REPEAT_WEIGHT = 0.5
const POPULARITY_WEIGHT = 0.3
const DISTANCE_WEIGHT = 0.2
const NEUTRAL_DISTANCE = 0.6

export function scoreRoom(
  room: RoomForScoring,
  hasBookedBefore: boolean,
  lastBookingRoom: RoomForScoring | null,
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

export async function recommendationsHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = req.headers.get('origin') ?? undefined
  if (req.method === 'OPTIONS') return corsPreflightResponse(origin)

  try {
    const userId = req.query.get('userId')
    if (!userId) {
      return withCors({ status: 400, jsonBody: { error: 'Missing userId query parameter.' } }, origin)
    }

    const rooms = await listRoomsWithOccupancy()
    const freeRooms = rooms.filter((r) => r.occupancy === 0)

    const bookingsClient = await ensureTable(TABLE_NAMES.userBookings)
    const bookings: UserBooking[] = []
    for await (const e of bookingsClient.listEntities<UserBooking & { partitionKey: string; rowKey: string }>({
      queryOptions: { filter: `PartitionKey eq '${userId.replace(/'/g, "''")}'` },
    })) {
      const { partitionKey: _pk, rowKey: _rk, ...fields } = e
      bookings.push(fields)
    }

    const bookedRoomIds = new Set(bookings.map((b) => b.roomId))
    const sortedByTime = [...bookings].sort((a, b) => Date.parse(b.bookedAt) - Date.parse(a.bookedAt))
    const lastBookedRoomId = sortedByTime[0]?.roomId ?? null
    const lastBookingRoom = lastBookedRoomId
      ? (rooms.find((r) => r.roomId === lastBookedRoomId) ?? null)
      : null

    const scored = freeRooms
      .map((room) => ({ ...room, score: scoreRoom(room, bookedRoomIds.has(room.roomId), lastBookingRoom) }))
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.roomId.localeCompare(b.roomId)))

    const [hero, ...rest] = scored
    return withCors(
      { status: 200, jsonBody: { hero: hero ?? null, alternates: rest.slice(0, 2) } },
      origin,
    )
  } catch (err) {
    logError(ctx, 'recommendations handler failed', err)
    return withCors({ status: 500, jsonBody: { error: 'Internal server error.' } }, origin)
  }
}

app.http('recommendations', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'recommendations',
  handler: recommendationsHandler,
})
