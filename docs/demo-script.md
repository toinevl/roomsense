# RoomSense — Demo script

5-slide internal walkthrough for conference-room presentation, ~8 minutes.

---

## Slide 1 — The problem

> "We build software for spaces we cannot see. Meeting rooms are booked but
> empty. No signal. No cost transparency. No urgency to fix it."

Hook: ask the room — "who here walked into a booked-but-empty meeting room this
week?" Most hands go up.

One-liner: RoomSense turns a Terabee People-Counting sensor above the door into
a dashboard that tells ops how much empty-room time is costing.

## Slide 2 — The data

Open the architecture page (`/#architecture`) first — it shows the **real path**
(Terabee → LoRa → network server → IoT Hub → Databricks) and the **demo path**
(seed generator → Azure Tables). This is the slide that wins the technical
audience's trust that the mock is honest.

Key facts to say while the architecture page is up:

- Terabee's LoRa payload carries cumulative `count_in` / `count_out` (uint32).
- Occupancy = `count_in − count_out`, reset daily at 04:00.
- The demo seeds 30 days of realistic data: office-hours curve, ~20% ghost
  meetings, ~10% walk-in traffic, reservation-driven spikes.

Navigate to the **Live** page (`/#live`) and point at a room grid cell.

## Slide 3 — C-level dashboard (`/#dashboard`)

"The thing your facilities team will ask for first."

Walk through the tiles in order:

1. **Utilization %** — how much of the booked time is actually used.
2. **Ghost meeting rate %** — booked-but-empty. The money chart.
3. **Wasted floor-space EUR** — ghost hours × capacity × desk cost.
4. **Busiest building** — where the real pressure is.

Then the heatmap and "booked vs used" bar chart. Point at the ghost table row.

Demo move: click a room in the underused list to drill into occupancy history.

## Slide 4 — Technical live view (`/#live`)

"This is what the ops team sees when a sensor misbehaves."

Point at:

- Room grid: occupancy dots update every 10s (poll).
- Per-room drill: raw telemetry stream (`count_in`/`count_out` per interval).
- Device metadata: mounting height, push period, battery, RSSI, SNR.

The architecture page and live page share the same mock-mode fixture. Both
render the same live data; only the abstraction layer differs.

## Slide 5 — Live advance + adapter seam

"This is the demo trick."

Click **Presenter mode auto-tick** if the feature is live, or call
`POST /api/simulate/tick` from a curl terminal:

```bash
curl -s -X POST http://<api>/api/simulate/tick \
  -H 'x-sim-key: <SIMULATOR_KEY>'
```

Watch the live page update: 30 new readings + 30 new snapshots appended, clock
advances 15 minutes. This is the hook that proves the data is real.

Close with the adapter seam:

> "Right now this is mock data in Azure Tables. Swap Terabee → real IoT Hub
> ingestion or Outlook → real Graph calendar — one new adapter module, zero API
> changes, zero frontend changes. That's the bet."

End with the roadmap slide if asked: #22 deploy, #23 Outlook-mock adapter,
#24 reservations overlay, #25 presenter mode button. Post-demo: real Graph
adapter (#27) and real IoT Hub (#28).

---

## Bonus slides — Audience-specific pitches

Use these with students, staff, professors, or fundraising committees to tailor
the RoomSense story. All four are built into the live app.

### Bonus 1 — Students: Find me a room (`/#finder`)

"One thing every student needs: a quiet place to study, *right now*."

Open the Room Finder page. Show:
- Green cards = empty or low-occupancy rooms
- Sorted by building and floor (quick navigation)
- One-tap to see details

Story: "We're sitting on occupancy data that solves a daily student problem.
This page is the product angle — not IT ops, but student experience. Campus
WiFi shows you the library is full; RoomSense tells you where the quiet rooms
are. That's a feature worth funding."

### Bonus 2 — Leadership: Semester in Review (`/#report`)

"What CFO or department head wants to see?"

Open the Report page. Point out:
- Average utilization %
- Peak utilization %
- Ghost-meeting rate %
- Wasted floor-space €
- Top underused rooms
- Illustrative CO₂ impact (HVAC/lighting waste)

Story: "This is a one-pager auto-generated every semester. Forward it to whoever
holds the budget. It's the case for money: 'We're wasting €X and Y tonnes of CO₂
on ghost meetings. RoomSense fixes this.' The report is the proof."

Demo move: Open browser print preview (Ctrl+P or Cmd+P) and show it fits on one
page. Mention this gets built into a monthly/semester digest that requires zero
manual work.

### Bonus 3 — Students (viral): RoomSense Wrapped (`/#wrapped`)

"Spotify made 'Wrapped' because people love sharing their own stats."

Open the Wrapped card. Show:
- Busiest room you used
- Quietest hideout you found
- Ghost meeting hours campus-wide

Story: "This is intentionally playful. Not for ops, but for students to
screenshot and post. 'Here's my campus occupancy story.' It's marketing candy,
but it's also proof the data is real and relatable. Organic reach."

Demo move: Take a screenshot at phone dimensions (375px) — it looks perfect on
mobile, ready to share.

### Bonus 4 — All audiences: Trust & Transparency (`/#trust`)

"The question everyone asks (but silently): 'Are you tracking me?'"

Open the Trust FAQ page. Highlight:
- "Do you track individuals?" → No, counts only.
- "Do you have cameras?" → No, infrared time-of-flight.
- "How long is data kept?" → 30 days (demo); configurable in production.
- "Who can see what?" → Building-level public; room-level for staff.

Story: "Preempt the privacy objection before they ask. This page is on every
pitch. It's the trust unlock — once they know what you're *not* doing, every
other feature lands better."

---

## Demo flow options

**5-minute technical demo** (default):
Slides 1–5 (problem → architecture → dashboard → live → adapter seam).

**15-minute comprehensive demo** (student/staff/fundraising):
Slides 1–5, then pick 2–3 bonus slides based on the room:
- **For students:** Bonus 1 (Room Finder) + Bonus 3 (Wrapped)
- **For staff/facilities:** Bonus 2 (Report) + Bonus 4 (Trust)
- **For professors/researchers:** Slide 2 (architecture) + Bonus 4 (Trust) +
  mention open dataset potential (in FEATURES.md)
- **For fundraising committee:** Bonus 2 (Report) + Bonus 4 (Trust)
