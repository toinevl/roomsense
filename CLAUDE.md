# RoomSense — Project Notes

Showcase app for Terabee room-occupancy sensor data. Full plan: `docs/plan.md`.
Backlog + lane coordination: `wishlist.md` (single source of truth for progress).

## ⚡ Wishlist-First Discipline (Mandatory Pre-Work)

**Rule:** Every work item (code, docs, tests, infrastructure, wiki updates) MUST be on wishlist.md BEFORE work starts. This includes "pure deliverable" docs like architecture diagrams, ADRs, API contracts, and technical specs — if it produces a file or changes a wiki page, it's a work item.

**Why:** wishlist.md is the single source of truth for what's done/in-progress/blocked. Without it:
- Progress is invisible to teammates
- Lane coordination fails (Hermes doesn't know what Claude is doing)
- Duplicates and conflicts emerge
- Status queries require reading git history instead of the backlog

**Process:**
1. **Before starting:** Add item to wishlist with `[ ]` (unchecked)
   - If complex, add sub-tasks immediately
   - Reference lane owner (`@C`, `@H`, `@O`)
2. **While working:** Commit message references the wishlist item: `feat(#36): add modal`
3. **When complete:** Mark `[x]` and add commit SHA(s) in the wishlist line
4. **Before reviewing:** Verify wishlist matches actual work in the commits

**Bad pattern (don't do this):**
```
❌ Write code → Test code → Commit code → Remember to update wishlist → Add item late
```

**Good pattern (do this):**
```
✅ Add to wishlist → Write code → Test code → Commit (reference wishlist) → Mark [x]
```

**Guard:** If you create a file/doc without a corresponding wishlist entry, fix it immediately before pushing.

## Lane ownership (parallel Hermes/Claude work)

`api/**` = Hermes. `frontend/**` = Claude. `infra/**` + `.github/workflows/**` = orchestrator.
`packages/shared` is frozen after Phase 0 — changes only via orchestrator coordination commit.
Always `git status`/`git log` before assuming tree state; commit with explicit paths, never `git add -A`.

## Shared CSS/markup lives in main.css — not an app-specific stylesheet

`frontend/admin/` and the student SPA are two separate Vite entries that both import
`frontend/src/styles/main.css` for markup they share (topbar, brand, nav, status
indicator). `admin.css` (or any future app-specific stylesheet) should only hold rules
for markup that ONLY that app has.

**What happened:** #57 (admin build, 2026-07-23) added `.topbar-status`/`.status-dot`
rules to `admin.css` — correctly noticing the markup was shared with the student app,
but scoping the CSS fix to admin.css only, with a comment admitting "the student app
never styled it either." That left the student app's connectivity dot invisible (0×0,
no color, no spacing) for a week, until Toine noticed the visual difference between the
two topbars and asked for it directly (#58).

**Guard:** Before adding a CSS rule for anything defined in BOTH `index.html` and
`admin/index.html` (topbar, brand, nav, status dot, footer, etc.), check whether it
belongs in `main.css` instead of the app-specific file. If you're scoped to one app
(e.g. "build the admin view") but the gap you're fixing lives in shared markup, either
fix it in `main.css` directly, or — if genuinely out of scope right now — add a `+bug`
wishlist item on the spot. **A code comment admitting a bug in a sibling app is not
sufficient tracking; it must go on wishlist.md or get fixed immediately.**

**The reverse failure also happens — over-broad selectors in `main.css` leaking INTO
the sibling app:** #59's final review (2026-07-30, same day as #58) caught a mobile CSS
rule added to `main.css`'s `@media (max-width: 760px)` block that hid `.primary-nav`
below 760px to make room for a new hamburger menu. Correct for the student app — but
`.primary-nav` is a class, and admin's nav uses the same class with no hamburger to
reveal it again, so admin's entire navigation silently went unreachable on mobile. This
slipped past three task-level implementer+reviewer passes because none of them were
scoped to think about admin at all; it was only caught because a final whole-branch
review ran afterward.

**Guard (reverse direction):** Before editing or adding a rule in `main.css` — especially
inside a media query, or anything toggled by JS (a class added/removed at runtime) —
check whether the selector could also match markup in the OTHER app. Prefer the
`index.html`-only element's `id` (each app's root nav/controls should have a unique id,
not just a shared class) over a bare shared class when the rule should apply to one app
only. Ask explicitly: "does `frontend/admin/` import this file too, and if so, what does
this selector match there?"

**Test-coverage guard:** `frontend/e2e/admin-smoke.spec.ts` must include a test at any
viewport/breakpoint that `main.css` defines responsive behavior for (currently: a
390×844 mobile case, added as part of #59's fix — keep this current as new breakpoints
are added). A shared-stylesheet media-query change with no admin-side test at that same
breakpoint is exactly how the #59 regression went undetected for three review rounds —
admin's suite ran desktop-only (`devices['Desktop Chrome']`) and never crossed 760px.

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

## Interactive UI elements (buttons, selectors) must be implemented, not just styled

"False affordance" = styling that signals interactivity (`cursor: pointer`, hover
effects) without backing behavior. Room Finder shipped with beautiful card styling
but no click handlers, making rooms unchosen. This pattern is invisible to lint
and tests because CSS passes; the app compiles and loads with zero errors.

**Guards:**
- Interactive cards/buttons MUST be `<button>` elements (semantic HTML + keyboard support).
- If styling adds `cursor: pointer`, a unit test MUST verify click handlers exist.
- Dev-mode guard warns if `.room-card` elements aren't buttons.

**Example:** Room cards are buttons in `frontend/src/pages/roomFinder.ts`; clicking
navigates to `#live` with room pre-selected via `sessionStorage`. Test suite
explicitly checks that cards are buttons, not divs.

## Testing conventions

Test fixtures must include real non-ASCII names (ä, ö, å, ç — e.g. `Vergaderzaal
Höganäs`, `Zaal Curaçao`, `Anaïs Dubois`), not just ASCII placeholders. The seed
data is deliberately non-ASCII; a suite that only uses ASCII names cannot catch
encoding bugs that trigger on real content.

**A composed/templated UI string needs a test on the FINAL rendered text, not
just its ingredients.** #60 (2026-08-02): `roomStatus.ts`'s `computeRoomStatus()`
returns an `untilText` field that `overview.ts` renders as
`${STATUS_LABEL[status]} · ${untilText}`. Two of `untilText`'s three branches
redundantly restated the status word ('In use — not booked', 'Free for the rest
of today'), so the rendered text doubled up ("Free · Free for the rest of
today") for 13 of 15 rooms. This shipped with #57 and stayed live for over a
week undetected, because `roomStatus.test.ts` asserted `untilText` alone
(correct in isolation, relative to its own inconsistent definition) and
`overview.test.ts` only asserted the `data-status` attribute (the status KEY,
e.g. `'free'`) — nothing anywhere asserted the actual `.status-line`
`textContent` a user reads. This is the same *shape* of failure as the
false-affordance and CSS-layout incidents already known in this project (tests
pass, the real screen is wrong) — a new variant specific to hand-composed text
templates. **Guard:** when a function returns a string/field that a caller
concatenates with a label/prefix/template into on-screen text, add at least
one test asserting the literal final composed string for each branch — not
just the sub-value in isolation.

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
Smoke tests must tolerate ~60s cold start. Confirm the resource group
(`rgRoomSense`) and subscription before any `az` mutation.
Platform CORS for the SWA hostname is set via `az functionapp cors add` in the
deploy workflow — it is NOT expressible in Bicep and NOT the same as
app-level ALLOWED_ORIGINS.

## API plan: Consumption (Y1/Dynamic), NOT Flex Consumption

The API runs on a Consumption (Y1/Dynamic) plan (WestEuropeLinuxDynamicPlan),
NOT Flex Consumption. Flex Consumption was the original plan (#19) but was
migrated (#39) because its Kestrel front-end short-circuits browser CORS
preflights (OPTIONS with Origin + ACRM headers) with an empty 204 before
function code runs. This broke all cross-origin browser API calls requiring
a preflight — including the presenter-mode /simulate/tick endpoint.

**Deploy method:** `func azure functionapp publish` (func CLI). Do NOT use
`Azure/functions-action@v1` — it uses Kudu zipdeploy internally, which
produced 503 "Function host is not running" on Consumption Linux (host never
started). The func CLI does a proper trigger sync that makes the host
recognize all functions immediately.

**Platform CORS:** On Consumption plan, platform CORS works correctly
(returns proper Access-Control-Allow-* headers on preflight). This is the
opposite of Flex Consumption, where platform CORS had to be cleared.

## API naming & custom domain CORS

**API function app:** `roomsense-api2` (in resource group `rgRoomSense`)
**Custom frontend domain:** `roomsense.van-vliet.eu`

When deploying to a custom domain, the frontend will get "NetworkError when
attempting to fetch resource" if platform CORS is not configured. Fix:

```bash
az functionapp cors add -g rgRoomSense -n roomsense-api2 \
  --allowed-origins https://roomsense.van-vliet.eu
```

Verify preflight succeeds (~5-10s propagation):
```bash
curl -D - -X OPTIONS https://roomsense-api2.azurewebsites.net/api/health \
  -H 'Origin: https://roomsense.van-vliet.eu' \
  -H 'Access-Control-Request-Method: GET'
```

Should see `Access-Control-Allow-Origin: https://roomsense.van-vliet.eu` in headers.

## A new Table Storage table needs provisioning in every environment, not just code

`api/src/lib/tables.ts`'s `TABLE_NAMES` map is a list of tables the code expects
to exist — adding an entry there does not create the table anywhere. This bit
the project twice with the identical root cause: **#45** (sandbox, 2026-07-27 —
`OccupancySnapshots`/`Reservations` were never provisioned, so `/api/kpis` 500'd
on any real date range) and **#38** (production, 2026-08-05 — `UserBookings` was
never provisioned, so `/streak`, `/unlocks`, and `/api/recommendations` all
500'd right after a fully-reviewed, fully-tested merge went live). Both times
the automated test suite was clean: unit tests mock the table client, e2e runs
under `VITE_MOCK=1`, so nothing in CI ever talks to a real Table Storage
account — a provisioning gap is invisible to every layer except a human
manually checking the live site, which is what caught #38.

**Guard (now automated):** `deploy-api.yml`'s "Ensure all Table Storage tables
exist" step runs after every deploy — it parses `TABLE_NAMES` straight out of
`tables.ts` (so it can't drift from the code) and auto-creates any table
missing from that environment's storage account, mirroring `ensureTable()`'s
create-if-missing semantics at the infra layer instead of depending on a human
to remember a manual seed/provisioning step. If you add a new table name, you
do not need to do anything extra — the next deploy provisions it in whichever
environment it targets. Prefer `ensureTable()` over bare `getTableClient()` in
new code that reads/writes a table introduced in the same feature, as a second
line of defense.
