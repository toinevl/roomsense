# RoomSense — Demo Use-Case Catalog

> **For Hermes:** This is a decision document, not an implementation plan. Review the use cases below with the user, pick 2-3 flagships, then create a separate implementation plan per chosen use case.

**Goal:** Catalog every compelling demo use case that the EXISTING RoomSense data can power — without new API endpoints, new sensor hardware, or new data sources — so the user can choose which to build out for presentations, fundraising, or student/staff engagement.

---

## What data we already have

Before the use cases, here is the ground truth — everything below is already seeded, already flowing through 12 API endpoints, and already backing 11 frontend pages:

| Dataset | Volume | Key fields |
|---------|--------|------------|
| Rooms | 15 (3 buildings: Atlas, Flux, Neuron) | roomId, building, floor, name, capacity (2–80), deviceId |
| Sensor readings | ~43k (30 days, 15-min intervals) | countIn, countOut (cumulative), flags, batteryPct, rssi, snr |
| Occupancy snapshots | ~43k | roomId, ts, occupancy, utilizationPct |
| Reservations | ~1.3k | subject, organizer, attendeeCount, start/end, ghost flag (20% are ghosts) |
| Social fixtures | 6 users, 4 friend links, 8 reviews | displayName, building, status, rating, tags |
| Sources | 2 adapters | Terabee sensor mock, Outlook calendar mock |
| KPIs (derived) | computed on-demand | avgUtilizationPct, peakUtilizationPct, ghostRatePct, wastedEur, busiestBuilding, underusedRooms |

**What this means:** The app already has rich, realistic data spanning occupancy, cost, device health, social behavior, calendar patterns, and privacy — all from 30 days of simulated TU/e campus life.

---

## Use Case Catalog

Each use case is scored on three axes:
- **Data readiness:** Does the data exist today? (✅ = yes, ⚠️ = minor extension needed)
- **Audience appeal:** Who does this impress? (C-level, facilities, students, staff, technical)
- **Demo drama:** Can you show it live with the simulator tick? (🔥 = high visual impact)

---

### 1. The Ghost Meeting Detective 🔥

**Pitch:** "20% of booked meetings have zero attendees. Let's find out who and how much it costs."

**Data:** ✅ Fully supported. Reservations carry a ghost flag (seeded at 20% rate). KPIs endpoint already computes ghostRatePct and wastedEur. Occupancy snapshots confirm zero-occupancy during booked slots.

**Demo flow:**
1. Open dashboard — show ghost rate % and wasted EUR tile
2. Drill into a specific room's reservation list
3. Highlight a ghost meeting: booked by "Sanne de Vries", subject "Sprint review", 0 people showed up
4. Show the cost calculation: 12-capacity room × ghost hours × desk cost
5. Aggregate: "This building wasted €X this month on empty meetings"

**Audience:** C-level / budget holders / facilities management
**Demo drama:** 🔥 — The wasted-EUR number is visceral. Clicking through to see WHO booked empty rooms is compelling.
**Build effort:** Dashboard + live already have this. A dedicated "ghost leaderboard" (repeat ghost organizers) would be a small frontend addition.

---

### 2. Campus Heatmap Live 🔥

**Pitch:** "Watch the campus breathe."

**Data:** ✅ Fully supported. /rooms returns real-time occupancy for all 15 rooms. Buildings/floors are known.

**Demo flow:**
1. Open a building-level heatmap view (Atlas, Flux, Neuron)
2. Hit the simulator tick — watch rooms shift from green (empty) to red (full)
3. Zoom into a floor — see which rooms are hot right now
4. "Notice how Flux 5th floor is always busy at 2pm — that's the Faraday auditorium"

**Audience:** Facilities, campus planners, students (room finder), C-level (visual wow)
**Demo drama:** 🔥🔥 — This is the screenshot/GIF that sells the product. Animated heatmap with the tick is pure demo gold.
**Build effort:** Medium — requires a new frontend page with a floor-plan or grid visualization. Data is already there.

---

### 3. Capacity Right-Sizing Report

**Pitch:** "Your 80-seat PhD defense hall averages 12 people. Your 6-seat focus pods are at 90% utilization. Swap them."

**Data:** ✅ Fully supported. Room capacity vs. actual occupancy snapshots are all present.

**Demo flow:**
1. Open the semester-in-review report (or a new "capacity audit" page)
2. Show bar chart: capacity vs. average actual occupancy per room
3. Highlight the gap: rooms where capacity >> actual (wasted space)
4. Highlight the inverse: small rooms perpetually over-booked (need more of these)
5. Recommendation card: "Reallocate 2 large rooms → 4 focus pods, save €X/year"

**Audience:** C-level, real estate, facilities
**Demo drama:** Medium — static but the numbers are persuasive. Print-friendly for board meetings.
**Build effort:** Low — extends the existing report page with a capacity comparison chart.

---

### 4. Sensor Health Operations Center

**Pitch:** "This is what your IoT ops team sees at 9am on a Monday."

**Data:** ✅ Fully supported. Every reading has batteryPct, rssi, snr. 30 days of telemetry.

**Demo flow:**
1. Open the live page
2. Show device grid: battery levels, signal strength, SNR
3. Filter to "low battery" (< 20%) — flag devices needing maintenance
4. Show a battery degradation curve over 30 days for one device
5. "Device TB-PCL-0008 (Focus Cabin Zoë) has dropped 40% battery in 30 days — schedule replacement"

**Audience:** Technical / IoT operations / Terabee (as a vendor pitch)
**Demo drama:** Medium — the raw telemetry and device health data is credible and specific.
**Build effort:** Low — live page already shows some of this. A dedicated device-health sparkline chart is a small addition.

---

### 5. The Social Campus — "Who's Here?"

**Pitch:** "Students don't just want a room. They want to know if their friends are nearby."

**Data:** ✅ Seeded. 6 users with building-level presence, friend links, room reviews with ratings and tags.

**Demo flow:**
1. Open the friends page
2. "Anaïs is in Atlas right now. Björn is available in Flux."
3. Open room reviews — show ratings, tags (quiet, fast-wifi, temperature-hot)
4. Show the privacy settings page — "opt-in only, no permanent logs"
5. Tie it together: "Find a room near your friends" → room finder with social overlay

**Audience:** Students, student services, student experience teams
**Demo drama:** Medium — social features are sticky but less dramatic than heatmap/ghost.
**Build effort:** Already built (friends, reviews, privacy pages exist). Needs polish for demo flow.

---

### 6. Smart Cleaning & Energy Schedule

**Pitch:** "Stop cleaning empty rooms. Stop heating empty floors."

**Data:** ✅ Supported via occupancy time-series. Cleaning/energy schedules can be derived from actual usage patterns.

**Demo flow:**
1. Show building occupancy by hour-of-day heatmap (which hours are dead?)
2. "Atlas floor 4 averages 2 people after 4pm — switch cleaning to mornings when it's empty"
3. "Neuron is 90% empty on Fridays — reduce HVAC to setback mode"
4. Generate a "recommended cleaning schedule" based on low-occupancy windows

**Audience:** Facilities management, sustainability/green campus teams
**Demo drama:** Medium — operational, not flashy, but saves real money.
**Build effort:** Medium — requires an hour-of-day aggregation view and a schedule generator. Data is there; the UX is new.

---

### 7. Pattern Detective — "When Is It Free?"

**Pitch:** "This room is free every Tuesday at 2pm. Book it."

**Data:** ✅ Supported. 30 days of 15-min occupancy snapshots per room. Day-of-week and hour-of-day patterns are derivable.

**Demo flow:**
1. Pick a busy room (e.g., atlas-0.710 Senaatzaal)
2. Show a weekly occupancy heatmap (day-of-week × hour-of-day)
3. "See this green patch every Tuesday 14:00-15:00? It's consistently empty."
4. "We can predict: this room will be free next Tuesday at 2pm with 85% confidence"

**Audience:** Students (room booking), staff (scheduling), technical (pattern recognition)
**Demo drama:** Medium — the heatmap reveal is satisfying. Predictive angle adds intrigue.
**Build effort:** Medium — requires a weekly-pattern aggregation and visualization. No ML needed; simple historical frequency is enough for demo.

---

### 8. Departmental Booking Analytics

**Pitch:** "EAISI books 40% of Neuron. Electrical Engineering is the heaviest user of Flux. Here's the campus social graph."

**Data:** ⚠️ Partially supported. Reservation subjects and organizer names are present. Department inference requires mapping organizers to departments (a simple lookup table based on building/subject keywords like "EAISI", "PhD", "BEP", "NWO").

**Demo flow:**
1. Show reservation volume by building (stacked by inferred department)
2. "Grant kickoff (NWO/TOPSIS)" meetings cluster in Atlas — research pressure
3. "BEP mid-term review" meetings cluster in Flux — undergraduate activity
4. Show a network graph: which organizers book together?

**Audience:** Department heads, deans, campus planners
**Demo drama:** Low-Medium — analytical, not visual-flashy, but tells a story about campus life.
**Build effort:** Medium — requires a department-inference mapping (simple keyword rules) and new chart visualizations.

---

### 9. RoomSense Wrapped — Gamified Year-in-Review 🔥

**Pitch:** "Spotify Wrapped, but for campus spaces."

**Data:** ✅ Fully supported. Occupancy, reservations, buildings, reviews — all present.

**Demo flow:**
1. "You spent 340 hours in meeting rooms this semester"
2. "Your most-used room: Focus Cabin Zoë (47 bookings)"
3. "Your ghost rate: 12% — better than the campus average of 20%!"
4. "Busiest day: Tuesday. Quietest day: Friday."
5. Shareable card graphic (like Spotify Wrapped)

**Audience:** Students, staff — viral/shareable appeal
**Demo drama:** 🔥 — Gamified, shareable, emotional. The Wrapped format is proven to drive engagement.
**Build effort:** Low-Medium — page already exists (`#wrapped`), needs visual polish and animated number reveals.

---

### 10. Accessibility & Comfort Finder

**Pitch:** "Find a quiet room near bathrooms with good WiFi — based on real student reviews, not a floor plan."

**Data:** ✅ Supported. Room reviews have tags: quiet, noisy, fast-wifi, slow-wifi, near-bathrooms, near-food, temperature-cold, temperature-hot, great-whiteboard, broken-equipment.

**Demo flow:**
1. Open room finder with comfort filters
2. Filter: "quiet + fast-wifi + near-food"
3. Show matching rooms with review scores and tags
4. "Focus Cabin Zoë: 5 stars, tagged quiet + fast-wifi by 3 reviewers"

**Audience:** Students (especially neurodivergent, international students unfamiliar with campus)
**Demo drama:** Medium — practical, inclusive, solves a real daily problem.
**Build effort:** Low — room finder + reviews already exist. Needs a tag-filter UI addition.

---

### 11. Live Demo Mode — The Sales Pitch

**Pitch:** "Watch the data move in real-time."

**Data:** ✅ The simulator tick endpoint (`POST /api/simulate/tick`) advances the clock 15 minutes and appends 30 new readings + snapshots.

**Demo flow:**
1. Open the live page
2. Trigger the tick (presenter mode or curl)
3. Watch occupancy grids update, new readings stream in
4. "This is what it looks like when real Terabee sensors feed data every 15 minutes"
5. Switch to architecture page: "Replace the mock with IoT Hub → Databricks, same API"

**Audience:** All — this is the closer for any demo
**Demo drama:** 🔥🔥 — Live data movement is the most convincing demo trick. It proves the system is real, not static.
**Build effort:** Zero — already built and working.

---

## Summary Matrix

| # | Use Case | Data Ready | Best Audience | Demo Drama | Build Effort |
|---|----------|-----------|---------------|------------|-------------|
| 1 | Ghost Meeting Detective | ✅ | C-level, facilities | 🔥 | Low (mostly exists) |
| 2 | Campus Heatmap Live | ✅ | All audiences | 🔥🔥 | Medium (new viz) |
| 3 | Capacity Right-Sizing | ✅ | C-level, real estate | Medium | Low |
| 4 | Sensor Health Ops | ✅ | Technical, IoT ops | Medium | Low |
| 5 | Social Campus | ✅ | Students, student services | Medium | Zero (exists) |
| 6 | Smart Cleaning/Energy | ✅ | Facilities, sustainability | Medium | Medium |
| 7 | Pattern Detective | ✅ | Students, staff | Medium | Medium |
| 8 | Departmental Analytics | ⚠️ | Department heads | Low-Med | Medium |
| 9 | RoomSense Wrapped | ✅ | Students, staff (viral) | 🔥 | Low-Med (exists) |
| 10 | Accessibility Finder | ✅ | Students (inclusive) | Medium | Low |
| 11 | Live Demo Tick | ✅ | All (closer) | 🔥🔥 | Zero (exists) |

---

## Recommendation: Top 3 Flagship Combos

If the demo is for a mixed audience (professors + staff + students), these three use cases tell the most complete story:

**A. Ghost Meeting Detective (#1) + Live Tick (#11)**
The money story + the "it's real" proof. C-level walks away knowing the cost of empty rooms and that the tech works. ~10 min.

**B. Campus Heatmap (#2) + Accessibility Finder (#10)**
The visual wow + the human impact. Students and staff see a campus that's alive and usable. ~8 min.

**C. RoomSense Wrapped (#9) + Social Campus (#5)**
The engagement play. Shareable, gamified, viral potential. Good for student recruitment and campus experience pitches. ~6 min.

---

## Open Questions

1. **Who is the primary demo audience?** Professors (research/funding), students (engagement), facilities (operations), or C-level (budget)? This determines which flagship to lead with.
2. **Is this a live presentation or a leave-behind?** Live demos favor heatmap/tick; leave-behinds favor reports/Wrapped.
3. **Should we invest in a new visualization (heatmap/floor plan) or polish existing pages?** The heatmap is the highest-impact new build.
4. **Any real Terabee data available?** Even one sensor's worth of real data would transform the demo from "simulated" to "validated."
