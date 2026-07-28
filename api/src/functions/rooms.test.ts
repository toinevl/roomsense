import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { HttpRequest, InvocationContext, HttpResponseInit } from '@azure/functions'

/**
 * rooms.ts unit tests.
 *
 * Mocks '../lib/tables' so the handler never touches Azurite. Each fake
 * TableClient implements only listEntities + byPage — the two methods the
 * handler actually calls. Fixtures use real non-ASCII names per the project's
 * standing testing convention (CLAUDE.md).
 */

vi.mock('../lib/tables', () => {
  // The mock reads fixtures lazily from globalThis on EVERY getTableClient
  // call. Tests mutate globalThis via setState() in beforeEach so each test
  // gets a fresh fixture set — a previous version closed over module-level
  // state which made setState a no-op and every test see the empty default.
  return {
    TABLE_NAMES: { rooms: 'Rooms', snapshots: 'OccupancySnapshots' },
    getTableClient: (name: string) => {
      function listEntities(opts?: any) {
        const filter = opts?.queryOptions?.filter ?? ''
        const roomsState: any[] = (globalThis as any).__ROOMS_STATE__ ?? []
        const snapshotsState: Record<string, any[]> =
          (globalThis as any).__SNAPSHOTS_STATE__ ?? {}
        let rows: any[]
        if (name === 'Rooms') {
          rows = roomsState
        } else {
          // PartitionKey eq 'roomId' → pull that partition; rows are stored
          // in RowKey ASC (= newest-first in inverted-ticks land).
          const m = filter.match(/PartitionKey eq '([^']+)'/)
          const pk = m ? m[1] : ''
          rows = (snapshotsState[pk] ?? []).slice() // already ASC by rowKey
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
            // Simulate the SDK: a single page containing the first `take` rows.
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
      return { listEntities }
    },
  }
})

// Imported AFTER vi.mock so the module picks up the mock.
const { roomsHandler } = await import('./rooms')

// ---- Fixtures (non-ASCII names per CLAUDE.md) -------------------------------

const ROOMS_FIXTURE = [
  // Deliberately out of order across both building and roomId — the handler
  // must sort. Includes a non-ASCII name (Höganäs) and one room with no
  // snapshot (atlas-4-410).
  { partitionKey: 'flux', rowKey: 'flux-2-207', roomId: 'flux-2-207', building: 'flux', floor: 2, name: 'Focus Booth Åse', capacity: 2, deviceId: 'TB-9', outlookAddress: 'flux-2-207@rooms.demo', sourceId: 'terabee' },
  { partitionKey: 'atlas', rowKey: 'atlas-2-210', roomId: 'atlas-2-210', building: 'atlas', floor: 2, name: 'Vergaderzaal Höganäs', capacity: 8, deviceId: 'TB-1', outlookAddress: 'atlas-2-210@rooms.demo', sourceId: 'terabee' },
  { partitionKey: 'atlas', rowKey: 'atlas-4-410', roomId: 'atlas-4-410', building: 'atlas', floor: 4, name: 'Café Corner', capacity: 6, deviceId: 'TB-3', outlookAddress: 'atlas-4-410@rooms.demo', sourceId: 'terabee' },
  { partitionKey: 'atlas', rowKey: 'atlas-2-215', roomId: 'atlas-2-215', building: 'atlas', floor: 2, name: 'Zaal Curaçao', capacity: 12, deviceId: 'TB-2', outlookAddress: 'atlas-2-215@rooms.demo', sourceId: 'terabee' },
]

// Snapshots stored RowKey-ASC = newest-first. For test purposes we model the
// listEntities-byPage contract: first row returned = latest.
//
// 2026-07-19 (used by atlas-2-210 / flux-2-207 below) is a SUNDAY — these
// fixtures predate the office-hours anchor and deliberately have no weekday
// match at all, so they exercise the "fall back to literal latest" path.
const SNAPSHOTS_FIXTURE: Record<string, any[]> = {
  'atlas-2-210': [
    { partitionKey: 'atlas-2-210', rowKey: '0000000001', ts: '2026-07-19T10:15:00.000Z', occupancy: 5, utilizationPct: 62.5, intervalMinutes: 15 },
    { partitionKey: 'atlas-2-210', rowKey: '0000000002', ts: '2026-07-19T10:00:00.000Z', occupancy: 3, utilizationPct: 37.5, intervalMinutes: 15 },
  ],
  'flux-2-207': [
    { partitionKey: 'flux-2-207', rowKey: '0000000001', ts: '2026-07-19T10:15:00.000Z', occupancy: 1, utilizationPct: 50, intervalMinutes: 15 },
  ],
  // atlas-4-410 and atlas-2-215 deliberately have NO snapshots.
}

// Office-hours anchor fixtures. 2026-07-24 is a Friday, 2026-07-25/26 are the
// following Sat/Sun.
const OFFICE_HOURS_SNAPSHOTS_FIXTURE: Record<string, any[]> = {
  // Newest-first: a dead-of-night Sunday reading, then a Friday-afternoon
  // office-hours reading further back. Expect the Friday one to win.
  'atlas-2-210': [
    { partitionKey: 'atlas-2-210', rowKey: '0000000001', ts: '2026-07-26T23:45:00.000Z', occupancy: 0, utilizationPct: 0, intervalMinutes: 15 },
    { partitionKey: 'atlas-2-210', rowKey: '0000000002', ts: '2026-07-26T02:00:00.000Z', occupancy: 0, utilizationPct: 0, intervalMinutes: 15 },
    { partitionKey: 'atlas-2-210', rowKey: '0000000003', ts: '2026-07-25T13:00:00.000Z', occupancy: 0, utilizationPct: 0, intervalMinutes: 15 }, // Saturday
    { partitionKey: 'atlas-2-210', rowKey: '0000000004', ts: '2026-07-24T15:30:00.000Z', occupancy: 5, utilizationPct: 62.5, intervalMinutes: 15 }, // Friday 15:30 UTC — office hours
    { partitionKey: 'atlas-2-210', rowKey: '0000000005', ts: '2026-07-24T07:00:00.000Z', occupancy: 1, utilizationPct: 12.5, intervalMinutes: 15 }, // Friday 07:00 UTC — before 08:00, not office hours
  ],
  // Weekday but outside 08:00-18:00 (19:00) — should NOT count; only a
  // literal-latest fallback exists (no office-hours row anywhere).
  'atlas-2-215': [
    { partitionKey: 'atlas-2-215', rowKey: '0000000001', ts: '2026-07-24T19:00:00.000Z', occupancy: 2, utilizationPct: 25, intervalMinutes: 15 },
  ],
}

function setState(rooms: any[], snapshots: Record<string, any[]>) {
  // The vi.mock factory reads these lazily on every getTableClient call.
  ;(globalThis as any).__ROOMS_STATE__ = rooms
  ;(globalThis as any).__SNAPSHOTS_STATE__ = snapshots
}

function buildRequest(method: string, origin?: string): HttpRequest {
  const headers = new Headers()
  if (origin) headers.set('origin', origin)
  return {
    method,
    headers,
    query: new URLSearchParams(),
    params: {},
  } as unknown as HttpRequest
}

describe('GET /api/rooms', () => {
  let ctx: InvocationContext

  beforeEach(() => {
    ctx = { error: vi.fn(), log: vi.fn() } as unknown as InvocationContext
    setState(ROOMS_FIXTURE, SNAPSHOTS_FIXTURE)
  })

  it('returns 200 with one item per faked room', async () => {
    const res = await roomsHandler(buildRequest('GET'), ctx)
    expect(res.status).toBe(200)
    const body = res.jsonBody as any[]
    expect(body).toHaveLength(ROOMS_FIXTURE.length)
  })

  it('each item carries occupancy / utilizationPct / lastSeenTs from the latest snapshot', async () => {
    const res = await roomsHandler(buildRequest('GET'), ctx)
    const body = res.jsonBody as any[]
    const byRoom = new Map(body.map((r) => [r.roomId, r]))

    // atlas-2-210 latest = 5 / 62.5 / 10:15
    const a = byRoom.get('atlas-2-210')!
    expect(a.occupancy).toBe(5)
    expect(a.utilizationPct).toBe(62.5)
    expect(a.lastSeenTs).toBe('2026-07-19T10:15:00.000Z')

    // flux-2-207 latest = 1 / 50 / 10:15
    const f = byRoom.get('flux-2-207')!
    expect(f.occupancy).toBe(1)
    expect(f.utilizationPct).toBe(50)
    expect(f.lastSeenTs).toBe('2026-07-19T10:15:00.000Z')

    // Rooms with no snapshot → empty-string lastSeenTs + zeros.
    const noSnap = byRoom.get('atlas-4-410')!
    expect(noSnap.lastSeenTs).toBe('')
    expect(noSnap.occupancy).toBe(0)
    expect(noSnap.utilizationPct).toBe(0)
  })

  it('orders by building asc then roomId asc', async () => {
    const res = await roomsHandler(buildRequest('GET'), ctx)
    const body = res.jsonBody as any[]
    const keys = body.map((r) => `${r.building}|${r.roomId}`)
    // Expected: atlas-2-210, atlas-2-215, atlas-4-410, flux-2-207
    expect(keys).toEqual([
      'atlas|atlas-2-210',
      'atlas|atlas-2-215',
      'atlas|atlas-4-410',
      'flux|flux-2-207',
    ])
  })

  it('preserves non-ASCII names verbatim in the body', async () => {
    const res = await roomsHandler(buildRequest('GET'), ctx)
    const body = res.jsonBody as any[]
    const byRoom = new Map(body.map((r) => [r.roomId, r]))
    expect(byRoom.get('atlas-2-210')!.name).toBe('Vergaderzaal Höganäs')
    expect(byRoom.get('atlas-2-215')!.name).toBe('Zaal Curaçao')
    expect(byRoom.get('flux-2-207')!.name).toBe('Focus Booth Åse')
  })

  it('anchors to the most recent office-hours snapshot, not the literal latest row', async () => {
    setState(ROOMS_FIXTURE, OFFICE_HOURS_SNAPSHOTS_FIXTURE)
    const res = await roomsHandler(buildRequest('GET'), ctx)
    const body = res.jsonBody as any[]
    const byRoom = new Map(body.map((r) => [r.roomId, r]))

    // Literal latest is Sunday 23:45 (occupancy 0); the most recent
    // office-hours row is Friday 15:30 UTC (occupancy 5) — that one should win.
    const a = byRoom.get('atlas-2-210')!
    expect(a.lastSeenTs).toBe('2026-07-24T15:30:00.000Z')
    expect(a.occupancy).toBe(5)
    expect(a.utilizationPct).toBe(62.5)
  })

  it('falls back to the literal latest row when no office-hours snapshot exists', async () => {
    setState(ROOMS_FIXTURE, OFFICE_HOURS_SNAPSHOTS_FIXTURE)
    const res = await roomsHandler(buildRequest('GET'), ctx)
    const body = res.jsonBody as any[]
    const byRoom = new Map(body.map((r) => [r.roomId, r]))

    // Only row is a weekday but 19:00 UTC (outside 08:00-18:00) — no
    // office-hours match anywhere, so the literal latest row is used as-is.
    const b = byRoom.get('atlas-2-215')!
    expect(b.lastSeenTs).toBe('2026-07-24T19:00:00.000Z')
    expect(b.occupancy).toBe(2)
  })

  it('returns 200 with [] when the rooms table is empty', async () => {
    setState([], {})
    const res = await roomsHandler(buildRequest('GET'), ctx)
    expect(res.status).toBe(200)
    expect(res.jsonBody).toEqual([])
  })

  it('responds 204 to OPTIONS preflight', async () => {
    const res = await roomsHandler(buildRequest('OPTIONS', 'http://localhost:5173'), ctx)
    expect(res.status).toBe(204)
  })
})
