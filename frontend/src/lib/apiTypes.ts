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
