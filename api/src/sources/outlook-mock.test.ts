import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Reservation } from '@roomsense/shared'

/**
 * Outlook-mock adapter tests (wishlist #23).
 *
 * Tables are mocked hermetically: the adapter's ping/listReservations
 * see only the entities we stub here. Two failure modes are tested
 * explicitly: empty table (active, no lastSyncTs) and storage throw
 * (inactive, no throw out of ping).
 */

const MOCK_RESERVATIONS: Reservation[] = [
  {
    roomId: 'atlas-2-210',
    subject: 'Sprint review',
    organizer: 'Jörgen Månsson',
    startTs: '2026-07-19T09:00:00.000Z',
    endTs: '2026-07-19T09:30:00.000Z',
    attendeeCount: 6,
    sourceId: 'outlook-mock',
  },
  {
    roomId: 'atlas-2-215',
    subject: 'Kwartaalreview',
    organizer: 'Anaïs Dubois',
    startTs: '2026-07-20T14:00:00.000Z',
    endTs: '2026-07-20T15:00:00.000Z',
    attendeeCount: 10,
    sourceId: 'outlook-mock',
  },
]

function makeEntityIterator(rows: Reservation[]) {
  return {
    listEntities: () => ({
      byPage: () =>
        (async function* () {
          // Reservations table is keyed by roomId — rows come back with
          // partitionKey/rowKey attached. ping() reads the first row's endTs.
          yield rows.map((r) => ({ ...r, partitionKey: r.roomId, rowKey: 'k' }))
        })(),
      [Symbol.asyncIterator]: async function* () {
        for (const r of rows) yield { ...r, partitionKey: r.roomId, rowKey: 'k' }
      },
    }),
  }
}

vi.mock('../lib/tables', () => ({
  getTableClient: vi.fn(),
  TABLE_NAMES: { rooms: 'Rooms', readings: 'SensorReadings', snapshots: 'OccupancySnapshots', reservations: 'Reservations', sources: 'Sources' },
}))

import { outlookMockAdapter, OUTLOOK_MOCK_SOURCE_ID } from './outlook-mock'
import { getTableClient } from '../lib/tables'

function setRows(rows: Reservation[]) {
  ;(getTableClient as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
    makeEntityIterator(rows),
  )
}

describe('outlook-mock adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes the seeded sourceId and calendar kind', () => {
    expect(outlookMockAdapter.sourceId).toBe(OUTLOOK_MOCK_SOURCE_ID)
    expect(outlookMockAdapter.sourceId).toBe('outlook-mock')
    expect(outlookMockAdapter.kind).toBe('calendar')
    expect(outlookMockAdapter.displayName).toMatch(/Outlook/i)
  })

  it('ping returns active with lastSyncTs when rows exist', async () => {
    setRows(MOCK_RESERVATIONS)
    const result = await outlookMockAdapter.ping()
    expect(result.status).toBe('active')
    expect(result.lastSyncTs).toBe('2026-07-20T15:00:00.000Z')
  })

  it('ping returns inactive when storage throws (never throws out)', async () => {
    ;(getTableClient as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      listEntities: () => ({
        byPage: () => {
          throw new Error('storage unavailable')
        },
      }),
    })
    const result = await outlookMockAdapter.ping()
    expect(result.status).toBe('inactive')
    expect(result.lastSyncTs).toBeUndefined()
  })

  it('listReservations yields only reservations overlapping the window', async () => {
    setRows(MOCK_RESERVATIONS)
    const collected: Reservation[] = []
    const window = { from: new Date('2026-07-19T00:00:00Z'), to: new Date('2026-07-19T23:59:59Z') }
    for await (const r of outlookMockAdapter.listReservations!(window)) {
      collected.push(r)
    }
    expect(collected).toHaveLength(1)
    expect(collected[0].subject).toBe('Sprint review')
  })

  it('listReservations strips storage metadata (no partitionKey/rowKey on output)', async () => {
    setRows(MOCK_RESERVATIONS)
    const window = { from: new Date('2026-07-19T00:00:00Z'), to: new Date('2026-07-21T00:00:00Z') }
    for await (const r of outlookMockAdapter.listReservations!(window)) {
      expect(r).not.toHaveProperty('partitionKey')
      expect(r).not.toHaveProperty('rowKey')
    }
  })
})
