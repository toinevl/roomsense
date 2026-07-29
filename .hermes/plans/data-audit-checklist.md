# RoomSense Research: Data & Technical Readiness Audit

**Purpose:** Verify technical prerequisites for each UI strategy before design/dev phase  
**Timeline:** 2 days (items marked 🏃 = < 1 hour, items marked 📋 = < 2 hours)  
**Owners:** Claude (frontend), Hermes (API/backend), Orchestrator (infra)  
**Output:** Blocking issues → blocklist; green items → proceed with confidence

---

## Strategy 1: Mobile-First Booking

**Goal:** Enable spontaneous room booking from mobile devices (phone/tablet). Requires fast, responsive UX + reliable API performance.

### Frontend Readiness

#### 1.1 Mobile-First Vite Config & Responsive Design
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Current Vite config tested on mobile viewports (320px–480px)?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Dashboard, Live, and Architecture pages render without horizontal scroll on mobile?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Forms (if any) are touch-friendly (input size ≥ 48px)?

**Owner:** Claude (frontend)  
**Blocking Issue?** [ ] Critical [ ] Major [ ] Minor [ ] None  
**If blocked:** Requires responsive redesign; estimate 2–3 dev days  
**Evidence:** Run `pnpm build` and screenshot the dashboard on a Pixel 6 / iPhone 14 viewport

---

#### 1.2 API Response Time (Mobile Network Conditions)
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — `GET /api/rooms` returns in < 2s on a 3G-simulated network (Chrome DevTools throttling)?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Booking API endpoints (if new) < 1.5s latency, even during cold start?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Client has retry logic for transient failures (e.g., timeout on mobile)?

**Owner:** Hermes (API) + Claude (client error handling)  
**Blocking Issue?** [ ] Critical [ ] Major [ ] Minor [ ] None  
**If blocked:** Requires API optimization (caching, batch queries) or client-side retry/fallback; estimate 1–2 dev days  
**Evidence:** Browser DevTools Network tab showing response times; client code showing retry logic

---

### Analytics & A/B Testing Infrastructure

#### 1.3 Event Instrumentation for Mobile Booking Flows
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Frontend has analytics client library loaded (e.g., Segment, GTM, or custom logger)?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Can track "booking initiated," "booking completed," "booking abandoned" events?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Can segment analytics by device (mobile vs. desktop)?

**Owner:** Claude (frontend) + Orchestrator (analytics config)  
**Blocking Issue?** [ ] Critical [ ] Major [ ] Minor [ ] None  
**If blocked:** Requires analytics setup; if none exists, estimate 1 dev day  
**Evidence:** Check `frontend/src/config.ts` or analytics constants for tracking service config

---

#### 1.4 Mobile/Desktop Traffic Split
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Current analytics (if any) show mobile vs. desktop breakdown?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Baseline: % of users accessing from mobile device?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Baseline: bounce rate or session duration on mobile vs. desktop?

**Owner:** Orchestrator (analytics / reporting)  
**Blocking Issue?** [ ] Critical [ ] Major [ ] Minor [ ] None  
**If blocked:** No analytics data available; proceed without baseline (risks incorrect prioritization); estimate 1 week for production data  
**Evidence:** Shared analytics dashboard or spreadsheet with 2-week aggregate

---

## Strategy 2: Social Presence ("Who Else Is Booking?")

**Goal:** Show users who else has booked or is currently in a room. Requires user identity, booking history tracking, and privacy guardrails.

### User Identity & Session Management

#### 2.1 User Identity System
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — App currently requires user login (e.g., Entra, OAuth)?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — If not logged in, is there a session cookie or anonymous user ID (UUID)?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — User identity persists across page reloads?

**Owner:** Claude (frontend) + Hermes (API auth)  
**Blocking Issue?** [ ] Critical [ ] Major [ ] Minor [ ] None  
**If blocked:** **CRITICAL** — Social presence requires user identity. Options: (a) add login flow (2–3 dev days), (b) use anonymous UUID (1 dev day, less privacy risk). Recommend (b) for demo.  
**Evidence:** Check `frontend/src/lib/api.ts` and API auth middleware for user ID handling

---

#### 2.2 Booking History & Presence Tracking
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — API can record "user X booked room Y at time Z"?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — API can query "which users are currently in room Y" or "who booked room Y in the last 24h"?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Database schema supports user-to-room associations (e.g., Bookings table)?

**Owner:** Hermes (API) + Orchestrator (schema)  
**Blocking Issue?** [ ] Critical [ ] Major [ ] Minor [ ] None  
**If blocked:** Requires new Bookings table + API endpoints. Estimate 2–3 dev days.  
**Evidence:** Check `packages/shared/src/types.ts` for Booking type; check `api/src/functions/` for booking-related endpoints

---

#### 2.3 Activity Feed / Presence Display
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Frontend can render a list of users in a room (e.g., avatars, names)?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Can distinguish between "booked" and "actually present" (if sensors or manual check-in exist)?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Real-time updates (WebSocket or polling) to show when users join/leave?

**Owner:** Claude (frontend) + Hermes (real-time API)  
**Blocking Issue?** [ ] Critical [ ] Major [ ] Minor [ ] None  
**If blocked:** Requires WebSocket upgrade or polling refactor. Estimate 2 dev days. Fallback: static list updated on page reload (1 dev day, UX impact).  
**Evidence:** Check `frontend/src/pages/live.ts` for real-time data handling

---

### Privacy & Compliance

#### 2.4 Privacy / GDPR Compliance
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Legal team has reviewed whether displaying user presence violates privacy policies?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Can users opt out of presence visibility (e.g., "show me as anonymous")?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Data retention policy defined (e.g., delete booking history after 30 days)?

**Owner:** Orchestrator (legal/compliance) + Hermes (data deletion)  
**Blocking Issue?** [ ] Critical [ ] Major [ ] Minor [ ] None  
**If blocked:** **CRITICAL for production.** For demo: document as "internal demo data only, not for production"; estimate 2–4 weeks for full compliance audit.  
**Evidence:** Check `infra/RECOVERY.md` or legal docs for privacy statement

---

#### 2.5 FERPA Compliance (for Student Data)
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — If student names/IDs are shown, does this violate FERPA (US) or equivalent?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Can show non-identifying data (e.g., "3 people in this room") without names?

**Owner:** Orchestrator (legal)  
**Blocking Issue?** [ ] Critical [ ] Major [ ] Minor [ ] None  
**If blocked:** Recommend showing aggregate counts ("3 people") instead of named list for MVP; estimate 1 dev day.  
**Evidence:** Check TU/e data governance / legal guidance

---

## Strategy 3: AI Recommendations ("Book This Room Instead")

**Goal:** Suggest optimal rooms based on user preferences, availability, and occupancy patterns. Requires historical data + ML pipeline.

### Historical Data & Training Set

#### 3.1 Data Volume (≥8 Weeks Clean)
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Do we have 8+ weeks of occupancy snapshots (daily, no gaps)?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Do we have 8+ weeks of booking/reservation data (who booked what, when)?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Data is labeled (e.g., "this booking was ghost / was legitimate") or inferred from occupancy?

**Owner:** Hermes (data validation) + Orchestrator (data retention)  
**Blocking Issue?** [ ] Critical [ ] Major [ ] Minor [ ] None  
**Current status (as of 2026-07-19):** ~30 days of seeded data + 1 week of real TU/e sensor data; estimate 3–4 weeks to accumulate 8+ weeks at production velocity.  
**If blocked:** Recommendation engine cannot be trained; fallback to simple rules (e.g., "book the largest room with lowest occupancy"). Estimate 1 dev day for rule-based MVP.  
**Evidence:** Check `api/src/functions/kpis.ts` for data range queries; verify row counts in Azure Tables

---

#### 3.2 Feature Engineering (Room Attributes)
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Room schema includes capacity, floor, building, amenities (e.g., "projector", "whiteboard")?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Occupancy data includes time-of-day, day-of-week, is_holiday flags?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — User booking history captured (e.g., "Alice always books quiet rooms at 2 PM")?

**Owner:** Hermes (API) + Orchestrator (schema)  
**Blocking Issue?** [ ] Critical [ ] Major [ ] Minor [ ] None  
**If blocked:** Feature-starved model; recommend focusing on occupancy + capacity only for MVP. Estimate 2 dev days to add user preference tracking.  
**Evidence:** Check `packages/shared/src/types.ts` for Room and Reservation schemas

---

### ML Infrastructure & Tooling

#### 3.3 ML Training Pipeline (Local or Cloud)
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Do we have a Jupyter notebook or Python script for training a recommendation model?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Is there a cloud ML service configured (e.g., Azure ML, Databricks)?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Can we export a trained model to a format the API can load (e.g., ONNX, joblib, TensorFlow.js)?

**Owner:** Hermes (API inference) + Orchestrator (ML ops)  
**Blocking Issue?** [ ] Critical [ ] Major [ ] Minor [ ] None  
**If blocked:** Recommend lightweight Python+sklearn approach (1 dev week to train + integrate). Fallback: rule-based recommendations (heuristics, no ML).  
**Evidence:** Check `api/src/` for any ML model files or inference code

---

#### 3.4 Real-Time Inference Latency
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Can recommendation model run on-demand when user opens booking page (< 500ms)?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Model is embedded in the API or called via an external service?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Fallback available if model is slow/unavailable (e.g., show generic recommendations)?

**Owner:** Hermes (API)  
**Blocking Issue?** [ ] Critical [ ] Major [ ] Minor [ ] None  
**If blocked:** Pre-compute recommendations (batch job hourly) instead of real-time; estimate 1 dev day.  
**Evidence:** Performance test of model load + inference; check `api/src/functions/recommend.ts` (if exists)

---

### User Preferences & Personalization

#### 3.5 User Preference Tracking
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — API can record user preferences (e.g., "I prefer quiet rooms near building X")?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Frontend has a preferences UI (e.g., settings modal)?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Preferences inform recommendations (e.g., model re-ranks based on user settings)?

**Owner:** Claude (frontend) + Hermes (API)  
**Blocking Issue?** [ ] Critical [ ] Major [ ] Minor [ ] None  
**If blocked:** Recommend starting with no personalization (generic recommendations for all users); add preferences in a follow-up phase. Estimate 2 dev days.  
**Evidence:** Check for UserPreferences table in schema; check `frontend/src/pages/settings.ts` (if exists)

---

#### 3.6 Cold-Start Problem (New Users)
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — How do we recommend for users with no booking history?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Fallback strategy defined (e.g., show popular rooms, or rooms matching room size to group size)?

**Owner:** Hermes (recommendation logic)  
**Blocking Issue?** [ ] Critical [ ] Major [ ] Minor [ ] None  
**If blocked:** Recommend using content-based filtering (room attributes) for cold-start; estimate 1 dev day.  
**Evidence:** Check `api/src/functions/recommendations.ts` for cold-start handling (if exists)

---

## Cross-Strategy: Data Quality

#### Q: Are occupancy sensors reliable? (All strategies depend on this)
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Sensor data has < 10% missing/null values in the last 4 weeks?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Sensor data is within expected range (occupancy ≤ room capacity)?
- [ ] **YES** / [ ] **PARTIAL** / [ ] **NO** — Sensor data is synced and real-time (no stale readings > 1 hour old)?

**Owner:** Hermes (data validation) + Orchestrator (sensor ops)  
**Blocking Issue?** [ ] Critical [ ] Major [ ] Minor [ ] None  
**If blocked:** All three strategies suffer; do NOT proceed until sensor reliability is verified. Estimate 1 week for sensor diagnostics.  
**Evidence:** Check `api/src/functions/health.ts` for sensor health checks; run `SELECT COUNT(*), COUNT(occupancy) FROM OccupancySnapshots` to find nulls

---

## Audit Summary Table

| Strategy | Readiness | Blocking Issues | Owner | Est. Work to Unblock |
|----------|-----------|-----------------|-------|---------------------|
| **Strategy 1 (Mobile-first)** | [ ] Ready [ ] Partial [ ] Blocked | [List] | Claude / Hermes | [Days] |
| **Strategy 2 (Social presence)** | [ ] Ready [ ] Partial [ ] Blocked | [List] | Hermes / Claude | [Days] |
| **Strategy 3 (AI recommendations)** | [ ] Ready [ ] Partial [ ] Blocked | [List] | Hermes | [Days] |

---

## Recommended Action Path

**Scenario A: All three strategies are GREEN**
→ Proceed immediately to design + development phase. Parallelization recommended: Strategy 1 (frontend only) + Strategy 2 (API + frontend) + Strategy 3 (backend only).

**Scenario B: Strategy 1 GREEN, Strategy 2 YELLOW, Strategy 3 RED**
→ Start Strategy 1 immediately. Unblock Strategy 2 in parallel (add user identity if missing). Defer Strategy 3 to after 8 weeks of data accumulation.

**Scenario C: Any strategy is CRITICAL**
→ Fix blocking issues before starting any development. Example: no sensor data → fix sensors before designing anything.

---

## Next Steps

1. **This week:** Complete the checklist (assign items to owners; target < 3 hours).
2. **By end of week:** Identify the top 2–3 blocking issues (if any) and assign an owner + ETA to fix.
3. **Gate design phase:** Do not start designs until at least Strategy 1 is GREEN and Strategy 3 data gaps are acknowledged (with a go/no-go date).
