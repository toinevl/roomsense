# RoomSense — API Contract

All endpoints are anonymous (no auth except simulate/tick). All responses are JSON.
Base URL (prod): `https://roomsense-api2.azurewebsites.net/api`

CORS preflight (`OPTIONS`) handled by platform on every endpoint.

---

## GET /api/health

Liveness probe. Returns build SHA and table status.

**Request**
```
GET /api/health
```

**Response** `200 OK`
```json
{
  "status": "ok",
  "buildSha": "a1b2c3d",
  "tables": ["Rooms", "SensorReadings", "OccupancySnapshots", "Reservations", "Sources"]
}
```

| Status | When |
|--------|------|
| 200 | Always — even if tables are empty. Errors return 500. |

---

## GET /api/rooms

All rooms with their latest known occupancy.

**Request**
```
GET /api/rooms
```

**Response** `200 OK`
```json
[
  {
    "roomId": "amsterdam-101",
    "building": "Amsterdam",
    "floor": 1,
    "name": "Vergaderzaal Höganäs",
    "capacity": 12,
    "deviceId": "terabee-001",
    "occupancy": 5,
    "utilizationPct": 41.7,
    "lastSeenTs": "2025-07-23T10:15:00.000Z"
  }
]
```

---

## GET /api/rooms/:roomId/occupancy

Time-series of occupancy snapshots for a room.

**Request**
```
GET /api/rooms/:roomId/occupancy?from=ISO8601&to=ISO8601
```

| Param | Required | Type | Notes |
|-------|----------|------|-------|
| roomId | yes | path | URL-encoded room ID |
| from | no | query (ISO8601) | Default: 24h ago |
| to | no | query (ISO8601) | Default: now |

**Response** `200 OK` — array ASC by timestamp
```json
[
  {
    "roomId": "amsterdam-101",
    "ts": "2025-07-23T08:00:00.000Z",
    "occupancy": 0,
    "utilizationPct": 0,
    "intervalMinutes": 15
  }
]
```

---

## GET /api/rooms/:roomId/readings

Raw Terabee sensor telemetry (DESC — newest first).

**Request**
```
GET /api/rooms/:roomId/readings?limit=50
```

| Param | Required | Type | Default |
|-------|----------|------|---------|
| limit | no | int (1–500) | 50 |

**Response** `200 OK`
```json
[
  {
    "deviceId": "terabee-001",
    "ts": "2025-07-23T10:15:00.000Z",
    "countIn": 47,
    "countOut": 42,
    "flags": 0,
    "batteryPct": 87,
    "rssi": -64,
    "snr": 9.5,
    "sourceId": "terabee-lora"
  }
]
```

Occupancy is derived: `countIn - countOut`, clamped >= 0. Field names match 
Terabee's `pcl_lora_payload_decoder`.

---

## GET /api/rooms/:roomId/reservations

Calendar bookings for a room.

**Request**
```
GET /api/rooms/:roomId/reservations?date=YYYY-MM-DD
```

| Param | Required | Type | Default |
|-------|----------|------|---------|
| date | no | YYYY-MM-DD | Today (UTC) |

**Response** `200 OK` — array ASC by start time
```json
[
  {
    "roomId": "amsterdam-101",
    "subject": "Sprint Planning",
    "organizer": "Anaïs Dubois",
    "startTs": "2025-07-23T09:00:00.000Z",
    "endTs": "2025-07-23T10:00:00.000Z",
    "attendeeCount": 8,
    "sourceId": "outlook-mock"
  }
]
```

**Ghost meeting:** A reservation slot where max occupancy = 0. Derived, never stored.

---

## GET /api/kpis

Aggregate KPIs for the dashboard. Requires explicit date range (400 without).

**Request**
```
GET /api/kpis?from=ISO8601&to=ISO8601
```

| Param | Required | Type | Notes |
|-------|----------|------|-------|
| from | yes | ISO8601 | Inclusive |
| to | yes | ISO8601 | Inclusive |

**Response** `200 OK`
```json
{
  "avgUtilizationPct": 34.2,
  "peakUtilizationPct": 87.5,
  "ghostMeetingRate": 12.0,
  "wastedEuros": 4200,
  "busiestBuilding": "Amsterdam"
}
```

| Status | When |
|--------|------|
| 400 | Missing `from` or `to` |
| 500 | Storage query failure |

---

## GET /api/sources

Status of all registered data-source adapters.

**Request**
```
GET /api/sources
```

**Response** `200 OK`
```json
[
  {
    "sourceId": "outlook-mock",
    "displayName": "Outlook (Mock)",
    "kind": "calendar",
    "status": "active",
    "lastSyncTs": "2025-07-23T10:00:00.000Z"
  }
]
```

---

## GET /api/presence

User presence, optionally filtered by building.

**Request**
```
GET /api/presence?building=Amsterdam
```

**Response** `200 OK`
```json
[
  {
    "userId": "user-001",
    "displayName": "Anaïs Dubois",
    "building": "Amsterdam",
    "roomId": "amsterdam-101",
    "status": "available",
    "lastSeenTs": "2025-07-23T10:15:00.000Z"
  }
]
```

---

## GET /api/users/:userId/friends

Friend links for a user.

**Request**
```
GET /api/users/:userId/friends
```

**Response** `200 OK`
```json
[
  {
    "userId": "user-001",
    "friendId": "user-002",
    "friendName": "Erik Janssen",
    "status": "active",
    "canSeeLive": true,
    "connectedAt": "2025-07-01T12:00:00.000Z"
  }
]
```

---

## GET /api/rooms/:roomId/reviews

Reviews for a room.

**Request**
```
GET /api/rooms/:roomId/reviews?sort=recent|helpful
```

| Param | Required | Type | Default |
|-------|----------|------|---------|
| sort | no | `recent` \| `helpful` | `recent` |

**Response** `200 OK`
```json
[
  {
    "reviewId": "rev-001",
    "roomId": "amsterdam-101",
    "authorId": "user-003",
    "authorName": "Zaal Curaçao",
    "rating": 5,
    "title": "Great whiteboard space",
    "body": "Excellent room for brainstorming sessions...",
    "tags": ["quiet", "great-whiteboard", "fast-wifi"],
    "helpfulCount": 3,
    "status": "active",
    "createdAt": "2025-07-15T10:00:00.000Z",
    "updatedAt": "2025-07-15T10:00:00.000Z"
  }
]
```

---

## POST /api/reviews

Submit a new review.

**Request**
```
POST /api/reviews
Content-Type: application/json
```
```json
{
  "roomId": "amsterdam-101",
  "authorId": "user-003",
  "authorName": "Zaal Curaçao",
  "rating": 4,
  "title": "Solid meeting room",
  "body": "Good size, temperature was a bit warm though.",
  "tags": ["near-food", "temperature-hot"]
}
```

| Field | Required | Validation |
|-------|----------|------------|
| roomId | yes | non-empty string |
| authorId | yes | non-empty string |
| authorName | yes | non-empty string |
| rating | yes | integer 1–5 |
| title | yes | string, 3–50 chars |
| body | yes | string, 10–500 chars |
| tags | no | array of ReviewTag values |

**Response** `201 Created` — the created review with generated `reviewId`, timestamps.

| Status | When |
|--------|------|
| 400 | Validation failure — body names the field and reason |
| 500 | Storage write failure |

---

## GET /api/users/:userId/privacy

Privacy settings for a user.

**Request**
```
GET /api/users/:userId/privacy
```

**Response** `200 OK`
```json
{
  "userId": "user-001",
  "locationSharingEnabled": false,
  "friendVisibility": "friends-only",
  "reviewAttributionDefault": "anonymous",
  "dataRetentionDays": 1,
  "lastUpdated": "2025-07-23T10:00:00.000Z"
}
```

---

## PATCH /api/users/:userId/privacy

Update privacy settings (partial update).

**Request**
```
PATCH /api/users/:userId/privacy
Content-Type: application/json
```
```json
{
  "locationSharingEnabled": true,
  "friendVisibility": "campus"
}
```

**Response** `200 OK` — the full updated settings object.

---

## POST /api/simulate/tick

Advance the demo clock. Appends ~30 new readings to simulate live data.

**Request**
```
POST /api/simulate/tick
x-sim-key: <simulator-key>
```

| Header | Required | Notes |
|--------|----------|-------|
| x-sim-key | yes | Shared secret — never baked into frontend bundle |

**Response** `200 OK`
```json
{
  "appended": 15,
  "ts": "2025-07-23T10:45:00.000Z"
}
```

| Status | When |
|--------|------|
| 401 | Missing or invalid x-sim-key |
| 500 | Storage write failure |

---

## Error Response Shapes

All errors return JSON:
```json
{
  "error": "Human-readable message",
  "status": 400
}
```

**Critical:** Response header values must be ASCII-only. Never put room names or 
free text in a header — the Azure Functions host rejects non-ASCII header bytes 
(`System.InvalidOperationException`).

---

## CORS

Platform CORS configured via:
```bash
az functionapp cors add -g rgRoomSense -n roomsense-api2 \
  --allowed-origins https://roomsense.van-vliet.eu
```

This is NOT expressible in Bicep and is NOT the same as app-level 
ALLOWED_ORIGINS. It must be set in the deploy workflow.
