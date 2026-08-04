import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'

/**
 * schedulingHealth.ts unit tests (#64).
 *
 * Mock pattern copied from kpis.test.ts: the vi.mock factory reads fixture
 * state LAZILY from globalThis on every getTableClient call, so setState()
 * in beforeEach gives each test a fresh fixture set (a factory that closes
 * over module-level arrays makes setState a no-op — standing Wave-2 lesson).
 *
 * Fixture reuses kpis.test.ts's 3-room/6-snapshot/4-reservation set (same
 * window 2026-07-19T10:00->11:00Z) plus a 4th room with zero reservations/
 * snapshots in range, to exercise the divide-by-zero guard:
 *
 *   3 rooms:  atlas-2-210 (atlas, cap 8,  "Vergaderzaal Höganäs")
 *             atlas-2-215 (atlas, cap 12, "Zaal Curaçao")          <- non-ASCII
 *             flux-2-207  (flux,  cap 2,  "Focus Booth Åse")
 *             flux-3-301  (flux,  cap 4,  "Salle Étoile")          <- zero data
 *   6 snapshots (as kpis.test.ts):
 *     atlas-2-210: 10:00 occ=4 (50%), 10:15 occ=8 (100%), 10:30 occ=6 (75%)
 *     atlas-2-215: 10:00 occ=0 (0%),   10:30 occ=6 (50%)
 *     flux-2-207:  10:00 occ=2 (100%)
 *   4 reservations (1 ghost, 1 oversized):
 *     A atlas-2-210 10:00->10:30 attendee=5  slot max occ = 8   -> normal, cap*0.3=2.4, not oversized
 *     B atlas-2-215 10:00->10:15 attendee=3  slot max occ = 0   -> GHOST, cap*0.3=3.6, OVERSIZED (3<=3.6)
 *     C atlas-2-215 10:30->11:00 attendee=6  slot max occ = 6   -> normal, cap*0.3=3.6, not oversized
 *     D flux-2-207  10:00->11:00 attendee=1  slot max occ = 2   -> normal, cap*0.3=0.6, not oversized
 *
 * Expected per-room (rows sorted by roomId ascending):
 *   atlas-2-210: ghostRatePct=0,     oversizedRatePct=0,   utilizationPct=75    (=(50+100+75)/3)
 *   atlas-2-215: ghostRatePct=33.33, oversizedRatePct=50,  utilizationPct=25    (=(0+50)/2)
 *   flux-2-207:  ghostRatePct=0,     oversizedRatePct=0,   utilizationPct=100
 *   flux-3-301:  ghostRatePct=0,     oversizedRatePct=0,   utilizationPct=0     (no data -> no div-by-zero)
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
          rows = (globalThis as any).__SH_ROOMS_STATE__ ?? []
        } else if (name === 'OccupancySnapshots') {
          rows = (globalThis as any).__SH_SNAPSHOTS_STATE__ ?? []
        } else if (name === 'Reservations') {
          rows = (globalThis as any).__SH_RESERVATIONS_STATE__ ?? []
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

const { schedulingHealthHandler } = await import('./schedulingHealth')

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
  {
    partitionKey: 'flux',
    rowKey: 'flux-3-301',
    roomId: 'flux-3-301',
    building: 'flux',
    floor: 3,
    name: 'Salle Étoile',
    capacity: 4,
    deviceId: 'TB-10',
    outlookAddress: 'flux-3-301@rooms.demo',
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
  // flux-3-301 has zero snapshots in range (deliberately).
]

const RESERVATIONS_FIXTURE = [
  // A — normal (slot max occ = 8), not oversized (5 > 8*0.3=2.4)
  { partitionKey: 'atlas-2-210', rowKey: 'rk-ra', roomId: 'atlas-2-210', subject: 'Sprint review', organizer: 'Anaïs Dubois', startTs: '2026-07-19T10:00:00.000Z', endTs: '2026-07-19T10:30:00.000Z', attendeeCount: 5, sourceId: 'outlook-mock' },
  // B — GHOST (slot max occ = 0), oversized (3 <= 12*0.3=3.6)
  { partitionKey: 'atlas-2-215', rowKey: 'rk-rb', roomId: 'atlas-2-215', subject: 'Empty sync', organizer: 'Bram Willems', startTs: '2026-07-19T10:00:00.000Z', endTs: '2026-07-19T10:15:00.000Z', attendeeCount: 3, sourceId: 'outlook-mock' },
  // C — normal (slot max occ = 6), not oversized (6 > 12*0.3=3.6)
  { partitionKey: 'atlas-2-215', rowKey: 'rk-rc', roomId: 'atlas-2-215', subject: 'Design critique', organizer: 'Sanne de Vries', startTs: '2026-07-19T10:30:00.000Z', endTs: '2026-07-19T11:00:00.000Z', attendeeCount: 6, sourceId: 'outlook-mock' },
  // D — normal (slot max occ = 2), not oversized (1 > 2*0.3=0.6)
  { partitionKey: 'flux-2-207', rowKey: 'rk-rd', roomId: 'flux-2-207', subject: 'Focus block', organizer: 'Åsa Lindqvist', startTs: '2026-07-19T10:00:00.000Z', endTs: '2026-07-19T11:00:00.000Z', attendeeCount: 1, sourceId: 'outlook-mock' },
  // flux-3-301 has zero reservations in range (deliberately).
]

function setState(rooms: any[], snapshots: any[], reservations: any[]) {
  ;(globalThis as any).__SH_ROOMS_STATE__ = rooms
  ;(globalThis as any).__SH_SNAPSHOTS_STATE__ = snapshots
  ;(globalThis as any).__SH_RESERVATIONS_STATE__ = reservations
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

async function callSchedulingHealth(opts: { from?: string; to?: string } = {}): Promise<any> {
  const ctx = { error: vi.fn(), log: vi.fn() } as unknown as InvocationContext
  const res = await schedulingHealthHandler(
    buildRequest('GET', { from: opts.from ?? FROM, to: opts.to ?? TO }),
    ctx,
  )
  return res
}

describe('GET /api/rooms/scheduling-health', () => {
  beforeEach(() => {
    setState(ROOMS_FIXTURE, SNAPSHOTS_FIXTURE, RESERVATIONS_FIXTURE)
  })

  it('a) 200 — returns ALL 4 rooms, sorted by roomId ascending', async () => {
    const res = await callSchedulingHealth()
    expect(res.status).toBe(200)
    const body = res.jsonBody as any
    expect(body.rooms.map((r: any) => r.roomId)).toEqual([
      'atlas-2-210',
      'atlas-2-215',
      'flux-2-207',
      'flux-3-301',
    ])
  })

  it('b) atlas-2-210: ghostRatePct=0, oversizedRatePct=0, utilizationPct=75', async () => {
    const res = await callSchedulingHealth()
    const body = res.jsonBody as any
    const room = body.rooms.find((r: any) => r.roomId === 'atlas-2-210')
    expect(room.name).toBe('Vergaderzaal Höganäs')
    expect(room.building).toBe('atlas')
    expect(room.ghostRatePct).toBe(0)
    expect(room.oversizedRatePct).toBe(0)
    expect(room.utilizationPct).toBe(75)
  })

  it('c) atlas-2-215: ghostRatePct=33.33 (0.25h/0.75h), oversizedRatePct=50 (1 of 2), utilizationPct=25', async () => {
    const res = await callSchedulingHealth()
    const body = res.jsonBody as any
    const room = body.rooms.find((r: any) => r.roomId === 'atlas-2-215')
    expect(room.name).toBe('Zaal Curaçao')
    expect(room.ghostRatePct).toBe(33.33)
    expect(room.oversizedRatePct).toBe(50)
    expect(room.utilizationPct).toBe(25)
  })

  it('d) flux-2-207: ghostRatePct=0, oversizedRatePct=0, utilizationPct=100', async () => {
    const res = await callSchedulingHealth()
    const body = res.jsonBody as any
    const room = body.rooms.find((r: any) => r.roomId === 'flux-2-207')
    expect(room.name).toBe('Focus Booth Åse')
    expect(room.ghostRatePct).toBe(0)
    expect(room.oversizedRatePct).toBe(0)
    expect(room.utilizationPct).toBe(100)
  })

  it('e) flux-3-301: zero reservations/snapshots in range -> all metrics 0, no NaN/division-by-zero', async () => {
    const res = await callSchedulingHealth()
    const body = res.jsonBody as any
    const room = body.rooms.find((r: any) => r.roomId === 'flux-3-301')
    expect(room.name).toBe('Salle Étoile')
    expect(room.ghostRatePct).toBe(0)
    expect(room.oversizedRatePct).toBe(0)
    expect(room.utilizationPct).toBe(0)
    expect(Number.isNaN(room.ghostRatePct)).toBe(false)
    expect(Number.isNaN(room.oversizedRatePct)).toBe(false)
    expect(Number.isNaN(room.utilizationPct)).toBe(false)
  })

  it('f) 400 when `from` is missing', async () => {
    const ctx = { error: vi.fn(), log: vi.fn() } as unknown as InvocationContext
    const res = await schedulingHealthHandler(buildRequest('GET', { to: TO }), ctx)
    expect(res.status).toBe(400)
  })

  it('g) 400 when `to` is missing', async () => {
    const ctx = { error: vi.fn(), log: vi.fn() } as unknown as InvocationContext
    const res = await schedulingHealthHandler(buildRequest('GET', { from: FROM }), ctx)
    expect(res.status).toBe(400)
  })

  it('h) 400 when from is not a valid ISO datetime', async () => {
    const ctx = { error: vi.fn(), log: vi.fn() } as unknown as InvocationContext
    const res = await schedulingHealthHandler(
      buildRequest('GET', { from: 'not-a-date', to: TO }),
      ctx,
    )
    expect(res.status).toBe(400)
  })

  it('i) 400 when from >= to', async () => {
    const ctx = { error: vi.fn(), log: vi.fn() } as unknown as InvocationContext
    const res = await schedulingHealthHandler(
      buildRequest('GET', {
        from: '2026-07-19T12:00:00.000Z',
        to: '2026-07-19T11:00:00.000Z',
      }),
      ctx,
    )
    expect(res.status).toBe(400)
  })

  it('j) OPTIONS preflight -> 204 with CORS headers', async () => {
    const ctx = { error: vi.fn(), log: vi.fn() } as unknown as InvocationContext
    const res = await schedulingHealthHandler(
      buildRequest('OPTIONS', { origin: 'http://localhost:5173' }),
      ctx,
    )
    expect(res.status).toBe(204)
    const headers = res.headers as Record<string, string>
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173')
    expect(headers['Access-Control-Allow-Methods']).toContain('GET')
  })
})
