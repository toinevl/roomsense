# ADR-002: Consumption (Y1/Dynamic) Plan Instead of Flex Consumption

Date: 2025-07-23
Status: Accepted

## Context

The RoomSense API runs on Azure Functions. The original plan (wishlist #19) used 
Flex Consumption (FC1). During testing, a critical platform bug was discovered: 
Flex Consumption's Kestrel front-end short-circuits browser CORS preflights.

When a browser sends an `OPTIONS` request with `Origin` + `Access-Control-Request-Method` 
+ ACRM headers, the Flex Consumption Kestrel gateway responds with an empty `204 No 
Content` *before* the function code ever runs. This means:
- No `Access-Control-Allow-Origin` header in the response
- Browser blocks all cross-origin API calls requiring a preflight
- The presenter-mode `/simulate/tick` endpoint (POST with custom header) is completely 
  broken from the browser
- The frontend on `roomsense.van-vliet.eu` cannot call the API at all

## Options Considered

### Option A: Stay on Flex Consumption, work around CORS
- Pros: Flex has better cold-start performance; scale-to-zero with per-instance 
  granularity
- Cons: No viable workaround — the platform intercepts OPTIONS before function code; 
  response cannot be modified from application code; Microsoft confirmed this is 
  platform behavior, not a bug

### Option B: Migrate to Consumption (Y1/Dynamic) Plan
The classic serverless Functions plan.

- Pros: Platform CORS works correctly (returns proper `Access-Control-Allow-*` headers 
  on preflight); same scale-to-zero; `func azure functionapp publish` deploys cleanly; 
  well-documented and battle-tested
- Cons: Slightly worse cold-start than Flex; less granular scaling; `Azure/functions-action@v1` 
  (Kudu zipdeploy) produces 503 "Function host is not running" on Consumption Linux — 
  must use func CLI instead

### Option C: App Service (Dedicated)
Always-on plan with no cold starts.

- Pros: No cold start at all
- Cons: Monthly cost even when idle; overkill for a demo app receiving occasional traffic

## Decision

We chose **Option B: Consumption (Y1/Dynamic) Plan** because it is the only option 
where cross-origin browser API calls work correctly without platform-level workarounds.

## Consequences

**Positive:**
- CORS preflight works correctly out of the box
- Scale-to-zero means zero cost when the demo is not being used
- Platform CORS configured via `az functionapp cors add` — simple, well-documented

**Negative / trade-offs accepted:**
- Cold start latency (~60s on first request after idle) — smoke tests must tolerate this
- Must use `func azure functionapp publish` (func CLI) instead of `Azure/functions-action@v1` 
  (Kudu zipdeploy), which 503s on Consumption Linux
- Per-instance scaling is less granular than Flex

**Risks:**
- Cold start may cause poor first-impression in demos; mitigated by presenter mode 
  and health-ping warm-up on page load
- The func CLI dependency means CI must run on a runner with the Azure Functions 
  tooling installed

## References

- [ADR-003](ADR-003-func-cli-deploy.md) — why func CLI, not Kudu zipdeploy
- Wishlist #19 (original Flex plan), #39 (migration to Consumption)
- [CLAUDE.md](../../CLAUDE.md) — deploy verification instructions
