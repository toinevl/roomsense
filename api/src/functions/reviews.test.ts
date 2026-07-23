import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'

/**
 * reviews endpoint unit tests (#37).
 * Uses globalThis state pattern from simulate.test.ts.
 */

const REVIEWS_INITIAL = [
  { partitionKey: 'atlas-0.710', rowKey: 'rev-1', roomId: 'atlas-0.710', reviewId: 'rev-1', authorId: 'u1', authorName: 'Anaïs', rating: 5, title: 'Perfect for quiet work', body: 'Great lighting and very quiet, ideal for deep focus.', tags: ['quiet'], helpfulCount: 5, status: 'active', createdAt: '2026-07-21T10:00:00.000Z', updatedAt: '2026-07-21T10:00:00.000Z' },
  { partitionKey: 'atlas-0.710', rowKey: 'rev-2', roomId: 'atlas-0.710', reviewId: 'rev-2', authorId: 'u2', authorName: 'Björn', rating: 3, title: 'OK but noisy', body: 'Fine but crowded during peak hours.', tags: ['noisy'], helpfulCount: 2, status: 'flagged', createdAt: '2026-07-21T09:00:00.000Z', updatedAt: '2026-07-21T09:00:00.000Z' },
  { partitionKey: 'atlas-0.710', rowKey: 'rev-3', roomId: 'atlas-0.710', reviewId: 'rev-3', authorId: 'u3', authorName: 'Zoë', rating: 4, title: 'Good lighting', body: 'Nice natural light in the afternoon.', tags: ['good-lighting'], helpfulCount: 1, status: 'active', createdAt: '2026-07-21T08:00:00.000Z', updatedAt: '2026-07-21T08:00:00.000Z' },
  { partitionKey: 'flux-2.240', rowKey: 'rev-4', roomId: 'flux-2.240', reviewId: 'rev-4', authorId: 'u1', authorName: 'Anaïs', rating: 5, title: 'Amazing space', body: 'The best room on this floor, truly.', tags: ['fast-wifi'], helpfulCount: 0, status: 'active', createdAt: '2026-07-21T10:00:00.000Z', updatedAt: '2026-07-21T10:00:00.000Z' },
]

declare global {
  var __REVIEWS_TEST_STATE__: { reviews: any[]; createdReviews: any[] }
}
;(globalThis as any).__REVIEWS_TEST_STATE__ = {
  reviews: REVIEWS_INITIAL.slice(),
  createdReviews: [],
}

vi.mock('../lib/tables', () => ({
  TABLE_NAMES: {
    rooms: 'Rooms',
    readings: 'SensorReadings',
    snapshots: 'OccupancySnapshots',
    reservations: 'Reservations',
    sources: 'Sources',
    presence: 'UserPresence',
    friends: 'FriendLinks',
    reviews: 'RoomReviews',
    privacy: 'UserPrivacy',
  },
  getTableClient: (name: string) => {
    if (name === 'RoomReviews') {
      return {
        listEntities(opts?: { queryOptions?: { filter?: string } }) {
          const g = (globalThis as any).__REVIEWS_TEST_STATE__
          let rows = g.reviews.slice()
          const filter = opts?.queryOptions?.filter
          if (filter) {
            const m = filter.match(/^PartitionKey eq '(.*)'$/)
            if (m) rows = rows.filter((e: any) => e.partitionKey === m[1].replace(/''/g, "'"))
          }
          return {
            [Symbol.asyncIterator]() {
              let i = 0
              return { next: async () => (i < rows.length ? { value: rows[i++], done: false } : { value: undefined, done: true }) }
            },
          }
        },
        async createEntity(entity: any) {
          ;(globalThis as any).__REVIEWS_TEST_STATE__.createdReviews.push(entity)
        },
      }
    }
    return {
      listEntities() {
        return { [Symbol.asyncIterator]() { return { next: async () => ({ value: undefined, done: true }) } } }
      },
    }
  },
}))

import { reviewsHandler } from './reviews'

function makeReq(
  method: string,
  opts: { params?: Record<string, string>; body?: any; sort?: string; origin?: string } = {},
): HttpRequest {
  const url = new URL('http://localhost/api/')
  if (opts.sort) url.searchParams.set('sort', opts.sort)
  const headers = new Headers()
  if (opts.origin) headers.set('Origin', opts.origin)
  const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : ''
  if (opts.body !== undefined) headers.set('Content-Type', 'application/json')
  return {
    method,
    url: url.toString(),
    headers,
    query: url.searchParams,
    params: opts.params ?? {},
    body: bodyStr || undefined,
    text: async () => bodyStr,
  } as unknown as HttpRequest
}

const ctx = { error() {} } as unknown as InvocationContext

function resetState() {
  ;(globalThis as any).__REVIEWS_TEST_STATE__ = {
    reviews: REVIEWS_INITIAL.slice(),
    createdReviews: [],
  }
}

describe('reviews endpoint', () => {
  beforeEach(() => {
    resetState()
  })

  it('GET returns active reviews sorted by createdAt desc (recent default)', async () => {
    const res = await reviewsHandler(makeReq('GET', { params: { roomId: 'atlas-0.710' } }), ctx)
    expect(res.status).toBe(200)
    const body = res.jsonBody as any[]
    expect(body).toHaveLength(2)
    expect(body[0].reviewId).toBe('rev-1')
    expect(body[1].reviewId).toBe('rev-3')
  })

  it('GET with sort=helpful sorts by helpfulCount desc', async () => {
    const res = await reviewsHandler(makeReq('GET', { params: { roomId: 'atlas-0.710' }, sort: 'helpful' }), ctx)
    const body = res.jsonBody as any[]
    expect(body[0].reviewId).toBe('rev-1')
    expect(body[1].reviewId).toBe('rev-3')
  })

  it('GET filters out flagged/deleted reviews', async () => {
    const res = await reviewsHandler(makeReq('GET', { params: { roomId: 'atlas-0.710' } }), ctx)
    const ids = (res.jsonBody as any[]).map((r: any) => r.reviewId)
    expect(ids).not.toContain('rev-2')
  })

  it('GET returns empty array for room with no reviews', async () => {
    const res = await reviewsHandler(makeReq('GET', { params: { roomId: 'no-such' } }), ctx)
    expect(res.status).toBe(200)
    expect(res.jsonBody).toEqual([])
  })

  it('POST creates a review with generated fields and returns 201', async () => {
    const res = await reviewsHandler(
      makeReq('POST', { body: { roomId: 'neuron-0.150', authorId: 'u1', authorName: 'Björn Hölm', rating: 4, title: 'Nice room overall', body: 'Comfortable and great tables for group work.', tags: ['quiet', 'group-friendly'] } }),
      ctx,
    )
    expect(res.status).toBe(201)
    const body = res.jsonBody as any
    expect(body.roomId).toBe('neuron-0.150')
    expect(body.rating).toBe(4)
    expect(body.status).toBe('active')
    expect(body.helpfulCount).toBe(0)
    expect(body.reviewId).toBeTruthy()
    // Verify persisted
    const g = (globalThis as any).__REVIEWS_TEST_STATE__
    expect(g.createdReviews).toHaveLength(1)
  })

  it('POST rejects invalid rating (outside 1-5)', async () => {
    const res = await reviewsHandler(
      makeReq('POST', { body: { roomId: 'r1', authorId: 'u1', authorName: 'A', rating: 6, title: 'Must be valid here', body: 'Good enough for working sessions daily.', tags: [] } }),
      ctx,
    )
    expect(res.status).toBe(400)
  })

  it('POST rejects short title', async () => {
    const res = await reviewsHandler(
      makeReq('POST', { body: { roomId: 'r1', authorId: 'u1', authorName: 'A', rating: 3, title: 'OK', body: 'Good enough for working sessions daily.', tags: [] } }),
      ctx,
    )
    expect(res.status).toBe(400)
  })

  it('OPTIONS returns 204', async () => {
    const res = await reviewsHandler(makeReq('OPTIONS', { origin: 'http://localhost:5173' }), ctx)
    expect(res.status).toBe(204)
  })
})
