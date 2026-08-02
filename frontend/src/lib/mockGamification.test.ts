import { describe, it, expect, beforeEach } from 'vitest'
import {
  getMockRecommendations,
  getMockOccupancyPrediction,
  getMockStreak,
  getMockUnlocks,
  addMockBooking,
  __resetMockGamification,
} from './mockGamification'
import type { RoomWithOccupancy } from './apiTypes'

const ROOMS: RoomWithOccupancy[] = [
  { roomId: 'r1', name: 'Free A', building: 'atlas', floor: 0, capacity: 4, occupancy: 0, utilizationPct: 80, lastSeenTs: '2026-08-04T10:00:00.000Z' },
  { roomId: 'r2', name: 'Busy', building: 'atlas', floor: 0, capacity: 4, occupancy: 3, utilizationPct: 90, lastSeenTs: '2026-08-04T10:00:00.000Z' },
]

describe('mockGamification', () => {
  beforeEach(() => {
    __resetMockGamification()
  })

  it('getMockRecommendations only recommends free rooms', async () => {
    const result = await getMockRecommendations(ROOMS, 'user-1', '2026-08-04T10:00:00.000Z')
    expect(result.hero?.roomId).toBe('r1')
  })

  it('getMockStreak starts at 0 with no bookings', async () => {
    const streak = await getMockStreak('user-1', '2026-08-04T10:00:00.000Z')
    expect(streak.currentStreakDays).toBe(0)
  })

  it('addMockBooking then getMockStreak reflects the new booking', async () => {
    await addMockBooking('user-1', 'r1', '2026-08-04T09:00:00.000Z')
    const streak = await getMockStreak('user-1', '2026-08-04T10:00:00.000Z')
    expect(streak.currentStreakDays).toBe(1)
  })

  it('getMockUnlocks reflects the derived streak', async () => {
    for (const [date] of [['2026-08-03'], ['2026-08-04'], ['2026-08-05']]) {
      await addMockBooking('user-1', 'r1', `${date}T09:00:00.000Z`)
    }
    const unlocks = await getMockUnlocks('user-1', '2026-08-05T10:00:00.000Z')
    expect(unlocks.find((u) => u.threshold === 3)?.unlocked).toBe(true)
  })

  it('getMockOccupancyPrediction returns a plausible shape', async () => {
    const prediction = await getMockOccupancyPrediction('r1', '2026-08-04T10:00:00.000Z')
    expect(prediction.roomId).toBe('r1')
    expect(typeof prediction.plus30m.occupancy).toBe('number')
  })
})
