import type { SensorReading } from './apiTypes'

export interface ReadingDelta {
  reading: SensorReading
  deltaIn: number | null
  deltaOut: number | null
  deltaOccupancy: number | null
  reset: boolean
}

/**
 * Readings arrive descending by ts (frozen API contract, wishlist.md
 * "#5-#12"). For each reading, diff against the next-older one
 * (readings[i + 1]) to surface the actual in/out events since the previous
 * uplink — the number that makes "occupancy = countIn − countOut"
 * (CLAUDE.md, "Terabee data model") legible next to two raw cumulative
 * integers. A counter drop (today's cumulative < the previous reading's) is
 * the documented daily reset at 04:00 UTC, not a negative delta — it is
 * flagged via `reset`, never computed as a number.
 */
export function computeReadingDeltas(readings: SensorReading[]): ReadingDelta[] {
  return readings.map((reading, i) => {
    const prev = readings[i + 1]
    if (!prev) {
      return { reading, deltaIn: null, deltaOut: null, deltaOccupancy: null, reset: false }
    }
    const reset = reading.countIn < prev.countIn || reading.countOut < prev.countOut
    if (reset) {
      return { reading, deltaIn: null, deltaOut: null, deltaOccupancy: null, reset: true }
    }
    const deltaIn = reading.countIn - prev.countIn
    const deltaOut = reading.countOut - prev.countOut
    return { reading, deltaIn, deltaOut, deltaOccupancy: deltaIn - deltaOut, reset: false }
  })
}
