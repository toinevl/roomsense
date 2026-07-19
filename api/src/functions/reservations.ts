import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { z } from 'zod'
import { withCors, corsPreflightResponse } from '../lib/cors'
import { logError } from '../lib/log'
import { getTableClient, TABLE_NAMES } from '../lib/tables'

/**
 * GET /api/rooms/{roomId}/reservations?date=YYYY-MM-DD
 *
 * Returns the reservations for a room whose `[startTs, endTs)` overlaps the
 * given UTC calendar day, ascending by startTs.
 *
 * Storage layout: Reservations partitions by roomId, RowKey is
 * `${startTicks}_${hash8(organizer+subject)}`. All reservations for a room are
 * in one partition, so the date filter is applied in memory after a single
 * partition scan.
 *
 * Overlap predicate (half-open interval vs half-open day):
 *   dayStart = Date.parse(date + 'T00:00:00Z')
 *   dayEnd   = dayStart + 86_400_000
 *   overlaps ⟺  start < dayEnd  AND  end > dayStart
 */

const DAY_MS = 24 * 60 * 60 * 1000

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

type ReservationRow = {
  roomId: string
  subject: string
  organizer: string
  startTs: string
  endTs: string
  attendeeCount: number
  sourceId: string
}

type RoomRow = {
  roomId: string
  building?: string
  deviceId?: string
  name?: string
}

export async function reservationsHandler(
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

    const rawDate = request.query.get('date')
    if (rawDate === null) {
      return withCors(
        {
          status: 400,
          jsonBody: { error: 'Missing required `date` query parameter (YYYY-MM-DD).' },
        },
        origin,
      )
    }
    const dateParse = DateSchema.safeParse(rawDate)
    if (!dateParse.success) {
      return withCors(
        {
          status: 400,
          jsonBody: {
            error: `Invalid \`date\` query parameter: must match YYYY-MM-DD, got "${rawDate}".`,
          },
        },
        origin,
      )
    }
    // Regex allows impossible calendar dates (e.g. 2026-02-30) through; reject
    // those by round-tripping through Date.UTC and confirming the day survives.
    const [yStr, mStr, dStr] = rawDate.split('-')
    const y = Number(yStr)
    const m = Number(mStr)
    const d = Number(dStr)
    const reconstructed = new Date(Date.UTC(y, m - 1, d))
    if (
      reconstructed.getUTCFullYear() !== y ||
      reconstructed.getUTCMonth() !== m - 1 ||
      reconstructed.getUTCDate() !== d
    ) {
      return withCors(
        {
          status: 400,
          jsonBody: { error: `Invalid calendar date: "${rawDate}" does not exist.` },
        },
        origin,
      )
    }
    const dayStart = Date.UTC(y, m - 1, d)
    const dayEnd = dayStart + DAY_MS

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

    const reservationsClient = getTableClient(TABLE_NAMES.reservations)
    const matches: ReservationRow[] = []
    const iter = reservationsClient.listEntities<ReservationRow>({
      queryOptions: { filter: `PartitionKey eq '${roomId.replace(/'/g, "''")}'` },
    })
    for await (const row of iter) {
      const startMs = Date.parse(row.startTs)
      const endMs = Date.parse(row.endTs)
      // Half-open overlap: [startMs, endMs) ∩ [dayStart, dayEnd)
      if (startMs < dayEnd && endMs > dayStart) {
        matches.push({
          roomId: row.roomId,
          subject: row.subject,
          organizer: row.organizer,
          startTs: row.startTs,
          endTs: row.endTs,
          attendeeCount: row.attendeeCount,
          sourceId: row.sourceId,
        })
      }
    }

    matches.sort((a, b) => {
      const sa = Date.parse(a.startTs)
      const sb = Date.parse(b.startTs)
      if (sa < sb) return -1
      if (sa > sb) return 1
      return 0
    })

    return withCors({ status: 200, jsonBody: matches }, origin)
  } catch (err) {
    logError(context, 'reservations handler failed', err)
    return withCors(
      { status: 500, jsonBody: { error: 'Internal server error.' } },
      origin,
    )
  }
}

app.http('reservationsByRoom', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'rooms/{roomId}/reservations',
  handler: reservationsHandler,
})
