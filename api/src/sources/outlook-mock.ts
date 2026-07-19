import type { Reservation } from '@roomsense/shared'
import { getTableClient, TABLE_NAMES } from '../lib/tables'
import type { SourceAdapter, PingResult, ReservationWindow } from './types'

/**
 * Outlook-mock SourceAdapter (wishlist #23).
 *
 * Pulls reservations from the `Reservations` Azure Table that the seed
 * generator populated. The seed's OUTLOOK_SOURCE id is reused so the
 * adapter lines up with the Sources table row.
 *
 * This is the proof-of-concept for the adapter seam: every method that
 * talks to "Outlook" goes through this object. Swapping in a real
 * Microsoft Graph adapter (#27) means writing a sibling file that
 * calls Graph instead of Table Storage — no other layer changes.
 *
 * Storage layout (matches packages/seed/src/upload.ts):
 *   PartitionKey = roomId
 *   RowKey       = `${startTicks}_${hash8(organizer+subject)}`
 * Rows for one room share a partition, so per-room queries are one
 * partition scan; cross-room windows enumerate all partitions.
 */

export const OUTLOOK_MOCK_SOURCE_ID = 'outlook-mock'

type ReservationEntity = Reservation & {
  partitionKey: string
  rowKey: string
}

async function* iterReservations(): AsyncIterable<ReservationEntity> {
  const client = getTableClient(TABLE_NAMES.reservations)
  for await (const row of client.listEntities<ReservationEntity>()) {
    yield row
  }
}

/** Half-open overlap predicate: [start, end) ∩ [from, to). */
function overlaps(startMs: number, endMs: number, w: ReservationWindow): boolean {
  return startMs < w.to.getTime() && endMs > w.from.getTime()
}

export const outlookMockAdapter: SourceAdapter = {
  sourceId: OUTLOOK_MOCK_SOURCE_ID,
  kind: 'calendar',
  displayName: 'Outlook rooms & reservations (mock)',

  async ping(): Promise<PingResult> {
    // Probe the Reservations table. Like the /health endpoint, this is
    // intentionally cheap and side-effect-free; a degraded store reports
    // 'inactive' rather than throwing. We track the most recent endTs
    // across the whole table as a stable "last sync" proxy for the mock;
    // real adapters would track their own sync timestamp.
    try {
      const client = getTableClient(TABLE_NAMES.reservations)
      let lastSyncTs: string | undefined
      for await (const row of client.listEntities<ReservationEntity>()) {
        if (!lastSyncTs || row.endTs > lastSyncTs) {
          lastSyncTs = row.endTs
        }
      }
      return { status: 'active', lastSyncTs }
    } catch {
      return { status: 'inactive' }
    }
  },

  async *listReservations(window: ReservationWindow): AsyncIterable<Reservation> {
    for await (const row of iterReservations()) {
      const startMs = Date.parse(row.startTs)
      const endMs = Date.parse(row.endTs)
      if (overlaps(startMs, endMs, window)) {
        // Strip storage metadata — callers see the public Reservation shape.
        yield {
          roomId: row.roomId,
          subject: row.subject,
          organizer: row.organizer,
          startTs: row.startTs,
          endTs: row.endTs,
          attendeeCount: row.attendeeCount,
          sourceId: row.sourceId,
        }
      }
    }
  },
}
