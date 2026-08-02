# Strategy 3: AI recommendations & gamification — design

**Date:** 2026-08-02
**Status:** Approved, ready for implementation
**Wishlist:** #38

## Context

#38 is the last of the three consumer-UI strategies from #35's evaluation (#36
mobile-first booking and #37 social presence both shipped). Its wishlist entry
already specifies phases, endpoints, and a scoring formula — this spec fills in
the concrete algorithms, data model, and file structure needed to implement it,
and narrows scope to what's actually achievable for a demo app with seeded
data and no real users.

**Scope decisions (confirmed with Toine 2026-08-02):**
- Phase 3a (backend) is built for real, crossing into `api/**` (same as
  #44-#46) rather than waiting for Hermes.
- Phases 3c (A/B measurement) and 3d (ML model) are **not achievable** for a
  demo app — no real traffic to measure or train on. Built as clearly-labeled
  illustrative scaffolding instead of real infrastructure: a deterministic
  feature flag + a static sample-metrics panel for 3c, a documentation-only
  future-path note for 3d (no code).

## Key design decision: streak is derived, not stored

The wishlist phrases this as "increments streak" (implying a stored, mutated
counter), but this project's own established convention — see CLAUDE.md on
ghost-meeting derivation and latest-occupancy anchoring — is to always derive
state from an event log, never trust a separately-mutated counter that can
drift. This spec deviates from the wishlist's literal wording accordingly:

- Every booking through the app writes one row to a new `UserBookings` table.
- Streak, "repeat" (for recommendations), and unlocks are all **computed** by
  reading `UserBookings` at request time — nothing is incremented.

## Data model

### New shared type (`packages/shared/src/types.ts`)

```typescript
export const UserBookingSchema = z.object({
  userId: z.string(),
  roomId: z.string(),
  bookedAt: z.string().datetime(),
})
export type UserBooking = z.infer<typeof UserBookingSchema>
```

### New table (`api/src/lib/tables.ts`'s `TABLE_NAMES`)

`userBookings: 'UserBookings'` — PK: `userId`, RK: `${bookedAt}_${roomId}`
(timestamp-first RK gives natural descending-time iteration order, matching
the existing `SensorReadings`/`OccupancySnapshots` convention).

## Algorithms

### Recommendation score (`GET /api/recommendations`)

For each room currently free (occupancy === 0, from the same data `/rooms`
already returns — never recommend an occupied room):

```
repeatScore     = 1.0 if userId has any prior UserBookings row for this roomId, else 0.0
popularityScore = room.utilizationPct / 100   (already computed by GET /rooms)
distanceScore   = 1.0 if same building AND same floor as the user's most recent booking
                = 0.6 if same building, different floor
                = 0.2 if different building
                = 0.6 (neutral default) if the user has no booking history at all

totalScore = 0.5 * repeatScore + 0.3 * popularityScore + 0.2 * distanceScore
```

Sort descending by `totalScore`; the top result is the "hero", the next two
are "alternates". Ties broken by `roomId` ascending (deterministic, testable).

### Occupancy prediction (`GET /api/occupancy/prediction`)

For `+30m` and `+60m` from `now`: average this room's occupancy across all
historical `OccupancySnapshots` (already fetched the same way
`GET /rooms/{roomId}/occupancy` does) whose timestamp falls in the same
15-minute-of-day bucket as `(now + offset)`, regardless of which calendar day
they're from. If there is no historical data in that bucket, fall back to the
room's current occupancy (no wild extrapolation). This is a heuristic, not
ML — 3d's "collaborative filtering" upgrade is explicitly out of scope here.

### Streak (`GET /api/users/{id}/streak`)

Read all `UserBookings` for `userId`; extract the distinct UTC calendar dates
booked into a `Set<string>` (`YYYY-MM-DD`). Walk backward **one weekday at a
time** starting from `referenceTs`'s UTC date, skipping Saturdays/Sundays
entirely (they are neither required for, nor able to break, a streak — matches
this app's existing "only weekday office-hours data is meaningful"
convention). At each weekday: if it's in the booked-dates set, increment the
streak and move to the previous weekday; if it's not, stop — UNLESS it is
`referenceTs`'s own date AND that date has no booking yet, in which case skip
just that one starting day without stopping (a streak isn't broken until a
full day passes with no booking) and continue the walk from the previous
weekday. Example: bookings on Thursday and the following Monday, `referenceTs`
= that Tuesday with no booking yet → walk skips Tuesday (today, not yet
booked, doesn't stop it) → Monday booked (+1) → Sunday skipped (weekend) →
Saturday skipped (weekend) → Friday not booked → stop. Result: streak = 1,
not 2 — Thursday's booking is NOT connected to Monday's because Friday (a
weekday) breaks the chain between them. (Contrast with Friday+Monday
bookings with no gap weekday between them: Friday booked, Saturday/Sunday
skipped, Monday booked → streak = 2.)

### Unlocks (`GET /api/users/{id}/unlocks`)

Computed from the same streak number, fixed thresholds:

| Streak (days) | Unlock                                                    |
|---------------|------------------------------------------------------------|
| 3             | Early access to RoomSense Wrapped (normally end-of-semester) |
| 7             | "Regular" badge shown next to the user's name on Reviews  |
| 14            | Shoutout line on the Trust page's "who uses this" section |

Response: array of `{ threshold: number, label: string, unlocked: boolean }`
for all three, so the frontend can show progress toward the next one.

## API contract (new endpoints, follow existing `presence.ts`/`reviews.ts` shape exactly: zod validation, `withCors`/`corsPreflightResponse`, `logError`, `referenceTs`/`now` query param — never `Date.now()`)

- `GET /api/recommendations?userId=&now=` → `{ hero: RoomWithOccupancy & { score: number }, alternates: Array<RoomWithOccupancy & { score: number }> }` (`RoomWithOccupancy` = the same shape `GET /rooms` already returns; top 3 free rooms by score, hero is index 0)
- `GET /api/occupancy/prediction?roomId=&now=` → `{ roomId, now: {occupancy}, plus30m: {occupancy}, plus60m: {occupancy} }`
- `GET /api/users/{id}/streak?now=` → `{ userId, currentStreakDays, longestStreakDays, totalBookings }`
- `POST /api/users/{id}/booking` body `{ roomId, bookedAt }` → 201, `{ userId, roomId, bookedAt }`, then the caller re-fetches streak/unlocks
- `GET /api/users/{id}/unlocks?now=` → array of unlock objects (table above)

## Files touched

**Backend:**
- `packages/shared/src/types.ts` — add `UserBookingSchema`/`UserBooking`
- `api/src/lib/tables.ts` — add `userBookings: 'UserBookings'` to `TABLE_NAMES`
- `api/src/functions/recommendations.ts` — new, `GET /api/recommendations`
- `api/src/functions/occupancyPrediction.ts` — new, `GET /api/occupancy/prediction`
- `api/src/functions/bookings.ts` — new, groups `POST /api/users/{id}/booking`,
  `GET /api/users/{id}/streak`, `GET /api/users/{id}/unlocks` (share the same
  `UserBookings` read/derive logic — same pattern as `reviews.ts` grouping GET+POST)
- `api/src/index.ts` — append the 3 new imports (append-only, per existing guard)

**Frontend:**
- `frontend/src/lib/apiTypes.ts` — response types for the 5 new endpoints
- `frontend/src/lib/api.ts` — add the 5 methods to `ApiClient`, `fetchClient`, `makeMockClient`
- `frontend/src/lib/mockGamification.ts` — new, mock data + derivation logic mirroring `mockSocialData.ts`'s existing pattern (`'user-1'` demo user, deterministic from existing mock room/occupancy fixtures — no new seed data needed)
- `frontend/src/lib/featureFlag.ts` — new, deterministic 30/70 split via a hash of a `localStorage`-persisted anonymous session id (not `Math.random()` — must be stable across reloads for a consistent demo experience)
- `frontend/src/components/recommendationCard.ts` — new
- `frontend/src/components/occupancyPrediction.ts` — new
- `frontend/src/components/streakCounter.ts` — new (topbar badge + progress modal)
- `frontend/src/components/featureUnlockModal.ts` — new (celebration modal)
- `frontend/src/pages/roomFinder.ts` — integrate `recommendationCard` at the top (only when the feature flag is on); wire the existing `onConfirm` handler to actually call `apiClient.postBooking(...)` (currently a pure client-side navigation with no backend call — see Context above)
- `frontend/src/main.ts` — mount `streakCounter` badge in the topbar (only when feature flag on), wire `featureUnlockModal` to fire when `getUnlocks` reports a newly-crossed threshold

**Illustrative 3c (admin app, not real measurement):**
- `frontend/admin/src/pages/growth.ts` — new, static/generated sample metrics
  (CTR, time-to-decision delta, DAU delta, p-value) with a visible banner:
  "Illustrative — this demo has no real user traffic to measure."
- `frontend/admin/index.html` — add "Growth" nav link
- `frontend/admin/src/main.ts` — register the `#growth` route

**3d (ML upgrade):** documentation only — a short "Future ML Path" section
appended to this spec (see below), no code.

## Future ML Path (3d — not implemented)

When real production traffic exists (8+ weeks), the rule-based scorer above
would be replaced by a collaborative-filtering model trained on real booking
history, with weekly retraining. Occupancy prediction would move from the
time-of-day heuristic to a per-room, per-day-of-week model. This requires
real user data this demo project does not have; documented here as the
intended evolution path, not built.

## Testing plan

- Unit tests (vitest): recommendation scoring (repeat/popularity/distance
  weighting, tie-breaking, free-rooms-only filter), occupancy prediction
  bucket-matching + fallback, streak derivation (consecutive days, weekend
  gap tolerance, empty history), unlock threshold computation — all as pure
  functions, following the `roomStatus.ts`/`readingDeltas.ts` pattern of
  testable logic separate from the HTTP handler.
- Frontend component tests for `recommendationCard`, `streakCounter`,
  `featureUnlockModal`, `occupancyPrediction` — following existing component
  test conventions (`confirmationModal.test.ts`).
- e2e (Playwright): booking flow now calls the real booking endpoint in mock
  mode and the streak badge updates; recommendation card renders on Find a
  Room when the feature flag is on.
- Manual/browser verification: both apps, both breakpoints, no console errors.
