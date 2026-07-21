# RoomSense — Project Notes

Showcase app for Terabee room-occupancy sensor data. Full plan: `docs/plan.md`.
Backlog + lane coordination: `wishlist.md` (single source of truth for progress).

## Lane ownership (parallel Hermes/Claude work)

`api/**` = Hermes. `frontend/**` = Claude. `infra/**` + `.github/workflows/**` = orchestrator.
`packages/shared` is frozen after Phase 0 — changes only via orchestrator coordination commit.
Always `git status`/`git log` before assuming tree state; commit with explicit paths, never `git add -A`.

## New frontend pages MUST be in THREE places

When adding a new page to the frontend, **three files must change** or the page
will be unreachable or invisible:

1. **Create** `frontend/src/pages/newPage.ts` — the page component
2. **Modify** `frontend/src/main.ts` — import and register the route in the `routes` object
3. **Modify** `frontend/index.html` — add a `<a>` link in `<nav class="primary-nav">` 
   with `href="#routeName"` and `data-route="routeName"` attributes

(A guard in main.ts warns in dev if a route has no nav link; CI does not catch this.)

## New API functions MUST be imported in api/src/index.ts

The Azure Functions v4 programming model only registers functions whose module
actually gets imported. A new file in `api/src/functions/` that isn't imported
in the entry point compiles, tests and deploys green while its endpoint 404s in
production (this shipped three dead endpoints at once in a sibling project).
Keep a guard test in `api/src/index.test.ts` asserting every non-test module in
`src/functions/` is imported.

## Testing conventions

Test fixtures must include real non-ASCII names (ä, ö, å, ç — e.g. `Vergaderzaal
Höganäs`, `Zaal Curaçao`, `Anaïs Dubois`), not just ASCII placeholders. The seed
data is deliberately non-ASCII; a suite that only uses ASCII names cannot catch
encoding bugs that trigger on real content.

## HTTP response headers must be ASCII-only

The Azure Functions host rejects non-ASCII bytes in response header values
(`System.InvalidOperationException`). Never put room names or other free text
in a header — body only.

## Terabee data model (why the fields look like this)

Field names mirror Terabee's official `pcl_lora_payload_decoder`: cumulative
`count_in`/`count_out` (uint32) per uplink, daily counter reset (here: 04:00 UTC).
Occupancy is derived as `countIn - countOut`, clamped ≥ 0. Ghost meetings are
DERIVED (reservation slot with max occupancy 0), never stored — the seed's
internal ghost flag is deliberately not uploaded.

## Verifying a deploy

A successful `git push` does not mean the deploy succeeded — check the run:
`gh run list --workflow=<wf> --limit 1` then `gh run watch <id> --exit-status`.
Smoke tests must tolerate ~60s Flex Consumption cold start. Confirm the
resource group (`rgRoomSense`) and subscription before any `az` mutation.
Platform CORS for the SWA hostname is set via `az functionapp cors add` in the
deploy workflow — it is NOT expressible in Bicep and NOT the same as
app-level ALLOWED_ORIGINS.
