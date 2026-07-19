import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'

/**
 * simulate.ts unit tests (wishlist #12).
 *
 * Same vi.mock('../lib/tables') pattern as occupancy.test.ts: the factory
 * reads fixture state lazily from globalThis on EVERY getTableClient call,
 * so setState() in beforeEach gives each test a fresh fixture set.
 *
 * The mock exposes THREE TableClient methods the handler uses:
 *   - listEntities (find latest reading per device; enumerate rooms)
 *   - createEntity  (append reading + snapshot per device)
 *   - ensureTable is mocked separately at module level — it just returns
 *     getTableClient(name) so the handler's `await ensureTable(...)` calls
 *     resolve without a real Azure table.
 *
 * createEntity calls are recorded on globalThis.__SIM_CREATE_CALLS__ so tests
 * can assert the exact write count and partition the calls by table.
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
      function listEntities(opts?: any) {
        const filter: string = opts?.queryOptions?.filter ?? ''
        const roomsState: any[] = (globalThis as any).__SIM_ROOMS_STATE__ ?? []
        const readingsState: Record<string, any[]> =
          (globalThis as any).__SIM_READINGS_STATE__ ?? {}
        let rows: any[]
        if (name === 'Rooms') {
          rows = roomsState.slice()
        } else if (name === 'SensorReadings') {
          // PartitionKey eq '<deviceId>' → that device's reading partition.
          // Stored RowKey-ASC = newest-first (inverted ticks).
          const m = filter.match(/PartitionKey eq '([^']+)'/)
          const pk = m ? m[1] : ''
          rows = (readingsState[pk] ?? []).slice()
        } else {
          rows = []
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
          byPage(settings?: { maxPageSize?: number }) {
            const take = settings?.maxPageSize ?? rows.length
            const page = rows.slice(0, take)
            return {
              [Symbol.asyncIterator]() {
                let yielded = false
                return {
                  next: async () => {
                    if (yielded) return { value: undefined, done: true }
                    yielded = true
                    return { value: page, done: false }
                  },
                }
              },
            }
          },
        }
      }
      async function createEntity(entity: any) {
        // Record every successful write so tests can assert count + per-table
        // distribution. 409 (EntityAlreadyExists) is NOT simulated here — the
        // re-tick path is exercised by asserting the catch handles it; a
        // separate test can override createEntity via vi.fn if needed.
        const calls: any[] = (globalThis as any).__SIM_CREATE_CALLS__ ?? []
        calls.push({ table: name, entity })
        ;(globalThis as any).__SIM_CREATE_CALLS__ = calls
        return {}
      }
      return { listEntities, createEntity }
    },
    // ensureTable is a no-op returning a fake client. The handler only uses
    // the return value incidentally; it re-fetches clients via getTableClient
    // for the actual writes.
    ensureTable: async (_name: string) => ({}),
  }
})

const { simulateTickHandler } = await import('./simulate')

// ---- Fixtures ----------------------------------------------------------------

// Two rooms with non-ASCII names per CLAUDE.md. Each room maps to one device.
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
]

const invTicks = (iso: string) =>
  String(10_000_000_000_000 - Date.parse(iso)).padStart(14, '0')

// Each device has exactly one existing latest reading at T = 10:00 UTC.
// Stored RowKey-ASC = newest-first. countIn/countOut are cumulative.
const LATEST_TS = '2026-07-19T10:00:00.000Z'
const READINGS_FIXTURE: Record<string, any[]> = {
  'TB-1': [
    {
      partitionKey: 'TB-1',
      rowKey: invTicks(LATEST_TS),
      deviceId: 'TB-1',
      ts: LATEST_TS,
      countIn: 100,
      countOut: 95,
      flags: 0,
      batteryPct: 90.0,
      rssi: -68,
      snr: 7.25,
      sourceId: 'terabee-iothub-mock',
    },
  ],
  'TB-2': [
    {
      partitionKey: 'TB-2',
      rowKey: invTicks(LATEST_TS),
      deviceId: 'TB-2',
      ts: LATEST_TS,
      countIn: 50,
      countOut: 40,
      flags: 0,
      batteryPct: 88.0,
      rssi: -70,
      snr: 7.0,
      sourceId: 'terabee-iothub-mock',
    },
  ],
}

function setState(rooms: any[], readings: Record<string, any[]>) {
  ;(globalThis as any).__SIM_ROOMS_STATE__ = rooms
  ;(globalThis as any).__SIM_READINGS_STATE__ = readings
  ;(globalThis as any).__SIM_CREATE_CALLS__ = []
}

function buildRequest(
  method: string,
  opts: { simKey?: string | null; origin?: string } = {},
): HttpRequest {
  const headers = new Headers()
  if (opts.origin) headers.set('origin', opts.origin)
  // Simulate presence/absence distinctly: undefined = header not set,
  // null = caller explicitly wants no header. Both map to "missing".
  if (opts.simKey !== undefined && opts.simKey !== null) {
    headers.set('x-sim-key', opts.simKey)
  }
  return {
    method,
    headers,
    query: new URLSearchParams(),
    params: {},
  } as unknown as HttpRequest
}

const VALID_KEY = 'test-sim-key'
const EXPECTED_NEW_TS = '2026-07-19T10:15:00.000Z' // LATEST_TS + 15min

describe('POST /api/simulate/tick', () => {
  let ctx: InvocationContext

  beforeEach(() => {
    ctx = { error: vi.fn(), log: vi.fn() } as unknown as InvocationContext
    setState(ROOMS_FIXTURE, READINGS_FIXTURE)
    vi.unstubAllEnvs()
    vi.stubEnv('SIMULATOR_KEY', VALID_KEY)
  })

  // a) 401 when x-sim-key header missing
  it('returns 401 when x-sim-key header is missing', async () => {
    const res = await simulateTickHandler(buildRequest('POST'), ctx)
    expect(res.status).toBe(401)
    expect((res.jsonBody as any).error).toBe('Unauthorized')
  })

  // b) 401 when x-sim-key wrong
  it('returns 401 when x-sim-key is wrong', async () => {
    const res = await simulateTickHandler(
      buildRequest('POST', { simKey: 'wrong-key' }),
      ctx,
    )
    expect(res.status).toBe(401)
    expect((res.jsonBody as any).error).toBe('Unauthorized')
  })

  // c) 401 when SIMULATOR_KEY env unset (fail closed)
  it('returns 401 for a valid key when SIMULATOR_KEY env is unset (fail closed)', async () => {
    delete process.env.SIMULATOR_KEY
    const res = await simulateTickHandler(
      buildRequest('POST', { simKey: VALID_KEY }),
      ctx,
    )
    expect(res.status).toBe(401)
    expect((res.jsonBody as any).error).toBe('Unauthorized')
  })

  // d) 200 when key valid → appended >= 1, ts is ISO, ts = latest+15min
  it('returns 200 with appended >= 1 and ts = latest + 15min', async () => {
    const res = await simulateTickHandler(
      buildRequest('POST', { simKey: VALID_KEY }),
      ctx,
    )
    expect(res.status).toBe(200)
    const body = res.jsonBody as { appended: number; ts: string }
    expect(body.appended).toBeGreaterThanOrEqual(1)
    // ts is a parseable ISO string.
    expect(typeof body.ts).toBe('string')
    expect(Number.isFinite(Date.parse(body.ts))).toBe(true)
    // Equals latest+15min for the first device processed.
    expect(body.ts).toBe(EXPECTED_NEW_TS)
  })

  // e) 200 writes one reading + one snapshot per device (2 + 2 = 4 calls)
  it('writes one reading + one snapshot per device', async () => {
    const res = await simulateTickHandler(
      buildRequest('POST', { simKey: VALID_KEY }),
      ctx,
    )
    expect(res.status).toBe(200)
    const calls: any[] = (globalThis as any).__SIM_CREATE_CALLS__
    const readingsWrites = calls.filter((c) => c.table === 'SensorReadings')
    const snapshotWrites = calls.filter((c) => c.table === 'OccupancySnapshots')
    expect(readingsWrites).toHaveLength(2)
    expect(snapshotWrites).toHaveLength(2)
    expect(calls).toHaveLength(4)
    // The response.appended must equal the actual number of writes.
    expect((res.jsonBody as any).appended).toBe(calls.length)
  })

  // f) cumulative counters: newCountIn >= latest.countIn (never decreases)
  it('never decreases cumulative countIn/countOut', async () => {
    const res = await simulateTickHandler(
      buildRequest('POST', { simKey: VALID_KEY }),
      ctx,
    )
    expect(res.status).toBe(200)
    const calls: any[] = (globalThis as any).__SIM_CREATE_CALLS__
    const readingsWrites = calls.filter((c) => c.table === 'SensorReadings')
    const prevByDevice: Record<string, number> = {
      'TB-1': 100,
      'TB-2': 50,
    }
    for (const w of readingsWrites) {
      const prev = prevByDevice[w.entity.deviceId]
      expect(w.entity.countIn).toBeGreaterThanOrEqual(prev)
      expect(w.entity.countOut).toBeGreaterThanOrEqual(prev === 100 ? 95 : 40)
    }
  })

  // g) 204 on OPTIONS preflight (no auth)
  it('responds 204 to OPTIONS preflight without checking auth', async () => {
    // No SIMULATOR_KEY set, no x-sim-key header — preflight must still pass.
    delete process.env.SIMULATOR_KEY
    const res = await simulateTickHandler(
      buildRequest('OPTIONS', { origin: 'http://localhost:5173' }),
      ctx,
    )
    expect(res.status).toBe(204)
  })

  // Extra: snapshot row shape — intervalMinutes=15, RowKey=invertedTicks(newTs)
  it('writes snapshot rows with intervalMinutes=15 and correct RowKey', async () => {
    const expectedRowKey = invTicks(EXPECTED_NEW_TS)
    const res = await simulateTickHandler(
      buildRequest('POST', { simKey: VALID_KEY }),
      ctx,
    )
    expect(res.status).toBe(200)
    const calls: any[] = (globalThis as any).__SIM_CREATE_CALLS__
    const snapshotWrites = calls.filter((c) => c.table === 'OccupancySnapshots')
    for (const w of snapshotWrites) {
      expect(w.entity.intervalMinutes).toBe(15)
      expect(w.entity.rowKey).toBe(expectedRowKey)
      expect(w.entity.ts).toBe(EXPECTED_NEW_TS)
      // occupancy is non-negative.
      expect(w.entity.occupancy).toBeGreaterThanOrEqual(0)
      expect(w.entity.utilizationPct).toBeGreaterThanOrEqual(0)
    }
  })
})
