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

export interface KpisResponse {
  avgUtilizationPct: number
  peakUtilizationPct: number
  ghostRatePct: number
  wastedEur: number
  busiestBuilding: string
  underusedRooms: UnderusedRoom[]
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
