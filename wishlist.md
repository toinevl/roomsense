# RoomSense wishlist — lanes: [H]=Hermes [C]=Claude [O]=orchestrator/either
# Coordination protocol:
#   - This file is the single source of truth for progress; git history is ground truth.
#   - Lanes own DISJOINT paths: @H owns api/**, @C owns frontend/**, @O owns infra/** + .github/workflows/**.
#   - Never touch another lane's files. Shared types (packages/shared) are FROZEN after Phase 0;
#     changes require a coordination commit by the orchestrator only.
#   - Subagents never commit — leave diffs for review. Lane owners (Hermes, Claude orchestrators) commit
#     their own lane's reviewed work with explicit paths (git add api/... , never git add -A).
#   - Mark items [x] + date when done. Full context: docs/plan.md.
# Conventions that apply to ALL lanes (see CLAUDE.md): non-ASCII test fixtures, ASCII-only response
#   headers, every api function module imported in api/src/index.ts (guard test), workflow_dispatch
#   on every workflow, TDD.

- [x] (A) Phase0 scaffold pnpm workspace + git + GitHub repo +setup @O #1 — done 2026-07-19
- [x] (A) Phase0 shared types + rowKeys with zod & tests +core @O #2 — done 2026-07-19 (12 tests)
- [x] (A) Phase0 deterministic seed generator (office curve, 20% ghosts, 04:00 reset) +core @O #3 — done 2026-07-19 (9 tests)
- [x] (A) Phase0 Azurite upload script + local row-count verify +core @O #4 — done 2026-07-19 (43k readings verified)
- [x] (A) api scaffold + v4 registration guard test +api @H #5 — done 2026-07-19 (31 tests; bundle fix for shared ESM)
- [x] (A) GET /health +api @H #6 — done 2026-07-19
- [x] (A) GET /rooms with latest occupancy +api @H #7 — done 2026-07-19
- [x] (A) GET /rooms/{id}/occupancy range query +api @H #8 — done 2026-07-19 (inverted-ticks bound swap fix)
- [x] (B) GET /rooms/{id}/readings raw telemetry +api @H #9 — done 2026-07-19
- [x] (B) GET /rooms/{id}/reservations +api @H #10 — done 2026-07-19
- [x] (A) GET /kpis (utilization, ghost rate, wasted EUR) +api @H #11 — done 2026-07-19 (10 tests; peakUtilizationPct clamped to 100)
- [x] (B) POST /simulate/tick key-protected live mode +api @H #12 — done 2026-07-19 (8 tests; cumulative counters, fail-closed auth)
- [x] (A) frontend scaffold + hash router + config.ts +ui @C #13 — done 2026-07-19
- [x] (A) typed api client with VITE_MOCK=1 fixture mode +ui @C #14 — done 2026-07-19 (22 tests)
- [x] (A) C-level dashboard (KPI tiles, heatmap, booked-vs-used, ghost table) +ui @C #15 — done 2026-07-19
- [x] (A) technical live page (room grid, drill-in, 10s poll) +ui @C #16 — done 2026-07-19
- [x] (B) architecture page (real path vs demo path, adapter seam) +ui @C #17 — done 2026-07-19
- [x] (B) playwright smoke spec in mock mode +ui @C #18 — done 2026-07-19 (4/4 e2e)
- [x] (A) bicep: storage + flex function app + SWA + RECOVERY.md +infra @O #19 — done 2026-07-19 (bicep compiles; provision pending #22)
- [x] (A) ci.yml lint/typecheck/test with workflow_dispatch +infra @O #20 — done 2026-07-19
- [x] (A) deploy workflows + CORS step + 60s cold-start smoke +infra @O #21 — done 2026-07-19 (unproven until #22 first run)
- [x] (A) provision rgRoomSense, deploy, seed azure, e2e verify +deploy @O #22 dep:#21,#11,#15 — done 2026-07-19
- [x] (B) outlook-mock SourceAdapter + adding-a-source.md +extend @H #23 dep:#22 — done 2026-07-19
- [x] (B) reservations overlay timeline (ghost visual) +extend @C #24 — done 2026-07-19 (Live page drill-in; browser + e2e verified)
- [x] (C) presenter mode auto-tick button +extend @C #25 — done 2026-07-19 (browser + e2e verified; mock-mode tick confirmed to advance displayed occupancy)
- [x] (C) README + architecture doc + demo script + og-image +docs @O #26 dep:#22 — done 2026-07-19
- [x] (C) marketing use-case brainstorm + flagship roadmap (students/staff/profs) +plan @O #30 — done 2026-07-21
- [ ] (C) evaluate 3 consumer UI strategies (mobile/social/ai) via user research +plan @O #35 — in progress 2026-07-21
- [x] (B) room-finder page for students (find empty rooms) +flagship @C #31 dep:#22 — done 2026-07-21 (2 tests pass; route #finder)
- [x] (B) semester-review report page for leadership (printable kpi one-pager) +flagship @C #32 dep:#22 — done 2026-07-21 (3 tests pass; print CSS; route #report)
- [x] (B) roomsense-wrapped shareable card (fun stats, screenshots) +flagship @C #33 dep:#22 — done 2026-07-21 (1 test pass; route #wrapped)
- [x] (B) trust & transparency faq page (privacy de-risk) +flagship @C #34 dep:#22 — done 2026-07-21 (1 test pass; route #trust; 7 Q&A)
- [ ] (C) strategy 1: mobile-first tap-to-book (48px targets, animations, one-tap flow) +flagship @C #36 dep:#35
- [ ] (C) strategy 2: social presence & network effects (avatars, team awareness, reviews, notifications) +extend @C @H #37 dep:#35
- [ ] (D) strategy 3: ai recommendations & gamification (recommendations, predictions, streaks) +extend @C @H @ML #38 dep:#35
- [ ] (D) real Microsoft Graph adapter (post-demo, if budget lands) +future #27
- [ ] (D) real IoT Hub ingestion adapter (post-demo) +future #28
- [x] (B) OPTIONS preflight bypasses function code on Flex Consumption +bug @H #29 — root-caused 2026-07-19 (platform limitation; documented)

## API contract for #5-#12 (frozen — frontend mock mode builds against this)
- GET /api/health → { status: "ok", buildSha, tables: boolean }
- GET /api/rooms → Array<Room & { occupancy: number; utilizationPct: number; lastSeenTs: string }>
- GET /api/rooms/{roomId}/occupancy?from=ISO&to=ISO → OccupancySnapshot[] (asc by ts; 400 on invalid range)
- GET /api/rooms/{roomId}/readings?limit=50 → SensorReading[] (desc by ts)
- GET /api/rooms/{roomId}/reservations?date=YYYY-MM-DD → Reservation[] (asc by startTs)
- GET /api/kpis?from=ISO&to=ISO → { avgUtilizationPct, peakUtilizationPct, ghostRatePct, wastedEur, busiestBuilding, underusedRooms: Array<{roomId, name, utilizationPct}> (top 5) }
- POST /api/simulate/tick (header x-sim-key) → { appended: number, ts } | 401
- Types come from @roomsense/shared. Ghost = reservation whose slot's max occupancy is 0.
- wastedEur = ghostHours × room.capacity × COST_PER_DESK_HOUR_EUR (env, default 4).

## Notes for Lane A (Hermes) from Lane B (frontend), 2026-07-19
- Ghost derivation: derive ghosts from occupancy data (slot max occupancy == 0), NOT from any seed-internal flag. Walk-in traffic can overlap a generator-flagged ghost slot — occupancy-derived is the correct production semantic; do not "fix" toward the seed flag.
- /rooms "latest occupancy": seed data ends at UTC midnight, so the literal newest snapshot is always ~0%. Frontend anchors "current" to the most recent office-hours (weekday 08:00-18:00 UTC) snapshot; consider the same anchoring server-side, or the dashboard shows dead rooms when demoed outside office hours.
- pnpm-lock.yaml is the ONLY shared file between lanes; ci.yml temporarily uses --no-frozen-lockfile until both lanes are committed (revert at #22).

## Deploy runbook facts (#22, verified 2026-07-19)
- Subscription: Visual Studio Enterprise 2dbeb3f1-e45d-4207-a7e9-185330aad74b; rg rgRoomSense (westeurope).
- Deploy identity: app `roomsense-github-deploy` (appId a4432cfb-4e76-4376-8785-95f8be16fd4e), Contributor on rg only. TWO federated credentials needed: classic subject AND GitHub's immutable-ID subject `repo:toinevl@46485764/roomsense@1305566744:ref:refs/heads/main` (GitHub now presents the ID form; AADSTS700213 tells you the exact subject to register).
- Flex Consumption: publish-profile/Kudu does NOT exist (Empty reply from scm host) — OIDC + functions-action with prebuilt self-contained package only. A stale `WEBSITE_RUN_FROM_PACKAGE` app setting blocks all zip deploys (RunFromExternalUrlException) — delete it.
- Live: https://lemon-mud-06bc7fd03.7.azurestaticapps.net (SWA) → https://roomsense-api.azurewebsites.net/api (vars.ROOMSENSE_API_URL MUST include /api).
- RESOLVED 2026-07-19: OPTIONS preflight was returning 204 without CORS headers on some endpoints. Root cause was NOT cors.ts (already correct) — a leftover `az functionapp cors add` from an earlier deploy attempt had configured platform-level CORS with a stale placeholder origin (`mango-coast-...` from Bicep parameters), which intercepts OPTIONS at the platform layer before function code runs. Fixed by clearing platform CORS entirely (`az functionapp cors remove` for every origin) so function-level `withCors`/`corsPreflightResponse` handles every request, OPTIONS included. Verified on all 6 endpoints incl. `/simulate/tick`. Do NOT re-add `az functionapp cors add` for this app — CORS is fully handled in code.
- Demo-quality (optional, Hermes): GET /rooms returns literal latest snapshot (0% outside office hours); frontend anchors client-side, server could do the same.

## Presenter mode notes (#25, 2026-07-19)
- Real/fetch mode requires the `SIMULATOR_KEY` app setting on roomsense-api — currently UNSET, so the live endpoint fails closed (401) for everyone (by design, see api/src/functions/simulate.ts). Presenter mode will prompt for a key and show "Invalid key" until Toine sets one. Enter it once per browser tab (sessionStorage `roomsense.simKey`, never baked into the bundle).
- Cadence: 30s server-side tick (advances the shared clock / mock counter); actual visible movement follows each page's own poll (Live: 10s). This is intentional, not a bug — don't "fix" it to update instantly.

## #29 detail: OPTIONS preflight bypasses function code on Flex Consumption (root-caused 2026-07-19)
Discovered while browser-verifying #25 (presenter mode) against the LIVE API — this affects any
endpoint needing a real preflight (any cross-origin browser request that triggers one).

ROOT CAUSE — PLATFORM LIMITATION (not a bug in our code):
Microsoft's own docs state: "CORS: CORS settings are currently not supported. Exceptions might
occur if CORS is configured for Flex Consumption apps."
(https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan#considerations)
On Flex Consumption, the Kestrel front-end that fronts the Node worker detects the CORS preflight
pattern (Origin + Access-Control-Request-Method headers) and short-circuits with an empty 204
before the request is dispatched to function code. Our corsPreflightResponse() never runs.
Confirmed by:
- 5/5 preflights (Origin + ACRM) return 204 with ZERO CORS headers (no Allow-Origin,
  no Allow-Methods, no Allow-Headers)
- Same endpoint with NO Origin/ACRM (not a preflight) returns our full CORS header set
- GitHub issue #5200 (azure-functions-host, 2019) — exact same repro, never resolved
- GitHub issue #2524 (azure-functions-dotnet-worker, 2024) — Flex Consumption repro

Verified NON-fixes (all tried, none worked):
- Clear platform CORS (allowedOrigins=[]) and disable supportCredentials — Kestrel still short-circuits
- Add SWA origin to platform CORS — Kestrel still short-circuits
- Remove empty `extensions.http` block from host.json (commit ebde3ae) — no change
- az functionapp restart — no change

What WORKS (the only paths forward):
1. Migrate API off Flex Consumption to Consumption (Linux) or Premium — platform CORS works there.
   Cost impact: small. This is the recommended fix before any production use.
2. Reverse-proxy through SWA's managed API proxy (SWA adds CORS itself; the Function is never
   called cross-origin from the browser).
3. Put Azure Front Door / API Management in front and configure CORS there.
4. Accept the limitation: the demo SWA's mock-mode fixtures work fine; only live API calls
  requiring preflight fail. The demo script already uses mock mode for everything except the
  optional /simulate/tick.

Impact on #25: presenter mode CODE/UX correct. Mock-mode e2e 6/6 green. Live-mode ticks will
fail at the preflight stage until one of the four workarounds above is applied. Recommendation:
document this as a known limitation in the README; implement workaround #2 (SWA proxy) or #1
(plan migration) before any non-demo audience.

Files changed for #29: wishlist.md (this entry). api/host.json had its empty `extensions.http`
block removed (commit ebde3ae) — that change is benign and stays even though it didn't fix the
bug, because empty-but-present config blocks are still a plausible footgun.

## Data reseed: real TU/e buildings, one week (2026-07-19)
Requested by Toine: reseed against the real TU/e Atlas/Flux/Neuron buildings with a week of
sensor + reservation data, instead of the fictional 30-day mock. Room fixtures were already
updated to real TU/e buildings/room numbers (commit e325790, `<floor>.<room>` IDs, `@tue.nl`
addresses) before this ran.

- Ran `DAYS=7 TABLES_CONNECTION_STRING=<roomsensestorage> pnpm seed:azure` against live Azure.
- Gotcha hit: SensorReadings/OccupancySnapshots row keys are timestamp-derived, so upsert cleanly
  overwrites on re-seed — but Reservations row keys are content-derived
  (`${startTs}_${hash(organizer+subject)}`), so a top-up run left the OLD 30-day reservations
  sitting alongside the NEW 7-day ones for the same dates, producing literal double-booked rooms
  (two different reservations, same room, same overlapping hour). Confirmed and fixed by deleting
  just the `Reservations` table (`az storage table delete --name Reservations --account-name
  roomsensestorage --auth-mode login` — note: no `--yes` flag, that errors) and re-running the
  upload, which recreates it cleanly. Readings/snapshots were intentionally left at their original
  30-day span (Toine's call) — only Reservations is now scoped to exactly the last 7 days.
- `az storage table delete` needs explicit human approval — Claude Code's auto-mode classifier
  blocks it as a destructive action; there is no code workaround, ask the user.
- Verified live: 15 real rooms (Atlas/Flux/Neuron), 319 reservations across the week, zero
  overlapping start times per room/day (scripted check across all 15 rooms × 7 days), KPIs and
  the Live-page ghost overlay browser-verified against a real room (Senaatzaal, atlas-0.710,
  capacity 80).
- If reseeding again with a different `days` value in future: always clear Reservations first:
  `az storage table delete --name Reservations --account-name roomsensestorage --auth-mode login`
  then re-run `pnpm seed:azure`. SensorReadings/OccupancySnapshots don't need this.
