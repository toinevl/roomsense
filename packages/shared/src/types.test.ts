import { describe, expect, test } from 'vitest'
import {
  SensorReadingSchema,
  RoomSchema,
  ReservationSchema,
  OccupancySnapshotSchema,
} from './types'

describe('SensorReadingSchema', () => {
  const valid = {
    deviceId: 'TB-PCL-0001',
    ts: '2026-07-19T10:15:00.000Z',
    countIn: 42,
    countOut: 40,
    flags: 0,
    batteryPct: 97.5,
    rssi: -71,
    snr: 9.25,
    sourceId: 'terabee-iothub-mock',
  }

  test('accepts a valid reading', () => {
    expect(SensorReadingSchema.parse(valid)).toEqual(valid)
  })

  test('rejects negative cumulative counts', () => {
    expect(() => SensorReadingSchema.parse({ ...valid, countIn: -1 })).toThrow()
  })

  test('rejects flags outside one byte', () => {
    expect(() => SensorReadingSchema.parse({ ...valid, flags: 256 })).toThrow()
  })
})

describe('RoomSchema', () => {
  test('accepts a room with a non-ASCII name', () => {
    const room = {
      roomId: 'atlas-4-410',
      building: 'atlas',
      floor: 4,
      name: 'Vergaderzaal Höganäs',
      capacity: 8,
      deviceId: 'TB-PCL-0001',
      outlookAddress: 'atlas-4-410@rooms.demo',
      sourceId: 'terabee-iothub-mock',
    }
    expect(RoomSchema.parse(room).name).toBe('Vergaderzaal Höganäs')
  })
})

describe('ReservationSchema', () => {
  test('accepts a reservation with a non-ASCII organizer', () => {
    const r = {
      roomId: 'flux-2-201',
      subject: 'Kwartaalreview',
      organizer: 'Anaïs Dubois',
      startTs: '2026-07-20T09:00:00.000Z',
      endTs: '2026-07-20T10:00:00.000Z',
      attendeeCount: 5,
      sourceId: 'outlook-mock',
    }
    expect(ReservationSchema.parse(r).organizer).toBe('Anaïs Dubois')
  })
})

describe('OccupancySnapshotSchema', () => {
  test('only accepts 15-minute intervals', () => {
    const s = {
      roomId: 'atlas-4-410',
      ts: '2026-07-19T10:15:00.000Z',
      occupancy: 4,
      utilizationPct: 50,
      intervalMinutes: 15,
    }
    expect(OccupancySnapshotSchema.parse(s).intervalMinutes).toBe(15)
    expect(() => OccupancySnapshotSchema.parse({ ...s, intervalMinutes: 30 })).toThrow()
  })
})
