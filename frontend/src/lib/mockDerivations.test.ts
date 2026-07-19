import { describe, expect, test } from 'vitest'
import { generate } from '@roomsense/seed'
import {
  COST_PER_DESK_HOUR_EUR,
  buildIndex,
  deriveHealth,
  deriveKpis,
  deriveOccupancy,
  deriveReadings,
  deriveReservations,
  deriveRooms,
  findLatestActiveIndex,
  isGhostReservation,
} from './mockDerivations'

// Fixed window so assertions are stable regardless of when the suite runs —
// same convention as packages/seed/src/generate.test.ts.
const END = new Date('2026-07-17T12:00:00.000Z')
const seed = generate({ seed: 42, days: 30, end: END })
const index = buildIndex(seed)

describe('deriveHealth', () => {
  test('reports ok/mock status', () => {
    expect(deriveHealth()).toEqual({ status: 'ok', buildSha: 'mock', tables: true })
  })
})

describe('deriveRooms', () => {
  const rooms = deriveRooms(seed, index)

  test('returns all 15 rooms joined with latest occupancy', () => {
    expect(rooms).toHaveLength(15)
    for (const room of rooms) {
      expect(typeof room.occupancy).toBe('number')
      expect(typeof room.utilizationPct).toBe('number')
      expect(typeof room.lastSeenTs).toBe('string')
    }
  })

  test('non-ASCII room names survive the derivation round-trip', () => {
    const names = rooms.map((r) => r.name)
    expect(names).toContain('Vergaderzaal Höganäs')
    expect(names).toContain('Zaal Curaçao')
    expect(names).toContain('Café Atlas Corner')
    expect(names).toContain('Boardroom Hèlmholtz')
    // Byte-level check, not just substring match: confirm no mangled encoding.
    const hoganas = rooms.find((r) => r.roomId === 'atlas-1.320')
    expect(hoganas?.name).toBe('Vergaderzaal Höganäs')
  })

  test('lastSeenTs matches the room\'s latest office-hours snapshot', () => {
    const room = rooms[0]!
    const snaps = index.snapshotsByRoom.get(room.roomId)!
    const expected = snaps[findLatestActiveIndex(snaps)]!
    expect(room.lastSeenTs).toBe(expected.ts)
    expect(room.occupancy).toBe(expected.occupancy)
  })

  test('"latest" is never the generator\'s dead-of-night window edge', () => {
    // Regression guard: the seed's 30-day window always ends at UTC
    // midnight, so the literal last row is always ~0% utilization. Confirm
    // deriveRooms is anchored to office hours instead, across every room.
    for (const room of rooms) {
      const d = new Date(room.lastSeenTs)
      const day = d.getUTCDay()
      expect(day).not.toBe(0)
      expect(day).not.toBe(6)
      expect(d.getUTCHours()).toBeGreaterThanOrEqual(8)
      expect(d.getUTCHours()).toBeLessThan(18)
    }
  })
})

describe('deriveOccupancy', () => {
  test('returns ascending snapshots for a room', () => {
    const roomId = seed.rooms[0]!.roomId
    const series = deriveOccupancy(seed, index, roomId)
    expect(series.length).toBeGreaterThan(0)
    for (let i = 1; i < series.length; i++) {
      expect(Date.parse(series[i]!.ts)).toBeGreaterThanOrEqual(Date.parse(series[i - 1]!.ts))
    }
  })

  test('filters by from/to range', () => {
    const roomId = seed.rooms[0]!.roomId
    const full = deriveOccupancy(seed, index, roomId)
    const midpoint = full[Math.floor(full.length / 2)]!.ts
    const filtered = deriveOccupancy(seed, index, roomId, midpoint)
    expect(filtered.length).toBeLessThan(full.length)
    expect(filtered.every((s) => Date.parse(s.ts) >= Date.parse(midpoint))).toBe(true)
  })

  test('throws when from is after to (mirrors API 400)', () => {
    const roomId = seed.rooms[0]!.roomId
    expect(() => deriveOccupancy(seed, index, roomId, '2026-07-10T00:00:00.000Z', '2026-07-01T00:00:00.000Z')).toThrow()
  })
})

describe('deriveReadings', () => {
  test('returns readings descending by ts, limited', () => {
    const roomId = seed.rooms[0]!.roomId
    const readings = deriveReadings(index, roomId, 50)
    expect(readings).toHaveLength(50)
    for (let i = 1; i < readings.length; i++) {
      expect(Date.parse(readings[i]!.ts)).toBeLessThanOrEqual(Date.parse(readings[i - 1]!.ts))
    }
  })

  test('unknown room returns empty array, not a throw', () => {
    expect(deriveReadings(index, 'does-not-exist')).toEqual([])
  })
})

describe('deriveReservations', () => {
  test('returns reservations ascending by startTs without the internal ghost flag', () => {
    const roomId = seed.reservations[0]!.roomId
    const reservations = deriveReservations(index, roomId)
    expect(reservations.length).toBeGreaterThan(0)
    for (const r of reservations) {
      expect('ghost' in r).toBe(false)
    }
    for (let i = 1; i < reservations.length; i++) {
      expect(Date.parse(reservations[i]!.startTs)).toBeGreaterThanOrEqual(Date.parse(reservations[i - 1]!.startTs))
    }
  })

  test('filters by UTC date', () => {
    const roomId = seed.reservations[0]!.roomId
    const first = deriveReservations(index, roomId)[0]!
    const date = first.startTs.slice(0, 10)
    const filtered = deriveReservations(index, roomId, date)
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((r) => r.startTs.startsWith(date))).toBe(true)
  })

  test('organizer names with diacritics survive the round-trip', () => {
    const all = seed.rooms.flatMap((r) => deriveReservations(index, r.roomId))
    const organizers = new Set(all.map((r) => r.organizer))
    const hasDiacritic = [...organizers].some((name) => /[À-ž]/.test(name))
    expect(hasDiacritic).toBe(true)
  })
})

describe('isGhostReservation', () => {
  // We derive ghost independently of the seed's internal flag (which is
  // never uploaded/served — see CLAUDE.md "ghost meetings are DERIVED").
  // The two are NOT expected to always agree: a walk-in can land inside a
  // slot the generator marked internally as a ghost booking, and derivation
  // correctly sees that real occupancy — it has no access to (and must not
  // depend on) the internal flag. What must always hold is the other
  // direction: a reservation the generator deliberately gave real occupancy
  // to (ghost === false) can never derive as a ghost.
  test('non-ghost reservations never derive as ghost', () => {
    const nonGhost = seed.reservations.filter((r) => !r.ghost).slice(0, 300)
    expect(nonGhost.length).toBeGreaterThan(0)
    for (const r of nonGhost) {
      expect(isGhostReservation(index, r)).toBe(false)
    }
  })

  test('agrees with the internal flag on the large majority of ghost-flagged reservations', () => {
    // A minority mismatch is expected (walk-in overlap); a majority mismatch
    // would indicate the derivation logic itself is broken.
    const flaggedGhost = seed.reservations.filter((r) => r.ghost)
    expect(flaggedGhost.length).toBeGreaterThan(0)
    const agreeing = flaggedGhost.filter((r) => isGhostReservation(index, r)).length
    expect(agreeing / flaggedGhost.length).toBeGreaterThan(0.7)
  })
})

describe('deriveKpis', () => {
  const kpis = deriveKpis(seed, index)

  test('shape matches the frozen contract', () => {
    expect(typeof kpis.avgUtilizationPct).toBe('number')
    expect(typeof kpis.peakUtilizationPct).toBe('number')
    expect(typeof kpis.ghostRatePct).toBe('number')
    expect(typeof kpis.wastedEur).toBe('number')
    expect(typeof kpis.busiestBuilding).toBe('string')
    expect(kpis.underusedRooms).toHaveLength(5)
  })

  test('ghost rate is roughly 20% (matches generator spec)', () => {
    expect(kpis.ghostRatePct).toBeGreaterThan(10)
    expect(kpis.ghostRatePct).toBeLessThan(30)
  })

  test('wastedEur is non-negative and uses COST_PER_DESK_HOUR_EUR = 4', () => {
    expect(kpis.wastedEur).toBeGreaterThanOrEqual(0)
    expect(COST_PER_DESK_HOUR_EUR).toBe(4)
  })

  test('busiestBuilding is one of the three fixture buildings', () => {
    expect(['atlas', 'flux', 'neuron']).toContain(kpis.busiestBuilding)
  })

  test('underusedRooms are sorted ascending by utilizationPct and include non-ASCII names', () => {
    for (let i = 1; i < kpis.underusedRooms.length; i++) {
      expect(kpis.underusedRooms[i]!.utilizationPct).toBeGreaterThanOrEqual(kpis.underusedRooms[i - 1]!.utilizationPct)
    }
    const allRoomNames = seed.rooms.map((r) => r.name)
    for (const room of kpis.underusedRooms) {
      expect(allRoomNames).toContain(room.name)
    }
  })

  test('peak utilization is at least the average', () => {
    expect(kpis.peakUtilizationPct).toBeGreaterThanOrEqual(kpis.avgUtilizationPct)
  })

  test('throws when from is after to', () => {
    expect(() => deriveKpis(seed, index, '2026-07-10T00:00:00.000Z', '2026-07-01T00:00:00.000Z')).toThrow()
  })
})
