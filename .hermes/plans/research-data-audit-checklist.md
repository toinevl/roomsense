# RoomSense Research Validation: Data Audit Checklist

**Objective:** Verify technical readiness for each strategy before design/prototyping begins.  
**Owner:** Hermes (backend/infra) + Claude (frontend) + Tonie (product)  
**Timeline:** Tue–Wed (48 hours)

---

## STRATEGY 1: MOBILE-FIRST TAP-TO-BOOK

### Frontend Infrastructure

- [ ] **Vite config supports mobile viewport meta tag**
  - Check: `frontend/index.html` has `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`
  - Status: ✅ YES (confirmed in index.html line 5)

- [ ] **CSS framework supports touch-first design (48px tap targets)**
  - Check: Can we define touch-safe sizes in `frontend/src/styles/main.css`? Any conflicts with current grid/flex?
  - Status: ⚠️ PARTIAL (current design uses variable sizes; need audit of button/card sizes)
  - Owner: Claude
  - Effort: 1 dev-day (standardize tap target sizes, test on mobile)

- [ ] **Mobile analytics instrumentation exists**
  - Check: Do we track page load time, tap interactions, booking flow completion?
  - Status: ❌ NO (no analytics currently; Vite build has no event tracking)
  - Owner: Hermes / Claude
  - Effort: 3 dev-days (add event tracking library like Plausible or gtag, instrument booking flow)
  - **Blocking?** YES — can't measure A/B test success without analytics
  - Workaround: Use browser DevTools network tab during first test; upgrade analytics before full A/B test

- [ ] **Current mobile/desktop traffic split known**
  - Check: Does SWA analytics show mobile vs. desktop breakdown?
  - Status: ❓ UNKNOWN
  - Owner: Tonie (check SWA insights portal)
  - Effort: 30 min (read SWA dashboard)
  - **Blocking?** NO — nice-to-have for prioritization, not a blocker
  - Action: Check this week; informs whether mobile redesign is priority 1 or 2

### API Performance

- [ ] **GET /rooms latency < 2s on mobile network**
  - Check: Test on 3G throttle in Chrome DevTools; measure baseline
  - Status: ❓ UNKNOWN
  - Owner: Hermes
  - Effort: 1 dev-day (profile, identify bottlenecks, optimize if needed)
  - **Blocking?** YES — mobile UX fails if API is slow
  - Baseline: Measure this week; target <2s for production

---

## STRATEGY 2: SOCIAL PRESENCE & NETWORK EFFECTS

### User Identity System

- [ ] **User identity exists or can be mocked for testing**
  - Check: Can we identify which user is making requests? (User ID, session, or anonymous ID)
  - Current state: Mock mode has no user context; API doesn't track user source
  - Status: ❌ NO (but not blocking for MVP mock testing)
  - Owner: Hermes
  - Effort: 2 dev-days (add user ID to booking context, either via header or session)
  - **Blocking?** NO for prototype/testing; YES for production
  - Workaround: Use browser tab identity (cookie) for MVP testing; upgrade to real auth later

- [ ] **User action tracking (bookings, views, ratings)**
  - Check: Can we log "user X booked room Y at 2:30pm"?
  - Status: ❌ NO (Reservations table exists but doesn't track user source)
  - Owner: Hermes
  - Effort: 2 dev-days (add UserId field to booking/activity events)
  - **Blocking?** YES — need this for presence and recommendations
  - Action: Add to #37 implementation plan

- [ ] **Notification infrastructure (email, push, in-app)**
  - Check: Can we send "Jane booked a room" notifications?
  - Status: ❌ NO (no notification system)
  - Owner: Hermes
  - Effort: 3-5 dev-days (email provider, push service, notification queue)
  - **Blocking?** YES for full feature; NO for MVP (can show in-app only)
  - Workaround: MVP shows presence in-app only; notifications phase 2

### Privacy & Legal

- [ ] **GDPR/FERPA compliance reviewed**
  - Check: Can we store user location/booking history? Must consent be explicit?
  - Status: ❓ UNKNOWN (Tonie to review with legal/compliance)
  - Owner: Tonie
  - Effort: 2-3 hours (legal review)
  - **Blocking?** YES — cannot ship social features without legal OK
  - Action: Schedule legal review this week; prepare summary of what data we'd track

- [ ] **Consent/opt-in UI design**
  - Check: Do we need explicit consent ("Turn on Friend Presence")?
  - Status: ❓ UNKNOWN (depends on legal review)
  - Owner: Claude (design) + Tonie (legal)
  - Effort: 1-2 dev-days (if required)
  - **Blocking?** NO, but required before any data collection

- [ ] **Data retention policy**
  - Check: How long do we store presence/booking history? 7 days? 30 days? Forever?
  - Status: ❓ UNKNOWN
  - Owner: Tonie (policy) + Hermes (implementation)
  - Effort: 1 dev-day (once policy decided)
  - **Blocking?** YES — must define before shipping

### Data Storage

- [ ] **Can we store user preferences/bookings in Table Storage**
  - Check: Can we add a new table (e.g., UserBookingHistory) to Azure?
  - Status: ✅ YES (schema already proven with Reservations/OccupancySnapshots)
  - Owner: Hermes
  - Effort: 1 dev-day (new table + seed script)

---

## STRATEGY 3: AI RECOMMENDATIONS & GAMIFICATION

### Historical Data Availability

- [ ] **≥8 weeks clean occupancy data available**
  - Current: 30 days seed data (fictional) + ~7 days real TU/e data (2026-07-14 onward)
  - Status: ⚠️ PARTIAL (need 4+ more weeks of real data to train ML)
  - Owner: Hermes
  - Timeline: Data will be ready ~2026-08-25 (8 weeks from 2026-07-19 deployment)
  - **Blocking?** YES for full ML model; NO for rule-based MVP
  - Workaround: Start with rule-based recommendations ("most popular room this hour") week 1; upgrade to ML week 5

- [ ] **User booking patterns identifiable (do users repeat?)**
  - Check: Do students typically book the same room? Same time of day?
  - Status: ❓ UNKNOWN (need to analyze existing reservations)
  - Owner: Hermes
  - Effort: 1 dev-day (data exploration: query Reservations, find repeat bookers)
  - **Blocking?** NO (if patterns are weak, fallback to aggregate recommendations)
  - Action: Analyze existing 7-day TU/e data this week; report findings

- [ ] **Feature for storing user preferences**
  - Check: Can we save "favorite rooms", "quiet pods preference", etc.?
  - Status: ❓ UNKNOWN (no UserPreferences table yet)
  - Owner: Hermes
  - Effort: 1-2 dev-days (new table + seed + API endpoints)
  - **Blocking?** NO for MVP (can derive preferences from booking history)

### ML Infrastructure

- [ ] **ML model framework available (TensorFlow, scikit-learn, LightGBM)**
  - Check: What's available in the monorepo? Any existing ML code?
  - Status: ❌ NO (no ML stack currently)
  - Owner: Hermes / Claude (@ML engineer if hiring)
  - Effort: 3-5 dev-days (set up Python/ML environment, train first model)
  - **Blocking?** YES for full ML; NO for rule-based MVP
  - Workaround: Start with rule-based (1 dev-day); add ML models in week 5 when data is ready

- [ ] **Model versioning & deployment pipeline**
  - Check: Can we train a model, version it, deploy it to production?
  - Status: ❌ NO (no infrastructure yet)
  - Owner: Hermes / Orchestrator
  - Effort: 2-3 dev-days (MLOps: model registry, container, deployment automation)
  - **Blocking?** YES for production; can skip for prototype

- [ ] **Prediction API endpoint (GET /api/rooms/{id}/prediction)**
  - Check: Can API expose ML model predictions (occupancy forecast, match score)?
  - Status: ❌ NO (needs new endpoint + model serving)
  - Owner: Hermes
  - Effort: 2 dev-days (once model exists)
  - **Blocking?** YES for full feature

### Data Quality

- [ ] **Sensor data quality (no gaps, no anomalies)**
  - Check: Are occupancy readings continuous? Any 24-hour gaps? Outliers (e.g., 1000 people in 80-cap room)?
  - Status: ⚠️ PARTIAL (real TU/e data clean so far, but only 7 days; watch for weekend patterns)
  - Owner: Hermes
  - Effort: 1 dev-day (data profiling; ongoing monitoring)
  - **Blocking?** NO (recommendations degrade gracefully with noisy data)

- [ ] **Occupancy ground truth validation**
  - Check: Can we spot-check sensor readings against actual room usage? (e.g., ask facilities)
  - Status: ❓ UNKNOWN
  - Owner: Tonie (coordinate with facilities)
  - Effort: 2 hours (spot checks)
  - **Blocking?** NO (but important for trust)

---

## Cross-Cutting Concerns

### Analytics & Metrics

- [ ] **Event tracking infrastructure for A/B tests**
  - Applies to: All 3 strategies (need baseline metrics)
  - Status: ❌ NO (no event tracking currently)
  - Owner: Claude / Hermes
  - Effort: 3 dev-days (add instrumentation, event schema, logging)
  - **Blocking?** YES for A/B tests; can skip for prototype

### Performance Baselines

- [ ] **Measure current page load time (desktop & mobile)**
  - Command: `curl -w "@format.txt" -o /dev/null -s https://lemon-mud-06bc7fd03.7.azurestaticapps.net/`
  - Status: ❓ UNKNOWN
  - Owner: Claude
  - Effort: 30 min
  - Action: Measure this week; target is LCP <2.5s mobile

---

## Summary: GO/NO-GO by Strategy

### STRATEGY 1: MOBILE-FIRST ✅ GO (with caveats)

**Status:** GREEN (can prototype immediately)

**Blockers:** None — CSS/layout can be redesigned without backend changes

**Pre-requisites before A/B test:**
- [ ] Analytics instrumentation (3 dev-days)
- [ ] Mobile network baseline (1 dev-day)

**Timeline:** Prototype week 1-2 (depends on Claude); A/B test week 3-4 (once analytics ready)

---

### STRATEGY 2: SOCIAL PRESENCE ⚠️ YELLOW (legal risk)

**Status:** YELLOW — legal review required before prototype

**Blockers:** 
- [ ] GDPR/FERPA compliance sign-off (2-3 hours, Tonie)
- [ ] User identity system (2 dev-days, Hermes)
- [ ] Notification infra for full feature (3-5 dev-days, can defer)

**Pre-requisites before MVP:**
- [ ] Legal approval to track user location/bookings
- [ ] User ID in booking context
- [ ] In-app presence UI (no email/push needed for MVP)

**Timeline:** Legal review this week; if approved, prototype week 2-3 (backend + frontend)

---

### STRATEGY 3: AI RECOMMENDATIONS 🟡 YELLOW (data timing)

**Status:** YELLOW — data not ready until 2026-08-25 (~4 weeks from now)

**Blockers:**
- [ ] Need 8 weeks data (currently have ~4 weeks); next ready date 2026-08-25
- [ ] ML infrastructure doesn't exist (3-5 dev-days to build)

**Workaround:** Rule-based MVP (1 dev-day):
- Week 1: Launch "most popular room this hour" (zero ML)
- Week 5: Train ML models on 8-week data (if patterns exist)
- Week 6: Deploy ML recommendations + A/B test

**Timeline:** Rule-based prototype week 1-2; ML upgrade week 5-6 (if data quality good)

---

## Action Items (This Week)

| Owner | Task | Deadline | Effort |
|-------|------|----------|--------|
| Tonie | Check SWA analytics for mobile/desktop split | Wed | 30min |
| Tonie | Legal review: GDPR/FERPA for social presence | Wed | 2hr |
| Claude | Audit CSS tap target sizes | Wed | 4hr |
| Hermes | Analyze TU/e booking patterns (7-day data) | Wed | 4hr |
| Hermes | Measure API latency on 3G throttle | Wed | 4hr |
| Claude | Measure baseline page load time (LCP) | Wed | 2hr |

---

## Decision Gate: Thu 2026-07-25

**Tonie decides:** Based on audit results, which strategies proceed to prototype?

- **Strategy 1:** APPROVED ✅ (proceed to design sprint week 1)
- **Strategy 2:** APPROVED ✅ if legal OK; DEFER if legal blocks
- **Strategy 3:** APPROVED for rule-based MVP; ML phase 2 (week 5)

Confirm with Hermes + Claude; update wishlist #36-#38 start dates.
