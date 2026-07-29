# RoomSense Demo: Budget-Holder Pitch — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Transform RoomSense into a focused ~10-minute demo for a TU/e budget holder, built around two money stories: wasted hours (ghost meetings) and over-provisioned seats (capacity mismatch), with a live-data closer.

**Architecture:** Extend the existing `/kpis` API endpoint with four new fields, modify two frontend pages (dashboard + report), update one stale doc page (architecture), and document the pre-demo re-seed procedure. No new pages, no new routes, no new API endpoints.

**Tech Stack:** Azure Functions v4 (Node 22, TypeScript), Vite + TypeScript SPA, Azure Table Storage, vitest, pnpm monorepo.

---

## Current context / assumptions

- The TU/e rebrand branch (`feat/40-tue-rebrand`) is merged to main and deployed.
- Production API: `roomsense-api2.azurewebsites.net` (Consumption plan, CORS works).
- Production frontend: SWA `lemon-mud-06bc7fd03.7.azurestaticapps.net`.
- Seed data ends 2026-07-19 — must re-seed before demo (Task 0).
- CLAUDE.md rules: wishlist-first, three-place page changes, no `git add -A`, ASCII-only headers.
- Lane ownership: `api/**` = Hermes, `frontend/**` = Claude (but this is a solo build).
- Deploy: `func azure functionapp publish roomsense-api2 --node` for API; SWA GitHub Action for frontend.

---

## Decisions from grill-me session

| Decision | Rationale |
|----------|-----------|
| Lead with hours, not euros | Hours are undeniable sensor math; €/desk-hour is a config default |
| No ghost leaderboard (names) | Surveillance feel undercuts trust story |
| Drill-down = one ghost meeting evidence | Live page already has this (red bands) |
| Replace € tile with hours tile + indicative € subtitle | Keep four tiles, keep € visible but secondary |
| Capacity metric = avg occupancy during booked hours | Not raw 24h average (misleading for part-time rooms) |
| Report page restructured into two acts | Leave-behind must be self-sufficient for a CFO |
| Cut CO2 section | Fake number × fake multiplier = credibility liability |
| Cut weather widget | Noise on the dashboard, irrelevant to budget story |
| Accept SIMULATOR_KEY exposure | Demo project, all-anonymous API, re-seed is the reset |
| Update architecture page CORS limitation | Stale: Consumption plan preflight works now |
| Click-to-drill on underused rooms table | Same sessionStorage pattern as room finder |

---

## Task 0: Re-seed production before demo (pre-demo runbook)

**Objective:** Document the pre-demo re-seed step so data is fresh.

**Files:**
- Create: `docs/demo-runbook.md`

**Step 1: Create the runbook**

```markdown
# RoomSense Demo Runbook

## Pre-demo (T-15 min)

### 1. Re-seed production data
```bash
cd /home/toine/AI-Projects/projects/playground/roomsense
TABLES_CONNECTION_STRING=$(az storage account show-connection-string -g rgRoomSense -n roomsensestorage -o tsv) \
  pnpm seed:azure
```

This regenerates 30 days of realistic data ending today, ~43k readings, ~1.3k reservations.

### 2. Verify data freshness
```bash
curl -s "https://roomsense-api2.azurewebsites.net/api/rooms" | jq '.[0].lastSeenTs'
# Should be today's date
```

### 3. Verify presenter mode tick works
```bash
curl -s -X POST "https://roomsense-api2.azurewebsites.net/api/simulate/tick" \
  -H "x-sim-key: 12345679"
# Should return {"appended":30,"ts":"<today+15min>"}
```

### 4. Smoke test frontend
Open `https://lemon-mud-06bc7fd03.7.azurestaticapps.net/#dashboard` — dashboard tiles should show non-zero utilization.
```

**Step 2: Commit**

```bash
git add docs/demo-runbook.md
git commit -m "docs(#47): add pre-demo re-seed runbook"
```

---

## Task 1: Add `wastedHours` to /kpis API response

**Objective:** Expose the ghost-hours figure the server already computes internally.

**Files:**
- Modify: `api/src/functions/kpis.ts` (lines 243-253, the jsonBody return)
- Test: `api/src/functions/kpis.test.ts` (add assertion)

**Step 1: Write failing test**

In `api/src/functions/kpis.test.ts`, add to the existing test that asserts `wastedEur`:

```typescript
it('e) wastedHours = ghostHours = 0.25 (the clipped ghost reservation duration)', async () => {
  const body = await callKpis()
  expect(body.wastedHours).toBe(0.25)
})
```

**Step 2: Run test to verify failure**

Run: `pnpm --filter @roomsense/api test -- --run kpis`
Expected: FAIL — `body.wastedHours` is undefined

**Step 3: Write minimal implementation**

In `api/src/functions/kpis.ts`, the variable `ghostHours` is already computed (line 177, 194). Round it and add to the response:

Line 202, after `const wastedEur = round2(wastedRaw)`:
```typescript
const wastedHours = round2(ghostHours)
```

Line 246-253, add `wastedHours` to the jsonBody:
```typescript
jsonBody: {
  avgUtilizationPct,
  peakUtilizationPct,
  ghostRatePct,
  wastedHours,
  wastedEur,
  busiestBuilding,
  underusedRooms,
},
```

Also update the JSDoc at the top (lines 8-16) to document `wastedHours`.

**Step 4: Run test to verify pass**

Run: `pnpm --filter @roomsense/api test -- --run kpis`
Expected: PASS

**Step 5: Commit**

```bash
git add api/src/functions/kpis.ts api/src/functions/kpis.test.ts
git commit -m "feat(#48): expose wastedHours in /kpis response"
```

---

## Task 2: Add capacity metrics to /kpis API response

**Objective:** Add `totalCapacity`, `peakConcurrentOccupancy`, and `roomBreakdown` to the KPI response for the capacity right-sizing story.

**Files:**
- Modify: `api/src/functions/kpis.ts` (computation section + response)
- Test: `api/src/functions/kpis.test.ts` (add assertions)

**Step 1: Write failing tests**

In `api/src/functions/kpis.test.ts`:

```typescript
it('f) totalCapacity = 8 + 12 + 2 = 22', async () => {
  const body = await callKpis()
  expect(body.totalCapacity).toBe(22)
})

it('g) peakConcurrentOccupancy = max concurrent across rooms at any timestamp', async () => {
  // Snapshots at 10:00: atlas-2-210 occ=4, atlas-2-215 occ=0, flux-2-207 occ=2 → sum=6
  // Snapshots at 10:15: atlas-2-210 occ=8 → atlas-2-215 has no snapshot → flux not at 10:15 → sum=8
  // Snapshots at 10:30: atlas-2-210 occ=6, atlas-2-215 occ=6 → flux not at 10:30 → sum=12
  const body = await callKpis()
  expect(body.peakConcurrentOccupancy).toBe(12)
})

it('h) roomBreakdown has all 3 rooms with capacity and avgBookedOccupancy', async () => {
  const body = await callKpis()
  expect(body.roomBreakdown).toHaveLength(3)
  const zaal = body.roomBreakdown.find((r: any) => r.roomId === 'atlas-2-215')
  expect(zaal.capacity).toBe(12)
  // atlas-2-215 reservations: 10:00→10:15 (ghost, occ=0), 10:30→11:00 (occ=6)
  // Booked-hour avg = (0 + 6) / 2 slots = but we need occupancy during booked hours
  // Snapshots during booked slots: 10:00→10:15 max occ=0, 10:30→11:00 max occ=6
  // avgBookedOccupancy = (0 + 6) / 2 = 3.0
  expect(zaal.avgBookedOccupancy).toBe(3)
})
```

**Step 2: Run test to verify failure**

Run: `pnpm --filter @roomsense/api test -- --run kpis`
Expected: FAIL — fields don't exist

**Step 3: Write minimal implementation**

In `api/src/functions/kpis.ts`, after the `underusedRooms` computation (line 241), add:

```typescript
// totalCapacity = sum of all room capacities.
const totalCapacity = [...rooms.values()].reduce((sum, r) => sum + r.capacity, 0)

// peakConcurrentOccupancy = max(sum of occupancy across all rooms at the same timestamp).
// Group snapshots by timestamp, sum occupancy per timestamp, take max.
const occByTimestamp = new Map<number, number>()
for (const s of snapshots) {
  occByTimestamp.set(s.tsMs, (occByTimestamp.get(s.tsMs) ?? 0) + s.occupancy)
}
let peakConcurrentOccupancy = 0
for (const total of occByTimestamp.values()) {
  if (total > peakConcurrentOccupancy) peakConcurrentOccupancy = total
}

// roomBreakdown = all rooms with capacity and avg occupancy during booked hours.
// For each room: find all reservations, for each reservation find the max occupancy
// during its slot, average those maxima weighted by reservation hours.
const roomBreakdown = [] as Array<{
  roomId: string
  name: string
  building: string
  capacity: number
  avgBookedOccupancy: number
}>
for (const [roomId, room] of rooms) {
  const roomReservations = reservations.filter((r) => r.roomId === roomId)
  const roomSnaps = snapsByRoom.get(roomId) ?? []
  let weightedOccSum = 0
  let totalBookedHours = 0
  for (const r of roomReservations) {
    const clipStart = Math.max(r.startMs, fromMs)
    const clipEnd = Math.min(r.endMs, toMs)
    const hours = (clipEnd - clipStart) / (60 * 60 * 1000)
    if (hours <= 0) continue
    let maxOcc = 0
    for (const s of roomSnaps) {
      if (s.tsMs >= r.startMs && s.tsMs < r.endMs && s.occupancy > maxOcc) {
        maxOcc = s.occupancy
      }
    }
    weightedOccSum += maxOcc * hours
    totalBookedHours += hours
  }
  const avgBookedOccupancy = totalBookedHours > 0 ? round2(weightedOccSum / totalBookedHours) : 0
  roomBreakdown.push({
    roomId,
    name: room.name,
    building: room.building,
    capacity: room.capacity,
    avgBookedOccupancy,
  })
}
// Sort by capacity descending (biggest rooms first — the right-sizing targets)
roomBreakdown.sort((a, b) => b.capacity - a.capacity)
```

Then add to the jsonBody response:
```typescript
jsonBody: {
  avgUtilizationPct,
  peakUtilizationPct,
  ghostRatePct,
  wastedHours,
  wastedEur,
  busiestBuilding,
  underusedRooms,
  totalCapacity,
  peakConcurrentOccupancy,
  roomBreakdown,
},
```

**Step 4: Run test to verify pass**

Run: `pnpm --filter @roomsense/api test -- --run kpis`
Expected: PASS

**Step 5: Commit**

```bash
git add api/src/functions/kpis.ts api/src/functions/kpis.test.ts
git commit -m "feat(#49): add capacity metrics (totalCapacity, peakConcurrent, roomBreakdown) to /kpis"
```

---

## Task 3: Update frontend KPI types

**Objective:** Sync the frontend type definitions with the new API fields.

**Files:**
- Modify: `frontend/src/lib/apiTypes.ts` (lines 28-35)

**Step 1: Update KpisResponse interface**

```typescript
export interface RoomBreakdownEntry {
  roomId: string
  name: string
  building: string
  capacity: number
  avgBookedOccupancy: number
}

export interface KpisResponse {
  avgUtilizationPct: number
  peakUtilizationPct: number
  ghostRatePct: number
  wastedHours: number
  wastedEur: number
  busiestBuilding: string
  underusedRooms: UnderusedRoom[]
  totalCapacity: number
  peakConcurrentOccupancy: number
  roomBreakdown: RoomBreakdownEntry[]
}
```

**Step 2: Update mockDerivations if needed**

Check `frontend/src/lib/mockDerivations.ts` — the `deriveKpis` function must also return the new fields so mock mode doesn't break. Add the same computation pattern (simplified — mock can derive from its in-memory data).

**Step 3: Verify build**

Run: `pnpm --filter @roomsense/frontend build`
Expected: PASS (no type errors)

**Step 4: Commit**

```bash
git add frontend/src/lib/apiTypes.ts frontend/src/lib/mockDerivations.ts
git commit -m "feat(#50): sync frontend KPI types with new API fields"
```

---

## Task 4: Dashboard — replace wasted-EUR tile with wasted-hours tile

**Objective:** Swap the "Wasted floor cost" tile for "Wasted hours" with indicative € subtitle. Cut the weather widget.

**Files:**
- Modify: `frontend/src/pages/dashboard.ts` (lines 149-153 tile, lines 108-112 skeleton, lines 499-587 weather, line 605 mount)

**Step 1: Replace the KPI tile (lines 149-153)**

Replace the `kpiTile('Wasted floor cost', ...)` call with:

```typescript
kpiTile(
  'Wasted hours',
  `${Math.round(kpis.wastedHours ?? 0)}<span class="kpi-unit">h</span>`,
  `≈ ${formatEur(kpis.wastedEur ?? 0)} indicative (€4/desk/hour)`,
),
```

**Step 2: Remove weather from the skeleton (line 109)**

Remove this line:
```typescript
<section class="chart-card" id="weather-card"></section>
```

**Step 3: Remove weather function and imports (lines 499-587, and the import on line 499)**

Delete:
- `import { buildWeatherState } from '../lib/weather'`
- `import type { FakeWeatherReading } from '../lib/weatherMock'`
- All weather-related functions: `WEATHER_ICON`, `weatherIcon`, `weatherLabel`, `weatherClass`, `WIND_DIRECTIONS`, `windLabel`, `formatUpdatedAt`, `renderWeather`

**Step 4: Remove weather call from mount (line 605)**

Delete:
```typescript
renderWeather(container)
```

**Step 5: Verify build and visual check**

Run: `pnpm --filter @roomsense/frontend build`
Expected: PASS

**Step 6: Commit**

```bash
git add frontend/src/pages/dashboard.ts
git commit -m "feat(#51): swap wasted-EUR tile for wasted-hours, cut weather widget"
```

---

## Task 5: Dashboard — add click-to-drill on underused rooms table

**Objective:** Make the underused rooms table rows clickable, navigating to `#live` with the room pre-selected via sessionStorage (same pattern as roomFinder).

**Files:**
- Modify: `frontend/src/pages/dashboard.ts` (function `renderGhostTable`, lines 450-493)

**Step 1: Make table rows clickable**

In `renderGhostTable`, after creating each `<tr>`, add click handler. Wrap the room name in a `<button>` for semantic HTML:

```typescript
for (const room of kpis.underusedRooms) {
  const tr = document.createElement('tr')
  tr.style.cursor = 'pointer'
  tr.addEventListener('click', () => {
    sessionStorage.setItem('roomsense.selectedRoomId', room.roomId)
    window.location.hash = '#live'
  })

  const tdName = document.createElement('td')
  tdName.textContent = room.name
  // ... rest of existing row code
  tr.append(tdName, tdPct)
  tbody.appendChild(tr)
}
```

**Step 2: Verify build**

Run: `pnpm --filter @roomsense/frontend build`
Expected: PASS

**Step 3: Verify click works in dev mode**

Run: `pnpm --filter @roomsense/frontend dev`
Open dashboard, click an underused room → should navigate to `#live` with drill panel open for that room.

**Step 4: Commit**

```bash
git add frontend/src/pages/dashboard.ts
git commit -m "feat(#52): click-to-drill on underused rooms table → live page"
```

---

## Task 6: Restructure report page — two-act capacity story

**Objective:** Transform the report page from a KPI-mirror into a self-sufficient two-act leave-behind: "Hours Wasted" (ghost evidence) then "Seats Over-Provisioned" (capacity table).

**Files:**
- Modify: `frontend/src/pages/report.ts` (full rewrite of `renderReport` function)

**Step 1: Rewrite renderReport**

Replace the entire `renderReport` function (lines 28-83) with:

```typescript
function renderReport(container: HTMLElement, kpis: KpisResponse): void {
  const content = container.querySelector('#report-content')!
  content.setAttribute('aria-busy', 'false')

  const reportDate = new Date().toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  // Two-act structure
  content.innerHTML = `
    <div class="report-header">
      <h1>RoomSense Occupancy Analysis</h1>
      <p class="date-range">Last 30 days · Generated ${reportDate}</p>
      <p class="report-source">TU/e campus — Atlas, Flux, Neuron | Data source: Terabee people-counting sensors (simulated; production path via IoT Hub → Databricks)</p>
    </div>

    <section class="report-act">
      <h2>Act 1: Hours Wasted</h2>
      <div class="report-metrics">
        <div class="metric">
          <div class="metric-label">Wasted Hours</div>
          <div class="metric-value">${Math.round(kpis.wastedHours ?? 0)}h</div>
          <div class="metric-note">Booked-but-empty meeting time</div>
        </div>
        <div class="metric">
          <div class="metric-label">Ghost Rate</div>
          <div class="metric-value">${(kpis.ghostRatePct ?? 0).toFixed(1)}%</div>
          <div class="metric-note">Of all booked hours</div>
        </div>
        <div class="metric">
          <div class="metric-label">Indicative Cost</div>
          <div class="metric-value">€${(kpis.wastedEur ?? 0).toFixed(0)}</div>
          <div class="metric-note">Estimated at €4/desk/hour</div>
        </div>
      </div>
    </section>

    <section class="report-act">
      <h2>Act 2: Seats Over-Provisioned</h2>
      <div class="report-portfolio">
        <p class="portfolio-headline">
          <strong>${kpis.totalCapacity ?? 0}</strong> total seats across campus.
          Peak concurrent usage: <strong>${kpis.peakConcurrentOccupancy ?? 0}</strong> people.
          That's ${kpis.totalCapacity > 0 ? Math.round((kpis.peakConcurrentOccupancy / kpis.totalCapacity) * 100) : 0}% of capacity at peak.
        </p>
      </div>
      <table class="report-capacity-table">
        <thead>
          <tr>
            <th>Room</th>
            <th>Building</th>
            <th class="num">Capacity</th>
            <th class="num">Avg During Booked Hours</th>
            <th class="num">Efficiency</th>
          </tr>
        </thead>
        <tbody>
          ${(kpis.roomBreakdown ?? []).map((room) => {
            const efficiency = room.capacity > 0
              ? Math.round((room.avgBookedOccupancy / room.capacity) * 100)
              : 0
            return `
              <tr>
                <td>${room.name}</td>
                <td>${room.building.charAt(0).toUpperCase() + room.building.slice(1)}</td>
                <td class="num">${room.capacity}</td>
                <td class="num">${room.avgBookedOccupancy.toFixed(1)}</td>
                <td class="num">${efficiency}%</td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </section>

    <section class="report-recommendations">
      <h2>Recommended Actions</h2>
      <ol>
        <li>Audit repeat ghost bookings — ${Math.round(kpis.wastedHours ?? 0)} hours/month of booked-but-empty time is recoverable through booking discipline.</li>
        <li>Assess whether large rooms (80+ seats) are right-sized for typical demand. Average occupancy during booked hours indicates actual need.</li>
        <li>Consider reallocating underused large spaces into smaller focus pods where peak demand suggests higher small-room utilization.</li>
      </ol>
    </section>

    <footer class="report-footer">
      <p>Generated by RoomSense for TU/e campus operations review.</p>
    </footer>
  `
}
```

**Step 2: Add print CSS for the capacity table**

In `frontend/src/styles/main.css`, add:

```css
.report-capacity-table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.9rem; }
.report-capacity-table th { text-align: left; padding: 0.5rem; border-bottom: 2px solid var(--border-strong); }
.report-capacity-table td { padding: 0.5rem; border-bottom: 1px solid var(--gridline); }
.report-capacity-table .num { text-align: right; font-family: var(--font-mono); }
.report-act { margin-bottom: 2rem; page-break-inside: avoid; }
.report-act h2 { border-bottom: 2px solid var(--brand); padding-bottom: 0.5rem; margin-bottom: 1rem; }
.report-portfolio { margin-bottom: 1rem; }
.portfolio-headline { font-size: 1.1rem; line-height: 1.6; }
.report-recommendations ol { padding-left: 1.5rem; line-height: 1.8; }
.report-source { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem; }
@media print {
  .report-capacity-table { font-size: 10pt; }
  .report-act { page-break-inside: avoid; }
}
```

**Step 3: Remove CO2 references from report.ts**

The old code had:
```typescript
const co2Estimate = (kpis.wastedEur ?? 0) * 0.5
```
And the CO2 section in the HTML template. Both are gone in the rewritten `renderReport`.

**Step 4: Verify build**

Run: `pnpm --filter @roomsense/frontend build`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/pages/report.ts frontend/src/styles/main.css
git commit -m "feat(#53): restructure report into two-act capacity story with framing"
```

---

## Task 7: Update architecture page — remove stale CORS limitation

**Objective:** The documented CORS limitation on the architecture page is stale — Consumption plan preflight works now. Remove the outdated callout.

**Files:**
- Modify: `frontend/src/pages/architecture.ts` (lines 266-287)

**Step 1: Replace the limitation callout**

Replace the entire `<div class="arch-note limitation-callout">` block (lines 266-287) with:

```html
<div class="arch-note">
  <strong>Presenter mode:</strong> The live tick (<code>POST /api/simulate/tick</code>)
  works in the browser. The API runs on a Consumption (Y1) plan where platform CORS
  handles preflight correctly. The simulator key is intentionally exposed for demo
  use — this is an anonymous demo API with no production data.
</div>
```

**Step 2: Verify build**

Run: `pnpm --filter @roomsense/frontend build`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/pages/architecture.ts
git commit -m "fix(#54): remove stale CORS limitation from architecture page"
```

---

## Task 8: Deploy API + frontend and verify

**Objective:** Deploy both API and frontend, run smoke tests, verify the demo flow end-to-end.

**Step 1: Deploy API**

```bash
cd api
pnpm build
func azure functionapp publish roomsense-api2 --node
```

**Step 2: Deploy frontend**

Push to main triggers the GitHub Action. Or trigger manually:

```bash
gh workflow run deploy-frontend.yml -f target_env=production
```

**Step 3: Verify API endpoints**

```bash
# Check new KPI fields
curl -s "https://roomsense-api2.azurewebsites.net/api/kpis?from=2026-06-28T00:00:00Z&to=2026-07-28T23:59:59Z" | jq '{wastedHours, totalCapacity, peakConcurrentOccupancy, roomBreakdownCount: (.roomBreakdown | length)}'
```

Expected: non-null `wastedHours`, `totalCapacity` > 0, `peakConcurrentOccupancy` > 0, `roomBreakdownCount` = 15.

**Step 4: Verify frontend pages**

- `/#dashboard`: Four tiles (hours not euros, no weather). Underused rooms table rows are clickable.
- `/#report`: Two-act structure with capacity table, no CO2. Recommended actions at bottom.
- `/#architecture`: No stale CORS callout. Presenter mode note updated.
- `/#live`: Click room from dashboard → drill panel opens with ghost bands.

**Step 5: Run existing test suite**

```bash
pnpm --filter @roomsense/api test -- --run
pnpm --filter @roomsense/frontend test -- --run
```

Expected: All pass.

**Step 6: Commit any remaining changes**

```bash
git add -A
git commit -m "chore(#55): deploy verification for budget-holder demo"
git push origin main
```

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Mock mode breaks (missing new KPI fields) | Task 3 explicitly updates mockDerivations.ts |
| `avgBookedOccupancy` test math wrong | Hand-computed expected values in test fixtures |
| Report page CSS conflicts with TU/e rebrand styles | Use scoped class names (`.report-capacity-table` not generic `table`) |
| Re-seed overwrites live tick data | Re-seed is documented as pre-demo only; tick appends after |
| Frontend deploy fails (OIDC) | Already fixed in this session — two federated credentials created |

---

## Verification checklist

- [ ] `wastedHours` in /kpis response
- [ ] `totalCapacity` in /kpis response
- [ ] `peakConcurrentOccupancy` in /kpis response
- [ ] `roomBreakdown` array with all 15 rooms in /kpis response
- [ ] Dashboard: hours tile replaces EUR tile
- [ ] Dashboard: weather widget removed
- [ ] Dashboard: underused rooms clickable → live drill
- [ ] Report: two-act structure (hours + capacity)
- [ ] Report: capacity table with avg-booked-occupancy efficiency
- [ ] Report: framing metadata (date, source, recommendations)
- [ ] Report: CO2 section removed
- [ ] Architecture: stale CORS limitation removed
- [ ] Mock mode works with all new fields
- [ ] All tests pass
- [ ] API deployed and live
- [ ] Frontend deployed and live
- [ ] Demo runbook documented
