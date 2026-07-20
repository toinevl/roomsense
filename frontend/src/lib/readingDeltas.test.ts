import { describe, expect, test } from 'vitest'
import { generate } from '@roomsense/seed'
import { computeReadingDeltas } from './readingDeltas'
import type { SensorReading } from './apiTypes'

function reading(over: Partial<SensorReading>): SensorReading {
  return {
    deviceId: 'TB-PCL-0001',
    ts: '2026-07-17T10:00:00.000Z',
    countIn: 10,
    countOut: 5,
    flags: 0,
    batteryPct: 90,
    rssi: -70,
    snr: 8,
    sourceId: 'terabee-iothub-mock',
    ...over,
  }
}

describe('computeReadingDeltas', () => {
  test('empty input returns empty output', () => {
    expect(computeReadingDeltas([])).toEqual([])
  })

  test('single reading has null deltas (no older reading to diff against)', () => {
    const [result] = computeReadingDeltas([reading({})])
    expect(result!.deltaIn).toBeNull()
    expect(result!.deltaOut).toBeNull()
    expect(result!.deltaOccupancy).toBeNull()
    expect(result!.reset).toBe(false)
  })

  test('descending pair (newest first, per API contract) yields correct deltas', () => {
    const newer = reading({ ts: '2026-07-17T10:15:00.000Z', countIn: 14, countOut: 6 })
    const older = reading({ ts: '2026-07-17T10:00:00.000Z', countIn: 10, countOut: 5 })
    const [result] = computeReadingDeltas([newer, older])
    expect(result!.deltaIn).toBe(4)
    expect(result!.deltaOut).toBe(1)
    expect(result!.deltaOccupancy).toBe(3)
    expect(result!.reset).toBe(false)
  })

  test('a counter drop is flagged as a reset, not a negative delta', () => {
    const newer = reading({ ts: '2026-07-17T04:00:00.000Z', countIn: 2, countOut: 0 })
    const older = reading({ ts: '2026-07-17T03:45:00.000Z', countIn: 48, countOut: 30 })
    const [result] = computeReadingDeltas([newer, older])
    expect(result!.reset).toBe(true)
    expect(result!.deltaIn).toBeNull()
    expect(result!.deltaOut).toBeNull()
    expect(result!.deltaOccupancy).toBeNull()
  })

  test('real seed data: 30 days of one device readings never produces a negative delta', () => {
    const seed = generate({ seed: 42, days: 30, end: new Date('2026-07-17T12:00:00.000Z') })
    const deviceId = seed.rooms[0]!.deviceId
    const readings = seed.readings.filter((r) => r.deviceId === deviceId).slice().reverse() // desc by ts
    const deltas = computeReadingDeltas(readings)
    for (const d of deltas) {
      if (d.reset) continue
      expect(d.deltaIn === null || d.deltaIn >= 0).toBe(true)
      expect(d.deltaOut === null || d.deltaOut >= 0).toBe(true)
    }
    // CLAUDE.md: daily reset at 04:00 UTC over 30 days must show up at least once.
    expect(deltas.some((d) => d.reset)).toBe(true)
  })
})
