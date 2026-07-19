# RoomSense

Showcase application for room-occupancy sensing: Terabee People-Counting sensor
data (mocked in Azure Table Storage, modeled on Terabee's official LoRa payload
decoder) presented for two audiences — a C-level utilization/cost dashboard and
a technical live-telemetry view.

- **Plan:** `docs/plan.md`
- **Backlog / progress:** `wishlist.md`
- **Conventions:** `CLAUDE.md`

## Layout

| Path | What |
|---|---|
| `packages/shared` | Domain types (zod) + Table Storage row-key helpers |
| `packages/seed` | Deterministic mock-data generator + Azurite/Azure uploader |
| `api` | Azure Functions v4 (Node 20/TS) API — lane: Hermes |
| `frontend` | Vite + TS SPA — lane: Claude |
| `infra` | Bicep + deployment docs — lane: orchestrator |

## Quick start

```bash
pnpm install
pnpm test                 # all workspace tests
npx azurite-table --location /tmp/azurite &   # local tables
pnpm seed:local           # generate + upload 30 days of mock data
```
