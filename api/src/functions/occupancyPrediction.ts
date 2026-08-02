import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import type { OccupancySnapshot } from '@roomsense/shared'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { getTableClient, TABLE_NAMES } from '../lib/tables'

/**
 * Phase 3 #38 — GET /api/occupancy/prediction?roomId=&now= → +30m/+60m
 * occupancy estimate. Heuristic (not ML — see spec's "Future ML Path"):
 * average this room's historical occupancy across all snapshots that fall
 * in the same 15-minute-of-day bucket as the target time, any calendar day.
 */

const BUCKET_MINUTES = 15
const BUCKET_MS = BUCKET_MINUTES * 60_000

function bucketOfDay(iso: string): number {
  const d = new Date(iso)
  const minutesSinceMidnight = d.getUTCHours() * 60 + d.getUTCMinutes()
  return Math.floor(minutesSinceMidnight / BUCKET_MINUTES)
}

export function predictBucket(snapshots: OccupancySnapshot[], targetTs: string): number {
  const targetBucket = bucketOfDay(targetTs)
  const matches = snapshots.filter((s) => bucketOfDay(s.ts) === targetBucket)
  if (matches.length === 0) return 0
  return matches.reduce((sum, s) => sum + s.occupancy, 0) / matches.length
}

export async function occupancyPredictionHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const origin = req.headers.get('origin') ?? undefined
  if (req.method === 'OPTIONS') return corsPreflightResponse(origin)

  try {
    const roomId = req.query.get('roomId')
    if (!roomId) {
      return withCors({ status: 400, jsonBody: { error: 'Missing roomId query parameter.' } }, origin)
    }
    const now = req.query.get('now') ?? new Date().toISOString()

    const client = getTableClient(TABLE_NAMES.snapshots)
    const snapshots: OccupancySnapshot[] = []
    for await (const e of client.listEntities<OccupancySnapshot & { partitionKey: string; rowKey: string }>({
      queryOptions: { filter: `PartitionKey eq '${roomId.replace(/'/g, "''")}'` },
    })) {
      const { partitionKey: _pk, rowKey: _rk, ...fields } = e
      snapshots.push(fields)
    }

    const nowMs = Date.parse(now)
    const currentSnap = snapshots.find((s) => Math.abs(Date.parse(s.ts) - nowMs) < BUCKET_MS)

    return withCors(
      {
        status: 200,
        jsonBody: {
          roomId,
          now: { occupancy: currentSnap?.occupancy ?? 0 },
          plus30m: { occupancy: predictBucket(snapshots, new Date(nowMs + 30 * 60_000).toISOString()) },
          plus60m: { occupancy: predictBucket(snapshots, new Date(nowMs + 60 * 60_000).toISOString()) },
        },
      },
      origin,
    )
  } catch (err) {
    logError(ctx, 'occupancy prediction handler failed', err)
    return withCors({ status: 500, jsonBody: { error: 'Internal server error.' } }, origin)
  }
}

app.http('occupancyPrediction', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'occupancy/prediction',
  handler: occupancyPredictionHandler,
})
