# RoomSense Research Validation: Success Criteria & Decision Matrix

**Objective:** Define quantified GO/NO-GO thresholds for each strategy.  
**Owner:** Tonie (decision-maker) + Leads (data collectors)  
**Decision Date:** Thu 2026-07-25 (end of research week)

---

## STRATEGY 1: MOBILE-FIRST TAP-TO-BOOK

### Validation Hypothesis
*"≥60% of students report mobile friction when searching for rooms; they find mobile-first redesign appealing."*

### Success Metrics (Interview Data)

| Metric | GO Threshold | YELLOW (MVP) | NO-GO | Current Baseline |
|--------|--------------|-------------|-------|------------------|
| Mobile friction reported | ≥60% | 40-59% | <40% | TBD (measure week 1) |
| "Booking takes too long" | ≥50% | 30-49% | <30% | TBD |
| Would use 1-tap booking | ≥65% | 50-64% | <50% | TBD |
| Pain points mentioned (≥3) | ≥40% | 20-39% | <20% | TBD |

### Technical Validation (Data Audit)

| Metric | GO | YELLOW | NO-GO |
|--------|----|---------| ------|
| CSS supports 48px tap targets | YES (audit done) | PARTIAL (refactor needed) | NO (architecture blocks) |
| API latency <2s (3G throttle) | YES | <3s (acceptable) | >3s (unacceptable) |
| Mobile traffic % | ≥15% | 5-14% | <5% (low priority) |

### Decision Tree

```
IF interview_threshold >= 60% AND technical_ready == YES:
  DECISION: GO ✅ → Start design sprint immediately (week 1)
  ACTION: File issue #36; assign to Claude

ELIF interview_threshold >= 40% AND technical_ready == YES:
  DECISION: YELLOW (MVP scope) ⚠️ → Start with core 1-tap booking only
  ACTION: File issue #36 with "MVP scope" label; defer "nice-to-haves" (animations, advanced filters)

ELIF interview_threshold < 40% OR technical_ready == NO:
  DECISION: DEFER 🔴 → Revisit in 3 months with new user cohort
  ACTION: Close #36 temp; file as backlog research item
```

### Success = Prototype Approved for A/B Test (Week 5)

**Definition:** At end of week 3-4, prototype meets:
- ✅ Mobile-first layout (1-column, full-width)
- ✅ 48px+ tap targets (all buttons, cards)
- ✅ Real-time occupancy animations (smooth state changes)
- ✅ 1-tap booking flow (card → confirm → done)
- ✅ <2s load time on 3G throttle
- ✅ Usability test: 5 student interviews, SUS score >72

**Go/No-Go:** Tonie + Claude agree prototype meets spec → APPROVED for 30% user A/B test (week 4-5)

---

## STRATEGY 2: SOCIAL PRESENCE & NETWORK EFFECTS

### Validation Hypothesis
*"≥70% of users are interested in social presence; legal/privacy concerns are manageable."*

### Success Metrics (Interview Data)

| Metric | GO | YELLOW (Privacy-First MVP) | NO-GO |
|--------|----|----|-------|
| "Friend presence useful" (4-5 rating) | ≥70% | 50-69% | <50% |
| Privacy concern level (1-5 scale) | <40% at 4-5 | <55% at 4-5 | ≥55% |
| "Would enable friend notifications" | ≥60% | 40-59% | <40% |
| Willing to share location with app | ≥55% | 35-54% | <35% |

### Technical Validation (Data Audit)

| Metric | GO | YELLOW | NO-GO |
|--------|----|----|-------|
| Legal/GDPR review complete | Approved ✅ | Conditional OK | Blocked ❌ |
| User identity system exists | YES | Can mock for MVP | NO (hard blocker) |
| Notification infra ready | YES (email+push) | In-app only (phase 2) | NO (defer) |
| Data retention policy defined | YES | In progress | NO (block until ready) |

### Decision Tree

```
IF legal_approved == NO:
  DECISION: DEFER 🔴 → Cannot proceed until legal clearance
  ACTION: Schedule legal review; replan after approval

ELIF legal_approved == YES AND interview_threshold >= 70%:
  DECISION: GO ✅ → Full feature set
  ACTION: File #37; scope includes avatars + notifications + friend suggestions

ELIF legal_approved == YES AND interview_threshold >= 50%:
  DECISION: YELLOW (Privacy-First MVP) ⚠️ → Limited scope
  ACTION: File #37 "MVP" label; scope: aggregate presence only (no named users)
    Example: "5 people are viewing rooms in Atlas" (not "Jane, Tom, Sarah")

ELIF interview_threshold < 50%:
  DECISION: DEFER 🔴 → User interest too low
  ACTION: Close #37; revisit in 6 months
```

### Success = Legal Cleared + Prototype Approved (Week 6)

**Pre-requisite:** Legal review says YES by Wed 2026-07-24

**Definition:** At end of week 5-6, prototype meets:
- ✅ Legal compliance verified (GDPR/FERPA OK)
- ✅ Consent/opt-in UI (clear, one-click enable)
- ✅ Presence indicators on room cards (live avatars or aggregate count)
- ✅ Friend detection (show "2 of your team members are viewing this room")
- ✅ Usability test: 5 users, SUS >72, <30% cite privacy concerns in follow-up

**Go/No-Go:** Tonie + legal + Claude agree → APPROVED for 30% user A/B test (week 6-7)

---

## STRATEGY 3: AI RECOMMENDATIONS & GAMIFICATION

### Validation Hypothesis
*"≥50% of students report decision paralysis; personalized recommendations speed up booking; gamification increases daily engagement."*

### Success Metrics (Interview Data)

| Metric | GO (ML-Ready) | YELLOW (Rule-Based MVP) | NO-GO |
|--------|---------------|-----|-------|
| Decision paralysis (>20sec) | ≥50% | 35-49% | <35% |
| Recommendations useful (4-5 rating) | ≥65% | 50-64% | <50% |
| Interested in streaks/gamification | ≥60% | 40-59% | <40% |
| Booking frequency (avg bookings/week) | ≥2 | 1-1.9 | <1 |

### Technical Validation (Data Audit)

| Metric | GO (ML Track) | YELLOW (Rule-Based MVP) | NO-GO |
|--------|---|---|---|
| 8+ weeks clean data | YES (ready by 2026-08-25) | 4-7 weeks (use rule-based temp) | <4 weeks (defer) |
| Booking patterns identifiable | Strong patterns (repeat users) | Weak patterns | No patterns |
| ML infrastructure | YES (framework + training) | NO (skip for MVP) | N/A |
| User preference storage | YES | Can derive from history | NO (hard blocker) |

### Decision Tree

```
IF interview_threshold >= 50% AND data_ready >= 8_weeks:
  DECISION: GO (Full ML) ✅ → Schedule ML model training (week 5-6)
  ACTION: File #38; scope includes recommendations + streaks + feature unlocks

ELIF interview_threshold >= 50% AND data_ready < 8_weeks:
  DECISION: YELLOW (Rule-Based MVP) ⚠️ → Start with rules; upgrade to ML in week 5
  ACTION: File #38 "MVP" label; week 1-3 = rule-based; week 5-6 = train ML models
    Rules: "Most booked room this hour", "Cheapest room right now", "Closest to you"
  THEN: Retrain to ML models when data is ready (2026-08-25)

ELIF interview_threshold < 50%:
  DECISION: DEFER 🔴 → User demand too low
  ACTION: Close #38; keep as backlog research item
```

### Success = Prototype Approved (Week 3 for Rule-Based; Week 6 for ML)

**Rule-Based MVP (Week 3):**
- ✅ Rule engine: "Most popular" + "Closest" + "Cheapest" recommendations
- ✅ Streak counter (local, no backend yet)
- ✅ Feature unlock UI (unlock "Advanced Scheduling" after 7 bookings)
- ✅ <500ms recommendation latency
- ✅ Usability test: 5 users find recommendations helpful

**Full ML (Week 6, if data ready):**
- ✅ Model trained on 8+ weeks data
- ✅ Recommendation accuracy >70% (measured on holdout set)
- ✅ Personalization: recommendations match user's past 5 bookings
- ✅ Prediction accuracy: "Will room peak next hour" >75% on test set
- ✅ Streak persistence (backend storage + user notifications)

**Go/No-Go:** Tonie + Claude agree rule-based works → APPROVED for 30% A/B test (week 3-4)  
**Go/No-Go (ML phase):** Data quality + accuracy met → APPROVED for upgrade (week 6-7)

---

## A/B Testing Framework (Applies to All Strategies)

### Experiment Design (Weeks 4-8)

Once prototype approved, run 2-week A/B test:

**Sample:** 
- Control (50% of users): Current UI (no changes)
- Variant (50% of users): New feature (Strategy 1/2/3)

**Duration:** 2 weeks (enough to see patterns; avoid confounding factors like exam season)

**Metrics (per strategy):**

**Strategy 1 (Mobile):**
- Booking conversion rate: Current baseline → +30% target
- Session duration: Current baseline → +60% target
- Mobile-specific: Page load time, tap accuracy, abandonment rate

**Strategy 2 (Social):**
- Session duration: Current → +40% target
- Booking frequency: Current → +25% target
- NPS (survey): Current → +35 points target
- Social feature engagement: % who enable presence, post reviews

**Strategy 3 (AI):**
- Booking time-to-decision: Current → -50% target (e.g., 25sec → 12sec)
- DAU (Daily Active Users): Current → +30% target
- Recommendation CTR: <10% baseline → +35% target
- Streak continuation: % who return day 2, day 7, day 14

### Statistical Significance

**Threshold:** p-value <0.05 (95% confidence)  
**Tool:** A/B test calculator (statsig.com or similar)  
**Power:** 80% (detect effect if it exists)

### Go/No-Go (After A/B Test)

```
IF metric_improvement >= target AND p_value < 0.05 AND NPS_positive:
  DECISION: LAUNCH ✅ → Roll out to all users
  ACTION: Enable feature flag for 100%; monitor production

ELIF metric_improvement >= 50% of target AND p_value < 0.05:
  DECISION: ITERATE ⚠️ → Keep feature; iterate based on feedback
  ACTION: Gather qualitative feedback; plan refinements

ELIF metric_improvement < 50% of target OR p_value >= 0.05:
  DECISION: KILL 🔴 → Revert feature; analyze failure mode
  ACTION: Investigate why; plan follow-up research
```

---

## Overall Success Criteria (End of Research + A/B Tests)

### For Tonie & Leadership (Week 9 Summary)

**Goal:** 3 validated strategies → 1-2 shipped to production, driving 30%+ engagement lift.

**Conditions:**

| Strategy | Success = | Failure = | Default Action |
|----------|-----------|-----------|-----------------|
| Mobile | Convert +30%, session +60%, p<0.05 | Convert <15%, p>0.05 | LAUNCH / ITERATE / KILL |
| Social | DAU +25%, NPS +35, engagement >40% | DAU <10%, engagement <20% | LAUNCH / ITERATE / KILL |
| AI | Time-to-decide -50%, DAU +30%, p<0.05 | Decision time -20%, p>0.05 | LAUNCH (rule-based) / ITERATE / DEFER (ML) |

**Overall Decision:**
- ✅ **Best case:** All 3 succeed → Launch mobile + social (week 9); AI rule-based (week 3) + ML upgrade (week 8)
- ⚠️ **Good case:** 2 succeed → Launch top 2; defer third
- 🔴 **Weak case:** <1 succeeds → Pause; deeper user research in Q3

---

## Timeline Summary

| Week | Phase | Deliverable | Owner | Go/No-Go |
|------|-------|-------------|-------|----------|
| 1 | Research | Interviews (9-15 users) + audit findings | Tonie + Leads | Thu decision |
| 2-3 | Prototype | High-fidelity mockups (all 3 strategies) | Claude + Hermes | Usability test: SUS >72 |
| 4-5 | A/B Test | Live experiment (30% users, 2 weeks) | Analytics + Leads | Statistical significance p<0.05 |
| 6-7 | Refinement | Iterate based on A/B feedback | Claude + Hermes | Prepare launch |
| 8-9 | Launch + Upgrade | Full rollout; AI ML upgrade if data ready | All | Measure production impact |

---

## Sign-Off (Decision Night: Thu 2026-07-25)

**Tonie:** I've reviewed the research data (interviews + audit). Here's what we're doing:

- [ ] Strategy 1 (Mobile): **GO / YELLOW / DEFER**
- [ ] Strategy 2 (Social): **GO / YELLOW / DEFER** (pending legal: ____________)
- [ ] Strategy 3 (AI): **GO (ML-track) / YELLOW (Rule-based) / DEFER**

**Rationale:** 

[Notes on interview findings, data quality, risk factors]

**Next:** Claude & Hermes start design sprints Monday (2026-07-28).

---

**Signed:**  
Tonie (Product)  
Claude (Frontend)  
Hermes (Backend)  

**Date:** [Decision date]
