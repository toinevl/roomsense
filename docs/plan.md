# RoomSense — Room Occupancy Showcase Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.
> **For Claude:** Lanes are defined in the Wishlist section; own only the files your lane names.

**Goal:** A live, demo-ready web application showcasing Terabee room-occupancy sensor data (mocked in Azure Table Storage) for two audiences at once — a technical crowd (live telemetry, architecture transparency) and C-level (utilization KPIs, "ghost meeting" cost, budget case).

**Architecture:** Vite + TypeScript SPA on Azure Static Web Apps (Free) calling a standalone Azure Functions v4 (Node 20/TS, Flex Consumption) API over CORS, backed by Azure Table Storage. A seed generator produces 30 days of realistic Terabee People-Counting telemetry (based on Terabee's official LoRa payload decoder field model) wrapped in IoT Hub envelope shape; a simulator endpoint appends live readings during demos. Data sources are pluggable **source adapters** — the Terabee/IoT Hub mock is adapter #1, an Outlook rooms/reservations mock is adapter #2, and the real Databricks/IoT Hub feed can slot in later without touching the API surface.

**Tech Stack:** Vite + TypeScript (no framework, matching nordicHolidays), Azure Functions v4 Node 20 TS, `@azure/data-tables`, `@azure/identity`, zod, vitest, Azurite for local tables, GitHub Actions with OIDC, Bicep for infra.

---

## Current context / assumptions

- **Real production path (not built here, but shown on the architecture page):** Terabee People Counting sensors → LoRa/network server → **Azure IoT Hub** → **Azure Databricks** data lake. The demo replaces everything left of the API with mock data in Azure Tables. Databricks is explicitly out of scope; Azure Tables is the system of record for the demo.
- **Terabee data model (verified 2026-07-19 from Terabee's official `pcl_lora_payload_decoder` on GitHub):** decoded uplink carries cumulative `count_in` / `count_out` (uint32) plus a `flags` byte; device config frames carry `direction` (normal/reversed), `state` (enabled/disabled), `mounting_height` (mm, uint16), `push_period_min` (uint16). Counts are **cumulative since device reset** — occupancy is derived as `count_in − count_out`, reset daily at 04:00.
- **Hosting mirrors existing apps** (goGo / nordicHolidays pattern): SWA Free static frontend + standalone Flex Consumption Functions API called via CORS + Table Storage, GitHub Actions OIDC deploys.
- New repo `roomsense` under the same GitHub account; local path `/home/toine/AI-Projects/projects/playground/roomsense`.
- New Azure resource group `rgRoomSense` (⚠ confirm subscription + rg before every deploy — standing lesson).
- Anonymous access, no auth wall (standing preference). The simulator write endpoint alone is protected by a shared-key header.
- Scalability is a non-goal. Seed volume: 3 buildings × 5 rooms × 30 days × 15-min resolution ≈ 43k snapshot rows + similar raw readings — trivial for Table Storage batch inserts.
- Room names use TU/e-flavoured but fictional labels and MUST include non-ASCII fixtures (standing testing convention): e.g. `Vergaderzaal Höganäs`, `Café Corner`, `Zaal Curaçao`.
- HTTP response headers ASCII-only (standing lesson — Functions host rejects non-ASCII header bytes).
- Every new Functions module MUST be imported in `api/src/index.ts`, with the `index.test.ts` guard test copied from nordicHolidays (standing lesson — v4 model silently 404s unregistered functions).
- All workflows get `workflow_dispatch` (standing lesson).

## Extensibility contract (the "later Outlook is real" story)

Each data source is an **adapter** = a module that writes into the normalized tables below and declares itself in a `Sources` registry table. The API only reads normalized tables; swapping mock → real IoT Hub ingestion or mock → real Microsoft Graph `/places` + calendar sync means writing one new adapter, zero API/frontend changes. Adapter #2 (Outlook mock) proves the seam by shipping reservations data through it in Phase 3.

## Data model (Azure Table Storage)

Storage account `stroomsense`, tables:

| Table | PartitionKey | RowKey | Properties |
|---|---|---|---|
| `Rooms` | building (`atlas`) | roomId (`atlas-4-410`) | name, floor (int), capacity (int), deviceId, outlookAddress (`atlas-4-410@rooms.demo`), sourceId |
| `SensorReadings` | deviceId (`TB-PCL-0001`) | inverted ticks (`String(10_000_000_000_000 - epochMs).padStart(14,'0')`) | ts (ISO), countIn (cumul.), countOut (cumul.), flags (int), batteryPct, rssi, snr, sourceId |
| `OccupancySnapshots` | roomId | inverted ticks of interval start | ts (ISO), occupancy (int), utilizationPct (float), intervalMinutes (15) |
| `Reservations` | roomId | `${startTicks}_${hash8(organizer+subject)}` | subject, organizer (fictional names), startTs, endTs, attendeeCount, sourceId (`outlook-mock`) |
| `Sources` | `source` | sourceId (`terabee-iothub-mock`, `outlook-mock`) | displayName, kind (`sensor`/`calendar`), status, lastSyncTs |

Inverted-ticks RowKeys make "latest N" a plain top-N partition scan — same pattern as existing apps.

## Seed / simulator behavioural spec (what makes the demo credible)

Generator (`packages/seed`) is **deterministic from a seed integer** (so tests can assert exact outputs):

1. Office-hours curve: weekday traffic ramps 08:00–10:00, lunch dip, dies after 18:00; weekends near-zero.
2. Reservation-driven spikes: mock reservations (30-day calendar, 60% weekday slot fill) pull `in` events at start, `out` events at end, attendeeCount ±20% jitter vs actual entries.
3. **Ghost meetings: ~20% of reservations produce zero occupancy.** This is the C-level money chart ("X% of booked hours are empty rooms — that is €Y of floor space").
4. Walk-ins: unreserved usage at ~10% of slots (the counter-story: sensors see usage Outlook can't).
5. Daily counter reset 04:00 (mirrors real device behaviour); occupancy derived as `countIn − countOut`, clamped ≥ 0.
6. Live mode: `POST /api/simulate/tick` (header `x-sim-key: $SIMULATOR_KEY`) appends one interval of fresh readings for all devices so the dashboard visibly moves during a presentation.

## API surface (all GET anonymous, JSON)

- `GET /api/health` — build stamp + table connectivity
- `GET /api/rooms` — all rooms joined with latest occupancy
- `GET /api/rooms/{roomId}/occupancy?from&to` — snapshot series
- `GET /api/rooms/{roomId}/readings?limit=50` — raw telemetry (tech view)
- `GET /api/rooms/{roomId}/reservations?date=` — mock Outlook bookings
- `GET /api/kpis?from&to` — portfolio: avg/peak utilization, ghost-meeting rate, top-5 underused rooms, estimated wasted-space cost (config `COST_PER_DESK_HOUR_EUR`, default 4)
- `POST /api/simulate/tick` — key-protected demo advance

## Frontend pages (single SPA, hash-routed like nordicHolidays)

1. **/#dashboard (C-level, landing):** 4 KPI tiles (utilization %, ghost rate, wasted € /month, busiest building), building/floor utilization heatmap, "booked vs actually used" bar chart, top-5 ghost rooms table. Load `dataviz` skill before building any chart.
2. **/#live (technical):** room grid with live occupancy dots, per-room drill-in with raw telemetry stream (auto-refresh 10s), device metadata (mounting height, push period, battery, RSSI).
3. **/#architecture (technical + credibility):** diagram of the real path (Terabee → LoRa → IoT Hub → Databricks) vs the demo path (seed → Azure Tables), with the adapter seam highlighted — this slide wins the technical room's trust that the mock is honest.

## Azure resources (Bicep in `infra/`, mirror goGo's `main.bicep` module layout)

- `rgRoomSense` (new; create explicitly, confirm subscription first)
- Storage account `stroomsense` (tables)
- Flex Consumption Function App `roomsense-api` + its host storage (enable SCM basic auth — standing lesson)
- SWA Free `roomsense-swa`
- Platform CORS on the Function App for the SWA hostname via `az functionapp cors add` — **not** expressible in Bicep, script it in the deploy workflow (standing lesson from nordicHolidays)
- OIDC federated credential on existing GitHub-deploy app registration pattern (document actual app name in `infra/RECOVERY.md` from day one — docs drift, tenant doesn't)

---

## Phases and execution order

- **Phase 0 (serial, one agent):** repo scaffold, shared types, seed generator, Azurite wiring. Everything else depends on it.
- **Phase 1 (parallel):** Lane A = API (Hermes), Lane B = frontend (Claude), Lane C = infra/CI (either, single owner).
- **Phase 2 (serial):** provisioning, first deploy, seed upload, smoke test.
- **Phase 3 (parallel):** Outlook-mock adapter + reservations UI + polish.

### Phase 0 — Foundation (serial)

#### Task 0.1: Scaffold repo
- Create `/home/toine/AI-Projects/projects/playground/roomsense` with pnpm workspace exactly like goGo: `frontend/`, `api/`, `packages/shared/`, `packages/seed/`, `infra/`, `.github/workflows/`, root `package.json`, `pnpm-workspace.yaml`, `.editorconfig`, `.gitignore`, `eslint.config.mjs`.
- `git init -b main`; first commit; create GitHub repo `roomsense` (private) with `gh repo create`; push.
- Copy `docs/superpowers` conventions? No — YAGNI. Copy only `.funcignore`, `host.json`, `tsconfig.json` patterns from `goGo/api/`.
- Verify: `pnpm install` clean; `gh repo view roomsense` shows repo.

#### Task 0.2: Shared domain types (`packages/shared/src/types.ts`)
TDD each type's zod schema. Complete code:

```ts
import { z } from 'zod'

/** Decoded Terabee PCL uplink — field names match Terabee's official pcl_lora_payload_decoder. */
export const SensorReadingSchema = z.object({
  deviceId: z.string().min(1),
  ts: z.string().datetime(),
  countIn: z.number().int().nonnegative(),   // cumulative since last reset
  countOut: z.number().int().nonnegative(),  // cumulative since last reset
  flags: z.number().int().min(0).max(255),
  batteryPct: z.number().min(0).max(100),
  rssi: z.number(),
  snr: z.number(),
  sourceId: z.string(),
})
export type SensorReading = z.infer<typeof SensorReadingSchema>

export const RoomSchema = z.object({
  roomId: z.string(),
  building: z.string(),
  floor: z.number().int(),
  name: z.string(),          // fixtures MUST include ä/ö/å/ç names
  capacity: z.number().int().positive(),
  deviceId: z.string(),
  outlookAddress: z.string().email(),
  sourceId: z.string(),
})
export type Room = z.infer<typeof RoomSchema>

export const ReservationSchema = z.object({
  roomId: z.string(),
  subject: z.string(),
  organizer: z.string(),
  startTs: z.string().datetime(),
  endTs: z.string().datetime(),
  attendeeCount: z.number().int().positive(),
  sourceId: z.string(),
})
export type Reservation = z.infer<typeof ReservationSchema>

export const OccupancySnapshotSchema = z.object({
  roomId: z.string(),
  ts: z.string().datetime(),
  occupancy: z.number().int().nonnegative(),
  utilizationPct: z.number().min(0),
  intervalMinutes: z.literal(15),
})
export type OccupancySnapshot = z.infer<typeof OccupancySnapshotSchema>
```

Also `rowKeys.ts` with `invertedTicks(epochMs: number): string` + unit tests (round-trip, ordering property: later time ⇒ lexicographically smaller key).

#### Task 0.3: Seed generator (`packages/seed/src/generate.ts`)
- Deterministic PRNG (mulberry32, seed param). Implements the 6-point behavioural spec above.
- Fixture room list: 15 rooms across buildings `atlas`, `flux`, `neuron`; names include `Vergaderzaal Höganäs`, `Zaal Curaçao`, `Café Corner`.
- Output: `{ rooms, readings, snapshots, reservations, sources }` arrays of shared types.
- Tests (vitest): determinism (same seed ⇒ identical output), ghost-rate ≈ 20% ± 3, weekend traffic < 5% of weekday, counters reset at 04:00, non-ASCII names survive round-trip.

#### Task 0.4: Table upload script (`packages/seed/src/upload.ts`)
- `@azure/data-tables` batch upserts (100/partition/batch), target from `TABLES_CONNECTION_STRING` (Azurite default local).
- npm script `pnpm seed:local` (Azurite) and `pnpm seed:azure`.
- Verify locally: start `azurite --tableHost`, run `pnpm seed:local`, then a 5-line query script prints row counts per table (rooms=15, readings>40k).

### Phase 1 — Parallel lanes

**Lane A (Hermes) owns `api/**` only. Lane B (Claude) owns `frontend/**` only. Lane C owns `infra/**` + `.github/workflows/**` only. Nobody touches another lane's files; shared types are frozen after Phase 0 (changes require a coordination commit by the orchestrator).**

#### Lane A tasks (API, TDD per endpoint)
- A1: `api/` scaffold — Functions v4 TS, `host.json`, `index.ts` entry + **registration guard test** (copy pattern from `nordicHolidays/api/src/index.test.ts`).
- A2: `lib/tables.ts` — table client factory (conn string local / managed identity in Azure, same dual pattern as goGo).
- A3: `GET /health` (+ build stamp env `BUILD_SHA`).
- A4: `GET /rooms` — join latest snapshot per room (top-1 partition scan per room; 15 rooms, fine).
- A5: `GET /rooms/{roomId}/occupancy` — range query with `from`/`to` zod validation; 400 on bad input.
- A6: `GET /rooms/{roomId}/readings` — top-N raw telemetry.
- A7: `GET /rooms/{roomId}/reservations?date=`.
- A8: `GET /kpis` — utilization avg/peak, ghost rate (reservations with max occupancy 0 during slot), top-5 underused, wasted-€ = ghost-hours × capacity × `COST_PER_DESK_HOUR_EUR`.
- A9: `POST /simulate/tick` — validates `x-sim-key` (ASCII header only), advances simulator one 15-min interval from latest reading state, appends rows.
- Each endpoint: vitest against Azurite with seeded fixtures **including non-ASCII room names**; never put room names in response headers.

#### Lane B tasks (frontend)
- B1: Vite + TS scaffold, hash router, `config.ts` reading `VITE_API_BASE_URL` (same pattern as nordicHolidays `config.ts`).
- B2: API client `src/lib/api.ts` typed against `@roomsense/shared`, with mock-data mode (`VITE_MOCK=1`) so Lane B never blocks on Lane A — mock fixtures generated by calling `packages/seed` directly.
- B3: Dashboard page (KPI tiles, heatmap, booked-vs-used chart, ghost table). **Invoke `dataviz` skill before writing any chart code; invoke `frontend-design` skill for the shell.**
- B4: Live page (room grid + drill-in + 10s polling).
- B5: Architecture page (static SVG/mermaid of real vs demo path).
- B6: Playwright smoke spec (`frontend/e2e/`) — pages render, KPI tiles non-empty against mock mode.

#### Lane C tasks (infra + CI)
- C1: `infra/main.bicep` + modules (storage, flex-consumption function app, SWA) modeled on `goGo/infra/`; `infra/RECOVERY.md` documenting the OIDC app registration by its **verified live name** (check with `az ad app list`, don't trust prose).
- C2: `ci.yml` — lint, typecheck, vitest on PR + push, `workflow_dispatch`.
- C3: `deploy-api.yml`, `deploy-frontend.yml` — OIDC login, deploy, **post-deploy smoke test with 60s cold-start tolerance**, `workflow_dispatch`, CORS `az functionapp cors add` step in deploy-api.

### Phase 2 — Provision + first deploy (serial, orchestrator)
1. `az account show` — confirm subscription; create `rgRoomSense`.
2. `az deployment group create` with `infra/main.bicep`; enable SCM basic auth on the Function App.
3. Set repo secrets/vars (deploy tokens, `SIMULATOR_KEY`, storage conn for seeding).
4. Run `pnpm seed:azure`; verify row counts.
5. Trigger both deploy workflows; `gh run watch --exit-status` each (a green push ≠ a live deploy — standing lesson); curl `/api/health` and the SWA URL.
6. End-to-end check per Deployment Testing Checklist memory: dashboard loads real KPIs from the live API in a browser (Playwright against prod URL).

### Phase 3 — Extensibility proof + demo polish (parallel again)
- D1 (Lane A): Outlook-mock adapter formalized: `api/src/adapters/outlookMock.ts` implementing `SourceAdapter` interface (`syncRooms()`, `syncReservations()`), registered in `Sources`; documents in `docs/adding-a-source.md` exactly what a real Graph adapter would implement.
- D2 (Lane B): Reservations overlay on Live page timeline (booked band vs occupancy line — the ghost-meeting visual).
- D3 (Lane B): "Presenter mode" button — calls `simulate/tick` every 30s with stored key, adds subtle motion for demos.
- D4 (Lane C): `README.md` + architecture doc via `architecture-documentation` skill; og-image; demo script (5-min C-level walkthrough, 10-min technical).

## Files likely to change / create (summary)
All under `/home/toine/AI-Projects/projects/playground/roomsense/`: `packages/shared/src/{types,rowKeys}.ts`, `packages/seed/src/{generate,upload}.ts` (+tests), `api/src/index.ts`, `api/src/functions/{health,rooms,occupancy,readings,reservations,kpis,simulate}.ts` (+tests), `api/src/lib/tables.ts`, `api/src/adapters/outlookMock.ts`, `frontend/index.html`, `frontend/src/{main.ts,config.ts,lib/api.ts,pages/*.ts,styles/*}`, `frontend/e2e/smoke.spec.ts`, `infra/{main.bicep,modules/*,RECOVERY.md}`, `.github/workflows/{ci,deploy-api,deploy-frontend}.yml`, `wishlist.md`, `README.md`, `CLAUDE.md` (seeded with the registration-guard + ASCII-header + non-ASCII-fixture conventions from day one).

## Tests / validation
- Unit: vitest in `packages/shared`, `packages/seed`, `api` (Azurite-backed), all with non-ASCII fixtures.
- E2E: Playwright smoke local (mock mode) + against prod post-deploy.
- CI gates every PR; deploys smoke-test themselves with cold-start tolerance.
- Demo rehearsal checklist in `docs/demo-script.md` is the final acceptance test.

## Risks, tradeoffs, open questions
- **Terabee realism:** field model is from their official LoRa decoder; exact IoT Hub envelope for their PoE/Wi-Fi variants differs (those POST JSON directly). Mitigation: architecture page states the mock uses the LoRa-decoded field model; adapter seam absorbs either.
- **KPI € figure is illustrative** (`COST_PER_DESK_HOUR_EUR` config) — label it "indicative" on the dashboard to keep C-level credibility.
- **Two-agent parallelism risk:** shared-types drift. Mitigation: types frozen after Phase 0; orchestrator-only coordination commits; lanes own disjoint paths.
- **Flex Consumption cold start (~60s worst case)** could embarrass a live demo. Mitigation: presenter mode pings `/health` on page load; demo script says open the app 2 minutes early.
- Open: repo private or public? Plan assumes private (can flip for showcase). Custom domain? Not in scope; SWA default hostname fine for demo.

---

## wishlist.md (to be created verbatim in repo root — todo.txt style, standing convention)

```
# RoomSense wishlist — lanes: [H]=Hermes [C]=Claude [O]=orchestrator/either
# Phase 0 is serial and blocks everything. Within a phase, items are parallel-safe:
# lanes own disjoint paths (H=api/**, C=frontend/**, O=infra/**+workflows).
# Agents NEVER commit — leave diffs for review (standing convention).

(A) Phase0 scaffold pnpm workspace + git + GitHub repo +setup @O #1
(A) Phase0 shared types + rowKeys with zod & tests +core @O #2 dep:#1
(A) Phase0 deterministic seed generator (office curve, 20% ghosts, 04:00 reset) +core @O #3 dep:#2
(A) Phase0 Azurite upload script + local row-count verify +core @O #4 dep:#3
(A) api scaffold + v4 registration guard test +api @H #5 dep:#4
(A) GET /health +api @H #6 dep:#5
(A) GET /rooms with latest occupancy +api @H #7 dep:#5
(A) GET /rooms/{id}/occupancy range query +api @H #8 dep:#5
(B) GET /rooms/{id}/readings raw telemetry +api @H #9 dep:#5
(B) GET /rooms/{id}/reservations +api @H #10 dep:#5
(A) GET /kpis (utilization, ghost rate, wasted EUR) +api @H #11 dep:#7
(B) POST /simulate/tick key-protected live mode +api @H #12 dep:#8
(A) frontend scaffold + hash router + config.ts +ui @C #13 dep:#4
(A) typed api client with VITE_MOCK=1 fixture mode +ui @C #14 dep:#13
(A) C-level dashboard (KPI tiles, heatmap, booked-vs-used, ghost table) +ui @C #15 dep:#14
(A) technical live page (room grid, drill-in, 10s poll) +ui @C #16 dep:#14
(B) architecture page (real path vs demo path, adapter seam) +ui @C #17 dep:#13
(B) playwright smoke spec in mock mode +ui @C #18 dep:#15
(A) bicep: storage + flex function app + SWA + RECOVERY.md +infra @O #19 dep:#1
(A) ci.yml lint/typecheck/test with workflow_dispatch +infra @O #20 dep:#5,#13
(A) deploy workflows + CORS step + 60s cold-start smoke +infra @O #21 dep:#19
(A) provision rgRoomSense, deploy, seed azure, e2e verify +deploy @O #22 dep:#21,#11,#15
(B) outlook-mock SourceAdapter + adding-a-source.md +extend @H #23 dep:#22
(B) reservations overlay timeline (ghost visual) +extend @C #24 dep:#22
(C) presenter mode auto-tick button +extend @C #25 dep:#22
(C) README + architecture doc + demo script + og-image +docs @O #26 dep:#22
(D) real Microsoft Graph adapter (post-demo, if budget lands) +future #27
(D) real IoT Hub ingestion adapter (post-demo) +future #28
```
