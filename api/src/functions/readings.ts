import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { z } from 'zod'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { getTableClient, TABLE_NAMES } from '../lib/tables'

/**
 * GET /api/rooms/{roomId}/readings?limit=50
 *
 * Returns raw Terabee telemetry rows for a room's sensor, descending by ts
 * (newest first). `limit` defaults to 50, clamps to [1, 200] for in-range
 * numeric values, and returns 400 for unparseable non-numeric input (garbage
 * is surfaced, not silently defaulted — standing convention).
 *
 * Storage layout: SensorReadings partitions by deviceId, RowKey is
 * `invertedTicks(ts)` so the lexicographically smallest RowKey is the newest
 * reading. Reading the partition top-N by RowKey ASC = newest-first = DESC by ts.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * `limit` defaults to 50. Out-of-range numeric values are CLAMPED to [1, 200]
 * (liberal in what we accept). Unparseable non-numeric input is rejected with
 * a 400 — garbage is surfaced, never silently defaulted.
 */
const LIMIT_SCHEMA = z
  .union([z.coerce.number(), z.nan()])
  .transform((v) => (Number.isFinite(v) ? Math.max(1, Math.min(200, Math.trunc(v))) : NaN))
  .refine((v) => !Number.isNaN(v), {
    message: 'limit must be a number between 1 and 200',
  })

const QuerySchema = z.object({
  limit: LIMIT_SCHEMA.optional().transform((v) => (v === undefined ? 50 : v)),
})

type ReadingRow = {
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

type RoomRow = {
  roomId: string
  building?: string
  deviceId: string
  name?: string
}

export async function readingsHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = request.headers.get('origin') ?? undefined

  if (request.method === 'OPTIONS') {
    return corsPreflightResponse(origin)
  }

  try {
    const roomId = request.params.roomId
    if (!roomId) {
      return withCors(
        {
          status: 400,
          jsonBody: { error: 'Missing roomId route parameter.' },
        },
        origin,
      )
    }

    const parsed = QuerySchema.safeParse({
      limit: request.query.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      return withCors(
        {
          status: 400,
          jsonBody: {
            error:
              'Invalid `limit` query parameter: must be an integer between 1 and 200.',
            details: parsed.error.issues,
          },
        },
        origin,
      )
    }
    const limit = parsed.data.limit
    void DAY_MS // reserved for future range filters

    const roomsClient = getTableClient(TABLE_NAMES.rooms)
    const roomIterator = roomsClient.listEntities<RoomRow>({
      queryOptions: { filter: `RowKey eq '${roomId.replace(/'/g, "''")}'` },
    })
    let room: RoomRow | undefined
    for await (const row of roomIterator) {
      room = row
      break
    }
    if (!room) {
      return withCors(
        { status: 404, jsonBody: { error: `Unknown roomId: ${roomId}` } },
        origin,
      )
    }

    const deviceId = room.deviceId
    const readingsClient = getTableClient(TABLE_NAMES.readings)
    const readings: ReadingRow[] = []
    const pages = readingsClient
      .listEntities<ReadingRow>({
        queryOptions: { filter: `PartitionKey eq '${deviceId.replace(/'/g, "''")}'` },
      })
      .byPage({ maxPageSize: limit })

    for await (const page of pages) {
      for (const row of page) {
        if (readings.length >= limit) break
        readings.push({
          deviceId: row.deviceId,
          ts: row.ts,
          countIn: row.countIn,
          countOut: row.countOut,
          flags: row.flags,
          batteryPct: row.batteryPct,
          rssi: row.rssi,
          snr: row.snr,
          sourceId: row.sourceId,
        })
      }
      if (readings.length >= limit) break
    }

    return withCors({ status: 200, jsonBody: readings }, origin)
  } catch (err) {
    logError(context, 'readings handler failed', err)
    return withCors(
      { status: 500, jsonBody: { error: 'Internal server error.' } },
      origin,
    )
  }
}

app.http('readingsByRoom', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'rooms/{roomId}/readings',
  handler: readingsHandler,
})
