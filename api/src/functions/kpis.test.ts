import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'

/**
 * kpis.ts unit tests (#11).
 *
 * Mock pattern copied from occupancy.test.ts / rooms.test.ts: the vi.mock
 * factory reads fixture state LAZILY from globalThis on every getTableClient
 * call, so setState() in beforeEach gives each test a fresh fixture set.
 * (A factory that closes over module-level arrays makes setState a no-op —
 * standing Wave-2 lesson.)
 *
 * The handler full-scans each table and filters in memory, so the mock simply
 * returns the whole per-table fixture without parsing OData filters.
 *
 * Fixture (hand-computed expected KPIs, window 2026-07-19T10:00→11:00Z):
 *   3 rooms:  atlas-2-210 (atlas, cap 8,  "Vergaderzaal Höganäs")
 *             atlas-2-215 (atlas, cap 12, "Zaal Curaçao")          ← non-ASCII
 *             flux-2-207  (flux,  cap 2,  "Focus Booth Åse")
 *   6 snapshots:
 *     atlas-2-210: 10:00 occ=4 (50%), 10:15 occ=8 (100%), 10:30 occ=6 (75%)
 *     atlas-2-215: 10:00 occ=0 (0%),   10:30 occ=6 (50%)
 *     flux-2-207:  10:00 occ=2 (100%)
 *   4 reservations (1 ghost):
 *     A atlas-2-210 10:00→10:30  slot max occ = max(4,8) = 8   → normal
 *     B atlas-2-215 10:00→10:15  slot max occ = 0              → GHOST
 *     C atlas-2-215 10:30→11:00  slot max occ = 6              → normal
 *     D flux-2-207  10:00→11:00  slot max occ = 2              → normal
 *
 * Expected:
 *   avgUtilizationPct  = (50+100+75+0+50+100)/6 = 62.5
 *   peakUtilizationPct = 100
 *   ghostRatePct       = 0.25 / 2.25 * 100 = 11.11
 *   wastedEur          = 0.25 * 12 * 4 = 12
 *   busiestBuilding    = "flux"   (atlas pooled avg=55, flux avg=100)
 *   underusedRooms     = [atlas-2-215(25), atlas-2-210(75), flux-2-207(100)]
 */

vi.mock('../lib/tables', () => {
  return {
    TABLE_NAMES: {
      rooms: 'Rooms',
      readings: 'SensorReadings',
      snapshots: 'OccupancySnapshots',
      reservations: 'Reservations',
      sources: 'Sources',
    },
    getTableClient: (name: string) => {
      function listEntities(): {
        [Symbol.asyncIterator](): {
          next: () => Promise<IteratorResult<any>>
        }
      } {
        // Read lazily on every call — setState() must take effect per-test.
        let rows: any[] = []
        if (name === 'Rooms') {
          rows = (globalThis as any).__KPI_ROOMS_STATE__ ?? []
        } else if (name === 'OccupancySnapshots') {
          rows = (globalThis as any).__KPI_SNAPSHOTS_STATE__ ?? []
        } else if (name === 'Reservations') {
          rows = (globalThis as any).__KPI_RESERVATIONS_STATE__ ?? []
        }
        return {
          [Symbol.asyncIterator]() {
            let i = 0
            return {
              next: async () =>
                i < rows.length
                  ? { value: rows[i++], done: false }
                  : { value: undefined, done: true },
            }
          },
        }
      }
      return { listEntities }
    },
  }
})

const { kpisHandler } = await import('./kpis')

// ---- Fixtures ----------------------------------------------------------------

const ROOMS_FIXTURE = [
  {
    partitionKey: 'atlas',
    rowKey: 'atlas-2-210',
    roomId: 'atlas-2-210',
    building: 'atlas',
    floor: 2,
    name: 'Vergaderzaal Höganäs',
    capacity: 8,
    deviceId: 'TB-1',
    outlookAddress: 'atlas-2-210@rooms.demo',
    sourceId: 'terabee',
  },
  {
    partitionKey: 'atlas',
    rowKey: 'atlas-2-215',
    roomId: 'atlas-2-215',
    building: 'atlas',
    floor: 2,
    name: 'Zaal Curaçao',
    capacity: 12,
    deviceId: 'TB-2',
    outlookAddress: 'atlas-2-215@rooms.demo',
    sourceId: 'terabee',
  },
  {
    partitionKey: 'flux',
    rowKey: 'flux-2-207',
    roomId: 'flux-2-207',
    building: 'flux',
    floor: 2,
    name: 'Focus Booth Åse',
    capacity: 2,
    deviceId: 'TB-9',
    outlookAddress: 'flux-2-207@rooms.demo',
    sourceId: 'terabee',
  },
]

const SNAPSHOTS_FIXTURE = [
  // atlas-2-210 (cap 8)
  { partitionKey: 'atlas-2-210', rowKey: 'rk-a1', roomId: 'atlas-2-210', ts: '2026-07-19T10:00:00.000Z', occupancy: 4, utilizationPct: 50, intervalMinutes: 15 },
  { partitionKey: 'atlas-2-210', rowKey: 'rk-a2', roomId: 'atlas-2-210', ts: '2026-07-19T10:15:00.000Z', occupancy: 8, utilizationPct: 100, intervalMinutes: 15 },
  { partitionKey: 'atlas-2-210', rowKey: 'rk-a3', roomId: 'atlas-2-210', ts: '2026-07-19T10:30:00.000Z', occupancy: 6, utilizationPct: 75, intervalMinutes: 15 },
  // atlas-2-215 (cap 12)
  { partitionKey: 'atlas-2-215', rowKey: 'rk-b1', roomId: 'atlas-2-215', ts: '2026-07-19T10:00:00.000Z', occupancy: 0, utilizationPct: 0, intervalMinutes: 15 },
  { partitionKey: 'atlas-2-215', rowKey: 'rk-b2', roomId: 'atlas-2-215', ts: '2026-07-19T10:30:00.000Z', occupancy: 6, utilizationPct: 50, intervalMinutes: 15 },
  // flux-2-207 (cap 2)
  { partitionKey: 'flux-2-207', rowKey: 'rk-c1', roomId: 'flux-2-207', ts: '2026-07-19T10:00:00.000Z', occupancy: 2, utilizationPct: 100, intervalMinutes: 15 },
]

const RESERVATIONS_FIXTURE = [
  // A — normal (slot max occ = 8)
  { partitionKey: 'atlas-2-210', rowKey: 'rk-ra', roomId: 'atlas-2-210', subject: 'Sprint review', organizer: 'Anaïs Dubois', startTs: '2026-07-19T10:00:00.000Z', endTs: '2026-07-19T10:30:00.000Z', attendeeCount: 5, sourceId: 'outlook-mock' },
  // B — GHOST (slot max occ = 0)
  { partitionKey: 'atlas-2-215', rowKey: 'rk-rb', roomId: 'atlas-2-215', subject: 'Empty sync', organizer: 'Bram Willems', startTs: '2026-07-19T10:00:00.000Z', endTs: '2026-07-19T10:15:00.000Z', attendeeCount: 3, sourceId: 'outlook-mock' },
  // C — normal (slot max occ = 6)
  { partitionKey: 'atlas-2-215', rowKey: 'rk-rc', roomId: 'atlas-2-215', subject: 'Design critique', organizer: 'Sanne de Vries', startTs: '2026-07-19T10:30:00.000Z', endTs: '2026-07-19T11:00:00.000Z', attendeeCount: 6, sourceId: 'outlook-mock' },
  // D — normal (slot max occ = 2)
  { partitionKey: 'flux-2-207', rowKey: 'rk-rd', roomId: 'flux-2-207', subject: 'Focus block', organizer: 'Åsa Lindqvist', startTs: '2026-07-19T10:00:00.000Z', endTs: '2026-07-19T11:00:00.000Z', attendeeCount: 1, sourceId: 'outlook-mock' },
]

function setState(rooms: any[], snapshots: any[], reservations: any[]) {
  ;(globalThis as any).__KPI_ROOMS_STATE__ = rooms
  ;(globalThis as any).__KPI_SNAPSHOTS_STATE__ = snapshots
  ;(globalThis as any).__KPI_RESERVATIONS_STATE__ = reservations
}

function buildRequest(
  method: string,
  opts: { from?: string; to?: string; origin?: string } = {},
): HttpRequest {
  const headers = new Headers()
  if (opts.origin) headers.set('origin', opts.origin)
  const query = new URLSearchParams()
  if (opts.from !== undefined) query.set('from', opts.from)
  if (opts.to !== undefined) query.set('to', opts.to)
  return {
    method,
    headers,
    query,
    params: {},
  } as unknown as HttpRequest
}

const FROM = '2026-07-19T10:00:00.000Z'
const TO = '2026-07-19T11:00:00.000Z'

describe('GET /api/kpis', () => {
  let ctx: InvocationContext

  beforeEach(() => {
    ctx = { error: vi.fn(), log: vi.fn() } as unknown as InvocationContext
    setState(ROOMS_FIXTURE, SNAPSHOTS_FIXTURE, RESERVATIONS_FIXTURE)
    // Deterministic cost-per-desk-hour; default is 4 but pin it explicitly.
    process.env.COST_PER_DESK_HOUR_EUR = '4'
  })

  it('a) 200 — avgUtilizationPct = mean of utilizationPct across all 6 snapshots = 62.5', async () => {
    const res = await kpisHandler(buildRequest('GET', { from: FROM, to: TO }), ctx)
    expect(res.status).toBe(200)
    const body = res.jsonBody as any
    // (50 + 100 + 75 + 0 + 50 + 100) / 6 = 375 / 6 = 62.5
    expect(body.avgUtilizationPct).toBe(62.5)
  })

  it('b) peakUtilizationPct = max(occ/cap*100) = 100', async () => {
    const res = await kpisHandler(buildRequest('GET', { from: FROM, to: TO }), ctx)
    const body = res.jsonBody as any
    // 8/8=100, 2/2=100 → peak = 100
    expect(body.peakUtilizationPct).toBe(100)
  })

  it('c) ghostRatePct = ghostHours(0.25) / totalHours(2.25) * 100 = 11.11', async () => {
    const res = await kpisHandler(buildRequest('GET', { from: FROM, to: TO }), ctx)
    const body = res.jsonBody as any
    expect(body.ghostRatePct).toBe(11.11)
  })

  it('d) wastedEur = ghostHours(0.25) * capacity(12) * COST(4) = 12', async () => {
    const res = await kpisHandler(buildRequest('GET', { from: FROM, to: TO }), ctx)
    const body = res.jsonBody as any
    expect(body.wastedEur).toBe(12)
  })

  it('e) busiestBuilding = "flux" (flux avg 100 > atlas avg 55)', async () => {
    const res = await kpisHandler(buildRequest('GET', { from: FROM, to: TO }), ctx)
    const body = res.jsonBody as any
    expect(body.busiestBuilding).toBe('flux')
  })

  it('f) underusedRooms = 3 rooms, lowest-util first (length <= 5)', async () => {
    const res = await kpisHandler(buildRequest('GET', { from: FROM, to: TO }), ctx)
    const body = res.jsonBody as any
    const list = body.underusedRooms as any[]
    expect(list.length).toBeLessThanOrEqual(5)
    expect(list).toHaveLength(3)
    // Sorted ascending by avg utilization.
    expect(list.map((r) => r.roomId)).toEqual([
      'atlas-2-215', // avg (0+50)/2 = 25
      'atlas-2-210', // avg (50+100+75)/3 = 75
      'flux-2-207', // avg 100
    ])
    // Utilizations ascending.
    const utils = list.map((r) => r.utilizationPct)
    expect(utils).toEqual([25, 75, 100])
  })

  it('g) 400 when `from` is missing', async () => {
    const res = await kpisHandler(
      buildRequest('GET', { to: TO }),
      ctx,
    )
    expect(res.status).toBe(400)
  })

  it('h) 400 when from >= to', async () => {
    const res = await kpisHandler(
      buildRequest('GET', {
        from: '2026-07-19T12:00:00.000Z',
        to: '2026-07-19T11:00:00.000Z',
      }),
      ctx,
    )
    expect(res.status).toBe(400)
  })

  it('i) non-ASCII name "Zaal Curaçao" preserved in underusedRooms', async () => {
    const res = await kpisHandler(buildRequest('GET', { from: FROM, to: TO }), ctx)
    const body = res.jsonBody as any
    const first = body.underusedRooms[0]
    expect(first.roomId).toBe('atlas-2-215')
    expect(first.name).toBe('Zaal Curaçao')
  })

  it('j) OPTIONS preflight → 204', async () => {
    const res = await kpisHandler(
      buildRequest('OPTIONS', { origin: 'http://localhost:5173' }),
      ctx,
    )
    expect(res.status).toBe(204)
  })
})
