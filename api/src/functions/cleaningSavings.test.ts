import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'

/**
 * cleaningSavings.ts unit tests (#65).
 *
 * Mock pattern copied from kpis.test.ts: the vi.mock factory reads fixture
 * state LAZILY from globalThis on every getTableClient call, so setState()
 * in beforeEach gives each test a fresh fixture set (a factory that closes
 * over module-level arrays makes setState a no-op — standing Wave-2 lesson).
 *
 * The handler full-scans Rooms + OccupancySnapshots and filters/replays in
 * memory, so the mock simply returns the whole per-table fixture without
 * parsing OData filters.
 *
 * Env vars are pinned explicitly per test (not relying on module defaults)
 * so the fixture math is hand-verifiable regardless of the shipped default
 * constants:
 *   CLEANING_INTERVAL_DAYS = 3            (72h)
 *   CLEANING_THRESHOLD_CAPACITY_HOURS = 2  (small, for a compact fixture)
 *   CLEANING_COST_PER_CLEAN_EUR = 15
 *
 * Window: 2026-07-19T00:00:00.000Z → 2026-07-26T00:00:00.000Z (exactly 7
 * days) → baselineCleans = floor(7*24h / 24h) = 7 per room.
 *
 * Fixture:
 *   atlas-a1 "Vergaderzaal Höganäs" (cap 4) — 8 hourly snapshots at
 *     01:00..08:00, occupancy=4 (full) each. capacityHoursSinceClean
 *     accumulates 4*0.25/4 = 0.25 per snapshot → reaches threshold(2) at
 *     the 8th snapshot (08:00), while hoursSinceClean is only 8h at that
 *     point (< 72h interval) → THRESHOLD-triggered clean fires first.
 *     policyCleans = 1. cleansAvoided = 7-1 = 6. eurSaved = 6*15 = 90.
 *   atlas-b1 "Zaal Curaçao" (cap 10) — 2 snapshots, occupancy=0 both times
 *     (never contributes capacity-hours): one at +1 day, one at +3.5 days.
 *     hoursSinceClean accumulates via elapsed calendar time: 24h then +60h
 *     = 84h >= 72h (interval) at the 2nd snapshot → INTERVAL-triggered
 *     clean fires (threshold never fires — capacityHoursSinceClean stays 0).
 *     policyCleans = 1. cleansAvoided = 7-1 = 6. eurSaved = 6*15 = 90.
 *   flux-c1 "Focus Booth Åse" (cap 2) — ZERO snapshots in window.
 *     baselineCleans is still computed from the date range (7), policyCleans
 *     = 0 (no resets ever fire), cleansAvoided = max(0, 7-0) = 7,
 *     eurSaved = 7*15 = 105.
 *
 * Totals: baselineCleans=21, policyCleans=2, cleansAvoided=19, eurSaved=285.
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
          rows = (globalThis as any).__CLEANING_ROOMS_STATE__ ?? []
        } else if (name === 'OccupancySnapshots') {
          rows = (globalThis as any).__CLEANING_SNAPSHOTS_STATE__ ?? []
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

const { cleaningSavingsHandler } = await import('./cleaningSavings')

// ---- Fixtures ----------------------------------------------------------------

const ROOMS_FIXTURE = [
  {
    partitionKey: 'atlas',
    rowKey: 'atlas-a1',
    roomId: 'atlas-a1',
    building: 'atlas',
    floor: 1,
    name: 'Vergaderzaal Höganäs',
    capacity: 4,
    deviceId: 'TB-1',
    outlookAddress: 'atlas-a1@rooms.demo',
    sourceId: 'terabee',
  },
  {
    partitionKey: 'atlas',
    rowKey: 'atlas-b1',
    roomId: 'atlas-b1',
    building: 'atlas',
    floor: 1,
    name: 'Zaal Curaçao',
    capacity: 10,
    deviceId: 'TB-2',
    outlookAddress: 'atlas-b1@rooms.demo',
    sourceId: 'terabee',
  },
  {
    partitionKey: 'flux',
    rowKey: 'flux-c1',
    roomId: 'flux-c1',
    building: 'flux',
    floor: 3,
    name: 'Focus Booth Åse',
    capacity: 2,
    deviceId: 'TB-3',
    outlookAddress: 'flux-c1@rooms.demo',
    sourceId: 'terabee',
  },
]

function hourlySnapshot(roomId: string, hour: number, occupancy: number) {
  const hh = String(hour).padStart(2, '0')
  return {
    partitionKey: roomId,
    rowKey: `rk-${roomId}-${hh}`,
    roomId,
    ts: `2026-07-19T${hh}:00:00.000Z`,
    occupancy,
    utilizationPct: 0,
    intervalMinutes: 15,
  }
}

const SNAPSHOTS_FIXTURE = [
  // atlas-a1: 8 hourly snapshots, full occupancy → threshold fires at 08:00.
  hourlySnapshot('atlas-a1', 1, 4),
  hourlySnapshot('atlas-a1', 2, 4),
  hourlySnapshot('atlas-a1', 3, 4),
  hourlySnapshot('atlas-a1', 4, 4),
  hourlySnapshot('atlas-a1', 5, 4),
  hourlySnapshot('atlas-a1', 6, 4),
  hourlySnapshot('atlas-a1', 7, 4),
  hourlySnapshot('atlas-a1', 8, 4),
  // atlas-b1: 2 snapshots, zero occupancy → only interval (calendar time) fires.
  {
    partitionKey: 'atlas-b1',
    rowKey: 'rk-atlas-b1-1',
    roomId: 'atlas-b1',
    ts: '2026-07-20T00:00:00.000Z', // +1 day
    occupancy: 0,
    utilizationPct: 0,
    intervalMinutes: 15,
  },
  {
    partitionKey: 'atlas-b1',
    rowKey: 'rk-atlas-b1-2',
    roomId: 'atlas-b1',
    ts: '2026-07-22T12:00:00.000Z', // +3.5 days
    occupancy: 0,
    utilizationPct: 0,
    intervalMinutes: 15,
  },
  // flux-c1: no snapshots at all — zero-snapshot room.
]

function setState(rooms: any[], snapshots: any[]) {
  ;(globalThis as any).__CLEANING_ROOMS_STATE__ = rooms
  ;(globalThis as any).__CLEANING_SNAPSHOTS_STATE__ = snapshots
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

const FROM = '2026-07-19T00:00:00.000Z'
const TO = '2026-07-26T00:00:00.000Z' // exactly 7 days later

describe('GET /api/rooms/cleaning-savings', () => {
  let ctx: InvocationContext

  beforeEach(() => {
    ctx = { error: vi.fn(), log: vi.fn() } as unknown as InvocationContext
    setState(ROOMS_FIXTURE, SNAPSHOTS_FIXTURE)
    process.env.CLEANING_INTERVAL_DAYS = '3'
    process.env.CLEANING_THRESHOLD_CAPACITY_HOURS = '2'
    process.env.CLEANING_COST_PER_CLEAN_EUR = '15'
  })

  it('a) 200 — baselineCleans = floor(7 days / 1 day) = 7 for every room', async () => {
    const res = await cleaningSavingsHandler(buildRequest('GET', { from: FROM, to: TO }), ctx)
    expect(res.status).toBe(200)
    const body = res.jsonBody as any
    for (const r of body.rooms) {
      expect(r.baselineCleans).toBe(7)
    }
  })

  it('b) atlas-a1: threshold fires before interval → policyCleans = 1, cleansAvoided = 6, eurSaved = 90', async () => {
    const res = await cleaningSavingsHandler(buildRequest('GET', { from: FROM, to: TO }), ctx)
    const body = res.jsonBody as any
    const room = body.rooms.find((r: any) => r.roomId === 'atlas-a1')
    expect(room.policyCleans).toBe(1)
    expect(room.cleansAvoided).toBe(6)
    expect(room.eurSaved).toBe(90)
    expect(room.name).toBe('Vergaderzaal Höganäs')
  })

  it('c) atlas-b1: only interval (elapsed calendar time) fires → policyCleans = 1, cleansAvoided = 6, eurSaved = 90', async () => {
    const res = await cleaningSavingsHandler(buildRequest('GET', { from: FROM, to: TO }), ctx)
    const body = res.jsonBody as any
    const room = body.rooms.find((r: any) => r.roomId === 'atlas-b1')
    expect(room.policyCleans).toBe(1)
    expect(room.cleansAvoided).toBe(6)
    expect(room.eurSaved).toBe(90)
    expect(room.name).toBe('Zaal Curaçao')
  })

  it('d) flux-c1: zero-snapshot room — baselineCleans still 7, policyCleans = 0, cleansAvoided = 7, eurSaved = 105', async () => {
    const res = await cleaningSavingsHandler(buildRequest('GET', { from: FROM, to: TO }), ctx)
    const body = res.jsonBody as any
    const room = body.rooms.find((r: any) => r.roomId === 'flux-c1')
    expect(room.policyCleans).toBe(0)
    expect(room.cleansAvoided).toBe(7)
    expect(room.eurSaved).toBe(105)
    expect(room.name).toBe('Focus Booth Åse')
  })

  it('e) totals = sum of each field across all rooms', async () => {
    const res = await cleaningSavingsHandler(buildRequest('GET', { from: FROM, to: TO }), ctx)
    const body = res.jsonBody as any
    expect(body.totals).toEqual({
      baselineCleans: 21,
      policyCleans: 2,
      cleansAvoided: 19,
      eurSaved: 285,
    })
  })

  it('f) rooms are sorted by roomId ascending, for determinism', async () => {
    const res = await cleaningSavingsHandler(buildRequest('GET', { from: FROM, to: TO }), ctx)
    const body = res.jsonBody as any
    expect(body.rooms.map((r: any) => r.roomId)).toEqual(['atlas-a1', 'atlas-b1', 'flux-c1'])
  })

  it('g) 400 when `from` is missing', async () => {
    const res = await cleaningSavingsHandler(buildRequest('GET', { to: TO }), ctx)
    expect(res.status).toBe(400)
  })

  it('h) 400 when `to` is missing', async () => {
    const res = await cleaningSavingsHandler(buildRequest('GET', { from: FROM }), ctx)
    expect(res.status).toBe(400)
  })

  it('i) 400 when from is not a valid ISO datetime', async () => {
    const res = await cleaningSavingsHandler(
      buildRequest('GET', { from: 'not-a-date', to: TO }),
      ctx,
    )
    expect(res.status).toBe(400)
  })

  it('j) 400 when from >= to', async () => {
    const res = await cleaningSavingsHandler(
      buildRequest('GET', { from: '2026-07-26T00:00:00.000Z', to: '2026-07-19T00:00:00.000Z' }),
      ctx,
    )
    expect(res.status).toBe(400)
  })

  it('k) OPTIONS preflight → 204', async () => {
    const res = await cleaningSavingsHandler(
      buildRequest('OPTIONS', { origin: 'http://localhost:5173' }),
      ctx,
    )
    expect(res.status).toBe(204)
  })
})
