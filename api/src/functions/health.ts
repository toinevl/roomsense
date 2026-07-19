import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { getTableClient, TABLE_NAMES } from '../lib/tables'

/**
 * GET /api/health — liveness + dependency probe.
 *
 * Contract (wishlist #6, frozen):
 *   { status: 'ok', buildSha: string, tables: boolean }
 *
 * - status: always 'ok' when this handler returns 200.
 * - buildSha: process.env.BUILD_SHA (default 'dev').
 * - tables: true if a 1-row probe against the Rooms table succeeds;
 *   false on ANY error. Degraded storage is still a 200 with tables:false —
 *   health must never throw and never depend on mutating the store.
 *
 * This endpoint is intentionally cheap and side-effect-free so it can sit
 * behind the Functions host uptime check without skewing metrics.
 */
export async function healthHandler(
  _req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  if (_req.method === 'OPTIONS') {
    const origin = _req.headers.get('origin') ?? undefined
    return corsPreflightResponse(origin)
  }

  let tables = true
  try {
    const client = getTableClient(TABLE_NAMES.rooms)
    // listEntities itself is lazy; the probe only needs the first page, so we
    // drive a single .next() on a maxPageSize=1 pager. (Note: maxPageSize is
    // a PagingOptions field on byPage(), NOT a ListTableEntitiesOptions field.)
    const pager = client.listEntities().byPage({ maxPageSize: 1 })
    await pager.next()
  } catch (err: unknown) {
    tables = false
    logError(ctx, 'health: tables probe failed', err)
  }

  const buildSha = process.env.BUILD_SHA ?? 'dev'
  const origin = _req.headers.get('origin') ?? undefined

  return withCors(
    {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      jsonBody: {
        status: 'ok',
        buildSha,
        tables,
      },
    },
    origin,
  )
}

app.http('health', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'health',
  handler: healthHandler,
})
