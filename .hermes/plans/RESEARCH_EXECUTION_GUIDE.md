# RoomSense Research Validation: Execution Guide

**Purpose:** Coordinate research week (Jul 21-25) to validate 3 consumer UI strategies before prototyping.

**Decision Date:** Thursday 2026-07-25 (end of week)  
**Coordinator:** Tonie (product)  
**Participants:** Tonie, Claude (frontend), Hermes (backend)

---

## Quick Start (Start Here!)

### What's the Plan?

Research three UI strategies to make RoomSense more appealing to students/casual users:

1. **Strategy 1 (Mobile):** Fast 1-tap room booking on phones
2. **Strategy 2 (Social):** Show which friends are booking nearby
3. **Strategy 3 (AI):** Personalized room recommendations + gamified streaks

### How Does It Work?

- **Week 1 (Mon-Thu):** Run user interviews + data audit
- **Thu night:** Decision — which strategies proceed to design?
- **Weeks 2-9:** Prototype → A/B test → Launch

### Files You Need

| File | What It Is | Who Uses It |
|------|-----------|-----------|
| `research-interview-script.md` | Copy-paste questions for 9-15 user interviews | Tonie (recruiting + running interviews) |
| `research-data-audit-checklist.md` | Technical readiness checklist (YES/PARTIAL/NO) | Claude + Hermes (backend work audit) |
| `research-success-criteria.md` | Decision thresholds + A/B test design | Tonie (Thu night decision + weeks 5-9) |
| `RESEARCH_EXECUTION_GUIDE.md` | This file — coordination + timeline | Everyone (reference as you go) |

---

## Research Week Execution (Jul 21-25)

### Monday Jul 21 (Today)

**Research Kick-Off (15 min sync, optional)**

- ✅ Read all `.hermes/plans/research-*.md` files (30 min)
- ✅ Confirm who's recruiting (Tonie needs ~15 interview slots)
- ✅ Confirm who's doing data audit (Claude + Hermes split checklist items)

### Tuesday-Wednesday Jul 22-23

**Parallel Work Streams**

#### Stream A: User Interviews (Tonie)

**Goal:** Get 9-15 interviews done (3-5 per persona: students, staff, faculty)

**Steps:**
1. Recruit participants (email lists, in-person intercept, incentives)
2. Schedule slots: 15-20 min each, back-to-back if possible
3. Run interviews using `research-interview-script.md`
4. Record (with consent) and take notes
5. Fill out post-interview template per `research-interview-script.md`

**Success:** ≥9 interviews completed; notes stored in `.hermes/research/notes/`

**Recruiting Tips:**
- Offer $10 gift card or coffee card (increases show-up rate)
- Target peak times: Tue/Wed morning (avoid exam prep)
- Multiple channels: email, Slack, study pods intercept, faculty office hours
- Script: "We're designing new features for the room-booking app. 15 minutes, you get a gift card. Interested?"

**Output:** 9-15 interview notes + audio recordings

#### Stream B: Data Audit (Claude + Hermes, parallel)

**Goal:** Complete checklist items to confirm technical readiness

**Split work:**

| Owner | Checklist Items | Est. Time | Deadline |
|-------|---|---|---|
| Claude | CSS tap targets, mobile baseline load time, analytics audit | 4-6 hr | Wed EOD |
| Hermes | API latency, booking patterns, ML data quality | 4-6 hr | Wed EOD |
| Tonie | Mobile/desktop traffic %, legal review, preference audit | 2-3 hr | Wed EOD |

**Commands to Run (Hermes):**

```bash
# Measure current API latency
curl -w "@format.txt" -o /dev/null -s https://roomsense-api.azurewebsites.net/api/health

# Check booking patterns (SQL query on Azure Storage)
# SELECT COUNT(*) FROM Reservations 
# WHERE UserId != null 
# GROUP BY UserId HAVING COUNT(*) >= 3
# (Shows which users book repeatedly; if high %, personalization works)

# Data quality: check for sensor gaps/outliers
# SELECT DATE(ts), COUNT(*) 
# FROM OccupancySnapshots 
# GROUP BY DATE(ts) 
# HAVING COUNT(*) < 50  (if <50 snapshots/day, data quality issue)
```

**Output:** Filled checklist from `research-data-audit-checklist.md`

### Thursday Jul 25 (Decision Day)

**Morning: Synthesis (Tonie)**

1. Aggregate interview results:
   - Count GO/YELLOW/NO-GO signals per strategy
   - Identify strongest pain points mentioned
   - Note any surprises or contradictions

2. Finalize audit findings:
   - Confirm technical blockers (if any)
   - Identify pre-requisites per strategy

**Afternoon: Decision Sync (1 hour, Tonie + Claude + Hermes)**

**Agenda:**
1. Review interview findings (10 min)
2. Review audit results (10 min)
3. Tonie's decision per strategy (5 min per strategy)
4. Confirm start dates for #36, #37, #38 (10 min)
5. Identify any pre-work needed before Mon start (5 min)

**Output:** Filled sign-off in `research-success-criteria.md`

**Friday Jul 26 (Prep)**

- Claude + Hermes review decision
- Start design/architecture sketches for approved strategies
- Ready to kick off design sprints Monday (Jul 28)

---

## Decision Template (Fill Out Thu Night)

**Use the decision tree in `research-success-criteria.md`, Section 3.**

### Strategy 1: Mobile-First Tap-to-Book

**Interview signals (from Tonie's aggregate):**
- % reporting mobile friction: _____ (target ≥60%)
- % saying "booking takes too long": _____ (target ≥50%)
- # of pain points mentioned: _____ (target ≥3 avg)

**Technical readiness (from Claude audit):**
- CSS supports 48px tap targets: YES / PARTIAL / NO
- API <2s on 3G: YES / PARTIAL / NO
- Mobile traffic %: _____% (context only)

**Decision:** ✅ GO / ⚠️ YELLOW (MVP) / 🔴 DEFER

**Rationale:** [1-2 sentences on why this decision]

---

### Strategy 2: Social Presence & Network Effects

**Interview signals (from Tonie's aggregate):**
- % "Friend presence useful" (4-5 rating): _____ (target ≥70%)
- % citing privacy concern: _____ (target <40%)
- % "Would enable notifications": _____ (target ≥60%)

**Technical readiness (from Hermes audit):**
- Legal review complete: YES / IN PROGRESS / BLOCKED
- User identity system: YES / CAN MOCK / NO
- Notification infra: YES / PHASE 2 / NO

**Decision:** ✅ GO / ⚠️ YELLOW (Privacy-first MVP) / 🔴 DEFER

**Blocking issue (if any):** [Legal review status, if applicable]

**Rationale:** [1-2 sentences on why this decision]

---

### Strategy 3: AI Recommendations & Gamification

**Interview signals (from Tonie's aggregate):**
- % with decision paralysis (>20sec): _____ (target ≥50%)
- % "Recommendations useful" (4-5 rating): _____ (target ≥65%)
- % interested in streaks: _____ (target ≥60%)

**Technical readiness (from Hermes audit):**
- Data ready (8+ weeks): YES / 4-7 weeks / <4 weeks
- ML infra exists: YES / CAN BUILD / NO
- Booking patterns identifiable: STRONG / WEAK / NONE

**Decision:** ✅ GO (ML-track) / ⚠️ YELLOW (Rule-based MVP) / 🔴 DEFER

**Data timeline:** Ready by _____ (target 2026-08-25)

**Rationale:** [1-2 sentences on why this decision]

---

## Approval: Next Steps (If GO/YELLOW)

**Once Tonie decides:** Claude + Hermes align on:

1. **Pre-work needed before design sprint starts (Mon 2026-07-28)**
   - Any checklist items blocking prototype? (Should be done by Thu EOD)
   - Any legal/compliance approvals needed? (Must have before code)

2. **Scope for MVP (if YELLOW)**
   - Strategy 1 YELLOW: Focus on 1-tap booking; defer animations
   - Strategy 2 YELLOW: Aggregate presence only; defer notifications
   - Strategy 3 YELLOW: Rule-based recommendations; defer ML training

3. **Start date for design sprint**
   - Usually Mon 2026-07-28 (design week 1)
   - A/B testing starts week 5 (Mon 2026-08-18)

---

## File Organization

```
.hermes/
  plans/
    2026-07-21_224600-consumer-ui-strategy-eval.md     (← original 3-strategy plan)
    research-interview-script.md                        (← copy-paste interview Q's)
    research-data-audit-checklist.md                    (← technical readiness checklist)
    research-success-criteria.md                        (← decision matrix + sign-off)
    RESEARCH_EXECUTION_GUIDE.md                         (← this file)
    
  research/                                             (← output folder, create it)
    notes/
      2026-07-22_student-1.md                           (← interview notes, one per session)
      2026-07-22_student-2.md
      2026-07-22_staff-1.md
      ...
    recordings/
      2026-07-22_student-1.m4a                          (← audio recording, with consent)
      ...
    audit/
      data-audit-filled.md                              (← checklist with results)
```

---

## Risk Mitigation

### "We won't get 15 interview slots"

**Acceptable:** 9 interviews (3 per persona) gives you directional signal  
**Fallback:** If <9, weight toward student interviews (primary users)

### "Legal review blocks Strategy 2"

**Plan:** Run interviews anyway; get preliminary legal feedback by Wed  
**Fallback:** If blocked, defer #37 to Q3; proceed with #36 (mobile) + #38 (AI rule-based)

### "Data audit finds blocking issues"

**Plan:** Identify by Wed EOD; escalate to Tonie Thu morning  
**Fallback:** Some blockers can be worked around (analytics can come after proto)

### "We run out of time"

**Priority order:** Interviews > audit > decision  
Even partial audit (70% done) is enough to inform decisions

---

## Success Criteria (End of Week)

✅ **Success = Tonie makes a GO/YELLOW/DEFER call on all 3 strategies**

Signs of success:
- 9-15 interviews completed + notes taken
- Checklist 70%+ complete
- No ambiguity on technical blockers
- Decision signed off Thu EOD
- Claude + Hermes clear on next steps (start dates, pre-work)

Signs of trouble:
- <6 interviews by Wed EOD → escalate to Tonie (reassess recruiting)
- Audit finds hard blocker → escalate to Tonie (plan mitigation)
- Ambiguous decision Thu → Tonie decides on incomplete data (OK, move forward)

---

## Questions?

**Who do I ask?**

- **Tonie:** Strategy questions, decision logic, recruiting help
- **Claude:** Frontend audit items, CSS tap targets, mobile load time
- **Hermes:** Backend audit items, data queries, API latency

**Where do I track progress?**

- Update `.hermes/plans/RESEARCH_EXECUTION_GUIDE.md` as you go
- Reference this file daily (Mon-Thu)
- Commit changes Thu after decision

---

## Timeline at a Glance

```
Mon 2026-07-21: Research kick-off (you are here)
Tue-Wed 2026-07-22-23: Interviews + audit (parallel)
Thu 2026-07-25: Decision sync + sign-off
Fri 2026-07-26: Prep for design sprints
Mon 2026-07-28: Design sprint #36, #37, #38 (approved strategies)
Mon 2026-08-18: A/B testing starts (week 5)
Thu 2026-09-04: Results analysis + launch/iterate decision
```

**Good luck! 🚀**
