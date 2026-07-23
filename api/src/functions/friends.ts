import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { z } from 'zod'
import type { FriendLink } from '@roomsense/shared'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { getTableClient, TABLE_NAMES } from '../lib/tables'

/**
 * Phase 2 #37 — friend links.
 *
 * Storage layout: FriendLinks (PK: userId, RK: friendId).
 *
 * a) GET  /api/users/{userId}/friends → FriendLink[] (active only)
 * b) POST /api/friends                → create a FriendLink (201)
 * c) DELETE /api/friends              → remove a FriendLink (200)
 *
 * All three HTTP methods are handled by a single `friendsHandler` registered
 * with methods ['GET', 'POST', 'DELETE', 'OPTIONS']. Routing: the GET path
 * uses `users/{userId}/friends` (named `friendsByUser`); the POST/DELETE path
 * uses `friends` (named `createFriend` / `deleteFriend`). Each registration
 * shares the same handler — the handler branches on `req.method`.
 */

type FriendEntity = FriendLink & { partitionKey: string; rowKey: string }

// ─── Body schemas ───

const CreateFriendBody = z.object({
  userId: z.string().min(1),
  friendId: z.string().min(1),
  friendName: z.string().min(1),
})

const DeleteFriendBody = z.object({
  userId: z.string().min(1),
  friendId: z.string().min(1),
})

export async function friendsHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = req.headers.get('origin') ?? undefined

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(origin)
  }

  try {
    if (req.method === 'GET') {
      return await listFriends(req, ctx, origin)
    }
    if (req.method === 'POST') {
      return await createFriend(req, ctx, origin)
    }
    if (req.method === 'DELETE') {
      return await deleteFriend(req, ctx, origin)
    }
    // Non-matching method on this route → 405.
    return withCors(
      { status: 405, jsonBody: { error: 'Method not allowed.' } },
      origin,
    )
  } catch (err) {
    logError(ctx, 'friends handler failed', err)
    return withCors(
      { status: 500, jsonBody: { error: 'Internal server error.' } },
      origin,
    )
  }
}

/** GET /api/users/{userId}/friends → FriendLink[] (active, sorted by friendName asc). */
async function listFriends(
  req: HttpRequest,
  _ctx: InvocationContext,
  origin: string | undefined,
): Promise<HttpResponseInit> {
  const userId = req.params.userId
  if (!userId) {
    return withCors(
      { status: 400, jsonBody: { error: 'Missing userId route parameter.' } },
      origin,
    )
  }

  const client = getTableClient(TABLE_NAMES.friends)
  const entities: FriendEntity[] = []
  const iter = client.listEntities<FriendEntity>({
    queryOptions: { filter: `PartitionKey eq '${userId.replace(/'/g, "''")}'` },
  })
  for await (const e of iter) {
    entities.push(e)
  }

  const friends: FriendLink[] = entities
    .filter((e) => e.status === 'active')
    .map(({ partitionKey: _pk, rowKey: _rk, ...fields }) => fields)

  friends.sort((a, b) =>
    a.friendName < b.friendName ? -1 : a.friendName > b.friendName ? 1 : 0,
  )

  return withCors({ status: 200, jsonBody: friends }, origin)
}

/** POST /api/friends → create a friend link, 201 with the created link. */
async function createFriend(
  req: HttpRequest,
  _ctx: InvocationContext,
  origin: string | undefined,
): Promise<HttpResponseInit> {
  const raw = await parseJsonBody(req)
  const parsed = CreateFriendBody.safeParse(raw)
  if (!parsed.success) {
    return withCors(
      { status: 400, jsonBody: { error: 'Invalid request body.', details: parsed.error.issues } },
      origin,
    )
  }
  const { userId, friendId, friendName } = parsed.data

  const connectedAt = new Date().toISOString()
  const client = getTableClient(TABLE_NAMES.friends)
  await client.createEntity({
    partitionKey: userId,
    rowKey: friendId,
    userId,
    friendId,
    friendName,
    status: 'active',
    canSeeLive: true,
    connectedAt,
  })

  const created: FriendLink = {
    userId,
    friendId,
    friendName,
    status: 'active',
    canSeeLive: true,
    connectedAt,
  }

  return withCors({ status: 201, jsonBody: created }, origin)
}

/** DELETE /api/friends → remove a friend link, 200 with { deleted: true }. */
async function deleteFriend(
  req: HttpRequest,
  _ctx: InvocationContext,
  origin: string | undefined,
): Promise<HttpResponseInit> {
  const raw = await parseJsonBody(req)
  const parsed = DeleteFriendBody.safeParse(raw)
  if (!parsed.success) {
    return withCors(
      { status: 400, jsonBody: { error: 'Invalid request body.', details: parsed.error.issues } },
      origin,
    )
  }
  const { userId, friendId } = parsed.data

  const client = getTableClient(TABLE_NAMES.friends)
  try {
    await client.deleteEntity(userId, friendId)
  } catch (err: unknown) {
    const e = err as { statusCode?: number; code?: string }
    // 404 → link already gone; idempotent delete still reports success.
    if (e?.statusCode !== 404 && e?.code !== 'ResourceNotFound' && e?.code !== 'EntityNotFound') {
      throw err
    }
  }

  return withCors({ status: 200, jsonBody: { deleted: true } }, origin)
}

/** Read + parse the request body as JSON; return {} on empty/missing body. */
async function parseJsonBody(req: HttpRequest): Promise<unknown> {
  const text = await req.text()
  if (!text || text.trim().length === 0) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Malformed JSON body.')
  }
}

// GET route — `friendsByUser`
app.http('friendsByUser', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'users/{userId}/friends',
  handler: friendsHandler,
})

// POST route — `createFriend`
app.http('createFriend', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'friends',
  handler: friendsHandler,
})

// DELETE route — `deleteFriend`
app.http('deleteFriend', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'friends',
  handler: friendsHandler,
})
