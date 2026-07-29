# RoomSense Research Validation Framework

**Status:** Ready for execution (week of 2026-07-21)  
**Purpose:** Structured research to validate three proposed UI improvement strategies before design + dev phase  
**Audience:** Toine (product owner), Hermes (API coordinator), Claude (frontend coordinator)  
**Total research time:** ~1 week (concurrent interviews + audit; serial synthesis)

---

## Documents in This Directory

### 1. Research Interview Scripts
**File:** `research-interview-script.md`  
**Owner:** Claude (interview facilitation) + Toine (scheduling/recruiting)  
**Timeline:** Mon–Wed (3 days; 1 interview per persona)

Provides:
- Ready-to-use interview intro script
- 5–7 questions per persona (Students, Staff, Faculty) with exact wording
- Response type expectations (yes/no, scale, open-ended)
- Which strategy each question validates
- Post-interview analysis template
- Success metrics (aggregate across all 3 interviews)

**Deliverable:** 3 interviews completed; recordings + analysis notes in notes/ directory

---

### 2. Data & Technical Readiness Audit
**File:** `data-audit-checklist.md`  
**Owner:** Claude (frontend readiness) + Hermes (API readiness) + Orchestrator (infra/compliance)  
**Timeline:** Tue–Wed (2 days; parallel checklist assessment)

Provides:
- 15+ checklist items per strategy (YES / PARTIAL / NO)
- Blocking issues identified for each strategy
- Owner and estimated effort to unblock
- Current RoomSense status (as of 2026-07-19)
- Action path for each readiness scenario

**Deliverable:** Completed checklist with blocking issues prioritized

---

### 3. Success Criteria & Decision Matrix
**File:** `research-success-criteria.md`  
**Owner:** Toine (decision-maker); Hermes + Claude (technical input)  
**Timeline:** Thu (1 day; synthesis + decision)

Provides:
- GO / NO-GO thresholds for each strategy (quantified % of users, data gaps, legal gates)
- Implementation plans if strategy is approved (scope, effort, success metrics)
- Decision branches (e.g., "if legal blocks social presence, show aggregate counts only")
- Master decision matrix (1 page fill-in-the-blank template)
- Risk mitigations

**Deliverable:** Signed-off decision matrix; ranked priority list; implementation start dates

---

## Strategy Overview

### Strategy 1: Mobile-First Booking
**Problem:** Users want to book rooms spontaneously from mobile but current UX is cumbersome  
**Validation:** ≥60% of users report mobile friction  
**Data prerequisite:** None (UX/interaction problem)  
**Effort if GO:** 4–6 dev days  
**Lane:** Claude (frontend) + Hermes (API optimization, if needed)

### Strategy 2: Social Presence
**Problem:** Users want to know who else has booked or is in a room  
**Validation:** ≥70% of users interested + user identity system exists  
**Data prerequisite:** Booking history tracking + user ID  
**Effort if GO:** 5–8 dev days (or 2–3 days for aggregate-only MVP)  
**Lane:** Hermes (API) + Claude (UI)

### Strategy 3: AI Recommendations
**Problem:** Users spend too much time deciding which room to book  
**Validation:** ≥50% report decision friction + ≥8 weeks historical data available  
**Data prerequisite:** 8+ weeks clean occupancy + booking data  
**Effort if GO:** 7–10 dev days (or 1 day for rule-based fallback)  
**Lane:** Hermes (backend) + Orchestrator (ML ops)

---

## Research Week Timeline

| Day | Milestone | Owner | Output |
|-----|-----------|-------|--------|
| **Mon–Wed** | Conduct 3 interviews (1 per persona) | Claude + Toine | Recording + notes × 3 |
| **Tue–Wed** | Complete data audit checklist | Claude / Hermes / Orch. | Filled checklist; blockers list |
| **Wed night** | Sync on early blockers (don't wait for Thu analysis) | All | Email: "Legal review status?", etc. |
| **Thu** | Synthesis: analyze interviews + audit; produce decision matrix | Toine + leads | Signed decision matrix |
| **Fri** | Kickoff: lanes assigned, design phase dates set | Tonie | Lanes start design sprints |

---

## How to Use These Documents

### For Toine (Product Owner)

1. **Before interviews (Mon):** Review the interview script; confirm recruiting (do we have 3 participants lined up?).
2. **After interviews (Wed PM):** Skim interview notes for themes and surprises.
3. **After audit (Wed PM):** Circulate checklist results to leads; flag any critical blockers (legal, data) that need escalation.
4. **Thu (synthesis):** Fill in the decision matrix. Answer: which strategy(ies) are GO? What's our priority ranking?
5. **Fri (kickoff):** Communicate the decision to lanes; set explicit start dates and success metrics for each strategy.

**Key decisions Tonie owns:**
- Are interviews sufficient, or do we need a larger sample? (3 is directional; 5–8 is more robust)
- If data is missing for Strategy 3, approve rule-based fallback now, or wait 4 weeks?
- If legal blocks social presence, proceed with aggregate-only MVP, or defer entirely?

---

### For Claude (Frontend Lead)

1. **Interview:** Facilitate all 3 interviews (can delegate recruiting to Tonie, but own running them).
2. **Audit:** Complete front-end items in checklist (mobile responsiveness, API latency, analytics setup).
3. **Synthesis:** Attend Thu sync; weigh in on feasibility of approved strategies (e.g., "We can ship responsive mobile in 3 days, not 4").
4. **Kickoff:** If Strategy 1 approved, start design Monday morning; if others approved, coordinate with Hermes on parallel track.

**Key questions for Claude to answer:**
- Is the current frontend responsive on mobile? (Data audit 1.1)
- Can we ship a booking flow redesign in 1 week? (Implementation estimate)
- Do we have analytics instrumentation? (Data audit 1.3)

---

### For Hermes (API Lead)

1. **Audit:** Complete API items in checklist (latency, user identity, booking history, data quality).
2. **Synthesis:** Attend Thu sync; clarify any blockers (e.g., "We need 8 weeks data; we have 4; recommend rule-based MVP").
3. **Kickoff:** If Strategy 2 approved, start API design (Bookings table, endpoints). If Strategy 3 approved, start data validation.

**Key questions for Hermes to answer:**
- Is API latency acceptable for mobile (< 2s)? (Data audit 1.2)
- Can we record user bookings? What schema changes are needed? (Data audit 2.2)
- Do we have 8+ weeks of data for ML? If not, what's the fallback? (Data audit 3.1)

---

### For Orchestrator

1. **Audit:** Complete infra/compliance items (privacy, GDPR, FERPA, data retention, ML infrastructure).
2. **Synthesis:** Provide legal status update before Thu; escalate blockers early (don't wait).
3. **Kickoff:** If Strategy 3 approved, set up ML pipeline / training infrastructure.

**Key questions for Orchestrator to answer:**
- What's the legal status of social presence? Can we proceed with MVP? (Data audit 2.4–2.5)
- Do we have ML infrastructure, or should we use rule-based MVP? (Data audit 3.3)

---

## Success Criteria (Research Phase)

**Research phase is successful if:**

1. ✅ All 3 interviews completed by Wed EOD (no cancellations; recordings + notes stored)
2. ✅ Audit checklist filled out with owner assigned for each blocker (no "TBD")
3. ✅ Decision matrix signed off by Thu EOD (Tonie + leads agree on GO/NO-GO per strategy)
4. ✅ Lanes have explicit start dates by Fri AM (no ambiguity on "when do we start designing?")
5. ✅ All identified blockers have an owner + ETA (e.g., "Legal review: Tonie, ETA Fri PM")

**Research phase is NOT successful if:**

- ❌ Only 1–2 interviews completed; don't have a quorum
- ❌ Audit checklist has multiple "TBD" or unassigned blockers
- ❌ Decision matrix is ambiguous (e.g., "all three are kind of GO, I guess")
- ❌ Lanes don't know when to start; waiting for clarity on priority

---

## Failure Modes & Escalation

| Scenario | Mitigation | Owner |
|----------|-----------|-------|
| Interview participant cancels | Have backups lined up; reschedule within 24h. Don't wait if it's the same day. | Tonie |
| Audit finds critical blocker (e.g., no user ID system for Strategy 2) | Document effort to unblock (1 dev day for session UUID?); decide Thu: fix now or defer strategy? | Hermes / Tonie |
| Legal blocks social presence | Proceed with aggregate-only MVP (no named list); revisit named list when legal OK. | Tonie / Orchestrator |
| Data insufficient for Strategy 3 (only 4 weeks available) | Approved: build rule-based MVP (1 day); ship it; plan ML transition for Phase 2 after 8 weeks. | Tonie / Hermes |
| No consensus on prioritization (Fri AM) | Tonie makes final call; communicate in writing (Slack thread); lanes execute. | Tonie |

---

## Files to Store Research Outputs

Create these directories in the RoomSense repo (if not already present):

```
roomsense/
├── .hermes/plans/  (this file + the three strategy docs)
├── .hermes/research/
│   ├── interviews/
│   │   ├── student-1.md
│   │   ├── staff-1.md
│   │   ├── faculty-1.md
│   └── audio/
│       ├── student-1.m4a  (recording, if available)
│       ├── staff-1.m4a
│       └── faculty-1.m4a
├── .hermes/decisions/
│   └── 2026-07-24-research-decision-matrix.md  (signed off)
```

---

## Next Step

**This morning (2026-07-21):**
- Tonie: Confirm 3 interview participants (1 student, 1 staff, 1 faculty); schedule Mon–Wed.
- Claude: Review the interview script; prepare to facilitate.
- Hermes: Start audit checklist items (no urgent deadline; can complete Tue–Wed).
- Orchestrator: Check legal status on social presence (data audit 2.4); don't wait until Wed.

**Kick off interviews Monday.**
