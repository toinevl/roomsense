import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'

/**
 * Unit tests for the presence endpoint — `../lib/tables` mocked hermetically.
 * The mock reads fixture state from globalThis on every call.
 */

declare global {
  var __PRESENCE_TEST_STATE__: {
    presence: any[]
    privacy: Record<string, { locationSharingEnabled: boolean }>
    throwOnList: boolean
  }
}
;(globalThis as any).__PRESENCE_TEST_STATE__ = { presence: [], privacy: {}, throwOnList: false }

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
    const g = () => (globalThis as any).__PRESENCE_TEST_STATE__

    if (name === 'UserPresence') {
      return {
        listEntities(opts?: { queryOptions?: { filter?: string } }) {
          const s = g()
          if (s.throwOnList) throw new Error('storage down')
          let rows = s.presence.slice()
          const filter = opts?.queryOptions?.filter
          if (filter) {
            const m = filter.match(/PartitionKey eq '([^']+)'/)
            const want = m ? m[1].replace(/''/g, "'") : null
            if (want !== null) rows = rows.filter((r: any) => r.building === want)
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

    if (name === 'UserPrivacy') {
      return {
        async getEntity(userId: string) {
          const s = g()
          const row = s.privacy[userId]
          if (row) {
            return {
              partitionKey: userId,
              rowKey: 'settings',
              userId,
              locationSharingEnabled: row.locationSharingEnabled,
              friendVisibility: 'friends-only',
              reviewAttributionDefault: 'anonymous',
              dataRetentionDays: 1,
              lastUpdated: '2026-07-21T10:00:00.000Z',
            }
          }
          const err: any = new Error('not found')
          err.statusCode = 404
          throw err
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

import { presenceHandler } from './presence'

function setState(
  entities: any[],
  privacy: Record<string, { locationSharingEnabled: boolean }>,
  throwOnList = false,
) {
  ;(globalThis as any).__PRESENCE_TEST_STATE__ = { presence: entities, privacy, throwOnList }
}

function makeReq(
  method: 'GET' | 'OPTIONS' = 'GET',
  opts?: { building?: string; origin?: string },
): HttpRequest {
  const url = new URL('http://localhost/api/presence')
  if (opts?.building) url.searchParams.set('building', opts.building)
  const headers = new Headers()
  if (opts?.origin) headers.set('Origin', opts.origin)
  return {
    method,
    url: url.toString(),
    headers,
    query: url.searchParams,
    params: {},
    body: undefined,
  } as unknown as HttpRequest
}

const ctx = { error() {} } as unknown as InvocationContext

describe('GET /api/presence', () => {
  beforeEach(() => {
    setState([], {})
  })

  it('returns 200 with empty array when no presence data', async () => {
    const res = await presenceHandler(makeReq(), ctx)
    expect(res.status).toBe(200)
    expect(res.jsonBody).toEqual([])
  })

  it('returns presence entries sorted by displayName', async () => {
    setState(
      [
        { userId: 'u1', displayName: 'Zoë Müller', building: 'atlas', status: 'available', lastSeenTs: '2026-07-21T10:00:00.000Z' },
        { userId: 'u2', displayName: 'Anaïs Dubois', building: 'atlas', roomId: 'atlas-0.710', status: 'busy', lastSeenTs: '2026-07-21T09:00:00.000Z' },
        { userId: 'u3', displayName: 'Björn Hölm', building: 'atlas', status: 'available', lastSeenTs: '2026-07-21T08:00:00.000Z' },
      ],
      { u1: { locationSharingEnabled: true }, u2: { locationSharingEnabled: true }, u3: { locationSharingEnabled: true } },
    )
    const res = await presenceHandler(makeReq(), ctx)
    expect(res.status).toBe(200)
    expect((res.jsonBody as any[]).map((r: any) => r.displayName)).toEqual([
      'Anaïs Dubois',
      'Björn Hölm',
      'Zoë Müller',
    ])
  })

  it('filters by building query param', async () => {
    setState(
      [
        { userId: 'u1', displayName: 'Anaïs', building: 'atlas', status: 'available', lastSeenTs: '2026-07-21T10:00:00.000Z' },
        { userId: 'u2', displayName: 'Björn', building: 'flux', status: 'available', lastSeenTs: '2026-07-21T10:00:00.000Z' },
      ],
      { u1: { locationSharingEnabled: true }, u2: { locationSharingEnabled: true } },
    )
    const res = await presenceHandler(makeReq('GET', { building: 'atlas' }), ctx)
    expect(res.status).toBe(200)
    const body = res.jsonBody as any[]
    expect(body).toHaveLength(1)
    expect(body[0].building).toBe('atlas')
  })

  it('filters out users whose privacy disables location sharing', async () => {
    setState(
      [
        { userId: 'u1', displayName: 'Anaïs', building: 'atlas', status: 'available', lastSeenTs: '2026-07-21T10:00:00.000Z' },
        { userId: 'u2', displayName: 'Björn', building: 'atlas', status: 'available', lastSeenTs: '2026-07-21T10:00:00.000Z' },
      ],
      { u1: { locationSharingEnabled: true }, u2: { locationSharingEnabled: false } },
    )
    const res = await presenceHandler(makeReq(), ctx)
    const body = res.jsonBody as any[]
    expect(body).toHaveLength(1)
    expect(body[0].userId).toBe('u1')
  })

  it('returns 204 on OPTIONS preflight', async () => {
    const res = await presenceHandler(makeReq('OPTIONS', { origin: 'http://localhost:5173' }), ctx)
    expect(res.status).toBe(204)
  })

  it('returns 500 on storage error', async () => {
    setState([], {}, true)
    const res = await presenceHandler(makeReq(), ctx)
    expect(res.status).toBe(500)
  })
})
