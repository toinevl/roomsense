# RoomSense

Showcase application for **Terabee People-Counting** room-occupancy sensor data
presented for two audiences at once — a C-level utilization/cost dashboard and a
technical live-telemetry view.

Mock data lives in **Azure Table Storage** (seeded deterministically, 30 days at
15-min resolution). The real production path (Terabee → LoRa → IoT Hub →
Databricks) is shown on the architecture page but not built; the demo code proves
the API contract before real hardware is attached.

- Backlog / progress: [wishlist.md](wishlist.md)
- Architecture + data model + security: [GitHub wiki](https://github.com/toinevl/roomsense/wiki)

## Live demo

| Tier | URL | Purpose |
|---|---|---|
| Frontend | https://lemon-mud-06bc7fd03.7.azurestaticapps.net | C-level dashboard + live telemetry |
| API | https://roomsense-api.azurewebsites.net/api/health | JSON API; try `/api/rooms`, `/api/kpis` |
| Wiki | [github.com/toinevl/roomsense/wiki](https://github.com/toinevl/roomsense/wiki) | Architecture, manual, security |

## Feature snapshot

| # | Feature | Status |
|---|---|---|
| #1–4 | Phase 0 scaffold + shared types + seed generator + Azurite upload | shipped |
| #5–12 | Azure Functions v4 API: 7 endpoints + registration guard + bundle | shipped, 49 tests |
| #13–18 | Vite SPA: dashboard, live page, architecture page, Playwright e2e | shipped, 22 tests |
| #19–21 | Bicep infra + CI + deploy workflows + OIDC federation | shipped |
| #22 | Provision rgRoomSense + deploy + seed Azure + e2e verify | shipped |
| #23 | Outlook-mock SourceAdapter (adapter seam proof) | next |
| #24 | Reservations overlay timeline (ghost visual) | queued |
| #25 | Presenter mode auto-tick button | queued |
| #26 | README + demo script + og-image + buildSha wiring | shipped |

### API surface (all anonymous, JSON)

```
GET /api/health           → { status, buildSha, tables }
GET /api/rooms            → rooms with latest occupancy
GET /api/rooms/{id}/occupancy?from&to  → snapshot series (ASC)
GET /api/rooms/{id}/readings?limit=50 → raw telemetry (DESC)
GET /api/rooms/{id}/reservations?date → today's bookings (ASC)
GET /api/kpis?from&to     → avg/peak utilization, ghost rate, wasted €, busiest building
POST /api/simulate/tick (x-sim-key)  → advance demo clock (+30 rows)
```

CORS preflight (`OPTIONS`) on every endpoint.

## Layout

```
repo/
├── api/              Azure Functions v4 (Node 20/TS) — @Hermes
├── frontend/         Vite + TS SPA — @Claude
├── infra/            Bicep + deployment docs — @orchestrator
├── packages/
│   ├── shared/       Domain types (zod) + Table Storage row-key helpers (frozen Phase 0)
│   └── seed/         Deterministic mock-data generator + Azure uploader
├── docs/
│   ├── demo-script.md   5-slide internal walkthrough
│   └── og-image.png     Social card (1200×630, 182KB)
├── .github/workflows/ CI (ci.yml) + deploy (deploy-api.yml, deploy-frontend.yml)
└── wishlist.md       Backlog + lane coordination
```

## Quick start

```bash
git clone git@github.com:toinevl/roomsense.git
cd roomsense
pnpm install

pnpm -r typecheck    # tsc --noEmit across all packages
pnpm -r test         # expect 80/80 green

# Local data
npx azurite -l /tmp/azurite-roomsense --silent &
sleep 4
pnpm seed:local      # 15 rooms, 43k readings, 1.3k reservations

# API
cd api && pnpm build && func start --port 7071
curl -s http://127.0.0.1:7071/api/health

# Frontend
cd frontend && pnpm dev
# Visit http://localhost:5173/#dashboard (mock mode if VITE_API_BASE_URL unset)
```

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vite + TS, no framework | Matches `nordicHolidays`; shared TS toolchain |
| API | Azure Functions v4, Node 20, Flex Consumption | Auto-scales to 0; mirrors existing apps |
| Tables | Azure Table Storage | Append-only telemetry; natural partition/row-key pattern |
| Types | `zod` schemas in `packages/shared` | Single source of truth; frozen after Phase 0 |
| Tests | vitest | Fast, native TS, no ts-node |
| Infra | Bicep + GitHub Actions OIDC | IaC as code; no long-lived secrets |
| CI | GitHub Actions | OIDC federation; `workflow_dispatch` on every workflow |

## Lane ownership

`api/**` = Hermes. `frontend/**` = Claude. `infra/**` + `.github/workflows/**` +
`packages/seed/**` = orchestrator. `packages/shared` is frozen after Phase 0 —
changes via orchestrator coordination commit only.

Commit with explicit paths, never `git add -A`. `wishlist.md` is the single
source of truth for progress.

## Demo script (internal)

See [docs/demo-script.md](docs/demo-script.md) for the 5-slide walkthrough used
in presentations.
