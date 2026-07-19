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
