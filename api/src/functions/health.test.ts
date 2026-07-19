import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'

// Hermetic tables mock — yields exactly one row so the probe resolves true
// unless the test re-declares getTableClient to throw.
const listEntitiesSpy = vi.fn().mockReturnValue({
  byPage: () =>
    (async function* () {
      yield [{ partitionKey: 'Rooms', rowKey: 'r-1' }]
    })(),
})
const fakeClient = { listEntities: listEntitiesSpy }

vi.mock('../lib/tables', () => ({
  getTableClient: vi.fn(() => fakeClient),
  TABLE_NAMES: { rooms: 'Rooms' },
}))

// Import AFTER mocks are in place.
import { healthHandler } from './health'

function makeContext(): InvocationContext {
  return {
    error: vi.fn(),
    log: vi.fn(),
  } as unknown as InvocationContext
}

function makeReq(method: 'GET' | 'OPTIONS' = 'GET', headers: Record<string, string> = {}): HttpRequest {
  return {
    method,
    headers: new Map(Object.entries(headers)) as unknown as Headers,
    query: new Map() as unknown as URLSearchParams,
    params: {},
    body: undefined,
    get: (k: string) => headers[k],
  } as unknown as HttpRequest
}

describe('GET /api/health', () => {
  beforeEach(() => {
    listEntitiesSpy.mockClear()
    vi.unstubAllEnvs()
  })

  it('returns 200 with status=ok and buildSha from BUILD_SHA env', async () => {
    vi.stubEnv('BUILD_SHA', 'test-sha')
    const res = await healthHandler(makeReq(), makeContext())
    expect(res.status).toBe(200)
    const body = res.jsonBody as { status: string; buildSha: string; tables: boolean }
    expect(body.status).toBe('ok')
    expect(body.buildSha).toBe('test-sha')
  })

  it('defaults buildSha to "dev" when BUILD_SHA unset', async () => {
    delete process.env.BUILD_SHA
    const res = await healthHandler(makeReq(), makeContext())
    const body = res.jsonBody as { buildSha: string }
    expect(body.buildSha).toBe('dev')
  })

  it('reports tables=true when the probe succeeds', async () => {
    const res = await healthHandler(makeReq(), makeContext())
    const body = res.jsonBody as { tables: boolean }
    expect(body.tables).toBe(true)
    expect(listEntitiesSpy).toHaveBeenCalledWith()
  })

  it('reports tables=false (still 200) when the probe throws', async () => {
    const { getTableClient } = await import('../lib/tables')
    ;(getTableClient as unknown as { mockReturnValueOnce: (v: unknown) => void }).mockReturnValueOnce({
      listEntities: () => {
        throw new Error('storage unavailable')
      },
    })
    const ctx = makeContext()
    const res = await healthHandler(makeReq(), ctx)
    expect(res.status).toBe(200)
    const body = res.jsonBody as { status: string; tables: boolean }
    expect(body.status).toBe('ok')
    expect(body.tables).toBe(false)
  })

  it('handles OPTIONS preflight with 204 and no body', async () => {
    const res = await healthHandler(makeReq('OPTIONS'), makeContext())
    expect(res.status).toBe(204)
    expect(res.body).toBeUndefined()
  })
})
