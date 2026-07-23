import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'

/**
 * friends endpoint unit tests (#37).
 *
 * Uses the proven globalThis state pattern from simulate.test.ts: the mock
 * factory reads fixture state lazily from globalThis on EVERY getTableClient
 * call, so setState() in beforeEach gives each test a fresh fixture set.
 */

declare global {
  var __FRIENDS_TEST_STATE__: { links: any[]; createdLinks: any[]; deletedCalls: any[] }
}
;(globalThis as any).__FRIENDS_TEST_STATE__ = { links: [], createdLinks: [], deletedCalls: [] }

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
    if (name === 'FriendLinks') {
      return {
        listEntities(opts?: { queryOptions?: { filter?: string } }) {
          const g = (globalThis as any).__FRIENDS_TEST_STATE__
          let rows = g.links.slice()
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
          ;(globalThis as any).__FRIENDS_TEST_STATE__.createdLinks.push(entity)
        },
        async deleteEntity(pk: string, rk: string) {
          const g = (globalThis as any).__FRIENDS_TEST_STATE__
          g.deletedCalls.push({ pk, rk })
          const idx = g.links.findIndex((e: any) => e.partitionKey === pk && e.rowKey === rk)
          if (idx !== -1) g.links.splice(idx, 1)
          else {
            const err: any = new Error('not found')
            err.statusCode = 404
            throw err
          }
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

import { friendsHandler } from './friends'

function makeReq(method: string, opts: { params?: any; body?: any; origin?: string } = {}): HttpRequest {
  const headers = new Headers()
  if (opts.origin) headers.set('Origin', opts.origin)
  const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : ''
  if (opts.body !== undefined) headers.set('Content-Type', 'application/json')
  return {
    method,
    url: 'http://localhost/api/' + (method === 'GET' ? 'users/user-1/friends' : 'friends'),
    headers,
    query: new URLSearchParams(),
    params: opts.params ?? {},
    body: bodyStr || undefined,
    text: async () => bodyStr,
  } as unknown as HttpRequest
}

const ctx = { error() {} } as unknown as InvocationContext

function setState(links: any[]) {
  ;(globalThis as any).__FRIENDS_TEST_STATE__ = { links: links.slice(), createdLinks: [], deletedCalls: [] }
}

describe('friends endpoint', () => {
  beforeEach(() => {
    setState([])
  })

  it('GET returns active friends for a user sorted by friendName', async () => {
    setState([
      { partitionKey: 'user-1', rowKey: 'user-2', userId: 'user-1', friendId: 'user-2', friendName: 'Zoë Müller', status: 'pending', canSeeLive: true, connectedAt: '2026-07-21T10:00:00.000Z' },
      { partitionKey: 'user-1', rowKey: 'user-3', userId: 'user-1', friendId: 'user-3', friendName: 'Anaïs Dubois', status: 'active', canSeeLive: true, connectedAt: '2026-07-21T09:00:00.000Z' },
      { partitionKey: 'user-1', rowKey: 'user-4', userId: 'user-1', friendId: 'user-4', friendName: 'Björn Hölm', status: 'active', canSeeLive: false, connectedAt: '2026-07-21T08:00:00.000Z' },
    ])
    const res = await friendsHandler(makeReq('GET', { params: { userId: 'user-1' } }), ctx)
    expect(res.status).toBe(200)
    const names = (res.jsonBody as any[]).map((r: any) => r.friendName)
    expect(names).toEqual(['Anaïs Dubois', 'Björn Hölm'])
  })

  it('GET returns empty array for unknown user', async () => {
    const res = await friendsHandler(makeReq('GET', { params: { userId: 'nope' } }), ctx)
    expect(res.status).toBe(200)
    expect(res.jsonBody).toEqual([])
  })

  it('GET returns 400 when userId is missing', async () => {
    const res = await friendsHandler(makeReq('GET', { params: {} }), ctx)
    expect(res.status).toBe(400)
  })

  it('POST creates a friend link and returns 201', async () => {
    const res = await friendsHandler(
      makeReq('POST', { body: { userId: 'user-1', friendId: 'user-5', friendName: 'François Çelik' } }),
      ctx,
    )
    expect(res.status).toBe(201)
    const b = res.jsonBody as any
    expect(b.status).toBe('active')
    expect(b.userId).toBe('user-1')
    expect(b.friendId).toBe('user-5')
    expect(b.canSeeLive).toBe(true)
    // Verify entity was persisted
    const g = (globalThis as any).__FRIENDS_TEST_STATE__
    expect(g.createdLinks).toHaveLength(1)
    expect(g.createdLinks[0].friendName).toBe('François Çelik')
  })

  it('DELETE removes a friend link and returns 200', async () => {
    setState([
      { partitionKey: 'user-1', rowKey: 'user-2', userId: 'user-1', friendId: 'user-2', friendName: 'Anaïs', status: 'active', canSeeLive: true, connectedAt: '2026-07-21T09:00:00.000Z' },
    ])
    const res = await friendsHandler(
      makeReq('DELETE', { body: { userId: 'user-1', friendId: 'user-2' } }),
      ctx,
    )
    expect(res.status).toBe(200)
    expect((res.jsonBody as any).deleted).toBe(true)
  })

  it('DELETE returns 200 even when link does not exist (idempotent)', async () => {
    const res = await friendsHandler(
      makeReq('DELETE', { body: { userId: 'user-1', friendId: 'user-99' } }),
      ctx,
    )
    expect(res.status).toBe(200)
    expect((res.jsonBody as any).deleted).toBe(true)
  })

  it('OPTIONS returns 204', async () => {
    const res = await friendsHandler(makeReq('OPTIONS', { origin: 'http://localhost:5173' }), ctx)
    expect(res.status).toBe(204)
  })

  it('invalid body returns 400 on POST', async () => {
    const res = await friendsHandler(makeReq('POST', { body: { userId: '' } }), ctx)
    expect(res.status).toBe(400)
  })

  it('invalid body returns 400 on DELETE', async () => {
    const res = await friendsHandler(makeReq('DELETE', { body: { userId: 'u1' } }), ctx)
    expect(res.status).toBe(400)
  })
})
