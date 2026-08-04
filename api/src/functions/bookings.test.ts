import { describe, it, expect, beforeEach, vi, test } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'
import type { UserBooking } from '@roomsense/shared'

// ─── Pure function tests (no table mocking) ───

import { deriveStreak, computeUnlocks } from './bookings'

function booking(userId: string, roomId: string, bookedAt: string): UserBooking {
  return { userId, roomId, bookedAt }
}

describe('deriveStreak', () => {
  test('returns 0 for no bookings', () => {
    expect(deriveStreak([], '2026-08-04T10:00:00.000Z').currentStreakDays).toBe(0)
  })

  test('counts a single booking today as a 1-day streak', () => {
    const bookings = [booking('user-1', 'r1', '2026-08-04T09:00:00.000Z')] // Tuesday
    expect(deriveStreak(bookings, '2026-08-04T10:00:00.000Z').currentStreakDays).toBe(1)
  })

  test('does not break the streak if today has no booking yet', () => {
    // Booked yesterday (Monday), referenceTs is Tuesday with nothing booked yet today.
    const bookings = [booking('user-1', 'r1', '2026-08-03T09:00:00.000Z')]
    expect(deriveStreak(bookings, '2026-08-04T08:00:00.000Z').currentStreakDays).toBe(1)
  })

  test('weekend does not break a Friday-to-Monday streak', () => {
    const bookings = [
      booking('user-1', 'r1', '2026-07-31T09:00:00.000Z'), // Friday
      booking('user-1', 'r1', '2026-08-03T09:00:00.000Z'), // Monday
    ]
    // referenceTs: Monday, already booked today.
    expect(deriveStreak(bookings, '2026-08-03T12:00:00.000Z').currentStreakDays).toBe(2)
  })

  test('a weekday gap DOES break the streak, even across a weekend it does not touch', () => {
    const bookings = [
      booking('user-1', 'r1', '2026-07-30T09:00:00.000Z'), // Thursday
      booking('user-1', 'r1', '2026-08-03T09:00:00.000Z'), // Monday (Friday between them has no booking)
    ]
    expect(deriveStreak(bookings, '2026-08-04T08:00:00.000Z').currentStreakDays).toBe(1)
  })

  test('only counts distinct calendar dates, not multiple bookings on the same day', () => {
    const bookings = [
      booking('user-1', 'r1', '2026-08-04T09:00:00.000Z'),
      booking('user-1', 'r2', '2026-08-04T14:00:00.000Z'),
    ]
    expect(deriveStreak(bookings, '2026-08-04T15:00:00.000Z').currentStreakDays).toBe(1)
  })
})

describe('computeUnlocks', () => {
  test('nothing unlocked at streak 0', () => {
    const unlocks = computeUnlocks(0)
    expect(unlocks.every((u) => !u.unlocked)).toBe(true)
    expect(unlocks.map((u) => u.threshold)).toEqual([3, 7, 14])
  })

  test('only the 3-day unlock is unlocked at streak 5', () => {
    const unlocks = computeUnlocks(5)
    expect(unlocks.find((u) => u.threshold === 3)?.unlocked).toBe(true)
    expect(unlocks.find((u) => u.threshold === 7)?.unlocked).toBe(false)
    expect(unlocks.find((u) => u.threshold === 14)?.unlocked).toBe(false)
  })

  test('all three unlocked at streak 14', () => {
    const unlocks = computeUnlocks(14)
    expect(unlocks.every((u) => u.unlocked)).toBe(true)
  })
})

// ─── Handler-level tests (table-mocked, matching presence.test.ts's style) ───

declare global {
  var __BOOKINGS_TEST_STATE__: { bookings: any[]; throwOnList: boolean }
}
;(globalThis as any).__BOOKINGS_TEST_STATE__ = { bookings: [], throwOnList: false }

vi.mock('../lib/tables', () => ({
  TABLE_NAMES: { userBookings: 'UserBookings' },
  getTableClient: (name: string) => {
    const g = () => (globalThis as any).__BOOKINGS_TEST_STATE__
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
        async createEntity(entity: any) {
          const s = g()
          if (s.throwOnList) throw new Error('storage down')
          s.bookings.push(entity)
        },
      }
    }
    throw new Error(`unexpected table: ${name}`)
  },
}))

import { bookingsHandler, streakHandler, unlocksHandler } from './bookings'

function setState(bookings: any[], throwOnList = false) {
  ;(globalThis as any).__BOOKINGS_TEST_STATE__ = { bookings, throwOnList }
}

function makeReq(
  method: string,
  userId: string,
  opts?: { now?: string; origin?: string; body?: unknown },
): HttpRequest {
  const url = new URL(`http://localhost/api/users/${userId}/booking`)
  if (opts?.now) url.searchParams.set('now', opts.now)
  const headers = new Headers()
  if (opts?.origin) headers.set('Origin', opts.origin)
  return {
    method,
    url: url.toString(),
    headers,
    query: url.searchParams,
    params: { id: userId },
    text: async () => (opts?.body ? JSON.stringify(opts.body) : ''),
  } as unknown as HttpRequest
}

const ctx = { error() {} } as unknown as InvocationContext

describe('POST /api/users/{id}/booking', () => {
  beforeEach(() => setState([]))

  it('creates a booking and returns 201', async () => {
    const res = await bookingsHandler(
      makeReq('POST', 'user-1', { body: { roomId: 'atlas-0.710', bookedAt: '2026-08-04T09:00:00.000Z' } }),
      ctx,
    )
    expect(res.status).toBe(201)
    expect((res.jsonBody as any).roomId).toBe('atlas-0.710')
  })

  it('returns 400 on invalid body', async () => {
    const res = await bookingsHandler(makeReq('POST', 'user-1', { body: { roomId: '' } }), ctx)
    expect(res.status).toBe(400)
  })

  it('returns 500 on storage error', async () => {
    setState([], true)
    const res = await bookingsHandler(
      makeReq('POST', 'user-1', { body: { roomId: 'atlas-0.710', bookedAt: '2026-08-04T09:00:00.000Z' } }),
      ctx,
    )
    expect(res.status).toBe(500)
  })

  it('returns 400 on malformed JSON body', async () => {
    const req = makeReq('POST', 'user-1', {})
    req.text = async () => '{not valid json'
    const res = await bookingsHandler(req, ctx)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/users/{id}/streak', () => {
  beforeEach(() => setState([]))

  it('returns 200 with currentStreakDays 0 for no history', async () => {
    const res = await streakHandler(makeReq('GET', 'user-1', { now: '2026-08-04T10:00:00.000Z' }), ctx)
    expect(res.status).toBe(200)
    expect((res.jsonBody as any).currentStreakDays).toBe(0)
  })

  it('returns 400 on a malformed now query param', async () => {
    const res = await streakHandler(makeReq('GET', 'user-1', { now: 'not-a-date' }), ctx)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/users/{id}/unlocks', () => {
  beforeEach(() => setState([]))

  it('returns all 3 thresholds, none unlocked, for no history', async () => {
    const res = await unlocksHandler(makeReq('GET', 'user-1', { now: '2026-08-04T10:00:00.000Z' }), ctx)
    expect(res.status).toBe(200)
    expect((res.jsonBody as any[])).toHaveLength(3)
    expect((res.jsonBody as any[]).every((u) => !u.unlocked)).toBe(true)
  })

  it('returns 400 on a malformed now query param', async () => {
    const res = await unlocksHandler(makeReq('GET', 'user-1', { now: 'not-a-date' }), ctx)
    expect(res.status).toBe(400)
  })
})
