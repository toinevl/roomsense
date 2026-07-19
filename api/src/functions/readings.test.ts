import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'

/**
 * Unit tests for the readings endpoint. `../lib/tables` is mocked so the
 * handler is exercised against in-memory fixtures without touching Azurite.
 *
 * Fixture shape mirrors the real seed:
 *   Rooms: rowKey = roomId, props include deviceId
 *   SensorReadings: partitionKey = deviceId, RowKey = invertedTicks(ts)
 *     → scanning the partition by RowKey ASC yields newest-first
 */

const ROOMS = [{ rowKey: 'atlas-2-210', deviceId: 'TB-PCL-0001' }]

// Eight readings spanning 2 hours, 15-min apart. We store them in the fixture
// pre-sorted by RowKey ASC (= ts DESC), which is what the partition scan returns.
const BASE = Date.parse('2026-07-19T10:00:00.000Z')
const READINGS = Array.from({ length: 8 }, (_, i) => {
  const ts = BASE - i * 15 * 60 * 1000
  return {
    deviceId: 'TB-PCL-0001',
    ts: new Date(ts).toISOString(),
    countIn: 10 + i,
    countOut: 5 + i,
    flags: 0,
    batteryPct: 92.5 - i * 0.3,
    rssi: -68,
    snr: 7.25,
    sourceId: 'terabee-iothub-mock',
  }
})

// Build a minimal fake TableClient whose listEntities applies the OData filter
// just enough to honour RowKey / PartitionKey equality.
function makeFakeClient(
  tableName: string,
): {
  client: {
    listEntities: (opts?: { queryOptions?: { filter?: string } }) => {
      byPage: (settings?: { maxPageSize?: number }) => AsyncIterable<unknown[]>
      [Symbol.asyncIterator]: () => AsyncIterator<unknown>
    }
  }
  filters: string[]
} {
  const filters: string[] = []
  const capture = (opts?: { queryOptions?: { filter?: string } }) => {
    if (opts?.queryOptions?.filter) filters.push(opts.queryOptions.filter)
  }

  const table = tableName
  let rows: Record<string, unknown>[] = []
  if (table === 'Rooms') rows = ROOMS as unknown as Record<string, unknown>[]
  else if (table === 'SensorReadings') rows = READINGS as unknown as Record<string, unknown>[]

  function applyFilter(
    filter: string | undefined,
    snapshot: Record<string, unknown>[],
  ): Record<string, unknown>[] {
    if (!filter) return snapshot
    // Match: RowKey eq '<val>'  or  PartitionKey eq '<val>'
    const rowKeyMatch = filter.match(/^RowKey eq '(.*)'$/)
    if (rowKeyMatch) {
      const want = rowKeyMatch[1].replace(/''/g, "'")
      return snapshot.filter((r) => r.rowKey === want)
    }
    const partKeyMatch = filter.match(/^PartitionKey eq '(.*)'$/)
    if (partKeyMatch) {
      const want = partKeyMatch[1].replace(/''/g, "'")
      return snapshot.filter(
        (r) => r.partitionKey === want || r.deviceId === want || r.roomId === want,
      )
    }
    return snapshot
  }

  const client = {
    listEntities(opts?: { queryOptions?: { filter?: string } }) {
      capture(opts)
      const snapshot = applyFilter(opts?.queryOptions?.filter, [...rows])
      const pageIterator = async function* (settings?: { maxPageSize?: number }) {
        const size = settings?.maxPageSize ?? snapshot.length
        for (let i = 0; i < snapshot.length; i += size) {
          yield snapshot.slice(i, i + size)
        }
      }
      const allIterator = async function* () {
        for (const row of snapshot) yield row
      }
      return {
        byPage: (settings?: { maxPageSize?: number }) => pageIterator(settings),
        [Symbol.asyncIterator]: () => allIterator(),
      }
    },
  }
  return { client, filters }
}

let lastClient: ReturnType<typeof makeFakeClient> | null = null

vi.mock('../lib/tables', () => ({
  getTableClient: (tableName: string) => {
    lastClient = makeFakeClient(tableName)
    return lastClient.client
  },
  TABLE_NAMES: {
    rooms: 'Rooms',
    readings: 'SensorReadings',
    snapshots: 'OccupancySnapshots',
    reservations: 'Reservations',
    sources: 'Sources',
  },
}))

import { readingsHandler } from './readings'

function makeRequest(
  params: { roomId?: string },
  query: Record<string, string>,
  method = 'GET',
  headers: Record<string, string> = {},
): HttpRequest {
  const url = new URL('http://localhost/api/rooms/' + (params.roomId ?? '') + '/readings')
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  return {
    method,
    url: url.toString(),
    headers: new Headers(headers),
    query: url.searchParams,
    params: params as Record<string, string>,
  } as unknown as HttpRequest
}

const ctx = { error() {} } as unknown as InvocationContext

describe('readings endpoint', () => {
  beforeEach(() => {
    lastClient = null
  })

  it('200 — returns up to limit readings, DESC by ts', async () => {
    const res = await readingsHandler(makeRequest({ roomId: 'atlas-2-210' }, {}), ctx)
    expect(res.status).toBe(200)
    const body = res.jsonBody as unknown[]
    expect(body).toHaveLength(8)
    // First row should be the newest (BASE ts), last row the oldest.
    expect((body[0] as { ts: string }).ts).toBe(READINGS[0].ts)
    expect((body[7] as { ts: string }).ts).toBe(READINGS[7].ts)
    // RowKey must not leak through.
    expect((body[0] as { rowKey?: string }).rowKey).toBeUndefined()
  })

  it('200 — limit=3 caps at 3', async () => {
    const res = await readingsHandler(
      makeRequest({ roomId: 'atlas-2-210' }, { limit: '3' }),
      ctx,
    )
    expect(res.status).toBe(200)
    const body = res.jsonBody as unknown[]
    expect(body).toHaveLength(3)
    expect((body[0] as { ts: string }).ts).toBe(READINGS[0].ts)
    expect((body[2] as { ts: string }).ts).toBe(READINGS[2].ts)
  })

  it('200 — limit=999 clamps to 200 (no error)', async () => {
    const res = await readingsHandler(
      makeRequest({ roomId: 'atlas-2-210' }, { limit: '999' }),
      ctx,
    )
    expect(res.status).toBe(200)
    const body = res.jsonBody as unknown[]
    // Only 8 readings available, but no clamp error is raised.
    expect(body).toHaveLength(8)
    expect(lastClient?.filters.some((f) => f.includes('TB-PCL-0001'))).toBe(true)
  })

  it('400 — limit=abc is unparseable', async () => {
    const res = await readingsHandler(
      makeRequest({ roomId: 'atlas-2-210' }, { limit: 'abc' }),
      ctx,
    )
    expect(res.status).toBe(400)
    expect((res.jsonBody as { error: string }).error).toMatch(/limit/i)
  })

  it('404 — unknown roomId', async () => {
    const res = await readingsHandler(
      makeRequest({ roomId: 'does-not-exist' }, {}),
      ctx,
    )
    expect(res.status).toBe(404)
    expect((res.jsonBody as { error: string }).error).toMatch(/does-not-exist/)
  })

  it('204 — OPTIONS preflight', async () => {
    const res = await readingsHandler(
      makeRequest({ roomId: 'atlas-2-210' }, {}, 'OPTIONS', {
        origin: 'http://localhost:5173',
      }),
      ctx,
    )
    expect(res.status).toBe(204)
  })
})
