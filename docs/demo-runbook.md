# RoomSense Demo Runbook

## Pre-demo (T-15 min)

### 1. Re-seed production data

Always clear Reservations first (content-derived row keys cause duplicates on re-seed):

```bash
az storage table delete --name Reservations --account-name roomsensestorage --auth-mode login
```

Then re-seed with fresh 30-day data ending today:

```bash
cd /home/toine/AI-Projects/projects/playground/roomsense
TABLES_CONNECTION_STRING=$(az storage account show-connection-string \
  -g rgRoomSense -n roomsensestorage -o tsv) \
  pnpm seed:azure
```

This regenerates ~43k readings, ~43k snapshots, ~1.3k reservations across 15 rooms.

### 2. Verify data freshness

```bash
curl -s "https://roomsense-api2.azurewebsites.net/api/rooms" | jq '.[0].lastSeenTs'
# Should show today's date
```

### 3. Verify presenter mode tick

```bash
curl -s -X POST "https://roomsense-api2.azurewebsites.net/api/simulate/tick" \
  -H "x-sim-key: 12345679"
# Should return: {"appended":30,"ts":"<today+15min>"}
```

### 4. Smoke test frontend

Open `https://lemon-mud-06bc7fd03.7.azurestaticapps.net/#dashboard` —
dashboard tiles should show non-zero utilization and recent timestamps.

## Demo flow (~10 min)

1. **Architecture** (2 min) — credibility: real Terabee path vs demo path, adapter seam
2. **Dashboard** (4 min) — ghost hours headline, booked-vs-used chart, click underused room → live drill-in (red ghost bands)
3. **Report** (3 min) — portfolio capacity headline (187 seats, peak 62), room efficiency table, recommended actions
4. **Live** (1 min) — hit presenter mode tick, watch data move

## Post-demo cleanup

If someone abuses the exposed simulator key during/after the demo:

```bash
# Just re-seed to reset all data
TABLES_CONNECTION_STRING=$(az storage account show-connection-string \
  -g rgRoomSense -n roomsensestorage -o tsv) \
  pnpm seed:azure
```
