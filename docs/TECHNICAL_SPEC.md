# Feature: RoomSense Platform

## Problem Statement

Organizations deploying Terabee people-counting sensors need a way to demonstrate 
the value of occupancy data to two distinct audiences simultaneously:
1. **C-level executives** who care about utilization rates, wasted real-estate spend, 
   and ghost meetings (booked but empty rooms)
2. **Technical operators** who need live telemetry, sensor health, and raw data access

Without a working demo dashboard, sensor data is invisible to decision-makers and 
the API contract cannot be validated before real hardware is attached.

## Scope

### In scope
- C-level dashboard with KPI tiles (avg/peak utilization, ghost rate, wasted euros, 
  busiest building) and 30-day trend charts
- Live telemetry view with per-room occupancy grid, polling every 10s
- Architecture page showing the full system (Terabee → LoRa → IoT Hub → Databricks 
  production path, plus the demo path via Table Storage)
- Room finder with interactive room cards (click-to-select, navigate to live view)
- Semester-in-review report page
- Trust & transparency metrics page
- RoomSense Wrapped (gamified year-in-review)
- Social features: friend links, user presence, room reviews with ratings/tags
- Privacy settings page (location sharing, friend visibility, review attribution, 
  data retention)
- Mock mode: entire app works with zero backend (deterministic in-browser seed data)
- Presenter mode: auto-tick the demo clock every 30s for live presentations
- Source adapter seam: pluggable interface for data sources (outlook-mock shipped, 
  Terabee IoT Hub future)

### Out of scope (explicitly)
- Real Terabee hardware integration (LoRa → IoT Hub → Databricks path shown but not built)
- Real Microsoft Graph calendar integration (outlook-mock adapter simulates it)
- User authentication / identity (all endpoints anonymous for demo)
- WebSocket / SignalR real-time push (polling is sufficient for demo scale)
- Mobile native app (responsive web only)
- Multi-tenant organization isolation

## Design

### Architecture overview

Three tiers, all in Azure West Europe (rgRoomSense):

1. **Frontend** — Azure Static Web App (Free tier). Vite + TypeScript SPA, no 
   framework. Hash-based router with 11 pages. Dual-mode ApiClient: fetch against 
   live Functions API, or compute in-browser from seed data — same interface.
2. **API** — Azure Functions v4 (Node 22, TypeScript). Consumption (Y1/Dynamic) 
   plan. 12 endpoints, all anonymous. SourceAdapter registry for pluggable data 
   sources. Bundled deploy package (esbuild) to avoid workspace dependency issues.
3. **Storage** — Azure Table Storage. 9 tables. Connection string locally 
   (Azurite), managed identity in cloud. Deterministic seed: 15 rooms, 43k readings, 
   1.3k reservations, social fixtures.

Cross-cutting:
- **packages/shared** — zod schemas defining all domain types. Frozen after Phase 0. 
  Single source of truth for API, frontend, and seed.
- **packages/seed** — deterministic mock-data generator + Azure uploader
- **infra/** — Bicep IaC (storage, functions, SWA, App Insights)
- **.github/workflows/** — CI (typecheck + test), deploy-api (func CLI), 
  deploy-frontend (SWA), all with OIDC federation (no long-lived secrets)

### Data model

All types defined in `packages/shared/src/types.ts` as zod schemas:

```typescript
// Core telemetry
SensorReading   { deviceId, ts, countIn, countOut, flags, batteryPct, rssi, snr, sourceId }
Room            { roomId, building, floor, name, capacity, deviceId, outlookAddress, sourceId }
Reservation     { roomId, subject, organizer, startTs, endTs, attendeeCount, sourceId }
OccupancySnapshot { roomId, ts, occupancy, utilizationPct, intervalMinutes: 15 }
Source          { sourceId, displayName, kind: 'sensor'|'calendar', status, lastSyncTs }

// Social (Phase 2)
FriendLink      { userId, friendId, friendName, status, canSeeLive, connectedAt }
UserPresence    { userId, displayName, building, roomId?, status, lastSeenTs }
RoomReview      { reviewId, roomId, authorId, authorName, rating: 1-5, title, body, tags[], helpfulCount, status, createdAt, updatedAt }
PrivacySettings { userId, locationSharingEnabled, friendVisibility, reviewAttributionDefault, dataRetentionDays, lastUpdated }
```

Table Storage partition/row key design:

| Table | PartitionKey | RowKey | Notes |
|-------|-------------|--------|-------|
| Rooms | building | roomId | |
| SensorReadings | deviceId | deviceId-ts | Reverse chron per device |
| OccupancySnapshots | roomId | roomId-ts | Time-range queries by room |
| Reservations | roomId | roomId-startTs | |
| Sources | source | sourceId | |
| UserPresence | building | userId | |
| FriendLinks | userId | friendId | |
| RoomReviews | roomId | reviewId | Tags stored as JSON string |
| UserPrivacy | userId | settings | |

### Source adapter seam

```typescript
interface SourceAdapter {
  readonly sourceId: string
  readonly kind: 'sensor' | 'calendar'
  readonly displayName: string
  ping(): Promise<PingResult>
  listReservations?(window: ReservationWindow): AsyncIterable<Reservation>
}
```

The API reads from adapters, never from storage directly for source-derived data. 
Adding a source = new file in `src/sources/` + register in `registry.ts`. No API 
endpoint changes. Currently registered: `outlook-mock` (calendar source).

### Azure resources

| Resource | Name | Tier |
|----------|------|------|
| Resource Group | rgRoomSense | West Europe |
| Storage Account | roomsensestorage | LRS, Table Storage |
| Function App | roomsense-api2 | Consumption (Y1/Dynamic) |
| Static Web App | roomsense-swa | Free |
| Application Insights | roomsense-appi | Standard |

Platform CORS is configured via `az functionapp cors add` (not expressible in Bicep).

### API contract

See [docs/API_CONTRACT.md](API_CONTRACT.md) for full endpoint specifications.

12 endpoints: health, rooms, occupancy, readings, reservations, kpis, sources, 
presence, friends, reviews (GET + POST), privacy (GET + PATCH), simulate/tick.

### Frontend architecture

- No framework — vanilla TypeScript with a Page interface (mount/unmount)
- Hash-based router (`#dashboard`, `#live`, etc.)
- ApiClient interface with two implementations behind one interface:
  - `fetchClient` — real HTTP calls to the Functions API
  - `makeMockClient()` — deterministic in-browser computations from seed data
- Switching modes triggers a hard reload (every page re-renders against new client)
- Presenter mode: 30s interval calling `POST /simulate/tick` (live) or 
  `tickMockClock()` (mock)

### CI/CD

- **ci.yml** — typecheck + test across all packages on every PR
- **deploy-api.yml** — `func azure functionapp publish` (NOT Kudu zipdeploy), 
  then `az functionapp cors add`, then health check
- **deploy-frontend.yml** — SWA publish profile, then bundle verification
- All workflows use OIDC federation — no long-lived Azure secrets in GitHub

## Implementation Plan

Phased delivery (wishlist-tracked):

1. **Phase 0 (shipped)** — scaffold, shared types, seed generator, Azurite upload
2. **Phase 1 (shipped)** — Azure Functions API: 7 core endpoints + registration guard
3. **Phase 1.5 (shipped)** — Vite SPA: dashboard, live, architecture, room finder
4. **Phase 1.7 (shipped)** — Bicep infra + CI + deploy workflows + OIDC
5. **Phase 1.8 (shipped)** — provision + deploy + seed Azure + e2e verify
6. **Phase 2 (shipped)** — social features: friends, presence, reviews, privacy, 
   wrapped, trust, report, booking-success
7. **Phase 2.5 (shipped)** — outlook-mock SourceAdapter (#23)
8. **Next** — reservations overlay timeline (#24), additional source adapters

## Testing Plan

- **Unit tests (vitest)**: 80+ tests across api, frontend, shared, seed
  - API: per-endpoint tests, registration guard (every function imported in index.ts)
  - Frontend: page tests, chart math, mock derivations, reading deltas, room freshness
  - Shared: zod schema validation, row-key helpers
  - Seed: deterministic generation, non-ASCII fixture coverage
- **E2E (Playwright)**: 22 smoke tests covering core user flows
- **Manual verification**: presenter mode walkthrough (5-slide demo script)
- **Deploy verification**: `gh run watch` + smoke test with 60s cold-start tolerance

## Open Questions

- [ ] When will real Terabee hardware be attached? (Determines whether to build the 
  IoT Hub ingestion path next)
- [ ] Should the simulator key (`x-sim-key`) be replaced with Entra ID auth for 
  production use?
- [ ] Data retention: currently defaults to 1 day for privacy settings — is this 
  appropriate for demo purposes?

## Not Decided Yet

- Multi-organization support (currently single-tenant demo)
- Real-time push (WebSocket/SignalR) vs continued polling
- Whether to add user authentication for the social features (currently anonymous)
- Mobile native app vs continued responsive web approach
