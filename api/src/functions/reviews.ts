import { randomUUID } from 'node:crypto'
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { z } from 'zod'
import type { RoomReview } from '@roomsense/shared'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { getTableClient, TABLE_NAMES } from '../lib/tables'

/**
 * Phase 2 #37 — room reviews.
 *
 * Storage layout: RoomReviews (PK: roomId, RK: reviewId).
 *
 * a) GET  /api/rooms/{roomId}/reviews → RoomReview[] (active only)
 *    Optional ?sort=recent|helpful (default: recent)
 * b) POST /api/reviews                → create a RoomReview (201)
 *
 * GET sorts by createdAt desc (recent) or helpfulCount desc (helpful).
 * POST validates: rating 1-5, title 3-50 chars, body 10-500 chars.
 */

type ReviewEntity = RoomReview & { partitionKey: string; rowKey: string }

const CreateReviewBody = z.object({
  roomId: z.string().min(1),
  authorId: z.string().min(1),
  authorName: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(3).max(50),
  body: z.string().min(10).max(500),
  tags: z.array(z.string()).default([]),
})

export async function reviewsHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = req.headers.get('origin') ?? undefined

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(origin)
  }

  try {
    if (req.method === 'GET') {
      return await listReviews(req, ctx, origin)
    }
    if (req.method === 'POST') {
      return await createReview(req, ctx, origin)
    }
    return withCors({ status: 405, jsonBody: { error: 'Method not allowed.' } }, origin)
  } catch (err) {
    logError(ctx, 'reviews handler failed', err)
    return withCors(
      { status: 500, jsonBody: { error: 'Internal server error.' } },
      origin,
    )
  }
}

/** GET /api/rooms/{roomId}/reviews → RoomReview[] (active only, sorted). */
async function listReviews(
  req: HttpRequest,
  _ctx: InvocationContext,
  origin: string | undefined,
): Promise<HttpResponseInit> {
  const roomId = req.params.roomId
  if (!roomId) {
    return withCors(
      { status: 400, jsonBody: { error: 'Missing roomId route parameter.' } },
      origin,
    )
  }

  const sortParam = req.query.get('sort') ?? 'recent'
  const sortBy = sortParam === 'helpful' ? 'helpful' : 'recent'

  const client = getTableClient(TABLE_NAMES.reviews)
  const entities: ReviewEntity[] = []
  const iter = client.listEntities<ReviewEntity>({
    queryOptions: { filter: `PartitionKey eq '${roomId.replace(/'/g, "''")}'` },
  })
  for await (const e of iter) {
    entities.push(e)
  }

  const reviews: RoomReview[] = entities
    .filter((e) => e.status === 'active')
    .map(({ partitionKey: _pk, rowKey: _rk, ...fields }) => ({
      ...fields,
      // Azure Table Storage doesn't support arrays — tags stored as JSON string.
      tags: typeof fields.tags === 'string' ? safeParseTags(fields.tags) : (fields.tags ?? []),
    }))

  if (sortBy === 'helpful') {
    reviews.sort((a, b) => b.helpfulCount - a.helpfulCount)
  } else {
    reviews.sort((a, b) => {
      const ta = Date.parse(a.createdAt)
      const tb = Date.parse(b.createdAt)
      if (ta < tb) return 1
      if (ta > tb) return -1
      return 0
    })
  }

  return withCors({ status: 200, jsonBody: reviews }, origin)
}

/** POST /api/reviews → create a review, 201 with the created review. */
async function createReview(
  req: HttpRequest,
  _ctx: InvocationContext,
  origin: string | undefined,
): Promise<HttpResponseInit> {
  const raw = await parseJsonBody(req)
  const parsed = CreateReviewBody.safeParse(raw)
  if (!parsed.success) {
    return withCors(
      { status: 400, jsonBody: { error: 'Invalid request body.', details: parsed.error.issues } },
      origin,
    )
  }
  const { roomId, authorId, authorName, rating, title, body, tags } = parsed.data

  const now = new Date().toISOString()
  const reviewId = randomUUID()
  const review: RoomReview = {
    reviewId,
    roomId,
    authorId,
    authorName,
    rating,
    title,
    body,
    tags,
    helpfulCount: 0,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }

  const client = getTableClient(TABLE_NAMES.reviews)
  await client.createEntity({
    partitionKey: roomId,
    rowKey: reviewId,
    ...review,
    tags: JSON.stringify(review.tags), // Azure Tables: no arrays
  })

  return withCors({ status: 201, jsonBody: review }, origin)
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

/** Parse tags from JSON string (Azure Table Storage doesn't support arrays). */
function safeParseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// GET route — `reviewsByRoom`
app.http('reviewsByRoom', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'rooms/{roomId}/reviews',
  handler: reviewsHandler,
})

// POST route — `createReview`
app.http('createReview', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'reviews',
  handler: reviewsHandler,
})
