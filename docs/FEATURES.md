# RoomSense Flagship Features — Development Tracker

**Status:** In progress (2026-07-21)
**Goal:** Four user-facing features targeting students, staff, and professors for fundraising/appeal.

## Feature 1: "Find Me a Room" — Room Finder for Students

**Status:** 🚧 In progress
**Owner:** Claude (frontend/@C)
**Epic:** Flagship — highest reach, student-facing
**Depends on:** Existing `/rooms` + `/occupancy` API (no backend changes needed)

### What it does
A mobile-first, free-rooms-near-me map. Filter rooms by occupancy (show empty or low-use only), sort by building/floor, tap for details. Reuses live occupancy data with a student-focused UX instead of technical drill-in.

### Files to create/modify
- Create: `frontend/src/pages/roomFinder.ts` (main page logic)
- Modify: `frontend/src/main.ts` (add route `#finder`)
- Create: `frontend/src/pages/roomFinder.test.ts` (happy path + edge cases)
- Modify: `.hermes/plans/` (this implementation plan as `2026-07-21_*-room-finder.md`)

### Key details
- Filter threshold: occupancy < capacity (show "available")
- Sort options: by building, by floor, by capacity
- Mobile-first layout: large tap targets, vertical cards
- Reuse: existing `frontend/src/lib/mockDerivations.ts` for occupancy calculations

### Success criteria
- [ ] Page renders with tap-friendly UI
- [ ] Filters work (empty rooms highlight first)
- [ ] E2E test added to Playwright smoke spec
- [ ] Manual verification on mobile viewport

---

## Feature 2: "Semester in Review" — Auto-Generated Report for Leadership

**Status:** 🚧 In progress
**Owner:** Claude (frontend/@C)
**Epic:** Flagship — most direct funding artifact
**Depends on:** Existing `/kpis` API

### What it does
A one-page printable/shareable report auto-generated from `/api/kpis`. Shows utilization trend, ghost-meeting cost, top-5 underused rooms, and CO₂ impact (illustrative). Meant to be forwarded to budget-holders.

### Files to create/modify
- Create: `frontend/src/pages/report.ts` (main report page)
- Modify: `frontend/src/main.ts` (add route `#report`)
- Create: `frontend/src/pages/report.test.ts`
- Modify: `frontend/src/lib/format.ts` (add CO₂ multiplier helper, if needed)

### Key details
- Print-friendly CSS (`@media print`)
- Pull `avgUtilizationPct`, `peakUtilizationPct`, `ghostRatePct`, `wastedEur` from existing KPI shape
- CO₂ estimate: simple multiplier (illustrative, clearly labeled)
- Single-page layout, no scrolling needed
- Include semester date range in header

### Success criteria
- [ ] Page renders as single-page printout
- [ ] Browser print-preview looks like a standalone document
- [ ] KPI values flow correctly from API
- [ ] CO₂ calculation labeled as "illustrative estimate"

---

## Feature 3: "RoomSense Wrapped" — Shareable Stats Card

**Status:** 🚧 In progress
**Owner:** Claude (frontend/@C)
**Epic:** Flagship — shareability/organic buzz
**Depends on:** Existing `/rooms`, `/occupancy` (mock data derivation)

### What it does
Spotify-Wrapped-style annual card. "Your busiest room," "quietest hideout," "campus ghost-meeting hours," etc. Vertical card sized for phone screenshots. Pure marketing candy — intentionally playful, not rigorous.

### Files to create/modify
- Create: `frontend/src/pages/wrapped.ts` (main wrapped page)
- Modify: `frontend/src/main.ts` (add route `#wrapped`)
- Create: `frontend/src/pages/wrapped.test.ts` (visual spot-check only)

### Key details
- 3-4 "fun" stats derived from mock occupancy history
- Mobile card layout (vertical, phone-friendly dimensions)
- Playful copy + bold colors (use existing design tokens if available)
- Screenshot-optimized (no interactive elements needed)

### Success criteria
- [ ] Card renders at phone dimensions
- [ ] Stats compute and display without errors
- [ ] Visual check: looks like something worth screenshotting
- [ ] No interactive elements (static card only)

---

## Feature 4: "Trust & Transparency" — FAQ Page

**Status:** 🚧 In progress
**Owner:** Claude (frontend/@C)
**Epic:** Flagship — de-risks every other pitch
**Depends on:** No API calls (static content)

### What it does
Plain-language FAQ addressing privacy concerns: "Do you track individuals? What data is collected? Who can see what? How long is data kept?" Defuses the objection that kills other pitches.

### Files to create/modify
- Create: `frontend/src/pages/trust.ts` (static FAQ page)
- Modify: `frontend/src/main.ts` (add route `#trust`)
- No tests needed (static content)

### Key details
- 5-7 Q&A pairs
- Tone: clear, non-technical, reassuring
- Emphasize: counts only, no cameras, no identity tracking, opt-out available
- Link to `#architecture` page for technical audience

### Success criteria
- [ ] Page renders
- [ ] Read-through for tone (sounds trustworthy, not defensive)
- [ ] No missing critical Q&A

---

## Progress log

| Date | Feature | Task | Status | Notes |
|------|---------|------|--------|-------|
| 2026-07-21 | All 4 | Brainstorm + flagship roadmap | ✅ Done | Saved to `.hermes/plans/` |
| 2026-07-21 | All 4 | Dispatch parallel agents | ✅ Done | 4 Haiku agents dispatched 20:58 UTC |
| 2026-07-21 | Room Finder | Implementation | ✅ Done | 2/2 tests pass; route `#finder` wired |
| 2026-07-21 | Semester Report | Implementation | ✅ Done | 3/3 tests pass; route `#report` + print CSS |
| 2026-07-21 | RoomSense Wrapped | Implementation | ✅ Done | 1/1 test pass; route `#wrapped` shareable card |
| 2026-07-21 | Trust FAQ | Implementation | ✅ Done | 1/1 test pass; route `#trust` 7 Q&A pairs |

---

## Blockers / decisions

- **None currently** — all four are buildable from existing API surface in mock mode.
- Leaderboard feature (#11 in brainstorm) deferred until privacy framing is finalized.
