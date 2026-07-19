import type { Reservation } from '@roomsense/shared'

/**
 * SourceAdapter — the adapter seam (wishlist #23).
 *
 * Every data source (Terabee IoT Hub, Outlook calendars, real Graph,
 * future IoT Hub ingestion) implements this contract. The API layer
 * reads from adapters, never from storage directly — adding a source
 * means dropping a new file in src/sources/ and registering it in
 * registry.ts. No API endpoint changes.
 *
 * Why `kind`:
 *   - 'sensor' sources produce occupancy telemetry (SensorReadings).
 *   - 'calendar' sources produce Reservations.
 * The shape difference is why listReservations is optional: sensors
 * legitimately have no calendar data.
 */

export type SourceKind = 'sensor' | 'calendar'
export type SourceStatus = 'active' | 'inactive'

export interface PingResult {
  status: SourceStatus
  /** ISO 8601 of last successful sync, if the adapter tracks one. */
  lastSyncTs?: string
}

export interface ReservationWindow {
  /** inclusive */
  from: Date
  /** exclusive */
  to: Date
}

export interface SourceAdapter {
  /** Stable identifier matching Source.sourceId in storage. */
  readonly sourceId: string
  readonly kind: SourceKind
  readonly displayName: string

  /**
   * Cheap liveness probe — must not throw. The /api/sources endpoint
   * calls this for every registered adapter on each request.
   */
  ping(): Promise<PingResult>

  /**
   * Calendar-source hook: yield reservations whose [startTs, endTs)
   * overlaps [from, to). Sensor sources omit this method.
   */
  listReservations?(window: ReservationWindow): AsyncIterable<Reservation>
}
