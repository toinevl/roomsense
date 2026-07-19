import { describe, expect, test } from 'vitest'
import { invertedTicks, fromInvertedTicks, hash8 } from './rowKeys'

describe('invertedTicks', () => {
  test('round-trips an epoch timestamp', () => {
    const ms = Date.UTC(2026, 6, 19, 10, 15, 0)
    expect(fromInvertedTicks(invertedTicks(ms))).toBe(ms)
  })

  test('later time sorts lexicographically smaller (newest-first scans)', () => {
    const earlier = invertedTicks(Date.UTC(2026, 0, 1))
    const later = invertedTicks(Date.UTC(2026, 6, 1))
    expect(later < earlier).toBe(true)
  })

  test('always 14 characters', () => {
    expect(invertedTicks(0)).toHaveLength(14)
    expect(invertedTicks(Date.now())).toHaveLength(14)
  })

  test('rejects out-of-range input', () => {
    expect(() => invertedTicks(-1)).toThrow(RangeError)
    expect(() => invertedTicks(10_000_000_000_000)).toThrow(RangeError)
    expect(() => invertedTicks(1.5)).toThrow(RangeError)
  })
})

describe('hash8', () => {
  test('is deterministic and 8 hex chars', () => {
    const h = hash8('Jörgen Månsson|Sprint review')
    expect(h).toMatch(/^[0-9a-f]{8}$/)
    expect(hash8('Jörgen Månsson|Sprint review')).toBe(h)
  })

  test('differs for different input', () => {
    expect(hash8('a')).not.toBe(hash8('b'))
  })
})
