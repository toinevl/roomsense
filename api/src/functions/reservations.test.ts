import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'

/**
 * Unit tests for the reservations endpoint. `../lib/tables` is mocked so the
 * handler is exercised against in-memory fixtures without touching Azurite.
 *
 * Fixture (5 reservations for atlas-2-210, target date 2026-07-19 UTC):
 *   A) 2026-07-19T00:00:00Z → 01:00  overlaps (midnight start)            → INCLUDED
 *   B) 2026-07-19T12:00:00Z → 13:00  overlaps (midday)                    → INCLUDED
 *   C) 2026-07-18T22:00:00Z → 2026-07-19T02:00:00Z  overlaps (crosses 00) → INCLUDED
 *   D) 2026-07-18T22:00:00Z → 23:00  end == 2026-07-19T00:00 = dayStart, half-open → EXCLUDED
 *   E) 2026-07-20T01:00:00Z → 02:00  start >= dayEnd                       → EXCLUDED
 *
 * Non-ASCII organizer preserved verbatim in case A (Anaïs Dubois).
 */

const TARGET_DATE = '2026-07-19'
const TARGET_DAY_START = Date.parse('2026-07-19T00:00:00.000Z')
const TARGET_DAY_END = TARGET_DAY_START + 24 * 60 * 60 * 1000
void TARGET_DAY_END

const ROOMS = [{ rowKey: 'atlas-2-210', deviceId: 'TB-PCL-0001' }]

const RESERVATIONS = [
  {
    // A — midnight-start, fully inside day
    roomId: 'atlas-2-210',
    subject: 'Sprint review',
    organizer: 'Anaïs Dubois',
    startTs: '2026-07-19T00:00:00.000Z',
    endTs: '2026-07-19T01:00:00.000Z',
    attendeeCount: 4,
    sourceId: 'outlook-mock',
  },
  {
    // B — midday, fully inside day
    roomId: 'atlas-2-210',
    subject: 'Design critique',
    organizer: 'Jörgen Månsson',
    startTs: '2026-07-19T12:00:00.000Z',
    endTs: '2026-07-19T13:00:00.000Z',
    attendeeCount: 6,
    sourceId: 'outlook-mock',
  },
  {
    // C — spans midnight from previous day
    roomId: 'atlas-2-210',
    subject: 'Projectoverleg',
    organizer: 'Sanne de Vries',
    startTs: '2026-07-18T22:00:00.000Z',
    endTs: '2026-07-19T02:00:00.000Z',
    attendeeCount: 5,
    sourceId: 'outlook-mock',
  },
  {
    // D — ends exactly at dayStart (half-open, no overlap)
    roomId: 'atlas-2-210',
    subject: 'Stand-up (uitloop)',
    organizer: 'Bram Willems',
    startTs: '2026-07-18T22:00:00.000Z',
    endTs: '2026-07-19T00:00:00.000Z',
    attendeeCount: 3,
    sourceId: 'outlook-mock',
  },
  {
    // E — starts at next day's 01:00 (no overlap)
    roomId: 'atlas-2-210',
    subject: 'Klantdemo',
    organizer: 'Tomás Núñez',
    startTs: '2026-07-20T01:00:00.000Z',
    endTs: '2026-07-20T02:00:00.000Z',
    attendeeCount: 7,
    sourceId: 'outlook-mock',
  },
]

function makeFakeClient(
  tableName: string,
): {
  client: {
    listEntities: (opts?: { queryOptions?: { filter?: string } }) => AsyncIterable<unknown>
  }
  filters: string[]
} {
  const filters: string[] = []
  let rows: Record<string, unknown>[] = []
  if (tableName === 'Rooms') rows = ROOMS as unknown as Record<string, unknown>[]
  else if (tableName === 'Reservations') rows = RESERVATIONS as unknown as Record<string, unknown>[]

  function applyFilter(
    filter: string | undefined,
    snapshot: Record<string, unknown>[],
  ): Record<string, unknown>[] {
    if (!filter) return snapshot
    const rowKeyMatch = filter.match(/^RowKey eq '(.*)'$/)
    if (rowKeyMatch) {
      const want = rowKeyMatch[1].replace(/''/g, "'")
      return snapshot.filter((r) => r.rowKey === want)
    }
    const partKeyMatch = filter.match(/^PartitionKey eq '(.*)'$/)
    if (partKeyMatch) {
      const want = partKeyMatch[1].replace(/''/g, "'")
      return snapshot.filter((r) => r.roomId === want || r.partitionKey === want)
    }
    return snapshot
  }

  const client = {
    listEntities(opts?: { queryOptions?: { filter?: string } }) {
      if (opts?.queryOptions?.filter) filters.push(opts.queryOptions.filter)
      const snapshot = applyFilter(opts?.queryOptions?.filter, [...rows])
      return (async function* () {
        for (const row of snapshot) yield row
      })()
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

import { reservationsHandler } from './reservations'

function makeRequest(
  params: { roomId?: string },
  query: Record<string, string | undefined>,
  method = 'GET',
  headers: Record<string, string> = {},
): HttpRequest {
  const url = new URL('http://localhost/api/rooms/' + (params.roomId ?? '') + '/reservations')
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) url.searchParams.set(k, v)
  }
  return {
    method,
    url: url.toString(),
    headers: new Headers(headers),
    query: url.searchParams,
    params: params as Record<string, string>,
  } as unknown as HttpRequest
}

const ctx = { error() {} } as unknown as InvocationContext

describe('reservations endpoint', () => {
  beforeEach(() => {
    lastClient = null
  })

  it('200 — returns the 3 overlapping reservations ASC startTs', async () => {
    const res = await reservationsHandler(
      makeRequest({ roomId: 'atlas-2-210' }, { date: TARGET_DATE }),
      ctx,
    )
    expect(res.status).toBe(200)
    const body = res.jsonBody as Array<{ startTs: string }>
    expect(body).toHaveLength(3)
    // ASC by startTs: C (22:00 prev day) → A (00:00) → B (12:00)
    expect(body[0].startTs).toBe('2026-07-18T22:00:00.000Z')
    expect(body[1].startTs).toBe('2026-07-19T00:00:00.000Z')
    expect(body[2].startTs).toBe('2026-07-19T12:00:00.000Z')
    // Filter targeted the reservations partition by roomId.
    expect(
      lastClient?.filters.some((f) => f.includes("PartitionKey eq 'atlas-2-210'")),
    ).toBe(true)
  })

  it('400 — date missing', async () => {
    const res = await reservationsHandler(
      makeRequest({ roomId: 'atlas-2-210' }, {}),
      ctx,
    )
    expect(res.status).toBe(400)
    expect((res.jsonBody as { error: string }).error).toMatch(/date/i)
  })

  it('400 — date malformed (13/07/2026)', async () => {
    const res = await reservationsHandler(
      makeRequest({ roomId: 'atlas-2-210' }, { date: '13/07/2026' }),
      ctx,
    )
    expect(res.status).toBe(400)
    expect((res.jsonBody as { error: string }).error).toMatch(/date/i)
  })

  it('400 — date impossible calendar date (2026-02-30)', async () => {
    const res = await reservationsHandler(
      makeRequest({ roomId: 'atlas-2-210' }, { date: '2026-02-30' }),
      ctx,
    )
    expect(res.status).toBe(400)
  })

  it('404 — unknown roomId', async () => {
    const res = await reservationsHandler(
      makeRequest({ roomId: 'nope' }, { date: TARGET_DATE }),
      ctx,
    )
    expect(res.status).toBe(404)
  })

  it('preserves non-ASCII organizer verbatim', async () => {
    const res = await reservationsHandler(
      makeRequest({ roomId: 'atlas-2-210' }, { date: TARGET_DATE }),
      ctx,
    )
    const body = res.jsonBody as Array<{ organizer: string; startTs: string }>
    const anais = body.find((r) => r.startTs === '2026-07-19T00:00:00.000Z')
    expect(anais?.organizer).toBe('Anaïs Dubois')
  })

  it('204 — OPTIONS preflight', async () => {
    const res = await reservationsHandler(
      makeRequest({ roomId: 'atlas-2-210' }, { date: TARGET_DATE }, 'OPTIONS', {
        origin: 'http://localhost:5173',
      }),
      ctx,
    )
    expect(res.status).toBe(204)
  })
})
