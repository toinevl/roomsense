import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { listSourceAdapters } from '../sources/registry'

/**
 * GET /api/sources — list every registered source adapter and its liveness.
 *
 * Wishlist #23. This endpoint is the runtime-visible proof of the adapter
 * seam: every adapter registered in `src/sources/registry.ts` shows up
 * here with its `kind`, `displayName`, and a freshly-computed `ping()`
 * result. Adding a source is a one-line registry change; this endpoint
 * needs no edits.
 *
 * Contract:
 *   [
 *     { sourceId, kind, displayName, status, lastSyncTs? },
 *     ...
 *   ]
 *
 * `status` / `lastSyncTs` come from `await adapter.ping()` — never throw
 * (adapters catch their own storage errors and report 'inactive').
 */

type SourceResponse = {
  sourceId: string
  kind: string
  displayName: string
  status: string
  lastSyncTs?: string
}

export async function sourcesHandler(
  _req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = _req.headers.get('origin') ?? undefined

  if (_req.method === 'OPTIONS') {
    return corsPreflightResponse(origin)
  }

  try {
    const adapters = listSourceAdapters()
    const results = await Promise.all(
      adapters.map(async (adapter) => {
        const ping = await adapter.ping()
        return {
          sourceId: adapter.sourceId,
          kind: adapter.kind,
          displayName: adapter.displayName,
          status: ping.status,
          ...(ping.lastSyncTs ? { lastSyncTs: ping.lastSyncTs } : {}),
        } satisfies SourceResponse
      }),
    )

    // Stable order so the dashboard render is deterministic across calls.
    results.sort((a, b) => a.sourceId.localeCompare(b.sourceId))

    return withCors({ status: 200, jsonBody: results }, origin)
  } catch (err) {
    logError(ctx, 'sources handler failed', err)
    return withCors(
      { status: 500, jsonBody: { error: 'Internal server error.' } },
      origin,
    )
  }
}

app.http('sources', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sources',
  handler: sourcesHandler,
})
