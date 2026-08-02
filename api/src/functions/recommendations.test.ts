import { describe, it, expect, beforeEach, vi, test } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'

import { scoreRoom } from './recommendations'

function room(overrides: Partial<{ roomId: string; building: string; floor: number; occupancy: number; utilizationPct: number }> = {}) {
  return { roomId: 'r1', building: 'atlas', floor: 0, occupancy: 0, utilizationPct: 50, ...overrides }
}

describe('scoreRoom', () => {
  test('repeat=false, no last booking: score is purely popularity + neutral distance', () => {
    const r = room({ utilizationPct: 80 })
    // 0.5*0 + 0.3*0.8 + 0.2*0.6(neutral) = 0.24 + 0.12 = 0.36
    expect(scoreRoom(r, false, null)).toBeCloseTo(0.36, 5)
  })

  test('repeat=true dominates the score', () => {
    const r = room({ utilizationPct: 0 })
    // 0.5*1 + 0.3*0 + 0.2*0.6(neutral, no last booking) = 0.5 + 0.12 = 0.62
    expect(scoreRoom(r, true, null)).toBeCloseTo(0.62, 5)
  })

  test('same building+floor as last booking scores full distance weight', () => {
    const r = room({ building: 'atlas', floor: 2, utilizationPct: 0 })
    const last = room({ building: 'atlas', floor: 2 })
    // 0.5*0 + 0.3*0 + 0.2*1.0 = 0.2
    expect(scoreRoom(r, false, last)).toBeCloseTo(0.2, 5)
  })

  test('same building different floor scores partial distance weight', () => {
    const r = room({ building: 'atlas', floor: 5, utilizationPct: 0 })
    const last = room({ building: 'atlas', floor: 1 })
    // 0.2 * 0.6 = 0.12
    expect(scoreRoom(r, false, last)).toBeCloseTo(0.12, 5)
  })

  test('different building scores minimal distance weight', () => {
    const r = room({ building: 'flux', utilizationPct: 0 })
    const last = room({ building: 'atlas' })
    // 0.2 * 0.2 = 0.04
    expect(scoreRoom(r, false, last)).toBeCloseTo(0.04, 5)
  })
})

// ─── Handler-level tests ───

declare global {
  var __RECS_TEST_STATE__: { rooms: any[]; bookings: any[]; throwOnList: boolean }
}
;(globalThis as any).__RECS_TEST_STATE__ = { rooms: [], bookings: [], throwOnList: false }

vi.mock('../lib/tables', () => ({
  TABLE_NAMES: { rooms: 'Rooms', userBookings: 'UserBookings' },
  getTableClient: (name: string) => {
    const g = () => (globalThis as any).__RECS_TEST_STATE__
    if (name === 'UserBookings') {
      return {
        listEntities(opts?: { queryOptions?: { filter?: string } }) {
          const s = g()
          if (s.throwOnList) throw new Error('storage down')
          let rows = s.bookings.slice()
          const filter = opts?.queryOptions?.filter
          if (filter) {
            const m = filter.match(/PartitionKey eq '([^']+)'/)
            const want = m ? m[1].replace(/''/g, "'") : null
            if (want !== null) rows = rows.filter((r: any) => r.userId === want)
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

vi.mock('./rooms', () => ({
  listRoomsWithOccupancy: async () => (globalThis as any).__RECS_TEST_STATE__.rooms,
}))

import { recommendationsHandler } from './recommendations'

function setState(rooms: any[], bookings: any[] = [], throwOnList = false) {
  ;(globalThis as any).__RECS_TEST_STATE__ = { rooms, bookings, throwOnList }
}

function makeReq(userId: string, now: string): HttpRequest {
  const url = new URL('http://localhost/api/recommendations')
  url.searchParams.set('userId', userId)
  url.searchParams.set('now', now)
  return { method: 'GET', url: url.toString(), headers: new Headers(), query: url.searchParams, params: {} } as unknown as HttpRequest
}

const ctx = { error() {} } as unknown as InvocationContext

describe('GET /api/recommendations', () => {
  beforeEach(() => setState([]))

  it('returns only free rooms as hero+alternates', async () => {
    setState([
      { roomId: 'r1', building: 'atlas', floor: 0, occupancy: 0, utilizationPct: 80, name: 'Free Room' },
      { roomId: 'r2', building: 'atlas', floor: 0, occupancy: 3, utilizationPct: 90, name: 'Busy Room' },
    ])
    const res = await recommendationsHandler(makeReq('user-1', '2026-08-04T10:00:00.000Z'), ctx)
    expect(res.status).toBe(200)
    const body = res.jsonBody as any
    expect(body.hero.roomId).toBe('r1')
    expect(body.alternates).toEqual([])
  })

  it('returns 500 on storage error', async () => {
    setState([], [], true)
    const res = await recommendationsHandler(makeReq('user-1', '2026-08-04T10:00:00.000Z'), ctx)
    expect(res.status).toBe(500)
  })
})
