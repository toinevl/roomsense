import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'

/**
 * occupancy.ts unit tests (#8).
 *
 * Same mock pattern as rooms.test.ts: vi.mock('../lib/tables') reads fixtures
 * lazily from globalThis on every getTableClient call, so setState() in
 * beforeEach gives each test a fresh fixture set. Fixtures use non-ASCII
 * names per CLAUDE.md.
 */

vi.mock('../lib/tables', () => {
  return {
    TABLE_NAMES: {
      rooms: 'Rooms',
      snapshots: 'OccupancySnapshots',
    },
    getTableClient: (name: string) => {
      function listEntities(opts?: any) {
        const filter: string = opts?.queryOptions?.filter ?? ''
        const roomsState: any[] = (globalThis as any).__OCC_ROOMS_STATE__ ?? []
        const snapshotsState: Record<string, any[]> =
          (globalThis as any).__OCC_SNAPSHOTS_STATE__ ?? {}
        let rows: any[]
        if (name === 'Rooms') {
          // Honour `RowKey eq '...'` for the room-exists check; ignore any
          // other filter clauses (we only ever scan Rooms by RowKey).
          const m = filter.match(/RowKey eq '([^']+)'/)
          rows = m
            ? roomsState.filter((r) => r.rowKey === m[1])
            : roomsState.slice()
        } else {
          // Filter looks like:
          //   PartitionKey eq 'atlas-2-210' and RowKey ge '<fromInv>' and RowKey le '<toInv>'
          // Parse PartitionKey, and honour RowKey ge/le bounds against the
          // fixture's rowKey strings. Snapshots stored RowKey-ASC (newest-first);
          // the handler re-sorts ASC-by-ts before returning.
          const pkMatch = filter.match(/PartitionKey eq '([^']+)'/)
          const geMatch = filter.match(/RowKey ge '([^']+)'/)
          const leMatch = filter.match(/RowKey le '([^']+)'/)
          const pk = pkMatch ? pkMatch[1] : ''
          const ge = geMatch ? geMatch[1] : null
          const le = leMatch ? leMatch[1] : null
          rows = ((snapshotsState[pk] ?? []).slice()).filter((r) => {
            if (ge !== null && r.rowKey < ge) return false
            if (le !== null && r.rowKey > le) return false
            return true
          })
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
      return { listEntities }
    },
  }
})

const { occupancyHandler } = await import('./occupancy')

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
]

// 5 snapshots for atlas-2-210 between 10:00 and 11:00 UTC, plus one at 09:00
// (outside the [10:00, 11:00] query window used by most tests). Stored
// RowKey-ASC so newest-first; the handler must reverse to ASC-by-ts.
//
// rowKey values use REAL invertedTicks(epochMs) so the handler's
// `RowKey ge '<fromInverted>' and RowKey le '<toInverted>'` OData filter
// selects the correct subset — same encoding the production seed writes.
// invertedTicks(epochMs) = String(10_000_000_000_000 - epochMs).padStart(14,'0')
// so larger epochMs → smaller rowKey → sorts first (newest-first in ASC).
const invTicks = (iso: string) =>
  String(10_000_000_000_000 - Date.parse(iso)).padStart(14, '0')

const SNAPSHOTS_FIXTURE: Record<string, any[]> = {
  'atlas-2-210': [
    { partitionKey: 'atlas-2-210', rowKey: invTicks('2026-07-19T11:00:00.000Z'), ts: '2026-07-19T11:00:00.000Z', occupancy: 7, utilizationPct: 87.5, intervalMinutes: 15 },
    { partitionKey: 'atlas-2-210', rowKey: invTicks('2026-07-19T10:45:00.000Z'), ts: '2026-07-19T10:45:00.000Z', occupancy: 6, utilizationPct: 75.0, intervalMinutes: 15 },
    { partitionKey: 'atlas-2-210', rowKey: invTicks('2026-07-19T10:30:00.000Z'), ts: '2026-07-19T10:30:00.000Z', occupancy: 5, utilizationPct: 62.5, intervalMinutes: 15 },
    { partitionKey: 'atlas-2-210', rowKey: invTicks('2026-07-19T10:15:00.000Z'), ts: '2026-07-19T10:15:00.000Z', occupancy: 4, utilizationPct: 50.0, intervalMinutes: 15 },
    { partitionKey: 'atlas-2-210', rowKey: invTicks('2026-07-19T10:00:00.000Z'), ts: '2026-07-19T10:00:00.000Z', occupancy: 3, utilizationPct: 37.5, intervalMinutes: 15 },
    { partitionKey: 'atlas-2-210', rowKey: invTicks('2026-07-19T09:00:00.000Z'), ts: '2026-07-19T09:00:00.000Z', occupancy: 2, utilizationPct: 25.0, intervalMinutes: 15 },
  ],
}

function setState(rooms: any[], snapshots: Record<string, any[]>) {
  ;(globalThis as any).__OCC_ROOMS_STATE__ = rooms
  ;(globalThis as any).__OCC_SNAPSHOTS_STATE__ = snapshots
}

function buildRequest(
  method: string,
  opts: { roomId?: string; from?: string; to?: string; origin?: string } = {},
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
    params: { roomId: opts.roomId ?? 'atlas-2-210' },
  } as unknown as HttpRequest
}

describe('GET /api/rooms/{roomId}/occupancy', () => {
  let ctx: InvocationContext

  beforeEach(() => {
    ctx = { error: vi.fn(), log: vi.fn() } as unknown as InvocationContext
    setState(ROOMS_FIXTURE, SNAPSHOTS_FIXTURE)
  })

  it('returns 200 with snapshots in ASC ts order within the range', async () => {
    const res = await occupancyHandler(
      buildRequest('GET', {
        roomId: 'atlas-2-210',
        from: '2026-07-19T10:00:00.000Z',
        to: '2026-07-19T11:00:00.000Z',
      }),
      ctx,
    )
    expect(res.status).toBe(200)
    const body = res.jsonBody as any[]
    // 5 rows in [10:00, 11:00] inclusive (09:00 excluded).
    expect(body).toHaveLength(5)
    // ASC by ts — the handler must reverse the service's newest-first order.
    const ts = body.map((r) => r.ts)
    expect(ts).toEqual([
      '2026-07-19T10:00:00.000Z',
      '2026-07-19T10:15:00.000Z',
      '2026-07-19T10:30:00.000Z',
      '2026-07-19T10:45:00.000Z',
      '2026-07-19T11:00:00.000Z',
    ])
  })

  it('excludes the snapshot outside the range', async () => {
    const res = await occupancyHandler(
      buildRequest('GET', {
        roomId: 'atlas-2-210',
        from: '2026-07-19T10:00:00.000Z',
        to: '2026-07-19T11:00:00.000Z',
      }),
      ctx,
    )
    const body = res.jsonBody as any[]
    expect(body.some((r) => r.ts === '2026-07-19T09:00:00.000Z')).toBe(false)
  })

  it('returns 400 when `from` is missing', async () => {
    const res = await occupancyHandler(
      buildRequest('GET', {
        roomId: 'atlas-2-210',
        to: '2026-07-19T11:00:00.000Z',
      }),
      ctx,
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when from >= to', async () => {
    const res = await occupancyHandler(
      buildRequest('GET', {
        roomId: 'atlas-2-210',
        from: '2026-07-19T12:00:00.000Z',
        to: '2026-07-19T11:00:00.000Z',
      }),
      ctx,
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when roomId is not in Rooms', async () => {
    const res = await occupancyHandler(
      buildRequest('GET', {
        roomId: 'does-not-exist',
        from: '2026-07-19T10:00:00.000Z',
        to: '2026-07-19T11:00:00.000Z',
      }),
      ctx,
    )
    expect(res.status).toBe(404)
  })

  it('responds 204 to OPTIONS preflight', async () => {
    const res = await occupancyHandler(
      buildRequest('OPTIONS', { origin: 'http://localhost:5173' }),
      ctx,
    )
    expect(res.status).toBe(204)
  })
})
