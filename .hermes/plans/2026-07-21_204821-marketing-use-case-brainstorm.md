# RoomSense — Marketing Use-Case Brainstorm & Appeal Roadmap

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task, but treat Part 1 as a decision document first — pick flagship ideas with the user before dispatching build tasks.

**Goal:** Generate appealing, engaging, fundable use cases for RoomSense's occupancy/reservation data aimed at professors, staff, and students — to win over an audience that decides whether this project gets further budget. Appeal and story beat stability/performance for this pass; nothing here needs to be production-hardened.

**Architecture:** All ideas build on the existing SPA (Vite + TS, hash-routed) and the frozen API surface (`health`, `rooms`, `occupancy`, `readings`, `reservations`, `kpis`, `simulate`, `sources`) — no new backend contracts required for the flagship set. Where an idea needs data the API doesn't expose yet, that's flagged explicitly as a Lane-A (Hermes/API) ask, not something Claude can do unilaterally in `frontend/**`.

**Tech Stack:** Same as the rest of the app — Vite + TypeScript, `dataviz` skill for any new chart, existing `frontend/src/lib/*` helpers (`charts.ts`, `mockDerivations.ts`, `roomFreshness.ts`) as the base to extend.

---

## Current context / assumptions

- Existing pages: `#dashboard` (C-level KPIs — utilization, ghost rate, wasted €, heatmap), `#live` (technical live telemetry, per-room drill-in with battery/RSSI sparklines, presenter-mode tick), `#architecture` (real-vs-demo path credibility slide).
- Existing data model already supports, without new API work: per-room occupancy time series, capacity, building/floor, reservations (subject/organizer/attendeeCount), ghost-meeting derivation, battery/RSSI telemetry, a live "tick" simulator for demo motion.
- Audience for *this* deliverable is explicitly **professors, staff, and students** — different from the existing C-level/technical split. None of the current three pages target students at all, and staff/professor framing today is all cost-savings, no delight. That's the gap this brainstorm fills.
- Purpose is **fundraising/visibility**, not operations: prioritize demo-day wow factor, shareability, and "I want this on my campus" reactions over data correctness or edge-case handling.
- Ghost-meeting and utilization data is currently anonymous at the room level — several ideas below (leaderboards, "hall of shame") need a privacy framing decision before they go further than a screenshot. Flagged inline.

---

## Part 1 — Use case ideas, grouped by audience

### For students (make the data *useful to their day*)

1. **"Find me a room right now"** — a big, mobile-first free/busy map of campus. Green dot = empty room within capacity range, tap for directions. This is the single highest-appeal, lowest-effort idea: it's the existing `#live` occupancy grid re-skinned for a phone screen with a "near me" sort instead of a technical drill-in.
2. **Best-time-to-book heatmap per room** — "Tuesdays 10-12 this room is almost always free" derived from the 30-day historical series already in `OccupancySnapshots`. Turns raw history into a planning tool instead of a live-only view.
3. **"RoomSense Wrapped"** — a Spotify-Wrapped-style shareable end-of-semester card: busiest room you used, quietest hideout you found, total hours the building saved you from wandering. Pure marketing candy — built for screenshots and social sharing, which is exactly the kind of engagement that gets forwarded to a dean.
4. **Exam-week quiet-room finder** — a seasonal skin of idea #1 that filters for low-occupancy, low-noise-proxy rooms during exam periods. Ties a fun feature to a real, emotionally loaded student moment (exam stress) — strong story for a pitch deck.
5. **Natural-language room assistant** — "where can I study alone for 2 hours after 3pm?" answered by an LLM given the room list + occupancy series as context. High wow-factor for a demo, and cheap to fake with the existing mock data (no new backend needed for a demo build).

### For professors (make the data *interesting to think with*)

6. **Living-lab / open dataset pitch** — frame the anonymized occupancy + reservation data as a standing dataset for capstone projects, theses, and papers (space utilization, urban informatics, IoT reliability). This is a positioning move, not a feature: a `#research` page describing the dataset schema, update cadence, and how to request access — the kind of page that gets forwarded to a department head deciding on funding.
7. **"Adopt a building" course project seed** — a page proposing this as a recurring course assignment (e.g. a data science or IoT elective builds a new adapter or dashboard each semester). Turns the codebase's existing adapter-seam design (`sources` table, `SourceAdapter` pattern from #23) into a teaching artifact, and gives professors a reason to want the project funded long-term (it's now their curriculum, not just IT's showcase).
8. **Digital twin / 3D live campus visualization** — an ambient, large-screen-friendly 3D or stylized 2D campus map with live pulsing occupancy, for lobby displays and open days. Same underlying `/rooms` + `/simulate/tick` data, new presentation layer. High visual impact for donor/board demos specifically.

### For staff / facilities / leadership (make the data *make the case for money*)

9. **Sustainability impact ticker** — "Ghost meetings this month cost an estimated X kWh / Y kg CO₂ of HVAC and lighting run for empty rooms" — a live-updating counter next to the existing wasted-€ KPI. Reframes the same `wastedEur` calculation the dashboard already has as an ESG/sustainability story, which is often a *stronger* funding lever than pure cost at a university.
10. **Auto-generated "Semester in Review" report** — a shareable PDF/one-pager (utilization trend, € and CO₂ saved, top-5 underused rooms) auto-built from `/kpis`, meant to be forwarded to whoever holds the budget. This is the single most direct "secure funding" artifact on this list — it's a pitch deck the data builds for you every semester.
11. **Ghost-meeting leaderboard, department-level only** — a light, slightly cheeky "most-cancelled-but-still-booked" board, aggregated at department/building level (never named individuals or specific meetings) to keep it in bounds — turns waste into a story people want to fix, and departments compete to get off the board. **Needs an explicit privacy/framing decision before building past a mockup** — check with the user before naming any real department.
12. **Trust/transparency FAQ page** — "what RoomSense does and doesn't track" (counts only, no cameras, no identity) — directly defuses the most likely objection from a staff/student audience and makes every other pitch land better. Cheap to build, disproportionately valuable for credibility.

---

## Part 2 — Flagship picks (recommended build order if greenlit)

These four give one strong idea per audience segment plus the trust page every other idea depends on, all buildable in `frontend/**` alone against the existing mock-mode API — no Lane-A/Hermes work needed to demo them:

1. **#1 "Find me a room right now"** (students) — highest reach, lowest effort, reuses `#live` data.
2. **#10 "Semester in Review" auto-report** (staff/leadership) — the most direct funding artifact.
3. **#3 "RoomSense Wrapped"** (students, shareability) — the one most likely to generate organic buzz outside the target room.
4. **#12 Trust/transparency FAQ** (all audiences) — small, but de-risks every other pitch.

Everything else (dataset positioning, leaderboard, 3D twin, exam-week skin, NL assistant) is a strong second wave once the flagship set proves the format lands — listed in Part 1 so nothing is lost, not because it's weaker, but because four is a demo-able amount and fifteen isn't.

---

## Step-by-step plan (for the flagship set, once confirmed)

### Task A: `#live` room-finder view for students
**Objective:** Add a student-facing "free rooms near me" mode to the existing live page.
**Files:**
- Modify: `frontend/src/pages/live.ts` (add a view toggle or new sub-route)
- Reuse: `frontend/src/lib/mockDerivations.ts`, `frontend/src/lib/roomFreshness.ts`
- Test: `frontend/src/pages/live.test.ts` (or new `frontend/src/pages/roomFinder.test.ts`)
**Approach:** Filter `/rooms` response to occupancy < capacity threshold, sort by whatever proxy stands in for "near me" (building/floor grouping is enough for a demo — no real geolocation needed for appeal purposes), render as large tap-friendly cards.
**Verify:** `pnpm --filter frontend test`, then manual check in mock mode (`VITE_MOCK=1`) on a narrow viewport.

### Task B: `#kpis`-driven "Semester in Review" report
**Objective:** Render a printable/exportable one-pager from the existing `/api/kpis` response.
**Files:**
- Create: `frontend/src/pages/report.ts`
- Reuse: `frontend/src/lib/format.ts`, `frontend/src/lib/charts.ts`
- Test: `frontend/src/pages/report.test.ts`
**Approach:** Single print-friendly layout (`@media print` CSS), pull `avgUtilizationPct`, `wastedEur`, `ghostRatePct`, `underusedRooms` straight from the existing KPI shape — no new API fields required for v1. A CO₂ estimate (idea #9) can be a simple derived multiplier on `wastedEur` computed client-side, clearly labeled as illustrative.
**Verify:** Manual — open the page, trigger browser print-preview, confirm it reads like a one-pager, not a dashboard screenshot.

### Task C: "RoomSense Wrapped" shareable card
**Objective:** A single generated image/card summarizing a fun stat set from the mock data.
**Files:**
- Create: `frontend/src/pages/wrapped.ts`
- Reuse: existing `charts.ts` sparkline helpers for visual flair
**Approach:** Pick 3-4 "fun" derived stats (busiest room, quietest room a user could've used, total ghost-hours campus-wide) and lay them out as a vertical card sized for a phone screenshot. This is intentionally the least rigorous page in the app — playful copy over precision.
**Verify:** Visual check only — does it look like something worth screenshotting?

### Task D: Trust/transparency FAQ page
**Objective:** Plain-language page explaining what is and isn't tracked.
**Files:**
- Create: `frontend/src/pages/trust.ts` (static content, no API calls)
**Approach:** Short FAQ: "Do you track individuals? No — counts only, no cameras, no badge/wifi correlation. What happens to the data? ... Who can see what? ..." Mirrors the `#architecture` page's credibility function but for a non-technical audience.
**Verify:** Read-through for tone; no functional testing needed (static content).

---

## Tests / validation

- Existing Playwright e2e smoke spec (`#18`) should get one new happy-path check per flagship page added (mock mode only — matches current e2e scope).
- No backend changes in the flagship set, so no `api/**` test surface changes and no Lane-A coordination needed.
- Manual browser check for each new page per this repo's `verify` skill/standing convention (screenshot the real thing, don't just trust typecheck).

## Risks, tradeoffs, open questions

- **Idea #11 (department leaderboard) needs an explicit go/no-go from the user before any building beyond a mockup** — naming real departments in a "waste" framing can land badly even when well-intentioned; keep it in the backlog list, not the flagship set, until that's decided.
- This whole brainstorm optimizes for appeal over accuracy — the CO₂/sustainability numbers (idea #9, Task B) are illustrative multipliers on mock data, not audited figures. Label them as such in the UI so "not stability-focused" doesn't quietly become "misleading."
- None of the flagship set requires new API endpoints, so it's entirely a Claude/`frontend/**` lane task per `CLAUDE.md` — no coordination commit needed to start.
- Open question for the user: which flagship idea (if any) should be built first, or should this stay a pitch document for now (e.g., to accompany a funding ask) before any code is written?
