# ADR-003: Deploy with func CLI, Never Kudu zipdeploy

Date: 2025-07-23
Status: Accepted

## Context

RoomSense API runs on Azure Functions Consumption (Y1/Dynamic) plan on Linux. 
The standard GitHub Actions deploy approach for Functions is 
`Azure/functions-action@v1`, which internally uses Kudu zipdeploy. On Consumption 
Linux, this deploy method produces `503 "Function host is not running"` — the 
host never starts and no endpoint is reachable.

## Options Considered

### Option A: Azure/functions-action@v1 (Kudu zipdeploy)
The "standard" GitHub Actions approach.

- Pros: One-step action; widely documented; handles ZIP packaging automatically
- Cons: 503 on Consumption Linux — host never starts; trigger sync does not happen; 
  endpoints 404 even after "successful" deploy

### Option B: func CLI (`func azure functionapp publish`)
The Azure Functions Core Tools CLI.

- Pros: Proper trigger sync — host recognizes all functions immediately; reliable on 
  Consumption Linux; battle-tested across many projects
- Cons: Requires installing Azure Functions Core Tools on the CI runner; slightly 
  more setup than a one-line action; deploy logs are verbose

### Option C: Container deploy
Deploy a custom container image.

- Pros: Full control over runtime environment
- Cons: Massive overkill for a Node.js Functions app; container build + registry 
  overhead; different billing model

## Decision

We chose **Option B: func CLI** because it is the only method that reliably starts 
the Functions host on Consumption Linux and makes all endpoints reachable immediately 
after deploy.

## Consequences

**Positive:**
- All endpoints are live immediately after deploy — no "ghost" 404s
- Trigger sync happens during the publish operation
- Reliable across Consumption, Flex, and App Service plans

**Negative / trade-offs accepted:**
- CI runner needs `func` CLI installed (handled via setup step in workflow)
- Deploy is not a single GitHub Action — it's a multi-step script (build → bundle → 
  publish → CORS update → health check)

**Risks:**
- If the func CLI version doesn't match the Functions runtime version, deploy may 
  fail silently — pinned to Node 22 / func 4.x

## References

- Wishlist #19, #22 — provision + deploy
- [DEPLOY_CHECKLIST.md](../../DEPLOY_CHECKLIST.md) — step-by-step deploy procedure
- [CLAUDE.md](../../CLAUDE.md) — "Verifying a deploy" section
