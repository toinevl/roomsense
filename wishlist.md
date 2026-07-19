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
- [ ] (A) api scaffold + v4 registration guard test +api @H #5 dep:#4
- [ ] (A) GET /health +api @H #6 dep:#5
- [ ] (A) GET /rooms with latest occupancy +api @H #7 dep:#5
- [ ] (A) GET /rooms/{id}/occupancy range query +api @H #8 dep:#5
- [ ] (B) GET /rooms/{id}/readings raw telemetry +api @H #9 dep:#5
- [ ] (B) GET /rooms/{id}/reservations +api @H #10 dep:#5
- [ ] (A) GET /kpis (utilization, ghost rate, wasted EUR) +api @H #11 dep:#7
- [ ] (B) POST /simulate/tick key-protected live mode +api @H #12 dep:#8
- [ ] (A) frontend scaffold + hash router + config.ts +ui @C #13 dep:#4
- [ ] (A) typed api client with VITE_MOCK=1 fixture mode +ui @C #14 dep:#13
- [ ] (A) C-level dashboard (KPI tiles, heatmap, booked-vs-used, ghost table) +ui @C #15 dep:#14
- [ ] (A) technical live page (room grid, drill-in, 10s poll) +ui @C #16 dep:#14
- [ ] (B) architecture page (real path vs demo path, adapter seam) +ui @C #17 dep:#13
- [ ] (B) playwright smoke spec in mock mode +ui @C #18 dep:#15
- [x] (A) bicep: storage + flex function app + SWA + RECOVERY.md +infra @O #19 — done 2026-07-19 (bicep compiles; provision pending #22)
- [x] (A) ci.yml lint/typecheck/test with workflow_dispatch +infra @O #20 — done 2026-07-19
- [x] (A) deploy workflows + CORS step + 60s cold-start smoke +infra @O #21 — done 2026-07-19 (unproven until #22 first run)
- [ ] (A) provision rgRoomSense, deploy, seed azure, e2e verify +deploy @O #22 dep:#21,#11,#15
- [ ] (B) outlook-mock SourceAdapter + adding-a-source.md +extend @H #23 dep:#22
- [ ] (B) reservations overlay timeline (ghost visual) +extend @C #24 dep:#22
- [ ] (C) presenter mode auto-tick button +extend @C #25 dep:#22
- [ ] (C) README + architecture doc + demo script + og-image +docs @O #26 dep:#22
- [ ] (D) real Microsoft Graph adapter (post-demo, if budget lands) +future #27
- [ ] (D) real IoT Hub ingestion adapter (post-demo) +future #28

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
