import { describe, expect, it } from 'vitest'
import { computeRoomStatus, minutesUntilNextBooking, OFFLINE_THRESHOLD_MS } from './roomStatus'
import type { OccupancySnapshot, Reservation, RoomWithOccupancy } from '../../../src/lib/apiTypes'

const REFERENCE_TS = '2026-07-29T11:20:00.000Z'

function makeRoom(overrides: Partial<RoomWithOccupancy> = {}): RoomWithOccupancy {
  return {
    roomId: 'r1',
    building: 'atlas',
    floor: 2,
    name: 'Kelvin',
    capacity: 4,
    deviceId: 'dev-1',
    outlookAddress: 'kelvin@tue.nl',
    sourceId: 'sensor-1',
    occupancy: 0,
    utilizationPct: 0,
    lastSeenTs: REFERENCE_TS,
    ...overrides,
  }
}

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    roomId: 'r1',
    subject: 'Sync',
    organizer: 'Anaïs Dubois',
    startTs: '2026-07-29T10:30:00.000Z',
    endTs: '2026-07-29T12:00:00.000Z',
    attendeeCount: 4,
    sourceId: 'outlook',
    ...overrides,
  }
}

function makeSnapshot(ts: string, occupancy: number, utilizationPct = 0): OccupancySnapshot {
  return { roomId: 'r1', ts, occupancy, utilizationPct, intervalMinutes: 15 }
}

describe('computeRoomStatus', () => {
  it('is free when there is no active reservation and no current occupancy', () => {
    const status = computeRoomStatus({
      room: makeRoom({ occupancy: 0 }),
      referenceTs: REFERENCE_TS,
      reservationsToday: [],
      recentOccupancy: [],
    })
    expect(status.status).toBe('free')
    expect(status.untilText).toBe('Free for the rest of today')
  })

  it('is ghost when a reservation is active but occupancy stayed at 0 throughout its window', () => {
    const reservation = makeReservation()
    const status = computeRoomStatus({
      room: makeRoom({ occupancy: 0 }),
      referenceTs: REFERENCE_TS,
      reservationsToday: [reservation],
      recentOccupancy: [makeSnapshot('2026-07-29T11:00:00.000Z', 0), makeSnapshot('2026-07-29T11:15:00.000Z', 0)],
    })
    expect(status.status).toBe('ghost')
    expect(status.activeReservation).toEqual(reservation)
    expect(status.untilText).toBe('Until 12:00')
  })

  it('is in-use when a reservation is active and occupancy was nonzero during its window', () => {
    const reservation = makeReservation()
    const status = computeRoomStatus({
      room: makeRoom({ occupancy: 4 }),
      referenceTs: REFERENCE_TS,
      reservationsToday: [reservation],
      recentOccupancy: [makeSnapshot('2026-07-29T11:00:00.000Z', 4), makeSnapshot('2026-07-29T11:15:00.000Z', 3)],
    })
    expect(status.status).toBe('in-use')
    expect(status.untilText).toBe('Until 12:00')
  })

  it('is in-use with "not booked" text when occupied without any active reservation', () => {
    const status = computeRoomStatus({
      room: makeRoom({ occupancy: 2 }),
      referenceTs: REFERENCE_TS,
      reservationsToday: [],
      recentOccupancy: [],
    })
    expect(status.status).toBe('in-use')
    expect(status.untilText).toBe('In use — not booked')
    expect(status.activeReservation).toBeNull()
  })

  it('offline wins over ghost when the sensor has not reported in a long time, even with an active reservation', () => {
    const staleLastSeen = new Date(Date.parse(REFERENCE_TS) - OFFLINE_THRESHOLD_MS - 60_000).toISOString()
    const status = computeRoomStatus({
      room: makeRoom({ occupancy: 0, lastSeenTs: staleLastSeen }),
      referenceTs: REFERENCE_TS,
      reservationsToday: [makeReservation()],
      recentOccupancy: [],
    })
    expect(status.status).toBe('offline')
  })

  it('free-until text names the next booking when one exists later today', () => {
    const status = computeRoomStatus({
      room: makeRoom({ occupancy: 0 }),
      referenceTs: REFERENCE_TS,
      reservationsToday: [makeReservation({ startTs: '2026-07-29T15:00:00.000Z', endTs: '2026-07-29T16:00:00.000Z' })],
      recentOccupancy: [],
    })
    expect(status.status).toBe('free')
    expect(status.untilText).toBe('Free until 15:00')
  })

  it('footer includes attendeeCount only when there is an active reservation, and never a CO2 figure', () => {
    const booked = computeRoomStatus({
      room: makeRoom({ occupancy: 4 }),
      referenceTs: REFERENCE_TS,
      reservationsToday: [makeReservation({ attendeeCount: 6 })],
      recentOccupancy: [makeSnapshot('2026-07-29T11:15:00.000Z', 4)],
    })
    expect(booked.footerText).toBe('4 people · 6 booked')
    expect(booked.footerText.toLowerCase()).not.toContain('co2')
    expect(booked.footerText.toLowerCase()).not.toContain('ppm')

    const unbooked = computeRoomStatus({
      room: makeRoom({ occupancy: 0 }),
      referenceTs: REFERENCE_TS,
      reservationsToday: [],
      recentOccupancy: [],
    })
    expect(unbooked.footerText).toBe('0 people')
  })
})

describe('minutesUntilNextBooking', () => {
  it('returns Infinity when there is no upcoming reservation', () => {
    expect(minutesUntilNextBooking([], REFERENCE_TS)).toBe(Infinity)
  })

  it('returns the minutes until the next booking today', () => {
    const minutes = minutesUntilNextBooking(
      [makeReservation({ startTs: '2026-07-29T12:05:00.000Z' })],
      REFERENCE_TS,
    )
    expect(minutes).toBe(45)
  })
})
