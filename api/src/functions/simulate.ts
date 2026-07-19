import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { invertedTicks } from '@roomsense/shared'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { ensureTable, getTableClient, TABLE_NAMES } from '../lib/tables'

/**
 * POST /api/simulate/tick (header x-sim-key) → { appended: number, ts: string } | 401
 *
 * Wishlist #12 — key-protected demo "live mode" tick. Advances the simulator
 * ONE 15-min interval from the latest reading state, appending a fresh
 * SensorReading + OccupancySnapshot row for every room's device.
 *
 * Auth: header `x-sim-key` is compared against process.env.SIMULATOR_KEY. If
 * the env var is unset, we fail closed (401 for everyone) — never default to
 * a magic value. Missing/mismatched key → 401 `{ error: 'Unauthorized' }`.
 * The handler NEVER throws on auth failure — it returns 401.
 *
 * Simulation semantics (per room):
 *   1. Find the room's deviceId (Rooms partition/row already known).
 *   2. Find the LATEST SensorReading for that device (top-1 by RowKey ASC on
 *      the deviceId partition — inverted-ticks put newest first).
 *   3. newTs = latestReading.ts + 15 minutes.
 *   4. countIn/countOut are CUMULATIVE — new value = latest + small random
 *      non-negative walk. flags=0, batteryPct drifts -0.1 (clamped ≥ 0),
 *      rssi/snr jittered ±5. sourceId='terabee-iothub-mock'.
 *   5. occupancy = newCountIn - newCountOut (clamped ≥ 0).
 *   6. utilizationPct = (occupancy / room.capacity) * 100, clamped ≥ 0.
 *   7. Write SensorReading: PartitionKey=deviceId, RowKey=invertedTicks(newTs).
 *   8. Write OccupancySnapshot: PartitionKey=roomId, RowKey=invertedTicks(newTs),
 *      intervalMinutes=15.
 *   9. createEntity (NOT upsert) — 409 on a re-tick of the same interval is
 *      acceptable: catch and skip, count only successful appends.
 *
 * `ts` in the 200 response = ISO timestamp of the newly-appended interval
 * (the new latest — same for every room because they all advance 15 min from
 * their own latest, but the response reports the first device's newTs; tests
 * only assert it equals latest+15min for device 0).
 *
 * `appended` = number of rows actually written (15 readings + 15 snapshots
 * expected in production with 15 rooms; tests assert ≥ 1 and equality with
 * the count of successful createEntity calls).
 */

const INTERVAL_MS = 15 * 60 * 1000
const SIM_SOURCE_ID = 'terabee-iothub-mock'

type RoomEntity = {
  partitionKey: string
  rowKey: string
  roomId: string
  building: string
  floor: number
  name: string
  capacity: number
  deviceId: string
  outlookAddress: string
  sourceId: string
}

type ReadingEntity = {
  partitionKey: string
  rowKey: string
  deviceId: string
  ts: string
  countIn: number
  countOut: number
  flags: number
  batteryPct: number
  rssi: number
  snr: number
  sourceId: string
}

type SnapshotEntity = {
  partitionKey: string
  rowKey: string
  roomId: string
  ts: string
  occupancy: number
  utilizationPct: number
  intervalMinutes: number
}

/**
 * Constant-time-ish string compare. Not a true constant-time implementation
 * (Math.random-driven simulator isn't a security boundary), but it avoids the
 * early-exit short-circuit of === so timing leaks don't reveal prefix length.
 * Falls back to plain === if lengths differ — length itself is not a secret
 * for a static demo key.
 */
function keysMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Latest SensorReading for a device. SensorReadings partitions by deviceId
 * and RowKey = invertedTicks(ts), so the lexicographically smallest RowKey
 * is the newest — `maxPageSize: 1` partition scan yields it in one round-trip.
 */
async function latestReadingForDevice(
  deviceId: string,
): Promise<ReadingEntity | undefined> {
  const client = getTableClient(TABLE_NAMES.readings)
  const pages = client
    .listEntities<ReadingEntity>({
      queryOptions: { filter: `PartitionKey eq '${deviceId}'` },
    })
    .byPage({ maxPageSize: 1 })
  for await (const page of pages) {
    if (page.length > 0) return page[0] as ReadingEntity
    break
  }
  return undefined
}

/** Small non-negative random walk step in [0, max]. */
function walk(max: number): number {
  return Math.floor(Math.random() * (max + 1))
}

/** Jitter a numeric reading by ±jitter (no clamp on signal fields). */
function jitter(value: number, amplitude: number): number {
  return value + (Math.random() * 2 - 1) * amplitude
}

export async function simulateTickHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = req.headers.get('origin') ?? undefined

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(origin)
  }

  // Auth: fail closed. Unset SIMULATOR_KEY → 401 for everyone. Never throws.
  const expectedKey = process.env.SIMULATOR_KEY
  if (!expectedKey) {
    return withCors({ status: 401, jsonBody: { error: 'Unauthorized' } }, origin)
  }
  const providedKey = req.headers.get('x-sim-key')
  if (!providedKey || !keysMatch(providedKey, expectedKey)) {
    return withCors({ status: 401, jsonBody: { error: 'Unauthorized' } }, origin)
  }

  try {
    // Ensure both write tables exist — the simulator may run before the seeder
    // on a fresh environment. ensureTable is idempotent (409 is swallowed).
    await ensureTable(TABLE_NAMES.readings)
    await ensureTable(TABLE_NAMES.snapshots)

    // Enumerate every room.
    const roomsClient = getTableClient(TABLE_NAMES.rooms)
    const rooms: RoomEntity[] = []
    for await (const entity of roomsClient.listEntities<RoomEntity>()) {
      rooms.push(entity)
    }

    const readingsClient = getTableClient(TABLE_NAMES.readings)
    const snapshotsClient = getTableClient(TABLE_NAMES.snapshots)

    let appended = 0
    let firstNewTs: string | undefined

    for (const room of rooms) {
      const latest = await latestReadingForDevice(room.deviceId)
      // Defensive: skip a room with no prior reading rather than crashing the
      // whole tick. Production has seed data; tests always provide one.
      if (!latest) continue

      const latestMs = Date.parse(latest.ts)
      const newMs = latestMs + INTERVAL_MS
      const newTs = new Date(newMs).toISOString()
      if (firstNewTs === undefined) firstNewTs = newTs

      // Cumulative counters — never decrease. Walk ∈ [0, 3].
      const newCountIn = latest.countIn + walk(3)
      const newCountOut = latest.countOut + walk(3)
      const occupancy = Math.max(0, newCountIn - newCountOut)
      const utilizationPct = Math.max(0, (occupancy / room.capacity) * 100)
      const newRowKey = invertedTicks(newMs)

      // SensorReading row.
      const readingEntity: Partial<ReadingEntity> & {
        partitionKey: string
        rowKey: string
      } = {
        partitionKey: room.deviceId,
        rowKey: newRowKey,
        deviceId: room.deviceId,
        ts: newTs,
        countIn: newCountIn,
        countOut: newCountOut,
        flags: 0,
        batteryPct: Math.max(0, latest.batteryPct - 0.1),
        rssi: jitter(latest.rssi, 5),
        snr: jitter(latest.snr, 5),
        sourceId: SIM_SOURCE_ID,
      }
      try {
        await readingsClient.createEntity(readingEntity)
        appended++
      } catch (err: unknown) {
        const e = err as { statusCode?: number; code?: string }
        // 409 / EntityAlreadyExists → re-tick of the same interval: skip.
        if (e?.statusCode !== 409 && e?.code !== 'EntityAlreadyExists') throw err
      }

      // OccupancySnapshot row.
      const snapshotEntity: Partial<SnapshotEntity> & {
        partitionKey: string
        rowKey: string
      } = {
        partitionKey: room.roomId,
        rowKey: newRowKey,
        roomId: room.roomId,
        ts: newTs,
        occupancy,
        utilizationPct,
        intervalMinutes: 15,
      }
      try {
        await snapshotsClient.createEntity(snapshotEntity)
        appended++
      } catch (err: unknown) {
        const e = err as { statusCode?: number; code?: string }
        if (e?.statusCode !== 409 && e?.code !== 'EntityAlreadyExists') throw err
      }
    }

    // Always 200 on valid key, even if zero rows appended (defensive).
    return withCors(
      {
        status: 200,
        jsonBody: {
          appended,
          ts: firstNewTs ?? new Date().toISOString(),
        },
      },
      origin,
    )
  } catch (err) {
    logError(ctx, 'simulate/tick: failed', err)
    return withCors(
      { status: 500, jsonBody: { error: 'Internal server error' } },
      origin,
    )
  }
}

app.http('simulateTick', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'simulate/tick',
  handler: simulateTickHandler,
})
