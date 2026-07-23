import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { z } from 'zod'
import type { PrivacySettings } from '@roomsense/shared'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { getTableClient, TABLE_NAMES } from '../lib/tables'

/**
 * Phase 2 #37 — privacy settings.
 *
 * Storage layout: UserPrivacy (PK: userId, RK: 'settings').
 *
 * a) GET  /api/users/{userId}/privacy → PrivacySettings
 *    Returns existing settings or privacy-safe defaults if none found.
 *
 * b) PATCH /api/users/{userId}/privacy → update privacy settings.
 *    Body: Partial<PrivacySettings> (subset of the four optional fields).
 *    Merges with existing, updates lastUpdated.
 *    Validate: only allow the four known mutable fields.
 */

type PrivacyEntity = PrivacySettings & { partitionKey: string; rowKey: string }

const PRIVACY_DEFAULTS: PrivacySettings = {
  userId: '',
  locationSharingEnabled: false,
  friendVisibility: 'friends-only',
  reviewAttributionDefault: 'anonymous',
  dataRetentionDays: 1,
  lastUpdated: '',
}

const PatchBodySchema = z.object({
  locationSharingEnabled: z.boolean().optional(),
  friendVisibility: z.enum(['friends-only', 'campus', 'public']).optional(),
  reviewAttributionDefault: z.enum(['anonymous', 'named']).optional(),
  dataRetentionDays: z.number().int().min(1).max(365).optional(),
})

export async function privacyHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = req.headers.get('origin') ?? undefined

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(origin)
  }

  try {
    if (req.method === 'GET') {
      return await getPrivacy(req, origin)
    }
    if (req.method === 'PATCH') {
      return await patchPrivacy(req, ctx, origin)
    }
    return withCors({ status: 405, jsonBody: { error: 'Method not allowed.' } }, origin)
  } catch (err) {
    logError(ctx, 'privacy handler failed', err)
    return withCors(
      { status: 500, jsonBody: { error: 'Internal server error.' } },
      origin,
    )
  }
}

/** GET /api/users/{userId}/privacy → PrivacySettings (stored or defaults). */
async function getPrivacy(
  req: HttpRequest,
  origin: string | undefined,
): Promise<HttpResponseInit> {
  const userId = req.params.userId
  if (!userId) {
    return withCors(
      { status: 400, jsonBody: { error: 'Missing userId route parameter.' } },
      origin,
    )
  }

  const client = getTableClient(TABLE_NAMES.privacy)
  let settings = await fetchSettings(client, userId)

  return withCors({ status: 200, jsonBody: settings }, origin)
}

/** PATCH /api/users/{userId}/privacy → merge body into stored settings. */
async function patchPrivacy(
  req: HttpRequest,
  ctx: InvocationContext,
  origin: string | undefined,
): Promise<HttpResponseInit> {
  const userId = req.params.userId
  if (!userId) {
    return withCors(
      { status: 400, jsonBody: { error: 'Missing userId route parameter.' } },
      origin,
    )
  }

  const raw = await parseJsonBody(req)
  const parsed = PatchBodySchema.safeParse(raw)
  if (!parsed.success) {
    return withCors(
      { status: 400, jsonBody: { error: 'Invalid request body.', details: parsed.error.issues } },
      origin,
    )
  }

  const client = getTableClient(TABLE_NAMES.privacy)
  const existing = await fetchSettings(client, userId)

  const merged: PrivacySettings = {
    ...existing,
    ...parsed.data,
    userId,
    lastUpdated: new Date().toISOString(),
  }

  await client.upsertEntity({
    partitionKey: userId,
    rowKey: 'settings',
    ...merged,
  })

  return withCors({ status: 200, jsonBody: merged }, origin)
}

/** Fetch stored settings for a user, returning built-in defaults when absent. */
async function fetchSettings(client: ReturnType<typeof getTableClient>, userId: string): Promise<PrivacySettings> {
  try {
    const entity = await client.getEntity<PrivacyEntity>(userId, 'settings')
    const { partitionKey: _pk, rowKey: _rk, ...fields } = entity
    return { ...PRIVACY_DEFAULTS, ...fields, userId }
  } catch (err: unknown) {
    const e = err as { statusCode?: number; code?: string }
    if (e?.statusCode === 404 || e?.code === 'ResourceNotFound' || e?.code === 'EntityNotFound') {
      return { ...PRIVACY_DEFAULTS, userId, lastUpdated: new Date().toISOString() }
    }
    throw err
  }
}

async function parseJsonBody(req: HttpRequest): Promise<unknown> {
  const text = await req.text()
  if (!text || text.trim().length === 0) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Malformed JSON body.')
  }
}

// GET route — `privacyByUser`
app.http('privacyByUser', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'users/{userId}/privacy',
  handler: privacyHandler,
})

// PATCH route — `updatePrivacy`
app.http('updatePrivacy', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'users/{userId}/privacy',
  handler: privacyHandler,
})
