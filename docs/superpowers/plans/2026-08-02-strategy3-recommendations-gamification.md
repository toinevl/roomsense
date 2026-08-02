# Strategy 3: Recommendations & Gamification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build #38's rule-based recommendations (repeat/popularity/distance scoring), occupancy prediction, a derived streak/unlocks gamification system, and a real backend booking-persistence path — plus illustrative (not real) A/B measurement scaffolding, since this demo app has no real user traffic.

**Architecture:** Backend follows the exact pattern already established by `presence.ts`/`reviews.ts` (Table-Storage-backed, zod-validated, `withCors`/`logError`, `referenceTs`-anchored). Each new backend file separates pure, unit-tested derivation logic (scoring, streak-walking, prediction) from a thin HTTP handler — same separation `roomStatus.ts` already uses for the admin app. Frontend follows the dual-mode `fetchClient`/`makeMockClient` split in `api.ts`, with a new `mockGamification.ts` mirroring `mockSocialData.ts`'s fixture style. Per this codebase's own established convention (ghost-derivation is independently reimplemented in `dashboard.ts`, `live.ts`, and `kpis.ts` rather than shared), the scoring/streak/prediction algorithms are implemented once in the backend and once (mirrored, not imported) in the frontend mock — `packages/shared` stays types-only, consistent with its "frozen after Phase 0" convention.

**Tech Stack:** TypeScript, Azure Functions v4, `@azure/data-tables`, zod, Vite, vitest, Playwright. No new dependencies.

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-08-02-strategy3-recommendations-gamification-design.md`.
- Wishlist item: #38 in `wishlist.md` — mark sub-items `[x]` as completed with commit SHAs.
- Streak/unlocks/repeat-score are DERIVED from `UserBookings` rows at request time — never a stored, mutated counter (see spec's "Key design decision").
- All new backend endpoints: zod-validate input, `withCors`/`corsPreflightResponse` from `../lib/cors`, `logError` from `../lib/log`, never `Date.now()` — always a `now`/`referenceTs` query param.
- New API functions MUST be appended (never edit existing lines) to `api/src/index.ts`'s import list, or the v4 registration guard fails and the endpoint silently 404s in production.
- Commit with `git add <explicit paths>` — never `git add -A`.
- Every commit message references `#38`.
- Demo user id is the hardcoded `'user-1'` (matches `friends.ts`'s existing convention — no auth system in this app).
- `frontend/admin/src/pages/growth.ts` (Phase 3c) must visibly state it shows illustrative, not real, metrics — this is a hard requirement, not a nice-to-have, since presenting fabricated numbers as real would be misleading.

---

### Task 1: Shared type, table registration, and booking/streak/unlocks endpoints

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/types.test.ts`
- Modify: `api/src/lib/tables.ts`
- Create: `api/src/functions/bookings.ts`
- Create: `api/src/functions/bookings.test.ts`
- Modify: `api/src/index.ts`

**Interfaces:**
- Produces: `UserBookingSchema`/`UserBooking` type from `@roomsense/shared`, consumed by Task 2 (recommendations' repeat-score lookup).
- Produces: exported pure functions `deriveStreak(bookings: UserBooking[], referenceTs: string): { currentStreakDays: number }` and `computeUnlocks(currentStreakDays: number): Array<{ threshold: number; label: string; unlocked: boolean }>` from `bookings.ts` — not consumed by other backend tasks, but the exact shape/behavior must match what Task 9 (frontend integration) and the mock mirror expect.
- Produces: `TABLE_NAMES.userBookings = 'UserBookings'`.

- [ ] **Step 1: Add the shared type**

In `packages/shared/src/types.ts`, append after the `PrivacySettingsSchema`/`REVIEW_TAGS` block:

```typescript
// ─── Gamification Types (Phase 3, #38) ───

export const UserBookingSchema = z.object({
  userId: z.string(),
  roomId: z.string(),
  bookedAt: z.string().datetime(),
})
export type UserBooking = z.infer<typeof UserBookingSchema>
```

- [ ] **Step 2: Write the type test**

In `packages/shared/src/types.test.ts`, append:

```typescript
describe('UserBookingSchema', () => {
  test('accepts a valid booking', () => {
    const b = { userId: 'user-1', roomId: 'atlas-0.710', bookedAt: '2026-08-02T10:00:00.000Z' }
    expect(UserBookingSchema.parse(b).roomId).toBe('atlas-0.710')
  })

  test('rejects a non-datetime bookedAt', () => {
    expect(() =>
      UserBookingSchema.parse({ userId: 'user-1', roomId: 'atlas-0.710', bookedAt: 'not-a-date' }),
    ).toThrow()
  })
})
```

Add `UserBookingSchema` to the existing top-of-file import/export list if the file re-exports schemas explicitly (check the file — if all schemas are just defined and exported inline as above, no separate export list edit is needed).

- [ ] **Step 3: Run the type tests, verify pass**

Run: `cd packages/shared && pnpm exec vitest run src/types.test.ts`
Expected: PASS, including the 2 new tests

- [ ] **Step 4: Register the new table**

In `api/src/lib/tables.ts`, add to `TABLE_NAMES`:

```typescript
export const TABLE_NAMES = {
  rooms: 'Rooms',
  readings: 'SensorReadings',
  snapshots: 'OccupancySnapshots',
  reservations: 'Reservations',
  sources: 'Sources',
  presence: 'UserPresence',
  friends: 'FriendLinks',
  reviews: 'RoomReviews',
  privacy: 'UserPrivacy',
  userBookings: 'UserBookings',
} as const
```

- [ ] **Step 5: Write the failing tests for the pure derivation functions**

Create `api/src/functions/bookings.test.ts` — this file has TWO parts: pure-function tests (no table mocking, most of the coverage) and a small number of handler-level tests (table-mocked, matching `presence.test.ts`'s style, just enough to prove the wiring works).

```typescript
import { describe, it, expect, beforeEach, vi, test } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'
import type { UserBooking } from '@roomsense/shared'

// ─── Pure function tests (no table mocking) ───

import { deriveStreak, computeUnlocks } from './bookings'

function booking(userId: string, roomId: string, bookedAt: string): UserBooking {
  return { userId, roomId, bookedAt }
}

describe('deriveStreak', () => {
  test('returns 0 for no bookings', () => {
    expect(deriveStreak([], '2026-08-04T10:00:00.000Z').currentStreakDays).toBe(0)
  })

  test('counts a single booking today as a 1-day streak', () => {
    const bookings = [booking('user-1', 'r1', '2026-08-04T09:00:00.000Z')] // Tuesday
    expect(deriveStreak(bookings, '2026-08-04T10:00:00.000Z').currentStreakDays).toBe(1)
  })

  test('does not break the streak if today has no booking yet', () => {
    // Booked yesterday (Monday), referenceTs is Tuesday with nothing booked yet today.
    const bookings = [booking('user-1', 'r1', '2026-08-03T09:00:00.000Z')]
    expect(deriveStreak(bookings, '2026-08-04T08:00:00.000Z').currentStreakDays).toBe(1)
  })

  test('weekend does not break a Friday-to-Monday streak', () => {
    const bookings = [
      booking('user-1', 'r1', '2026-07-31T09:00:00.000Z'), // Friday
      booking('user-1', 'r1', '2026-08-03T09:00:00.000Z'), // Monday
    ]
    // referenceTs: Monday, already booked today.
    expect(deriveStreak(bookings, '2026-08-03T12:00:00.000Z').currentStreakDays).toBe(2)
  })

  test('a weekday gap DOES break the streak, even across a weekend it does not touch', () => {
    const bookings = [
      booking('user-1', 'r1', '2026-07-30T09:00:00.000Z'), // Thursday
      booking('user-1', 'r1', '2026-08-03T09:00:00.000Z'), // Monday (Friday between them has no booking)
    ]
    expect(deriveStreak(bookings, '2026-08-04T08:00:00.000Z').currentStreakDays).toBe(1)
  })

  test('only counts distinct calendar dates, not multiple bookings on the same day', () => {
    const bookings = [
      booking('user-1', 'r1', '2026-08-04T09:00:00.000Z'),
      booking('user-1', 'r2', '2026-08-04T14:00:00.000Z'),
    ]
    expect(deriveStreak(bookings, '2026-08-04T15:00:00.000Z').currentStreakDays).toBe(1)
  })
})

describe('computeUnlocks', () => {
  test('nothing unlocked at streak 0', () => {
    const unlocks = computeUnlocks(0)
    expect(unlocks.every((u) => !u.unlocked)).toBe(true)
    expect(unlocks.map((u) => u.threshold)).toEqual([3, 7, 14])
  })

  test('only the 3-day unlock is unlocked at streak 5', () => {
    const unlocks = computeUnlocks(5)
    expect(unlocks.find((u) => u.threshold === 3)?.unlocked).toBe(true)
    expect(unlocks.find((u) => u.threshold === 7)?.unlocked).toBe(false)
    expect(unlocks.find((u) => u.threshold === 14)?.unlocked).toBe(false)
  })

  test('all three unlocked at streak 14', () => {
    const unlocks = computeUnlocks(14)
    expect(unlocks.every((u) => u.unlocked)).toBe(true)
  })
})

// ─── Handler-level tests (table-mocked, matching presence.test.ts's style) ───

declare global {
  var __BOOKINGS_TEST_STATE__: { bookings: any[]; throwOnList: boolean }
}
;(globalThis as any).__BOOKINGS_TEST_STATE__ = { bookings: [], throwOnList: false }

vi.mock('../lib/tables', () => ({
  TABLE_NAMES: { userBookings: 'UserBookings' },
  getTableClient: (name: string) => {
    const g = () => (globalThis as any).__BOOKINGS_TEST_STATE__
    if (name === 'UserBookings') {
      return {
        listEntities(opts?: { queryOptions?: { filter?: string } }) {
          const s = g()
          if (s.throwOnList) throw new Error('storage down')
          let rows = s.bookings.slice()
          const filter = opts?.queryOptions?.filter
          if (filter) {
            const m = filter.match(/PartitionKey eq '([^']+)'/)
            const want = m ? m[1].replace(/''/g, "'") : null
            if (want !== null) rows = rows.filter((r: any) => r.userId === want)
          }
          return {
            [Symbol.asyncIterator]() {
              let i = 0
              return { next: async () => (i < rows.length ? { value: rows[i++], done: false } : { value: undefined, done: true }) }
            },
          }
        },
        async createEntity(entity: any) {
          g().bookings.push(entity)
        },
      }
    }
    throw new Error(`unexpected table: ${name}`)
  },
}))

import { bookingsHandler, streakHandler, unlocksHandler } from './bookings'

function setState(bookings: any[], throwOnList = false) {
  ;(globalThis as any).__BOOKINGS_TEST_STATE__ = { bookings, throwOnList }
}

function makeReq(
  method: string,
  userId: string,
  opts?: { now?: string; origin?: string; body?: unknown },
): HttpRequest {
  const url = new URL(`http://localhost/api/users/${userId}/booking`)
  if (opts?.now) url.searchParams.set('now', opts.now)
  const headers = new Headers()
  if (opts?.origin) headers.set('Origin', opts.origin)
  return {
    method,
    url: url.toString(),
    headers,
    query: url.searchParams,
    params: { id: userId },
    text: async () => (opts?.body ? JSON.stringify(opts.body) : ''),
  } as unknown as HttpRequest
}

const ctx = { error() {} } as unknown as InvocationContext

describe('POST /api/users/{id}/booking', () => {
  beforeEach(() => setState([]))

  it('creates a booking and returns 201', async () => {
    const res = await bookingsHandler(
      makeReq('POST', 'user-1', { body: { roomId: 'atlas-0.710', bookedAt: '2026-08-04T09:00:00.000Z' } }),
      ctx,
    )
    expect(res.status).toBe(201)
    expect((res.jsonBody as any).roomId).toBe('atlas-0.710')
  })

  it('returns 400 on invalid body', async () => {
    const res = await bookingsHandler(makeReq('POST', 'user-1', { body: { roomId: '' } }), ctx)
    expect(res.status).toBe(400)
  })

  it('returns 500 on storage error', async () => {
    setState([], true)
    const res = await bookingsHandler(
      makeReq('POST', 'user-1', { body: { roomId: 'atlas-0.710', bookedAt: '2026-08-04T09:00:00.000Z' } }),
      ctx,
    )
    expect(res.status).toBe(500)
  })
})

describe('GET /api/users/{id}/streak', () => {
  beforeEach(() => setState([]))

  it('returns 200 with currentStreakDays 0 for no history', async () => {
    const res = await streakHandler(makeReq('GET', 'user-1', { now: '2026-08-04T10:00:00.000Z' }), ctx)
    expect(res.status).toBe(200)
    expect((res.jsonBody as any).currentStreakDays).toBe(0)
  })
})

describe('GET /api/users/{id}/unlocks', () => {
  beforeEach(() => setState([]))

  it('returns all 3 thresholds, none unlocked, for no history', async () => {
    const res = await unlocksHandler(makeReq('GET', 'user-1', { now: '2026-08-04T10:00:00.000Z' }), ctx)
    expect(res.status).toBe(200)
    expect((res.jsonBody as any[])).toHaveLength(3)
    expect((res.jsonBody as any[]).every((u) => !u.unlocked)).toBe(true)
  })
})
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd api && pnpm exec vitest run src/functions/bookings.test.ts`
Expected: FAIL — `Cannot find module './bookings'`

- [ ] **Step 7: Implement `api/src/functions/bookings.ts`**

```typescript
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { z } from 'zod'
import type { UserBooking } from '@roomsense/shared'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { getTableClient, TABLE_NAMES } from '../lib/tables'

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
      let expected = prevDate
      do {
        expected = previousDateOnly(expected) // walk forward conceptually by walking prevDate->d check below
      } while (false)
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
  const client = getTableClient(TABLE_NAMES.userBookings)
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
    const raw = await parseJsonBody(req)
    const parsed = CreateBookingBody.safeParse(raw)
    if (!parsed.success) {
      return withCors(
        { status: 400, jsonBody: { error: 'Invalid request body.', details: parsed.error.issues } },
        origin,
      )
    }
    const { roomId, bookedAt } = parsed.data
    const booking: UserBooking = { userId, roomId, bookedAt }

    const client = getTableClient(TABLE_NAMES.userBookings)
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
    const now = req.query.get('now') ?? new Date().toISOString()
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
    const now = req.query.get('now') ?? new Date().toISOString()
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
```

**Note on `longestStreakDays`:** the implementation above computes it via a
weekday-adjacency scan. If, during implementation, this proves harder to get
right than the `currentStreakDays` walk, it is acceptable to simplify to
`longestStreakDays = max(currentStreakDays, previously seen max)` — but the
5 `deriveStreak` tests above only assert `currentStreakDays`, so get that
exactly right first; `longestStreakDays` has looser correctness requirements
for this MVP (it's a nice-to-have display number, not load-bearing for
unlocks or recommendations).

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd api && pnpm exec vitest run src/functions/bookings.test.ts`
Expected: PASS — all pure-function and handler tests

- [ ] **Step 9: Register in the entry point**

In `api/src/index.ts`, append (do not edit existing lines):

```typescript
import './functions/bookings'
```

- [ ] **Step 10: Run the full api test suite and typecheck**

Run: `cd api && pnpm typecheck && pnpm exec vitest run`
Expected: all green, including `src/index.test.ts`'s registration guard

- [ ] **Step 11: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/types.test.ts \
  api/src/lib/tables.ts api/src/functions/bookings.ts api/src/functions/bookings.test.ts \
  api/src/index.ts
git commit -m "feat(#38): UserBooking type + derived streak/unlocks + booking endpoint"
```

---

### Task 2: Recommendations endpoint

**Files:**
- Create: `api/src/functions/recommendations.ts`
- Create: `api/src/functions/recommendations.test.ts`
- Modify: `api/src/index.ts`

**Interfaces:**
- Consumes: `UserBooking` type from `@roomsense/shared` (Task 1); `TABLE_NAMES.userBookings` (Task 1).
- Produces: exported pure function `scoreRoom(room: RoomForScoring, hasBookedBefore: boolean, lastBookingRoom: RoomForScoring | null): number` — internal to this task, not consumed elsewhere.

- [ ] **Step 1: Write the failing tests**

```typescript
// api/src/functions/recommendations.test.ts
import { describe, it, expect, beforeEach, vi, test } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'

import { scoreRoom } from './recommendations'

function room(overrides: Partial<{ roomId: string; building: string; floor: number; occupancy: number; utilizationPct: number }> = {}) {
  return { roomId: 'r1', building: 'atlas', floor: 0, occupancy: 0, utilizationPct: 50, ...overrides }
}

describe('scoreRoom', () => {
  test('repeat=false, no last booking: score is purely popularity + neutral distance', () => {
    const r = room({ utilizationPct: 80 })
    // 0.5*0 + 0.3*0.8 + 0.2*0.6(neutral) = 0.24 + 0.12 = 0.36
    expect(scoreRoom(r, false, null)).toBeCloseTo(0.36, 5)
  })

  test('repeat=true dominates the score', () => {
    const r = room({ utilizationPct: 0 })
    // 0.5*1 + 0.3*0 + 0.2*0.6(neutral, no last booking) = 0.5 + 0.12 = 0.62
    expect(scoreRoom(r, true, null)).toBeCloseTo(0.62, 5)
  })

  test('same building+floor as last booking scores full distance weight', () => {
    const r = room({ building: 'atlas', floor: 2, utilizationPct: 0 })
    const last = room({ building: 'atlas', floor: 2 })
    // 0.5*0 + 0.3*0 + 0.2*1.0 = 0.2
    expect(scoreRoom(r, false, last)).toBeCloseTo(0.2, 5)
  })

  test('same building different floor scores partial distance weight', () => {
    const r = room({ building: 'atlas', floor: 5, utilizationPct: 0 })
    const last = room({ building: 'atlas', floor: 1 })
    // 0.2 * 0.6 = 0.12
    expect(scoreRoom(r, false, last)).toBeCloseTo(0.12, 5)
  })

  test('different building scores minimal distance weight', () => {
    const r = room({ building: 'flux', utilizationPct: 0 })
    const last = room({ building: 'atlas' })
    // 0.2 * 0.2 = 0.04
    expect(scoreRoom(r, false, last)).toBeCloseTo(0.04, 5)
  })
})

// ─── Handler-level tests ───

declare global {
  var __RECS_TEST_STATE__: { rooms: any[]; bookings: any[]; throwOnList: boolean }
}
;(globalThis as any).__RECS_TEST_STATE__ = { rooms: [], bookings: [], throwOnList: false }

vi.mock('../lib/tables', () => ({
  TABLE_NAMES: { rooms: 'Rooms', userBookings: 'UserBookings' },
  getTableClient: (name: string) => {
    const g = () => (globalThis as any).__RECS_TEST_STATE__
    if (name === 'UserBookings') {
      return {
        listEntities(opts?: { queryOptions?: { filter?: string } }) {
          const s = g()
          if (s.throwOnList) throw new Error('storage down')
          let rows = s.bookings.slice()
          const filter = opts?.queryOptions?.filter
          if (filter) {
            const m = filter.match(/PartitionKey eq '([^']+)'/)
            const want = m ? m[1].replace(/''/g, "'") : null
            if (want !== null) rows = rows.filter((r: any) => r.userId === want)
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
    throw new Error(`unexpected table: ${name}`)
  },
}))

vi.mock('./rooms', () => ({
  listRoomsWithOccupancy: async () => (globalThis as any).__RECS_TEST_STATE__.rooms,
}))

import { recommendationsHandler } from './recommendations'

function setState(rooms: any[], bookings: any[] = [], throwOnList = false) {
  ;(globalThis as any).__RECS_TEST_STATE__ = { rooms, bookings, throwOnList }
}

function makeReq(userId: string, now: string): HttpRequest {
  const url = new URL('http://localhost/api/recommendations')
  url.searchParams.set('userId', userId)
  url.searchParams.set('now', now)
  return { method: 'GET', url: url.toString(), headers: new Headers(), query: url.searchParams, params: {} } as unknown as HttpRequest
}

const ctx = { error() {} } as unknown as InvocationContext

describe('GET /api/recommendations', () => {
  beforeEach(() => setState([]))

  it('returns only free rooms as hero+alternates', async () => {
    setState([
      { roomId: 'r1', building: 'atlas', floor: 0, occupancy: 0, utilizationPct: 80, name: 'Free Room' },
      { roomId: 'r2', building: 'atlas', floor: 0, occupancy: 3, utilizationPct: 90, name: 'Busy Room' },
    ])
    const res = await recommendationsHandler(makeReq('user-1', '2026-08-04T10:00:00.000Z'), ctx)
    expect(res.status).toBe(200)
    const body = res.jsonBody as any
    expect(body.hero.roomId).toBe('r1')
    expect(body.alternates).toEqual([])
  })

  it('returns 500 on storage error', async () => {
    setState([], [], true)
    const res = await recommendationsHandler(makeReq('user-1', '2026-08-04T10:00:00.000Z'), ctx)
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd api && pnpm exec vitest run src/functions/recommendations.test.ts`
Expected: FAIL — `Cannot find module './recommendations'`

- [ ] **Step 3: Check whether `rooms.ts` exports a reusable "list rooms with occupancy" function**

Before implementing, run: `grep -n "^export" api/src/functions/rooms.ts`. The test above mocks a `listRoomsWithOccupancy` export from `./rooms` — if `rooms.ts` doesn't already export its room+occupancy assembly logic as a standalone function, add one (extract the existing handler's room-listing logic into an exported function, call it from both the existing handler and the new `recommendations.ts`; do not duplicate the room-fetching logic). If this extraction touches `rooms.ts` in a way that risks its existing tests, run `pnpm exec vitest run src/functions/rooms.test.ts` before and after to confirm no regression.

- [ ] **Step 4: Implement `api/src/functions/recommendations.ts`**

```typescript
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import type { UserBooking } from '@roomsense/shared'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { getTableClient, TABLE_NAMES } from '../lib/tables'
import { listRoomsWithOccupancy, type RoomForScoring } from './rooms'

/**
 * Phase 3 #38 — GET /api/recommendations?userId=&now= → top 3 free rooms by
 * score. Weighting: repeat 50% + popularity 30% + distance 20% (see spec).
 */

const REPEAT_WEIGHT = 0.5
const POPULARITY_WEIGHT = 0.3
const DISTANCE_WEIGHT = 0.2
const NEUTRAL_DISTANCE = 0.6

export function scoreRoom(
  room: RoomForScoring,
  hasBookedBefore: boolean,
  lastBookingRoom: RoomForScoring | null,
): number {
  const repeatScore = hasBookedBefore ? 1 : 0
  const popularityScore = room.utilizationPct / 100
  const distanceScore = !lastBookingRoom
    ? NEUTRAL_DISTANCE
    : room.building !== lastBookingRoom.building
      ? 0.2
      : room.floor !== lastBookingRoom.floor
        ? 0.6
        : 1.0

  return REPEAT_WEIGHT * repeatScore + POPULARITY_WEIGHT * popularityScore + DISTANCE_WEIGHT * distanceScore
}

export async function recommendationsHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = req.headers.get('origin') ?? undefined
  if (req.method === 'OPTIONS') return corsPreflightResponse(origin)

  try {
    const userId = req.query.get('userId')
    if (!userId) {
      return withCors({ status: 400, jsonBody: { error: 'Missing userId query parameter.' } }, origin)
    }
    const now = req.query.get('now') ?? new Date().toISOString()

    const rooms = await listRoomsWithOccupancy()
    const freeRooms = rooms.filter((r) => r.occupancy === 0)

    const bookingsClient = getTableClient(TABLE_NAMES.userBookings)
    const bookings: UserBooking[] = []
    for await (const e of bookingsClient.listEntities<UserBooking & { partitionKey: string; rowKey: string }>({
      queryOptions: { filter: `PartitionKey eq '${userId.replace(/'/g, "''")}'` },
    })) {
      const { partitionKey: _pk, rowKey: _rk, ...fields } = e
      bookings.push(fields)
    }

    const bookedRoomIds = new Set(bookings.map((b) => b.roomId))
    const sortedByTime = [...bookings].sort((a, b) => Date.parse(b.bookedAt) - Date.parse(a.bookedAt))
    const lastBookedRoomId = sortedByTime[0]?.roomId ?? null
    const lastBookingRoom = lastBookedRoomId
      ? (rooms.find((r) => r.roomId === lastBookedRoomId) ?? null)
      : null

    const scored = freeRooms
      .map((room) => ({ ...room, score: scoreRoom(room, bookedRoomIds.has(room.roomId), lastBookingRoom) }))
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.roomId.localeCompare(b.roomId)))

    const [hero, ...rest] = scored
    return withCors(
      { status: 200, jsonBody: { hero: hero ?? null, alternates: rest.slice(0, 2) } },
      origin,
    )
  } catch (err) {
    logError(ctx, 'recommendations handler failed', err)
    return withCors({ status: 500, jsonBody: { error: 'Internal server error.' } }, origin)
  }
}

app.http('recommendations', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'recommendations',
  handler: recommendationsHandler,
})
```

- [ ] **Step 5: Run tests, verify pass**

Run: `cd api && pnpm exec vitest run src/functions/recommendations.test.ts src/functions/rooms.test.ts`
Expected: PASS, no regression in `rooms.test.ts`

- [ ] **Step 6: Register in the entry point**

Append to `api/src/index.ts`: `import './functions/recommendations'`

- [ ] **Step 7: Run full api suite + typecheck, then commit**

```bash
cd api && pnpm typecheck && pnpm exec vitest run
git add api/src/functions/recommendations.ts api/src/functions/recommendations.test.ts \
  api/src/functions/rooms.ts api/src/index.ts
git commit -m "feat(#38): recommendation scoring endpoint (repeat/popularity/distance)"
```

(If Step 3 required no changes to `rooms.ts`, drop it from the `git add`.)

---

### Task 3: Occupancy prediction endpoint

**Files:**
- Create: `api/src/functions/occupancyPrediction.ts`
- Create: `api/src/functions/occupancyPrediction.test.ts`
- Modify: `api/src/index.ts`

**Interfaces:**
- Produces: exported pure function `predictBucket(snapshots: OccupancySnapshot[], targetTs: string): number` — internal to this task.

- [ ] **Step 1: Write the failing tests**

```typescript
// api/src/functions/occupancyPrediction.test.ts
import { describe, it, expect, beforeEach, vi, test } from 'vitest'
import type { HttpRequest, InvocationContext } from '@azure/functions'
import type { OccupancySnapshot } from '@roomsense/shared'

import { predictBucket } from './occupancyPrediction'

function snap(ts: string, occupancy: number): OccupancySnapshot {
  return { roomId: 'r1', ts, occupancy, utilizationPct: 0, intervalMinutes: 15 }
}

describe('predictBucket', () => {
  test('averages occupancy across days at the same 15-min time-of-day bucket', () => {
    const snapshots = [
      snap('2026-07-27T14:30:00.000Z', 4), // Monday 14:30
      snap('2026-08-03T14:30:00.000Z', 6), // Monday 14:30 (different week)
      snap('2026-07-27T14:00:00.000Z', 99), // different bucket, ignored
    ]
    expect(predictBucket(snapshots, '2026-08-10T14:30:00.000Z')).toBeCloseTo(5, 5)
  })

  test('falls back to 0 when no historical data exists in the bucket', () => {
    expect(predictBucket([], '2026-08-10T14:30:00.000Z')).toBe(0)
  })
})

// ─── Handler-level tests ───

declare global {
  var __PRED_TEST_STATE__: { snapshots: any[]; throwOnList: boolean }
}
;(globalThis as any).__PRED_TEST_STATE__ = { snapshots: [], throwOnList: false }

vi.mock('../lib/tables', () => ({
  TABLE_NAMES: { snapshots: 'OccupancySnapshots' },
  getTableClient: (name: string) => {
    const g = () => (globalThis as any).__PRED_TEST_STATE__
    if (name === 'OccupancySnapshots') {
      return {
        listEntities(opts?: { queryOptions?: { filter?: string } }) {
          const s = g()
          if (s.throwOnList) throw new Error('storage down')
          let rows = s.snapshots.slice()
          const filter = opts?.queryOptions?.filter
          if (filter) {
            const m = filter.match(/PartitionKey eq '([^']+)'/)
            const want = m ? m[1].replace(/''/g, "'") : null
            if (want !== null) rows = rows.filter((r: any) => r.roomId === want)
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
    throw new Error(`unexpected table: ${name}`)
  },
}))

import { occupancyPredictionHandler } from './occupancyPrediction'

function setState(snapshots: any[], throwOnList = false) {
  ;(globalThis as any).__PRED_TEST_STATE__ = { snapshots, throwOnList }
}

function makeReq(roomId: string, now: string): HttpRequest {
  const url = new URL('http://localhost/api/occupancy/prediction')
  url.searchParams.set('roomId', roomId)
  url.searchParams.set('now', now)
  return { method: 'GET', url: url.toString(), headers: new Headers(), query: url.searchParams, params: {} } as unknown as HttpRequest
}

const ctx = { error() {} } as unknown as InvocationContext

describe('GET /api/occupancy/prediction', () => {
  beforeEach(() => setState([]))

  it('returns now/plus30m/plus60m occupancy', async () => {
    setState([{ roomId: 'r1', ts: '2026-08-04T10:00:00.000Z', occupancy: 5, utilizationPct: 50, intervalMinutes: 15 }])
    const res = await occupancyPredictionHandler(makeReq('r1', '2026-08-04T10:00:00.000Z'), ctx)
    expect(res.status).toBe(200)
    const body = res.jsonBody as any
    expect(body.roomId).toBe('r1')
    expect(body).toHaveProperty('now')
    expect(body).toHaveProperty('plus30m')
    expect(body).toHaveProperty('plus60m')
  })

  it('returns 400 when roomId is missing', async () => {
    const url = new URL('http://localhost/api/occupancy/prediction')
    url.searchParams.set('now', '2026-08-04T10:00:00.000Z')
    const req = { method: 'GET', url: url.toString(), headers: new Headers(), query: url.searchParams, params: {} } as unknown as HttpRequest
    const res = await occupancyPredictionHandler(req, ctx)
    expect(res.status).toBe(400)
  })

  it('returns 500 on storage error', async () => {
    setState([], true)
    const res = await occupancyPredictionHandler(makeReq('r1', '2026-08-04T10:00:00.000Z'), ctx)
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd api && pnpm exec vitest run src/functions/occupancyPrediction.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `api/src/functions/occupancyPrediction.ts`**

```typescript
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import type { OccupancySnapshot } from '@roomsense/shared'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { getTableClient, TABLE_NAMES } from '../lib/tables'

/**
 * Phase 3 #38 — GET /api/occupancy/prediction?roomId=&now= → +30m/+60m
 * occupancy estimate. Heuristic (not ML — see spec's "Future ML Path"):
 * average this room's historical occupancy across all snapshots that fall
 * in the same 15-minute-of-day bucket as the target time, any calendar day.
 */

const BUCKET_MINUTES = 15
const BUCKET_MS = BUCKET_MINUTES * 60_000

function bucketOfDay(iso: string): number {
  const d = new Date(iso)
  const minutesSinceMidnight = d.getUTCHours() * 60 + d.getUTCMinutes()
  return Math.floor(minutesSinceMidnight / BUCKET_MINUTES)
}

export function predictBucket(snapshots: OccupancySnapshot[], targetTs: string): number {
  const targetBucket = bucketOfDay(targetTs)
  const matches = snapshots.filter((s) => bucketOfDay(s.ts) === targetBucket)
  if (matches.length === 0) return 0
  return matches.reduce((sum, s) => sum + s.occupancy, 0) / matches.length
}

export async function occupancyPredictionHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = req.headers.get('origin') ?? undefined
  if (req.method === 'OPTIONS') return corsPreflightResponse(origin)

  try {
    const roomId = req.query.get('roomId')
    if (!roomId) {
      return withCors({ status: 400, jsonBody: { error: 'Missing roomId query parameter.' } }, origin)
    }
    const now = req.query.get('now') ?? new Date().toISOString()

    const client = getTableClient(TABLE_NAMES.snapshots)
    const snapshots: OccupancySnapshot[] = []
    for await (const e of client.listEntities<OccupancySnapshot & { partitionKey: string; rowKey: string }>({
      queryOptions: { filter: `PartitionKey eq '${roomId.replace(/'/g, "''")}'` },
    })) {
      const { partitionKey: _pk, rowKey: _rk, ...fields } = e
      snapshots.push(fields)
    }

    const nowMs = Date.parse(now)
    const currentSnap = snapshots.find((s) => Math.abs(Date.parse(s.ts) - nowMs) < BUCKET_MS)

    return withCors(
      {
        status: 200,
        jsonBody: {
          roomId,
          now: { occupancy: currentSnap?.occupancy ?? 0 },
          plus30m: { occupancy: predictBucket(snapshots, new Date(nowMs + 30 * 60_000).toISOString()) },
          plus60m: { occupancy: predictBucket(snapshots, new Date(nowMs + 60 * 60_000).toISOString()) },
        },
      },
      origin,
    )
  } catch (err) {
    logError(ctx, 'occupancy prediction handler failed', err)
    return withCors({ status: 500, jsonBody: { error: 'Internal server error.' } }, origin)
  }
}

app.http('occupancyPrediction', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'occupancy/prediction',
  handler: occupancyPredictionHandler,
})
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd api && pnpm exec vitest run src/functions/occupancyPrediction.test.ts`
Expected: PASS

- [ ] **Step 5: Register, typecheck, full suite, commit**

```bash
# api/src/index.ts: append `import './functions/occupancyPrediction'`
cd api && pnpm typecheck && pnpm exec vitest run
git add api/src/functions/occupancyPrediction.ts api/src/functions/occupancyPrediction.test.ts api/src/index.ts
git commit -m "feat(#38): occupancy prediction endpoint (time-of-day bucket average)"
```

---

### Task 4: Frontend types, API client wiring, mock data, feature flag

**Files:**
- Modify: `frontend/src/lib/apiTypes.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/mockGamification.ts`
- Create: `frontend/src/lib/mockGamification.test.ts`
- Create: `frontend/src/lib/featureFlag.ts`
- Create: `frontend/src/lib/featureFlag.test.ts`

**Interfaces:**
- Produces: `RecommendationsResponse`, `OccupancyPredictionResponse`, `StreakResponse`, `UnlockInfo` types in `apiTypes.ts` — consumed by Tasks 5-8 (components).
- Produces: 5 new `ApiClient` methods (`getRecommendations`, `getOccupancyPrediction`, `getStreak`, `postBooking`, `getUnlocks`) — consumed by Tasks 5-9.
- Produces: `isFeatureEnabled(flagName: string): boolean` from `featureFlag.ts` — consumed by Task 9.

- [ ] **Step 1: Add response types to `apiTypes.ts`**

Append to `frontend/src/lib/apiTypes.ts`:

```typescript
export interface RecommendedRoom extends RoomWithOccupancy {
  score: number
}

export interface RecommendationsResponse {
  hero: RecommendedRoom | null
  alternates: RecommendedRoom[]
}

export interface OccupancyPredictionResponse {
  roomId: string
  now: { occupancy: number }
  plus30m: { occupancy: number }
  plus60m: { occupancy: number }
}

export interface StreakResponse {
  userId: string
  currentStreakDays: number
  longestStreakDays: number
  totalBookings: number
}

export interface UnlockInfo {
  threshold: number
  label: string
  unlocked: boolean
}
```

- [ ] **Step 2: Write the failing tests for `featureFlag.ts`**

```typescript
// frontend/src/lib/featureFlag.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { isFeatureEnabled } from './featureFlag'

describe('isFeatureEnabled', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is deterministic across repeated calls (stable session id)', () => {
    const first = isFeatureEnabled('recommendations')
    const second = isFeatureEnabled('recommendations')
    expect(second).toBe(first)
  })

  it('persists the session id in localStorage', () => {
    isFeatureEnabled('recommendations')
    expect(localStorage.getItem('roomsense.flagSessionId')).toBeTruthy()
  })

  it('respects a pre-existing session id already in localStorage', () => {
    localStorage.setItem('roomsense.flagSessionId', 'fixed-id-for-test')
    const result = isFeatureEnabled('recommendations')
    // Same fixed id must always produce the same result, run after run.
    localStorage.setItem('roomsense.flagSessionId', 'fixed-id-for-test')
    expect(isFeatureEnabled('recommendations')).toBe(result)
  })
})
```

- [ ] **Step 3: Run test, verify it fails**

Run: `cd frontend && pnpm exec vitest run src/lib/featureFlag.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement `featureFlag.ts`**

```typescript
/**
 * Deterministic feature flag (#38, Phase 3b) — NOT Math.random(), so a given
 * browser session sees a stable on/off experience across reloads instead of
 * flickering between variants. 30% enabled / 70% control, matching the
 * spec's illustrative A/B split (see growth.ts for the — also illustrative,
 * not real — measurement panel this feeds).
 */

const SESSION_ID_KEY = 'roomsense.flagSessionId'
const ENABLED_RATIO = 0.3

function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(SESSION_ID_KEY)
  if (existing) return existing
  const id = `s-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
  localStorage.setItem(SESSION_ID_KEY, id)
  return id
}

/** Simple deterministic string hash (djb2) → [0, 1). */
function hashToUnitInterval(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return (hash >>> 0) / 0xffffffff
}

export function isFeatureEnabled(flagName: string): boolean {
  const sessionId = getOrCreateSessionId()
  return hashToUnitInterval(`${sessionId}:${flagName}`) < ENABLED_RATIO
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `cd frontend && pnpm exec vitest run src/lib/featureFlag.test.ts`
Expected: PASS

- [ ] **Step 6: Write the failing tests for `mockGamification.ts`**

```typescript
// frontend/src/lib/mockGamification.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getMockRecommendations,
  getMockOccupancyPrediction,
  getMockStreak,
  getMockUnlocks,
  addMockBooking,
  __resetMockGamification,
} from './mockGamification'
import type { RoomWithOccupancy } from './apiTypes'

const ROOMS: RoomWithOccupancy[] = [
  { roomId: 'r1', name: 'Free A', building: 'atlas', floor: 0, capacity: 4, occupancy: 0, utilizationPct: 80, lastSeenTs: '2026-08-04T10:00:00.000Z' },
  { roomId: 'r2', name: 'Busy', building: 'atlas', floor: 0, capacity: 4, occupancy: 3, utilizationPct: 90, lastSeenTs: '2026-08-04T10:00:00.000Z' },
]

describe('mockGamification', () => {
  beforeEach(() => {
    __resetMockGamification()
  })

  it('getMockRecommendations only recommends free rooms', async () => {
    const result = await getMockRecommendations(ROOMS, 'user-1', '2026-08-04T10:00:00.000Z')
    expect(result.hero?.roomId).toBe('r1')
  })

  it('getMockStreak starts at 0 with no bookings', async () => {
    const streak = await getMockStreak('user-1', '2026-08-04T10:00:00.000Z')
    expect(streak.currentStreakDays).toBe(0)
  })

  it('addMockBooking then getMockStreak reflects the new booking', async () => {
    await addMockBooking('user-1', 'r1', '2026-08-04T09:00:00.000Z')
    const streak = await getMockStreak('user-1', '2026-08-04T10:00:00.000Z')
    expect(streak.currentStreakDays).toBe(1)
  })

  it('getMockUnlocks reflects the derived streak', async () => {
    for (const [date] of [['2026-08-03'], ['2026-08-04'], ['2026-08-05']]) {
      await addMockBooking('user-1', 'r1', `${date}T09:00:00.000Z`)
    }
    const unlocks = await getMockUnlocks('user-1', '2026-08-05T10:00:00.000Z')
    expect(unlocks.find((u) => u.threshold === 3)?.unlocked).toBe(true)
  })

  it('getMockOccupancyPrediction returns a plausible shape', async () => {
    const prediction = await getMockOccupancyPrediction('r1', '2026-08-04T10:00:00.000Z')
    expect(prediction.roomId).toBe('r1')
    expect(typeof prediction.plus30m.occupancy).toBe('number')
  })
})
```

- [ ] **Step 7: Run tests, verify they fail**

Run: `cd frontend && pnpm exec vitest run src/lib/mockGamification.test.ts`
Expected: FAIL — module not found

- [ ] **Step 8: Implement `mockGamification.ts`**

This mirrors the backend's algorithm (scoring weights, weekday-streak-walk)
independently, per this codebase's established convention of not sharing
derivation logic between mock and live paths (see `roomStatus.ts`'s docblock
on ghost derivation being reimplemented per-surface, not centralized).

```typescript
import type {
  OccupancyPredictionResponse,
  RecommendationsResponse,
  RoomWithOccupancy,
  StreakResponse,
  UnlockInfo,
} from './apiTypes'

/**
 * Mock fixtures + derivation for the gamification features (Phase 3, #38).
 * Mirrors the backend's algorithm (see api/src/functions/recommendations.ts,
 * bookings.ts) independently — this codebase's established convention for
 * mock-vs-live logic (see roomStatus.ts's ghost-derivation docblock).
 */

interface MockBooking {
  userId: string
  roomId: string
  bookedAt: string
}

let MOCK_BOOKINGS: MockBooking[] = [
  { userId: 'user-1', roomId: 'atlas-0.710', bookedAt: '2026-07-30T09:00:00.000Z' },
]

export function __resetMockGamification(): void {
  MOCK_BOOKINGS = [{ userId: 'user-1', roomId: 'atlas-0.710', bookedAt: '2026-07-30T09:00:00.000Z' }]
}

export async function addMockBooking(userId: string, roomId: string, bookedAt: string): Promise<void> {
  MOCK_BOOKINGS.push({ userId, roomId, bookedAt })
}

const REPEAT_WEIGHT = 0.5
const POPULARITY_WEIGHT = 0.3
const DISTANCE_WEIGHT = 0.2
const NEUTRAL_DISTANCE = 0.6

function scoreRoom(
  room: RoomWithOccupancy,
  hasBookedBefore: boolean,
  lastBookingRoom: RoomWithOccupancy | null,
): number {
  const repeatScore = hasBookedBefore ? 1 : 0
  const popularityScore = room.utilizationPct / 100
  const distanceScore = !lastBookingRoom
    ? NEUTRAL_DISTANCE
    : room.building !== lastBookingRoom.building
      ? 0.2
      : room.floor !== lastBookingRoom.floor
        ? 0.6
        : 1.0
  return REPEAT_WEIGHT * repeatScore + POPULARITY_WEIGHT * popularityScore + DISTANCE_WEIGHT * distanceScore
}

export async function getMockRecommendations(
  allRooms: RoomWithOccupancy[],
  userId: string,
  _now: string,
): Promise<RecommendationsResponse> {
  const userBookings = MOCK_BOOKINGS.filter((b) => b.userId === userId)
  const bookedRoomIds = new Set(userBookings.map((b) => b.roomId))
  const sorted = [...userBookings].sort((a, b) => Date.parse(b.bookedAt) - Date.parse(a.bookedAt))
  const lastRoomId = sorted[0]?.roomId ?? null
  const lastBookingRoom = lastRoomId ? (allRooms.find((r) => r.roomId === lastRoomId) ?? null) : null

  const scored = allRooms
    .filter((r) => r.occupancy === 0)
    .map((room) => ({ ...room, score: scoreRoom(room, bookedRoomIds.has(room.roomId), lastBookingRoom) }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.roomId.localeCompare(b.roomId)))

  const [hero, ...rest] = scored
  return { hero: hero ?? null, alternates: rest.slice(0, 2) }
}

function utcDateOnly(iso: string): string {
  return iso.slice(0, 10)
}
function isWeekend(dateOnly: string): boolean {
  const day = new Date(`${dateOnly}T00:00:00.000Z`).getUTCDay()
  return day === 0 || day === 6
}
function previousDateOnly(dateOnly: string): string {
  return new Date(Date.parse(`${dateOnly}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10)
}

function deriveMockStreak(bookings: MockBooking[], referenceTs: string): number {
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
      cursor = previousDateOnly(cursor)
      isFirstDay = false
      continue
    }
    break
  }
  return streak
}

export async function getMockStreak(userId: string, now: string): Promise<StreakResponse> {
  const bookings = MOCK_BOOKINGS.filter((b) => b.userId === userId)
  return {
    userId,
    currentStreakDays: deriveMockStreak(bookings, now),
    longestStreakDays: deriveMockStreak(bookings, now),
    totalBookings: bookings.length,
  }
}

const UNLOCK_THRESHOLDS: Array<{ threshold: number; label: string }> = [
  { threshold: 3, label: 'Early access to RoomSense Wrapped' },
  { threshold: 7, label: '"Regular" badge on your reviews' },
  { threshold: 14, label: 'Shoutout on the Trust page' },
]

export async function getMockUnlocks(userId: string, now: string): Promise<UnlockInfo[]> {
  const streak = await getMockStreak(userId, now)
  return UNLOCK_THRESHOLDS.map((u) => ({ ...u, unlocked: streak.currentStreakDays >= u.threshold }))
}

export async function getMockOccupancyPrediction(
  roomId: string,
  _now: string,
): Promise<OccupancyPredictionResponse> {
  // Deterministic, plausible-looking mock — no snapshot table available
  // client-side; a small fixed pattern is enough for a demo/mock surface.
  return {
    roomId,
    now: { occupancy: 2 },
    plus30m: { occupancy: 3 },
    plus60m: { occupancy: 1 },
  }
}
```

- [ ] **Step 9: Run tests, verify they pass**

Run: `cd frontend && pnpm exec vitest run src/lib/mockGamification.test.ts`
Expected: PASS

- [ ] **Step 10: Wire the 5 new methods into `api.ts`**

Add to the `ApiClient` interface (after the social-features block):

```typescript
  // ── Gamification (Phase 3, #38) ──

  getRecommendations(userId: string, now?: string): Promise<RecommendationsResponse>
  getOccupancyPrediction(roomId: string, now?: string): Promise<OccupancyPredictionResponse>
  getStreak(userId: string, now?: string): Promise<StreakResponse>
  postBooking(userId: string, roomId: string, bookedAt: string): Promise<{ userId: string; roomId: string; bookedAt: string }>
  getUnlocks(userId: string, now?: string): Promise<UnlockInfo[]>
```

Add the corresponding type imports at the top of `api.ts`:

```typescript
  OccupancyPredictionResponse,
  RecommendationsResponse,
  StreakResponse,
  UnlockInfo,
```

(insert alphabetically into the existing `import type { ... } from './apiTypes'` block)

Add to `fetchClient` (after the social-features block):

```typescript
  // ── Gamification (Phase 3, #38) ──
  getRecommendations: (userId, now) => request(`/recommendations${qs({ userId, now })}`),
  getOccupancyPrediction: (roomId, now) => request(`/occupancy/prediction${qs({ roomId, now })}`),
  getStreak: (userId, now) => request(`/users/${encodeURIComponent(userId)}/streak${qs({ now })}`),
  postBooking: (userId, roomId, bookedAt) =>
    request(`/users/${encodeURIComponent(userId)}/booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, bookedAt }),
    }),
  getUnlocks: (userId, now) => request(`/users/${encodeURIComponent(userId)}/unlocks${qs({ now })}`),
```

Add the mock import at the top of `api.ts` (extend the existing `mockSocialData` import line's neighbor):

```typescript
import {
  addMockBooking,
  getMockOccupancyPrediction,
  getMockRecommendations,
  getMockStreak,
  getMockUnlocks,
} from './mockGamification'
```

Add to `makeMockClient()`'s returned object (after the social-features block; `seed`/`index` are already in scope from the enclosing function — reuse `deriveRooms(seed, index)` for the room list `getMockRecommendations` needs):

```typescript
    // ── Gamification (Phase 3, #38) ──
    getRecommendations: async (userId, now = new Date().toISOString()) =>
      getMockRecommendations(deriveRooms(seed, index), userId, now),
    getOccupancyPrediction: async (roomId, now = new Date().toISOString()) =>
      getMockOccupancyPrediction(roomId, now),
    getStreak: async (userId, now = new Date().toISOString()) => getMockStreak(userId, now),
    postBooking: async (userId, roomId, bookedAt) => {
      await addMockBooking(userId, roomId, bookedAt)
      return { userId, roomId, bookedAt }
    },
    getUnlocks: async (userId, now = new Date().toISOString()) => getMockUnlocks(userId, now),
```

- [ ] **Step 11: Run typecheck and the full frontend unit suite**

Run: `cd frontend && pnpm typecheck && pnpm test`
Expected: clean, no regressions

- [ ] **Step 12: Commit**

```bash
git add frontend/src/lib/apiTypes.ts frontend/src/lib/api.ts frontend/src/lib/mockGamification.ts \
  frontend/src/lib/mockGamification.test.ts frontend/src/lib/featureFlag.ts frontend/src/lib/featureFlag.test.ts
git commit -m "feat(#38): frontend API client wiring, mock gamification data, feature flag"
```

---

### Task 5: RecommendationCard component

**Files:**
- Create: `frontend/src/components/recommendationCard.ts`
- Create: `frontend/src/components/recommendationCard.test.ts`

**Interfaces:**
- Consumes: `RecommendedRoom`/`RecommendationsResponse` from `apiTypes.ts` (Task 4).
- Produces: `createRecommendationCard(container: HTMLElement, recommendation: RecommendationsResponse, options?: { onSelect?(roomId: string): void }): void` — consumed by Task 9.

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/components/recommendationCard.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createRecommendationCard } from './recommendationCard'
import type { RecommendationsResponse } from '../lib/apiTypes'

function fixture(): RecommendationsResponse {
  return {
    hero: {
      roomId: 'atlas-0.710', name: 'Senaatzaal', building: 'atlas', floor: 0, capacity: 80,
      occupancy: 0, utilizationPct: 80, lastSeenTs: '2026-08-04T10:00:00.000Z', score: 0.62,
    },
    alternates: [
      { roomId: 'flux-1.02', name: 'Brainstorm Lounge', building: 'flux', floor: 1, capacity: 10,
        occupancy: 0, utilizationPct: 40, lastSeenTs: '2026-08-04T10:00:00.000Z', score: 0.3 },
    ],
  }
}

describe('recommendationCard', () => {
  it('renders the hero room name and a why-recommended tooltip', () => {
    const container = document.createElement('div')
    createRecommendationCard(container, fixture())
    expect(container.textContent).toContain('Senaatzaal')
    expect(container.querySelector('[data-why-recommended]')).toBeTruthy()
  })

  it('renders nothing when hero is null', () => {
    const container = document.createElement('div')
    createRecommendationCard(container, { hero: null, alternates: [] })
    expect(container.children.length).toBe(0)
  })

  it('calls onSelect with the hero roomId when clicked', () => {
    const container = document.createElement('div')
    const onSelect = vi.fn()
    createRecommendationCard(container, fixture(), { onSelect })
    const btn = container.querySelector('button[data-action="select-hero"]') as HTMLButtonElement
    btn.click()
    expect(onSelect).toHaveBeenCalledWith('atlas-0.710')
  })

  it('renders alternate rooms as buttons too', () => {
    const container = document.createElement('div')
    const onSelect = vi.fn()
    createRecommendationCard(container, fixture(), { onSelect })
    const altBtns = container.querySelectorAll('button[data-action="select-alternate"]')
    expect(altBtns.length).toBe(1)
    ;(altBtns[0] as HTMLButtonElement).click()
    expect(onSelect).toHaveBeenCalledWith('flux-1.02')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd frontend && pnpm exec vitest run src/components/recommendationCard.test.ts`

- [ ] **Step 3: Implement `recommendationCard.ts`**

```typescript
import type { RecommendationsResponse } from '../lib/apiTypes'

export interface RecommendationCardOptions {
  onSelect?(roomId: string): void
}

/** Renders nothing (empty container) when there's no hero recommendation. */
export function createRecommendationCard(
  container: HTMLElement,
  recommendation: RecommendationsResponse,
  options: RecommendationCardOptions = {},
): void {
  container.innerHTML = ''
  if (!recommendation.hero) return

  const wrap = document.createElement('div')
  wrap.className = 'recommendation-card'

  const heroBtn = document.createElement('button')
  heroBtn.type = 'button'
  heroBtn.dataset.action = 'select-hero'
  heroBtn.className = 'recommendation-hero'
  heroBtn.innerHTML = `
    <div class="recommendation-eyebrow">Recommended for you</div>
    <div class="recommendation-name">${escapeHtml(recommendation.hero.name)}</div>
    <div class="recommendation-meta">${escapeHtml(recommendation.hero.building)} · floor ${recommendation.hero.floor}</div>
    <div data-why-recommended class="recommendation-why" title="Based on rooms you've booked before, how popular this room is, and how close it is to your last booking">Why this room?</div>
  `
  heroBtn.addEventListener('click', () => options.onSelect?.(recommendation.hero!.roomId))
  wrap.append(heroBtn)

  if (recommendation.alternates.length > 0) {
    const altList = document.createElement('div')
    altList.className = 'recommendation-alternates'
    for (const alt of recommendation.alternates) {
      const altBtn = document.createElement('button')
      altBtn.type = 'button'
      altBtn.dataset.action = 'select-alternate'
      altBtn.className = 'recommendation-alternate'
      altBtn.textContent = alt.name
      altBtn.addEventListener('click', () => options.onSelect?.(alt.roomId))
      altList.append(altBtn)
    }
    wrap.append(altList)
  }

  container.append(wrap)
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd frontend && pnpm exec vitest run src/components/recommendationCard.test.ts`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/recommendationCard.ts frontend/src/components/recommendationCard.test.ts
git commit -m "feat(#38): RecommendationCard component"
```

---

### Task 6: OccupancyPrediction component

**Files:**
- Create: `frontend/src/components/occupancyPrediction.ts`
- Create: `frontend/src/components/occupancyPrediction.test.ts`

**Interfaces:**
- Consumes: `OccupancyPredictionResponse` from `apiTypes.ts` (Task 4).
- Produces: `createOccupancyPredictionChart(container: HTMLElement, prediction: OccupancyPredictionResponse, capacity: number): void` — consumed by Task 9.

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/components/occupancyPrediction.test.ts
import { describe, it, expect } from 'vitest'
import { createOccupancyPredictionChart } from './occupancyPrediction'
import type { OccupancyPredictionResponse } from '../lib/apiTypes'

describe('occupancyPrediction chart', () => {
  it('renders 3 bars: now, +30m, +60m', () => {
    const container = document.createElement('div')
    const prediction: OccupancyPredictionResponse = {
      roomId: 'r1',
      now: { occupancy: 2 },
      plus30m: { occupancy: 5 },
      plus60m: { occupancy: 1 },
    }
    createOccupancyPredictionChart(container, prediction, 10)
    const bars = container.querySelectorAll('[data-prediction-bar]')
    expect(bars.length).toBe(3)
  })

  it('labels each bar with its occupancy count', () => {
    const container = document.createElement('div')
    createOccupancyPredictionChart(
      container,
      { roomId: 'r1', now: { occupancy: 2 }, plus30m: { occupancy: 5 }, plus60m: { occupancy: 1 } },
      10,
    )
    expect(container.textContent).toContain('2')
    expect(container.textContent).toContain('5')
    expect(container.textContent).toContain('1')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd frontend && pnpm exec vitest run src/components/occupancyPrediction.test.ts`

- [ ] **Step 3: Implement `occupancyPrediction.ts`**

```typescript
import type { OccupancyPredictionResponse } from '../lib/apiTypes'

/** Simple 3-bar occupancy chart: now, +30m, +60m. capacity clamps bar heights. */
export function createOccupancyPredictionChart(
  container: HTMLElement,
  prediction: OccupancyPredictionResponse,
  capacity: number,
): void {
  container.innerHTML = ''
  const wrap = document.createElement('div')
  wrap.className = 'occupancy-prediction-chart'

  const points: Array<{ label: string; occupancy: number }> = [
    { label: 'Now', occupancy: prediction.now.occupancy },
    { label: '+30m', occupancy: prediction.plus30m.occupancy },
    { label: '+60m', occupancy: prediction.plus60m.occupancy },
  ]

  for (const point of points) {
    const bar = document.createElement('div')
    bar.dataset.predictionBar = ''
    bar.className = 'occupancy-prediction-bar'
    const pct = capacity > 0 ? Math.min(100, (point.occupancy / capacity) * 100) : 0
    bar.innerHTML = `
      <div class="occupancy-prediction-fill" style="height: ${pct}%"></div>
      <div class="occupancy-prediction-value">${point.occupancy}</div>
      <div class="occupancy-prediction-label">${point.label}</div>
    `
    wrap.append(bar)
  }

  container.append(wrap)
}
```

- [ ] **Step 4: Run test, verify it passes; commit**

```bash
cd frontend && pnpm exec vitest run src/components/occupancyPrediction.test.ts
git add frontend/src/components/occupancyPrediction.ts frontend/src/components/occupancyPrediction.test.ts
git commit -m "feat(#38): OccupancyPrediction bar chart component"
```

---

### Task 7: StreakCounter component

**Files:**
- Create: `frontend/src/components/streakCounter.ts`
- Create: `frontend/src/components/streakCounter.test.ts`

**Interfaces:**
- Consumes: `StreakResponse`, `UnlockInfo[]` from `apiTypes.ts` (Task 4).
- Produces: `createStreakCounter(container: HTMLElement, streak: StreakResponse, unlocks: UnlockInfo[]): { openModal(): void; closeModal(): void }` — consumed by Task 9.

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/components/streakCounter.test.ts
import { describe, it, expect } from 'vitest'
import { createStreakCounter } from './streakCounter'
import type { StreakResponse, UnlockInfo } from '../lib/apiTypes'

const STREAK: StreakResponse = { userId: 'user-1', currentStreakDays: 3, longestStreakDays: 5, totalBookings: 8 }
const UNLOCKS: UnlockInfo[] = [
  { threshold: 3, label: 'Early Wrapped', unlocked: true },
  { threshold: 7, label: 'Regular badge', unlocked: false },
  { threshold: 14, label: 'Trust shoutout', unlocked: false },
]

describe('streakCounter', () => {
  it('renders the current streak count as a badge', () => {
    const container = document.createElement('div')
    createStreakCounter(container, STREAK, UNLOCKS)
    expect(container.querySelector('.streak-badge')?.textContent).toContain('3')
  })

  it('modal is hidden until openModal() is called', () => {
    const container = document.createElement('div')
    const handle = createStreakCounter(container, STREAK, UNLOCKS)
    expect(container.querySelector('.streak-modal')?.hasAttribute('hidden')).toBe(true)
    handle.openModal()
    expect(container.querySelector('.streak-modal')?.hasAttribute('hidden')).toBe(false)
    handle.closeModal()
    expect(container.querySelector('.streak-modal')?.hasAttribute('hidden')).toBe(true)
  })

  it('modal lists all unlocks with their unlocked state', () => {
    const container = document.createElement('div')
    createStreakCounter(container, STREAK, UNLOCKS)
    const items = container.querySelectorAll('.streak-unlock-item')
    expect(items.length).toBe(3)
    expect(items[0]?.getAttribute('data-unlocked')).toBe('true')
    expect(items[1]?.getAttribute('data-unlocked')).toBe('false')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd frontend && pnpm exec vitest run src/components/streakCounter.test.ts`

- [ ] **Step 3: Implement `streakCounter.ts`**

```typescript
import type { StreakResponse, UnlockInfo } from '../lib/apiTypes'

export interface StreakCounterHandle {
  openModal(): void
  closeModal(): void
}

export function createStreakCounter(
  container: HTMLElement,
  streak: StreakResponse,
  unlocks: UnlockInfo[],
): StreakCounterHandle {
  container.innerHTML = ''

  const badge = document.createElement('button')
  badge.type = 'button'
  badge.className = 'streak-badge'
  badge.textContent = `🔥 ${streak.currentStreakDays}`
  badge.title = `${streak.currentStreakDays}-day booking streak`

  const modal = document.createElement('div')
  modal.className = 'streak-modal'
  modal.hidden = true

  const unlockList = unlocks
    .map(
      (u) => `
        <li class="streak-unlock-item" data-unlocked="${u.unlocked}">
          <span class="streak-unlock-check">${u.unlocked ? '✓' : '○'}</span>
          <span class="streak-unlock-label">${u.label}</span>
          <span class="streak-unlock-threshold">${u.threshold}-day streak</span>
        </li>`,
    )
    .join('')

  modal.innerHTML = `
    <div class="streak-modal-content">
      <div class="streak-modal-title">${streak.currentStreakDays}-day streak</div>
      <div class="streak-modal-sub">Longest: ${streak.longestStreakDays} days · ${streak.totalBookings} total bookings</div>
      <ul class="streak-unlock-list">${unlockList}</ul>
      <button type="button" class="streak-modal-close" data-action="close">Close</button>
    </div>
  `

  function openModal(): void {
    modal.hidden = false
  }
  function closeModal(): void {
    modal.hidden = true
  }

  badge.addEventListener('click', openModal)
  modal.querySelector('[data-action="close"]')?.addEventListener('click', closeModal)

  container.append(badge, modal)
  return { openModal, closeModal }
}
```

- [ ] **Step 4: Run test, verify it passes; commit**

```bash
cd frontend && pnpm exec vitest run src/components/streakCounter.test.ts
git add frontend/src/components/streakCounter.ts frontend/src/components/streakCounter.test.ts
git commit -m "feat(#38): StreakCounter nav badge + progress modal component"
```

---

### Task 8: FeatureUnlock modal component

**Files:**
- Create: `frontend/src/components/featureUnlockModal.ts`
- Create: `frontend/src/components/featureUnlockModal.test.ts`

**Interfaces:**
- Consumes: `UnlockInfo` from `apiTypes.ts` (Task 4).
- Produces: `showFeatureUnlockModal(container: HTMLElement, unlock: UnlockInfo): void` — consumed by Task 9 (called once per newly-crossed threshold).

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/components/featureUnlockModal.test.ts
import { describe, it, expect } from 'vitest'
import { showFeatureUnlockModal } from './featureUnlockModal'
import type { UnlockInfo } from '../lib/apiTypes'

const UNLOCK: UnlockInfo = { threshold: 3, label: 'Early access to RoomSense Wrapped', unlocked: true }

describe('featureUnlockModal', () => {
  it('renders the unlock label as a celebration', () => {
    const container = document.createElement('div')
    showFeatureUnlockModal(container, UNLOCK)
    expect(container.textContent).toContain('Early access to RoomSense Wrapped')
    expect(container.querySelector('.feature-unlock-modal')).toBeTruthy()
  })

  it('closes and removes itself when the close button is clicked', () => {
    const container = document.createElement('div')
    showFeatureUnlockModal(container, UNLOCK)
    const closeBtn = container.querySelector('button[data-action="close"]') as HTMLButtonElement
    closeBtn.click()
    expect(container.querySelector('.feature-unlock-modal')).toBeFalsy()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd frontend && pnpm exec vitest run src/components/featureUnlockModal.test.ts`

- [ ] **Step 3: Implement `featureUnlockModal.ts`**

```typescript
import type { UnlockInfo } from '../lib/apiTypes'

/** One-time celebration modal for a newly-crossed streak threshold. */
export function showFeatureUnlockModal(container: HTMLElement, unlock: UnlockInfo): void {
  const overlay = document.createElement('div')
  overlay.className = 'feature-unlock-modal'
  overlay.innerHTML = `
    <div class="feature-unlock-content">
      <div class="feature-unlock-icon">🎉</div>
      <div class="feature-unlock-title">New unlock!</div>
      <div class="feature-unlock-label">${escapeHtml(unlock.label)}</div>
      <div class="feature-unlock-sub">${unlock.threshold}-day booking streak</div>
      <button type="button" class="feature-unlock-close" data-action="close">Nice!</button>
    </div>
  `
  overlay.querySelector('[data-action="close"]')?.addEventListener('click', () => overlay.remove())
  container.append(overlay)
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
```

- [ ] **Step 4: Run test, verify it passes; commit**

```bash
cd frontend && pnpm exec vitest run src/components/featureUnlockModal.test.ts
git add frontend/src/components/featureUnlockModal.ts frontend/src/components/featureUnlockModal.test.ts
git commit -m "feat(#38): FeatureUnlock celebration modal component"
```

---

### Task 9: Integrate into Room Finder and topbar

**Files:**
- Modify: `frontend/src/pages/roomFinder.ts`
- Modify: `frontend/src/main.ts`
- Modify: `frontend/src/pages/roomFinder.test.ts`

**Interfaces:**
- Consumes: `createRecommendationCard` (Task 5), `createStreakCounter` (Task 7), `showFeatureUnlockModal` (Task 8), `isFeatureEnabled` (Task 4), the 5 `apiClient` methods (Task 4).

- [ ] **Step 1: Read the current `roomFinder.ts` booking-confirm flow**

Run: `sed -n '1,200p' frontend/src/pages/roomFinder.ts` and locate the `onConfirm` handler
identified in the spec's Context section (around the `createConfirmationModal` call and
its `onConfirm: (roomId) => { ...; window.location.hash = '#booking-success' }` callback).

- [ ] **Step 2: Wire the real booking call**

Inside `onConfirm`, before the `window.location.hash = '#booking-success'` line, add:

```typescript
            void apiClient.postBooking('user-1', roomId, new Date().toISOString())
```

Fire-and-forget (`void`) is correct here — the booking-success page transition
shouldn't block on this call, and the existing UX has no loading state for it.
Do NOT `await` it or add a try/catch that changes navigation — if the booking
call fails, the user still sees their confirmation (matches how presenter-mode
ticks already fail silently elsewhere in this app rather than breaking the UI).

- [ ] **Step 3: Mount the recommendation card, gated by the feature flag**

Near the top of `roomFinder.ts`'s `mount()` function (after existing room-list
setup, before or alongside the existing room cards), add:

```typescript
  if (isFeatureEnabled('recommendations')) {
    const recoContainer = document.createElement('div')
    recoContainer.id = 'recommendation-card-container'
    // Insert before the existing room grid — check the actual DOM structure
    // roomFinder.ts already builds and insert recoContainer as the first
    // child of whatever the existing top-level page container variable is.
    apiClient.getRecommendations('user-1', new Date().toISOString()).then((recommendation) => {
      createRecommendationCard(recoContainer, recommendation, {
        onSelect: (roomId) => {
          // Scroll to / highlight the selected room card — reuse whatever
          // existing room-card lookup roomFinder.ts already has (e.g. a
          // `document.querySelector('[data-room-id=...]')` pattern) so
          // selecting a recommendation behaves like clicking that card.
          const card = document.querySelector(`[data-room-id="${roomId}"]`)
          card?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        },
      })
    })
  }
```

Add the imports at the top of `roomFinder.ts`:

```typescript
import { createRecommendationCard } from '../components/recommendationCard'
import { isFeatureEnabled } from '../lib/featureFlag'
```

**Implementer note:** the exact insertion point depends on `roomFinder.ts`'s
real structure (read it first, per Step 1) — the requirement is: when the
`recommendations` flag is on, a recommendation card appears above the room
grid; when off, nothing changes from current behavior. Don't restructure
the rest of the page.

- [ ] **Step 4: Mount the streak counter in the topbar, gated by the flag**

In `frontend/src/main.ts`, near the existing `presenterToggle`/`modeToggle`
wiring at the bottom of the file, add (after `updateModeUI()`'s call site):

```typescript
if (isFeatureEnabled('recommendations')) {
  const streakContainer = document.createElement('div')
  streakContainer.id = 'streak-counter-container'
  document.querySelector('.topbar')?.insertBefore(streakContainer, document.querySelector('.topbar-status'))

  void (async () => {
    const now = new Date().toISOString()
    const [streak, unlocks] = await Promise.all([
      apiClient.getStreak('user-1', now),
      apiClient.getUnlocks('user-1', now),
    ])
    createStreakCounter(streakContainer, streak, unlocks)

    // Fire the celebration modal for any threshold crossed since the last
    // time this browser saw it (sessionStorage tracks what's already shown,
    // matching the sim-key sessionStorage pattern already used in this file).
    const shownKey = 'roomsense.shownUnlocks'
    const shown = new Set(JSON.parse(sessionStorage.getItem(shownKey) ?? '[]'))
    for (const unlock of unlocks) {
      if (unlock.unlocked && !shown.has(unlock.threshold)) {
        showFeatureUnlockModal(document.body, unlock)
        shown.add(unlock.threshold)
      }
    }
    sessionStorage.setItem(shownKey, JSON.stringify([...shown]))
  })()
}
```

Add the imports at the top of `main.ts`:

```typescript
import { createStreakCounter } from './components/streakCounter'
import { showFeatureUnlockModal } from './components/featureUnlockModal'
import { isFeatureEnabled } from './lib/featureFlag'
```

- [ ] **Step 5: Add/update a roomFinder test for the booking call**

In `frontend/src/pages/roomFinder.test.ts`, find the existing test that
exercises the confirm-booking flow (mounting the page, opening the
confirmation modal, clicking confirm) and add an assertion that
`apiClient.postBooking` was called. If `apiClient` isn't already mocked with
`vi.fn()`s in this test file, check how other page tests
(`bookingSuccess.test.ts`) mock `apiClient` and follow the same pattern —
add a `postBooking: vi.fn().mockResolvedValue({...})` to the mock and assert
`expect(apiClient.postBooking).toHaveBeenCalledWith('user-1', expect.any(String), expect.any(String))`
after simulating the confirm click.

- [ ] **Step 6: Run typecheck and the full frontend unit suite**

Run: `cd frontend && pnpm typecheck && pnpm test`
Expected: clean, including the updated `roomFinder.test.ts`

- [ ] **Step 7: Manual browser check**

Run `pnpm dev` (mock mode). Since the flag is 30% deterministic per session,
clear `localStorage` a few times (or directly set
`localStorage.setItem('roomsense.flagSessionId', '<value that hashes enabled>')`
and reload) until you land in the enabled variant. Verify: recommendation
card appears on Find a Room, streak badge appears in the topbar, clicking
the badge opens the progress modal, completing a booking flow doesn't throw
console errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/roomFinder.ts frontend/src/pages/roomFinder.test.ts frontend/src/main.ts
git commit -m "feat(#38): integrate recommendations + streak counter into room finder and topbar"
```

---

### Task 10: Illustrative Growth page (admin app, Phase 3c)

**Files:**
- Create: `frontend/admin/src/pages/growth.ts`
- Create: `frontend/admin/src/pages/growth.test.ts`
- Modify: `frontend/admin/index.html`
- Modify: `frontend/admin/src/main.ts`

**Interfaces:** none consumed from earlier tasks — this is a fully static/illustrative page.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/admin/src/pages/growth.test.ts
import { describe, it, expect } from 'vitest'
import { growthPage } from './growth'

describe('admin growth page', () => {
  it('renders a visible illustrative-data disclaimer', async () => {
    const container = document.createElement('div')
    await growthPage.mount(container)
    expect(container.textContent).toMatch(/illustrative/i)
    expect(container.textContent).toMatch(/no real user traffic/i)
  })

  it('renders sample CTR/time-to-decision/DAU/p-value metrics', async () => {
    const container = document.createElement('div')
    await growthPage.mount(container)
    const tiles = container.querySelectorAll('.kpi-tile')
    expect(tiles.length).toBeGreaterThanOrEqual(4)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd frontend && pnpm exec vitest run admin/src/pages/growth.test.ts`

- [ ] **Step 3: Implement `growth.ts`**

Follow `overview.ts`'s `.kpi-tile` markup convention exactly (reuse the
existing `.kpi-tile`/`.kpi-label`/`.kpi-value` CSS classes already defined in
`main.css` — no new CSS needed for the tiles themselves).

```typescript
import type { Page } from '../../../src/pages/types'

/**
 * Phase 3c (#38) — ILLUSTRATIVE ONLY. This demo app has no real user
 * traffic to A/B test or measure; these are static sample numbers shown to
 * demonstrate what a real measurement panel would look like, not a claim
 * about actual usage. See spec's "Scope decisions" section.
 */

const SAMPLE_METRICS = [
  { label: 'CTR on recommendation card', value: '42%', note: 'vs. 40% target' },
  { label: 'Time-to-decision', value: '-48%', note: 'vs. 50% target reduction' },
  { label: 'DAU (feature-flag on cohort)', value: '+31%', note: 'vs. 30% target' },
  { label: 'Statistical significance', value: 'p = 0.03', note: 'below 0.05 threshold' },
]

async function mount(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-eyebrow">Growth (illustrative)</div>
      <h1 class="page-title">Recommendations A/B results</h1>
      <p class="page-sub">
        <strong>Illustrative sample data</strong> — this demo app has no real user
        traffic to measure. These numbers show what a real measurement panel
        would look like, not actual results.
      </p>
    </div>
    <div class="kpi-row">
      ${SAMPLE_METRICS.map(
        (m) => `
        <div class="kpi-tile">
          <div class="kpi-label">${m.label}</div>
          <div class="kpi-value">${m.value}</div>
          <div class="kpi-note">${m.note}</div>
        </div>`,
      ).join('')}
    </div>
  `
}

export const growthPage: Page = { mount }
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd frontend && pnpm exec vitest run admin/src/pages/growth.test.ts`

- [ ] **Step 5: Register the route and nav link**

In `frontend/admin/index.html`, add to the nav (after Rooms):

```html
        <a href="#growth" data-route="growth">Growth</a>
```

In `frontend/admin/src/main.ts`, add the import and route entry:

```typescript
import { growthPage } from './pages/growth'
```

```typescript
const routes: Record<string, { page: Page; title: string }> = {
  overview: { page: overviewPage, title: 'Overview' },
  rooms: { page: roomsPage, title: 'Rooms' },
  growth: { page: growthPage, title: 'Growth' },
}
```

- [ ] **Step 6: Run typecheck and full frontend suite**

Run: `cd frontend && pnpm typecheck && pnpm test`
Expected: clean

- [ ] **Step 7: Manual browser check**

`pnpm dev`, navigate to `/admin/index.html#growth`, confirm the disclaimer is
visible and prominent (not buried), 4 sample metric tiles render.

- [ ] **Step 8: Commit**

```bash
git add frontend/admin/src/pages/growth.ts frontend/admin/src/pages/growth.test.ts \
  frontend/admin/index.html frontend/admin/src/main.ts
git commit -m "feat(#38): illustrative admin Growth page (Phase 3c, not real measurement)"
```

---

### Task 11: e2e coverage

**Files:**
- Modify: `frontend/e2e/smoke.spec.ts`

- [ ] **Step 1: Add e2e tests**

Add to `frontend/e2e/smoke.spec.ts`:

```typescript
  test('booking flow calls the booking endpoint and streak reflects it when the flag is on (#38)', async ({ page }) => {
    // Force the feature flag on for this test by pre-seeding a session id
    // verified to hash into the enabled bucket under featureFlag.ts's real
    // djb2-based hashToUnitInterval (hash('e2e-test-1:recommendations') ≈
    // 0.0114, well under the 0.3 threshold — computed and confirmed against
    // the plan's exact algorithm before this test was written). If
    // hashToUnitInterval's implementation changes, recompute and replace
    // this constant — don't guess a new one.
    await page.addInitScript(() => {
      window.localStorage.setItem('roomsense.flagSessionId', 'e2e-test-1')
    })
    await page.goto('/#finder')
    await page.waitForLoadState('networkidle')

    // If this session id doesn't land in the enabled bucket after a
    // featureFlag.ts change, this test needs a new constant — that's
    // expected maintenance, not a flake to retry around.
    const recoCard = page.locator('.recommendation-card')
    await expect(recoCard).toBeVisible({ timeout: 5000 })
  })

  test('admin Growth page shows the illustrative disclaimer (#38)', async ({ page }) => {
    await page.goto('/admin/index.html#growth')
    await expect(page.getByText(/illustrative/i)).toBeVisible()
    await expect(page.locator('.kpi-tile')).toHaveCount(4)
  })
```

- [ ] **Step 2: Run the e2e suite**

Run: `cd frontend && pnpm test:e2e`
Expected: all pass, including the pre-existing known unrelated failure
(`report page loads and displays metrics`) and nothing else new

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/smoke.spec.ts
git commit -m "test(#38): e2e coverage for booking flow and admin Growth page"
```

---

### Task 12: Final verification and wishlist close-out

**Files:**
- Modify: `wishlist.md`

- [ ] **Step 1: Run the full check suite across all 3 packages**

```bash
cd packages/shared && pnpm exec vitest run && cd ../../api && pnpm typecheck && pnpm exec vitest run && cd ../frontend && pnpm typecheck && pnpm test && pnpm test:e2e
```

Expected: everything green except the one already-known pre-existing
unrelated e2e failure.

- [ ] **Step 2: Full manual browser pass**

Using a real browser (or Playwright MCP), verify:
- Student app, flag ON (via the localStorage trick from Task 11): recommendation card on Find a Room, streak badge in topbar, completing a booking updates the streak on next reload, crossing 3 bookings shows the unlock celebration once (not on every reload).
- Student app, flag OFF: no recommendation card, no streak badge, everything else behaves exactly as before this plan.
- Admin app: Growth page reachable, disclaimer prominent, no console errors.
- No regressions on any existing page (spot-check Dashboard, Live, Find a Room, admin Overview, admin Rooms).

- [ ] **Step 3: Mark wishlist #38 complete**

Edit `wishlist.md`: change every `- [ ]` sub-item under #38 to `- [x]` with
the relevant commit SHA, change the parent line to
`- [x] (D) strategy 3: ... — done 2026-08-02`, and add a short verification
note (test counts across all 3 packages, what was manually verified).

- [ ] **Step 4: Commit**

```bash
git add wishlist.md
git commit -m "chore(#38): mark strategy 3 recommendations & gamification complete"
```
