import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { z } from 'zod'
import type { UserBooking } from '@roomsense/shared'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { ensureTable, TABLE_NAMES } from '../lib/tables'

/**
 * Phase 3 #38 — gamification. Storage layout: UserBookings (PK: userId,
 * RK: `${bookedAt}_${roomId}`, timestamp-first for natural descending order).
 *
 * Streak and unlocks are DERIVED from UserBookings on every read, never a
 * stored counter — matches this project's existing ghost-derivation /
 * latest-occupancy-anchoring convention (see CLAUDE.md).
 *
 * a) POST /api/users/{id}/booking       → append a booking row (201)
 * b) GET  /api/users/{id}/streak?now=   → { userId, currentStreakDays, longestStreakDays, totalBookings }
 * c) GET  /api/users/{id}/unlocks?now=  → Array<{ threshold, label, unlocked }>
 */

type BookingEntity = UserBooking & { partitionKey: string; rowKey: string }

const CreateBookingBody = z.object({
  roomId: z.string().min(1),
  bookedAt: z.string().datetime(),
})

const QueryNowSchema = z.object({ now: z.string().datetime().optional() })

const UNLOCK_THRESHOLDS: Array<{ threshold: number; label: string }> = [
  { threshold: 3, label: 'Early access to RoomSense Wrapped' },
  { threshold: 7, label: '"Regular" badge on your reviews' },
  { threshold: 14, label: 'Shoutout on the Trust page' },
]

const MS_PER_DAY = 86_400_000

function utcDateOnly(iso: string): string {
  return iso.slice(0, 10)
}

function isWeekend(dateOnly: string): boolean {
  const day = new Date(`${dateOnly}T00:00:00.000Z`).getUTCDay()
  return day === 0 || day === 6
}

function previousDateOnly(dateOnly: string): string {
  const ms = Date.parse(`${dateOnly}T00:00:00.000Z`) - MS_PER_DAY
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * Walks backward one weekday at a time from referenceTs's UTC date, skipping
 * weekends entirely. Today (referenceTs's date) doesn't stop the walk even
 * if unbooked yet — a streak isn't broken until a full day passes with no
 * booking. See spec's worked example for the exact semantics.
 */
export function deriveStreak(
  bookings: UserBooking[],
  referenceTs: string,
): { currentStreakDays: number; longestStreakDays: number; totalBookings: number } {
  const bookedDates = new Set(bookings.map((b) => utcDateOnly(b.bookedAt)))

  let cursor = utcDateOnly(referenceTs)
  let streak = 0
  let isFirstDay = true

  while (true) {
    if (isWeekend(cursor)) {
      cursor = previousDateOnly(cursor)
      isFirstDay = false
      continue
    }
    if (bookedDates.has(cursor)) {
      streak += 1
      cursor = previousDateOnly(cursor)
      isFirstDay = false
      continue
    }
    if (isFirstDay) {
      // Today, not yet booked — skip without stopping.
      cursor = previousDateOnly(cursor)
      isFirstDay = false
      continue
    }
    break
  }

  // Longest streak: scan all distinct booked weekday dates for the longest
  // run of weekday-consecutive dates (weekends don't break a run here either).
  const sortedDates = Array.from(bookedDates).sort()
  let longest = 0
  let running = 0
  let prevDate: string | null = null
  for (const d of sortedDates) {
    if (prevDate === null) {
      running = 1
    } else {
      // Determine if `d` immediately follows `prevDate` skipping weekends.
      let cursor2 = prevDate
      let stepped = false
      for (let i = 0; i < 10; i++) {
        cursor2 = nextDateOnly(cursor2)
        if (isWeekend(cursor2)) continue
        stepped = cursor2 === d
        break
      }
      running = stepped ? running + 1 : 1
    }
    longest = Math.max(longest, running)
    prevDate = d
  }

  return { currentStreakDays: streak, longestStreakDays: Math.max(longest, streak), totalBookings: bookings.length }
}

function nextDateOnly(dateOnly: string): string {
  const ms = Date.parse(`${dateOnly}T00:00:00.000Z`) + MS_PER_DAY
  return new Date(ms).toISOString().slice(0, 10)
}

export function computeUnlocks(
  currentStreakDays: number,
): Array<{ threshold: number; label: string; unlocked: boolean }> {
  return UNLOCK_THRESHOLDS.map((u) => ({ ...u, unlocked: currentStreakDays >= u.threshold }))
}

async function fetchUserBookings(userId: string): Promise<UserBooking[]> {
  const client = await ensureTable(TABLE_NAMES.userBookings)
  const entities: BookingEntity[] = []
  const iter = client.listEntities<BookingEntity>({
    queryOptions: { filter: `PartitionKey eq '${userId.replace(/'/g, "''")}'` },
  })
  for await (const e of iter) entities.push(e)
  return entities.map(({ partitionKey: _pk, rowKey: _rk, ...fields }) => fields)
}

export async function bookingsHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = req.headers.get('origin') ?? undefined
  if (req.method === 'OPTIONS') return corsPreflightResponse(origin)

  try {
    const userId = req.params.id
    if (!userId) {
      return withCors({ status: 400, jsonBody: { error: 'Missing id route parameter.' } }, origin)
    }
    let raw: unknown
    try {
      raw = await parseJsonBody(req)
    } catch {
      return withCors({ status: 400, jsonBody: { error: 'Malformed JSON body.' } }, origin)
    }
    const parsed = CreateBookingBody.safeParse(raw)
    if (!parsed.success) {
      return withCors(
        { status: 400, jsonBody: { error: 'Invalid request body.', details: parsed.error.issues } },
        origin,
      )
    }
    const { roomId, bookedAt } = parsed.data
    const booking: UserBooking = { userId, roomId, bookedAt }

    const client = await ensureTable(TABLE_NAMES.userBookings)
    await client.createEntity({
      partitionKey: userId,
      rowKey: `${bookedAt}_${roomId}`,
      ...booking,
    })

    return withCors({ status: 201, jsonBody: booking }, origin)
  } catch (err) {
    logError(ctx, 'bookings handler failed', err)
    return withCors({ status: 500, jsonBody: { error: 'Internal server error.' } }, origin)
  }
}

export async function streakHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = req.headers.get('origin') ?? undefined
  if (req.method === 'OPTIONS') return corsPreflightResponse(origin)

  try {
    const userId = req.params.id
    if (!userId) {
      return withCors({ status: 400, jsonBody: { error: 'Missing id route parameter.' } }, origin)
    }
    const parsedQuery = QueryNowSchema.safeParse({ now: req.query.get('now') ?? undefined })
    if (!parsedQuery.success) {
      return withCors(
        { status: 400, jsonBody: { error: 'Invalid query parameters', details: parsedQuery.error.flatten() } },
        origin,
      )
    }
    const now = parsedQuery.data.now ?? new Date().toISOString()
    const bookings = await fetchUserBookings(userId)
    const streak = deriveStreak(bookings, now)
    return withCors({ status: 200, jsonBody: { userId, ...streak } }, origin)
  } catch (err) {
    logError(ctx, 'streak handler failed', err)
    return withCors({ status: 500, jsonBody: { error: 'Internal server error.' } }, origin)
  }
}

export async function unlocksHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = req.headers.get('origin') ?? undefined
  if (req.method === 'OPTIONS') return corsPreflightResponse(origin)

  try {
    const userId = req.params.id
    if (!userId) {
      return withCors({ status: 400, jsonBody: { error: 'Missing id route parameter.' } }, origin)
    }
    const parsedQuery = QueryNowSchema.safeParse({ now: req.query.get('now') ?? undefined })
    if (!parsedQuery.success) {
      return withCors(
        { status: 400, jsonBody: { error: 'Invalid query parameters', details: parsedQuery.error.flatten() } },
        origin,
      )
    }
    const now = parsedQuery.data.now ?? new Date().toISOString()
    const bookings = await fetchUserBookings(userId)
    const { currentStreakDays } = deriveStreak(bookings, now)
    return withCors({ status: 200, jsonBody: computeUnlocks(currentStreakDays) }, origin)
  } catch (err) {
    logError(ctx, 'unlocks handler failed', err)
    return withCors({ status: 500, jsonBody: { error: 'Internal server error.' } }, origin)
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

app.http('createBooking', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'users/{id}/booking',
  handler: bookingsHandler,
})

app.http('userStreak', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'users/{id}/streak',
  handler: streakHandler,
})

app.http('userUnlocks', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'users/{id}/unlocks',
  handler: unlocksHandler,
})
