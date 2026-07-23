import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'

/**
 * privacy endpoint unit tests (#37).
 * Uses globalThis state pattern from simulate.test.ts.
 */

declare global {
  var __PRIVACY_TEST_STATE__: Record<string, Record<string, any>>
}
;(globalThis as any).__PRIVACY_TEST_STATE__ = {}

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
    if (name === 'UserPrivacy') {
      return {
        async getEntity(pk: string, rk: string) {
          const store = (globalThis as any).__PRIVACY_TEST_STATE__ ?? {}
          const userStore = store[pk] ?? {}
          if (rk in userStore) {
            return { partitionKey: pk, rowKey: rk, ...userStore[rk] }
          }
          const err: any = new Error('not found')
          err.statusCode = 404
          throw err
        },
        async upsertEntity(entity: any) {
          const store = (globalThis as any).__PRIVACY_TEST_STATE__ ?? {}
          const pk = entity.partitionKey
          const rk = entity.rowKey
          if (!store[pk]) store[pk] = {}
          const { partitionKey: _pk, rowKey: _rk, ...fields } = entity
          store[pk][rk] = fields
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

import { privacyHandler } from './privacy'

function makeReq(
  method: string,
  opts: { params?: Record<string, string>; body?: any; origin?: string } = {},
): HttpRequest {
  const headers = new Headers()
  if (opts.origin) headers.set('Origin', opts.origin)
  const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : ''
  if (opts.body !== undefined) headers.set('Content-Type', 'application/json')
  return {
    method,
    url: 'http://localhost/api/',
    headers,
    query: new URLSearchParams(),
    params: opts.params ?? {},
    body: bodyStr || undefined,
    text: async () => bodyStr,
  } as unknown as HttpRequest
}

const ctx = { error() {} } as unknown as InvocationContext

function setPrivacy(data: Record<string, Record<string, any>>) {
  ;(globalThis as any).__PRIVACY_TEST_STATE__ = {}
  for (const [userId, rows] of Object.entries(data)) {
    ;(globalThis as any).__PRIVACY_TEST_STATE__[userId] = { ...rows }
  }
}

describe('privacy endpoint', () => {
  beforeEach(() => {
    setPrivacy({})
  })

  it('GET returns defaults when no settings exist', async () => {
    const res = await privacyHandler(makeReq('GET', { params: { userId: 'user-1' } }), ctx)
    expect(res.status).toBe(200)
    const body = res.jsonBody as any
    expect(body.locationSharingEnabled).toBe(false)
    expect(body.friendVisibility).toBe('friends-only')
    expect(body.reviewAttributionDefault).toBe('anonymous')
    expect(body.dataRetentionDays).toBe(1)
    expect(body.userId).toBe('user-1')
  })

  it('GET returns stored settings when they exist', async () => {
    setPrivacy({
      'user-5': {
        settings: {
          userId: 'user-5',
          locationSharingEnabled: true,
          friendVisibility: 'campus',
          reviewAttributionDefault: 'named',
          dataRetentionDays: 30,
          lastUpdated: '2026-07-20T08:00:00.000Z',
        },
      },
    })
    const res = await privacyHandler(makeReq('GET', { params: { userId: 'user-5' } }), ctx)
    expect(res.status).toBe(200)
    const body = res.jsonBody as any
    expect(body.locationSharingEnabled).toBe(true)
    expect(body.friendVisibility).toBe('campus')
    expect(body.dataRetentionDays).toBe(30)
  })

  it('PATCH updates specific fields and preserves others', async () => {
    setPrivacy({
      'user-7': {
        settings: {
          userId: 'user-7',
          locationSharingEnabled: false,
          friendVisibility: 'friends-only',
          reviewAttributionDefault: 'anonymous',
          dataRetentionDays: 1,
          lastUpdated: '2026-07-20T08:00:00.000Z',
        },
      },
    })
    const res = await privacyHandler(
      makeReq('PATCH', {
        params: { userId: 'user-7' },
        body: { locationSharingEnabled: true, dataRetentionDays: 7 },
      }),
      ctx,
    )
    expect(res.status).toBe(200)
    const body = res.jsonBody as any
    expect(body.locationSharingEnabled).toBe(true)
    expect(body.dataRetentionDays).toBe(7)
    expect(body.friendVisibility).toBe('friends-only')
  })

  it('PATCH updates lastUpdated timestamp', async () => {
    const before = Date.now()
    const res = await privacyHandler(
      makeReq('PATCH', {
        params: { userId: 'user-1' },
        body: { friendVisibility: 'public' },
      }),
      ctx,
    )
    expect(res.status).toBe(200)
    const body = res.jsonBody as any
    const ts = Date.parse(body.lastUpdated)
    expect(ts).toBeGreaterThanOrEqual(before)
  })

  it('OPTIONS returns 204', async () => {
    const res = await privacyHandler(makeReq('OPTIONS', { origin: 'http://localhost:5173' }), ctx)
    expect(res.status).toBe(204)
  })
})
