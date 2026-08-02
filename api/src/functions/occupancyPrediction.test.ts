import { describe, it, expect, beforeEach, vi, test } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'
import type { OccupancySnapshot } from '@roomsense/shared'

import { predictBucket } from './occupancyPrediction'

function snap(ts: string, occupancy: number): OccupancySnapshot {
  return { roomId: 'r1', ts, occupancy, utilizationPct: 0, intervalMinutes: 15 }
}

describe('predictBucket', () => {
  test('averages occupancy across days at the same 15-min time-of-day bucket', () => {
    const snapshots = [
      snap('2026-07-27T14:30:00.000Z', 4), // Monday 14:30
      snap('2026-08-03T14:30:00.000Z', 6), // Monday 14:30 (different week)
      snap('2026-07-27T14:00:00.000Z', 99), // different bucket, ignored
    ]
    expect(predictBucket(snapshots, '2026-08-10T14:30:00.000Z')).toBeCloseTo(5, 5)
  })

  test('falls back to 0 when no historical data exists in the bucket', () => {
    expect(predictBucket([], '2026-08-10T14:30:00.000Z')).toBe(0)
  })
})

// ─── Handler-level tests ───

declare global {
  var __PRED_TEST_STATE__: { snapshots: any[]; throwOnList: boolean }
}
;(globalThis as any).__PRED_TEST_STATE__ = { snapshots: [], throwOnList: false }

vi.mock('../lib/tables', () => ({
  TABLE_NAMES: { snapshots: 'OccupancySnapshots' },
  getTableClient: (name: string) => {
    const g = () => (globalThis as any).__PRED_TEST_STATE__
    if (name === 'OccupancySnapshots') {
      return {
        listEntities(opts?: { queryOptions?: { filter?: string } }) {
          const s = g()
          if (s.throwOnList) throw new Error('storage down')
          let rows = s.snapshots.slice()
          const filter = opts?.queryOptions?.filter
          if (filter) {
            const m = filter.match(/PartitionKey eq '([^']+)'/)
            const want = m ? m[1].replace(/''/g, "'") : null
            if (want !== null) rows = rows.filter((r: any) => r.roomId === want)
          }
          return {
            [Symbol.asyncIterator]() {
              let i = 0
              return { next: async () => (i < rows.length ? { value: rows[i++], done: false } : { value: undefined, done: true }) }
            },
          }
        },
      }
    }
    throw new Error(`unexpected table: ${name}`)
  },
}))

import { occupancyPredictionHandler } from './occupancyPrediction'

function setState(snapshots: any[], throwOnList = false) {
  ;(globalThis as any).__PRED_TEST_STATE__ = { snapshots, throwOnList }
}

function makeReq(roomId: string, now: string): HttpRequest {
  const url = new URL('http://localhost/api/occupancy/prediction')
  url.searchParams.set('roomId', roomId)
  url.searchParams.set('now', now)
  return { method: 'GET', url: url.toString(), headers: new Headers(), query: url.searchParams, params: {} } as unknown as HttpRequest
}

const ctx = { error() {} } as unknown as InvocationContext

describe('GET /api/occupancy/prediction', () => {
  beforeEach(() => setState([]))

  it('returns now/plus30m/plus60m occupancy', async () => {
    setState([{ roomId: 'r1', ts: '2026-08-04T10:00:00.000Z', occupancy: 5, utilizationPct: 50, intervalMinutes: 15 }])
    const res = await occupancyPredictionHandler(makeReq('r1', '2026-08-04T10:00:00.000Z'), ctx)
    expect(res.status).toBe(200)
    const body = res.jsonBody as any
    expect(body.roomId).toBe('r1')
    expect(body).toHaveProperty('now')
    expect(body).toHaveProperty('plus30m')
    expect(body).toHaveProperty('plus60m')
  })

  it('returns 400 when roomId is missing', async () => {
    const url = new URL('http://localhost/api/occupancy/prediction')
    url.searchParams.set('now', '2026-08-04T10:00:00.000Z')
    const req = { method: 'GET', url: url.toString(), headers: new Headers(), query: url.searchParams, params: {} } as unknown as HttpRequest
    const res = await occupancyPredictionHandler(req, ctx)
    expect(res.status).toBe(400)
  })

  it('returns 500 on storage error', async () => {
    setState([], true)
    const res = await occupancyPredictionHandler(makeReq('r1', '2026-08-04T10:00:00.000Z'), ctx)
    expect(res.status).toBe(500)
  })

  it('returns 400 when now is not a valid ISO datetime', async () => {
    const res = await occupancyPredictionHandler(makeReq('r1', 'not-a-date'), ctx)
    expect(res.status).toBe(400)
  })
})
