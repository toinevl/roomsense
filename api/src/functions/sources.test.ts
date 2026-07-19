import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'

/**
 * GET /api/sources handler tests (wishlist #23).
 *
 * Registry is mocked hermetically — we stub its return value per test so
 * the handler's sort/shape/ping-failure logic can be exercised without
 * touching storage. The handler must:
 *   - never throw on ping failure (adapter catches its own and returns
 *     'inactive', but the handler also defends against ping throwing)
 *   - omit lastSyncTs when undefined
 *   - sort adapters by sourceId for deterministic output
 */

vi.mock('../sources/registry', () => ({
  listSourceAdapters: vi.fn(),
}))

import { sourcesHandler } from './sources'
import { listSourceAdapters } from '../sources/registry'
import type { SourceAdapter } from '../sources/types'

function makeReq(method: 'GET' | 'OPTIONS' = 'GET'): HttpRequest {
  return {
    method,
    headers: new Map() as unknown as Headers,
    query: new Map() as unknown as URLSearchParams,
    params: {},
    body: undefined,
  } as unknown as HttpRequest
}

function makeContext(): InvocationContext {
  return { error: vi.fn(), log: vi.fn() } as unknown as InvocationContext
}

function makeAdapter(over: Partial<SourceAdapter>): SourceAdapter {
  return {
    sourceId: over.sourceId ?? 'x',
    kind: over.kind ?? 'sensor',
    displayName: over.displayName ?? 'X',
    ping:
      over.ping ??
      (async () => ({ status: 'active' as const })),
    ...over,
  }
}

describe('GET /api/sources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with an empty array when no adapters are registered', async () => {
    ;(listSourceAdapters as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue([])
    const res = await sourcesHandler(makeReq(), makeContext())
    expect(res.status).toBe(200)
    expect(res.jsonBody).toEqual([])
  })

  it('returns each adapter with its ping result, sorted by sourceId', async () => {
    const adapters = [
      makeAdapter({
        sourceId: 'zeta',
        kind: 'sensor',
        displayName: 'Zeta Sensor',
        async ping() {
          return { status: 'active', lastSyncTs: '2026-07-19T10:00:00Z' }
        },
      }),
      makeAdapter({
        sourceId: 'alpha',
        kind: 'calendar',
        displayName: 'Alpha Calendar',
        async ping() {
          return { status: 'inactive' }
        },
      }),
    ]
    ;(listSourceAdapters as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(adapters)

    const res = await sourcesHandler(makeReq(), makeContext())
    expect(res.status).toBe(200)
    const body = res.jsonBody as Array<Record<string, string>>
    expect(body).toHaveLength(2)
    // Sort is by sourceId, so alpha first.
    expect(body[0].sourceId).toBe('alpha')
    expect(body[0].status).toBe('inactive')
    expect(body[0]).not.toHaveProperty('lastSyncTs')
    expect(body[1].sourceId).toBe('zeta')
    expect(body[1].status).toBe('active')
    expect(body[1].lastSyncTs).toBe('2026-07-19T10:00:00Z')
  })

  it('omits lastSyncTs when ping returns undefined', async () => {
    ;(listSourceAdapters as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue([
      makeAdapter({
        sourceId: 'a',
        async ping() {
          return { status: 'active' }
        },
      }),
    ])
    const res = await sourcesHandler(makeReq(), makeContext())
    const body = res.jsonBody as Array<Record<string, string>>
    expect(body[0]).not.toHaveProperty('lastSyncTs')
  })

  it('OPTIONS preflight returns 204 with no body', async () => {
    const res = await sourcesHandler(makeReq('OPTIONS'), makeContext())
    expect(res.status).toBe(204)
    expect(res.body).toBeUndefined()
  })
})
