# RoomSense Research Validation: Interview Script

**Duration:** 15–20 minutes per participant  
**Format:** Semi-structured (follow guide, adapt to conversation)  
**Recording:** Optional but recommended (for synthesis later)

---

## Participant Information (Collect at Start)

- **Name/Email:** [confidential for consent only]
- **Persona:** Student / Staff / Faculty
- **Frequency of room searches:** Daily / Weekly / Monthly / Rarely
- **Primary tool:** (Phone / Desktop / Both)

---

## PERSONA A: STUDENTS (Primary Room Finder Users)

**Context:** Students booking study/collaboration spaces on campus.

### Q1: Current Booking Friction (Validates Strategy 1: Mobile-First)

**Exact wording:** "Walk me through the last time you needed to find an empty room on campus. What did you do?"

**Listen for:**
- Where were they? (Home vs. on campus at arrival)
- What tool did they use? (Phone vs. desktop vs. walking)
- How long did it take? (Seconds vs. minutes)
- Did they succeed? (Found a room vs. gave up)

**Follow-up if they used phone:** "Was using a phone easy or annoying? What frustrated you?"

**Success threshold:** If ≥60% report mobile friction (zoom/pan needed, small buttons, slow load), Strategy 1 gets GREEN.

---

### Q2: Decision Paralysis (Validates Strategy 3: AI Recommendations)

**Exact wording:** "When you see a list of empty rooms, how do you pick which one? Take 10 seconds — walk me through your decision."

**Listen for:**
- How long to decide? (<10sec / 10-30sec / >30sec — record)
- What info matters? (Distance, capacity, quiet-ness, plug outlets, reviews)
- Do they overthink? ("Hmm, should I try Pod 2 or Pod 3?")

**Follow-up:** "Would a recommendation help? Like: 'You usually pick quiet pods; this one matches.' Does that sound useful?"

**Success threshold:** If ≥50% report decision paralysis (>20sec to choose) AND find recommendations appealing, Strategy 3 gets GREEN.

---

### Q3: Social Awareness (Validates Strategy 2: Social Presence)

**Exact wording:** "When you're studying in a room, do you ever wonder who else is there or booking nearby? Would you want to know if your friends just booked a room on the same floor?"

**Response scale:** 1 (not interested) to 5 (very interested)

**Listen for:**
- Social motivation ("I like studying with my study group")
- Privacy concern ("I don't want everyone knowing where I am")

**Follow-up (if interested):** "Would you be worried about privacy if your location was visible?"

**Success threshold:** If ≥70% rate 4-5 (interested) AND <40% cite privacy concern, Strategy 2 gets GREEN.

---

### Q4: Open-Ended Feature Wish (Validates Overall)

**Exact wording:** "What's the #1 thing missing from a room-finding app that would make you use it way more often?"

**Listen for:** New pain points, unexpected use cases, feature surprises.

**Record verbatim.**

---

### Q5: Recap & Consent (Meta)

**Exact wording:** "Thank you! Can we follow up if we build prototypes to test? And is it OK if we use your feedback anonymously in our product decisions?"

---

## PERSONA B: STAFF / FACILITIES (Dashboard/Analytics Users)

**Context:** Facilities managers, office coordinators using RoomSense for utilization insights.

### Q1: Current Pain Point with Occupancy Visibility

**Exact wording:** "Tell me about the last time you needed to understand which rooms are underutilized or booked poorly. What data did you need, and how hard was it to get?"

**Listen for:**
- Which metrics matter? (Occupancy %, utilization trends, ghost meetings, cost-per-desk)
- Data freshness? ("I need live data vs. historical reports is OK")
- Tools used? (Dashboard vs. Excel export vs. manual inspection)
- Friction points? (Too many clicks, unclear UI, slow load)

**Success threshold:** If ≥50% report friction (>3 clicks to answer a question), strategy redesign roadmap priority rises.

---

### Q2: Actionability of Data

**Exact wording:** "When you see a utilization report, what do you actually DO with it? Do you make changes based on that data?"

**Listen for:**
- Does the data drive decisions? (Yes / Sometimes / No)
- Barriers? ("I want to act but can't convince leadership" vs. "UI is too confusing")
- What would help? (Simpler dashboards, printed reports, alerts)

---

### Q3: Team Collaboration (Validates Social/Sharing)

**Exact wording:** "Do you share occupancy data or insights with other teams? If so, how?"

**Listen for:**
- Sharing pattern? (Email / screenshots / shared dashboard / none)
- Friction? ("Sharing is hard; I manually create reports")

---

## PERSONA C: FACULTY (Occasional Scheduling Users)

**Context:** Professors booking lecture halls, office hours spaces.

### Q1: Room Booking Workflow

**Exact wording:** "How do you currently book a lecture hall or office hour space? Walk me through it from start to finish."

**Listen for:**
- Process? (Calendar system / room booking system / call facilities / walk in)
- Does RoomSense fit into that workflow? (Yes / Haven't heard of it / Don't need it)
- Pain points? (Double bookings, no real-time availability, conflicts with calendar)

---

### Q2: Advance Booking vs. Last-Minute

**Exact wording:** "Do you usually know your room needs a week in advance, or do you sometimes need a room on the same day?"

**Listen for:**
- Planning style? (Semester plan vs. ad-hoc)
- If ad-hoc: how do they find a free room? (Email facilities / peer network / visual inspection)

**Success threshold:** If ≥30% book same-day and report friction, mobile-first strategy gains relevance for faculty use case.

---

### Q3: Preferences & Customization

**Exact wording:** "Do you have favorite rooms (e.g., you always book the seminar room with the whiteboard)? Would a system that remembers your preferences be useful?"

**Listen for:**
- Pattern preference? (Yes / No)
- Value of personalization? (Saves time vs. not a big deal)

---

## Post-Interview Analysis Template

### For Interviewer (Fill Out After Each Session)

```
Participant: [Name]
Persona: [Student / Staff / Faculty]
Date: [Date]

Strategy 1 (Mobile) Signal:
- Mobile friction reported? YES / NO
- When using phone, frustration level: [1-5]
- Likely to adopt mobile-first redesign: YES / NO / MAYBE

Strategy 2 (Social) Signal:
- Interested in presence/friend awareness? YES / NO / UNSURE
- Privacy concern level: [1-5]
- Likely to enable social features: YES / NO / MAYBE

Strategy 3 (AI) Signal:
- Decision paralysis reported? YES / NO
- Time-to-decide: <10sec / 10-30sec / >30sec
- Would find recommendations useful? YES / NO / MAYBE

Overall Sentiment:
- Would use RoomSense regularly? YES / NO / MAYBE
- Most helpful feature mentioned: [quote]
- #1 missing feature: [quote]

Notes: [Any surprises, contradictions, or context]
```

---

## Aggregate Success Criteria (After All Interviews)

Count results across all participants:

```
STRATEGY 1 (MOBILE): 
- ≥60% mobile friction + ≥3 pain points mentioned = GREEN ✓
- 40-59% + mixed feedback = YELLOW (MVP only)
- <40% friction = RED (defer)

STRATEGY 2 (SOCIAL):
- ≥70% interested (4-5 rating) + <40% privacy concern = GREEN ✓
- 50-69% interested = YELLOW (privacy-first MVP)
- <50% interested = RED (defer)

STRATEGY 3 (AI):
- ≥50% decision paralysis + ≥60% find recs useful = GREEN ✓
- 30-49% paralysis = YELLOW (rule-based MVP, not ML)
- <30% paralysis = RED (defer)
```

---

## Consent & Data Handling

Before recording: "I'd like to record this for accuracy. Your name won't appear anywhere; we'll use feedback anonymously. OK?"

Store recordings in: `.hermes/research/recordings/` (date-named)  
Store notes in: `.hermes/research/notes/` (date-named)  
Do NOT include names in notes.

---

## Interview Recruiting Tips

- **Incentive:** Coffee card / $10 gift card (increases show rate)
- **Timing:** Weekday morning or lunch (avoid dead-week periods)
- **Recruiting channels:**
  - Email: student mailing lists (with faculty help)
  - Slack: facilities team channel
  - In-person: study pods, breakrooms (intercept method)
- **Target:** 3-5 per persona (9-15 total, 1 week of effort)
