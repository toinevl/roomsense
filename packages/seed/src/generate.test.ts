import { describe, expect, test } from 'vitest'
import { generate } from './generate'

// Fixed end date so assertions are stable regardless of when tests run.
const END = new Date('2026-07-17T12:00:00.000Z')
const out = generate({ seed: 42, days: 30, end: END })

describe('generate', () => {
  test('is deterministic for the same seed', () => {
    const again = generate({ seed: 42, days: 30, end: END })
    expect(again.readings.length).toBe(out.readings.length)
    expect(again.readings[100]).toEqual(out.readings[100])
    expect(again.reservations[10]).toEqual(out.reservations[10])
  })

  test('differs for a different seed', () => {
    const other = generate({ seed: 7, days: 30, end: END })
    expect(other.reservations).not.toEqual(out.reservations)
  })

  test('produces 15 rooms with non-ASCII names present', () => {
    expect(out.rooms).toHaveLength(15)
    const names = out.rooms.map((r) => r.name).join('|')
    expect(names).toMatch(/Höganäs/)
    expect(names).toMatch(/Curaçao/)
    expect(names).toMatch(/Café/)
    // TU/e campus buildings only
    const buildings = new Set(out.rooms.map((r) => r.building))
    expect([...buildings].sort()).toEqual(['atlas', 'flux', 'neuron'])
    // Real TU/e room format: <floor>.<room>
    expect(out.rooms.every((r) => r.roomId.match(/^atlas-|flux-|neuron-\d/))).toBe(true)
  })

  test('ghost-meeting rate is roughly 20%', () => {
    const ghosts = out.reservations.filter((r) => r.ghost).length
    const rate = ghosts / out.reservations.length
    expect(rate).toBeGreaterThan(0.14)
    expect(rate).toBeLessThan(0.26)
  })

  test('weekend traffic is under 5% of weekday traffic', () => {
    let weekday = 0
    let weekend = 0
    for (const s of out.snapshots) {
      const d = new Date(s.ts).getUTCDay()
      if (d === 0 || d === 6) weekend += s.occupancy
      else weekday += s.occupancy
    }
    expect(weekday).toBeGreaterThan(0)
    expect(weekend / weekday).toBeLessThan(0.05)
  })

  test('cumulative counters reset at 04:00 UTC', () => {
    const atReset = out.readings.filter((r) => {
      const d = new Date(r.ts)
      return d.getUTCHours() === 4 && d.getUTCMinutes() === 0
    })
    expect(atReset.length).toBeGreaterThan(0)
    for (const r of atReset) {
      expect(r.countIn).toBe(0)
      expect(r.countOut).toBe(0)
    }
  })

  test('occupancy is countIn minus countOut, never negative', () => {
    for (const r of out.readings) {
      expect(r.countIn).toBeGreaterThanOrEqual(r.countOut)
    }
    for (const s of out.snapshots) {
      expect(s.occupancy).toBeGreaterThanOrEqual(0)
    }
  })

  test('reservations only exist on weekdays within office hours', () => {
    for (const r of out.reservations) {
      const start = new Date(r.startTs)
      expect([0, 6]).not.toContain(start.getUTCDay())
      expect(start.getUTCHours()).toBeGreaterThanOrEqual(8)
      expect(new Date(r.endTs).getUTCHours()).toBeLessThanOrEqual(18)
    }
  })

  test('registers both mock sources', () => {
    const ids = out.sources.map((s) => s.sourceId).sort()
    expect(ids).toEqual(['outlook-mock', 'terabee-iothub-mock'])
  })
})
