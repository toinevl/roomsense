import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import type { UserPresence, PrivacySettings } from '@roomsense/shared'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { getTableClient, TABLE_NAMES } from '../lib/tables'

/**
 * GET /api/presence?building=X → UserPresence[]
 *
 * Phase 2 #37 — social presence. Returns the live presence of users, filtered
 * by building if `?building=` is provided (partition-scoped scan) or all
 * presence if omitted (full table scan).
 *
 * Privacy gate: a user's presence is only included when their stored
 * PrivacySettings has `locationSharingEnabled === true`. Users with no privacy
 * row (or location sharing off) are excluded — never silently returned.
 *
 * Order: displayName asc. Always 200 (returns [] on empty).
 *
 * Storage layout: UserPresence (PK: building, RK: userId),
 *                 UserPrivacy  (PK: userId,  RK: 'settings').
 */

type PresenceEntity = UserPresence & { partitionKey: string; rowKey: string }

type PrivacyEntity = PrivacySettings & { partitionKey: string; rowKey: string }

const PRIVACY_DEFAULTS: PrivacySettings = {
  userId: '',
  locationSharingEnabled: false,
  friendVisibility: 'friends-only',
  reviewAttributionDefault: 'anonymous',
  dataRetentionDays: 1,
  lastUpdated: '',
}

export async function presenceHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = req.headers.get('origin') ?? undefined

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(origin)
  }

  try {
    const building = req.query.get('building')
    const presenceClient = getTableClient(TABLE_NAMES.presence)
    const privacyClient = getTableClient(TABLE_NAMES.privacy)

    const entities: PresenceEntity[] = []
    const listOpts =
      building !== null
        ? { queryOptions: { filter: `PartitionKey eq '${building.replace(/'/g, "''")}'` } }
        : {}
    for await (const entity of presenceClient.listEntities<PresenceEntity>(listOpts)) {
      entities.push(entity)
    }

    // Privacy gate — only include presence for users who have opted in.
    const visible: UserPresence[] = []
    for (const e of entities) {
      const privacy = await getPrivacyForUser(privacyClient, e.userId)
      if (privacy.locationSharingEnabled) {
        const { partitionKey: _pk, rowKey: _rk, ...fields } = e
        visible.push(fields)
      }
    }

    // Order: displayName asc (locale-independent compare is fine for display).
    visible.sort((a, b) =>
      a.displayName < b.displayName ? -1 : a.displayName > b.displayName ? 1 : 0,
    )

    return withCors({ status: 200, jsonBody: visible }, origin)
  } catch (err) {
    logError(ctx, 'presence handler failed', err)
    return withCors(
      { status: 500, jsonBody: { error: 'Internal server error.' } },
      origin,
    )
  }
}

/** Fetch a user's privacy settings, returning privacy-safe defaults on miss. */
async function getPrivacyForUser(
  client: ReturnType<typeof getTableClient>,
  userId: string,
): Promise<PrivacySettings> {
  try {
    const entity = await client.getEntity<PrivacyEntity>(userId, 'settings')
    const { partitionKey: _pk, rowKey: _rk, ...fields } = entity
    return { ...PRIVACY_DEFAULTS, ...fields, userId }
  } catch (err: unknown) {
    const e = err as { statusCode?: number; code?: string }
    // 404 / ResourceNotFound → user has no privacy row yet → defaults.
    if (e?.statusCode === 404 || e?.code === 'ResourceNotFound' || e?.code === 'EntityNotFound') {
      return { ...PRIVACY_DEFAULTS, userId }
    }
    throw err
  }
}

app.http('presence', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'presence',
  handler: presenceHandler,
})
