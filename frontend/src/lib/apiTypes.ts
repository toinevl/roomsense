import type { OccupancySnapshot, Reservation, Room, SensorReading } from '@roomsense/shared'

/**
 * Response shapes for the frozen API contract (wishlist.md, "API contract for
 * #5-#12"). Lane A (API) builds against the same contract independently —
 * these types are the frontend's copy of that agreement, not re-exports of
 * anything Lane A owns.
 */

export interface HealthResponse {
  status: 'ok'
  buildSha: string
  tables: boolean
}

export type RoomWithOccupancy = Room & {
  occupancy: number
  utilizationPct: number
  lastSeenTs: string
}

export interface UnderusedRoom {
  roomId: string
  name: string
  utilizationPct: number
}

export interface RoomBreakdownEntry {
  roomId: string
  name: string
  building: string
  capacity: number
  avgBookedOccupancy: number
}

export interface KpisResponse {
  avgUtilizationPct: number
  peakUtilizationPct: number
  ghostRatePct: number
  wastedHours: number
  wastedEur: number
  busiestBuilding: string
  underusedRooms: UnderusedRoom[]
  totalCapacity: number
  peakConcurrentOccupancy: number
  roomBreakdown: RoomBreakdownEntry[]
}

export interface SourceStatus {
  sourceId: string
  kind: string
  displayName: string
  status: 'active' | 'inactive'
  lastSyncTs?: string
}

export interface SimulateTickResponse {
  appended: number
  ts: string
}

export interface OccupancyQuery {
  from?: string
  to?: string
}

export interface ReadingsQuery {
  limit?: number
}

export interface ReservationsQuery {
  date?: string
}

export interface KpisQuery {
  from?: string
  to?: string
}

/** Re-exported for convenience so callers only need one import. */
export type { OccupancySnapshot, Reservation, Room, SensorReading }

// ─── Social Feature Types (Phase 2, #37) ───

export interface FriendLink {
  userId: string
  friendId: string
  friendName: string
  status: 'active' | 'pending'
  canSeeLive: boolean
  connectedAt: string
}

export interface UserPresence {
  userId: string
  displayName: string
  building: string
  roomId?: string
  status: 'available' | 'busy' | 'offline'
  lastSeenTs: string
}

export interface RoomReview {
  reviewId: string
  roomId: string
  authorId: string
  authorName: string
  rating: number
  title: string
  body: string
  tags: string[]
  helpfulCount: number
  status: 'active' | 'flagged' | 'deleted'
  createdAt: string
  updatedAt: string
}

export interface PrivacySettings {
  userId: string
  locationSharingEnabled: boolean
  friendVisibility: 'friends-only' | 'campus' | 'public'
  reviewAttributionDefault: 'anonymous' | 'named'
  dataRetentionDays: number
  lastUpdated: string
}

// ─── Gamification Types (Phase 3, #38) ───

export interface RecommendedRoom extends RoomWithOccupancy {
  score: number
}

export interface RecommendationsResponse {
  hero: RecommendedRoom | null
  alternates: RecommendedRoom[]
}

export interface OccupancyPredictionResponse {
  roomId: string
  now: { occupancy: number }
  plus30m: { occupancy: number }
  plus60m: { occupancy: number }
}

export interface StreakResponse {
  userId: string
  currentStreakDays: number
  longestStreakDays: number
  totalBookings: number
}

export interface UnlockInfo {
  threshold: number
  label: string
  unlocked: boolean
}

// ─── Scheduling health (#64) ───
// Types for GET /api/rooms/scheduling-health. This endpoint's response
// lives here rather than packages/shared, same precedent as the
// gamification types above (#38) — packages/shared is frozen post-Phase-0.

export interface RoomSchedulingHealth {
  roomId: string
  name: string
  building: string
  /** % of this room's reservation-hours in range that were ghosts. */
  ghostRatePct: number
  /** % of this room's reservations (by count) where attendeeCount <= 0.3 * capacity. */
  oversizedRatePct: number
  /** Mean of snapshot utilizationPct for this room in range. */
  utilizationPct: number
}

export interface SchedulingHealthResponse {
  rooms: RoomSchedulingHealth[]
}

// ─── Cleaning savings (#65) ───
// Types for GET /api/rooms/cleaning-savings. This endpoint's response lives
// here rather than packages/shared, same precedent as the gamification
// types above (#38) — packages/shared is frozen post-Phase-0.

export interface CleaningSavingsRoomEntry {
  roomId: string
  name: string
  /** Fixed-daily-schedule comparison point: 1 clean/room/day in the window. */
  baselineCleans: number
  /** Simulated interval-OR-threshold policy cleans over the window. */
  policyCleans: number
  cleansAvoided: number
  eurSaved: number
}

export interface CleaningSavingsTotals {
  baselineCleans: number
  policyCleans: number
  cleansAvoided: number
  eurSaved: number
}

export interface CleaningSavingsResponse {
  rooms: CleaningSavingsRoomEntry[]
  totals: CleaningSavingsTotals
}
