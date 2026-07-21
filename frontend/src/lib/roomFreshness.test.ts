import { describe, expect, test } from 'vitest'
import { computeAdvancedRoomIds, snapshotLastSeen } from './roomFreshness'
import type { RoomWithOccupancy } from './apiTypes'

function room(over: Partial<RoomWithOccupancy>): RoomWithOccupancy {
  return {
    roomId: 'atlas-0.710',
    building: 'atlas',
    floor: 0,
    name: 'Senaatzaal',
    capacity: 80,
    deviceId: 'TB-PCL-0001',
    outlookAddress: 'atlas-0.710@tue.nl',
    sourceId: 'terabee-iothub-mock',
    occupancy: 10,
    utilizationPct: 12.5,
    lastSeenTs: '2026-07-17T10:00:00.000Z',
    ...over,
  }
}

describe('computeAdvancedRoomIds', () => {
  test('no previous snapshot means nothing is reported as advanced yet', () => {
    const rooms = [room({})]
    const advanced = computeAdvancedRoomIds(rooms, new Map())
    expect(advanced.size).toBe(0)
  })

  test('a room whose lastSeenTs changed since the previous poll is advanced', () => {
    const previous = snapshotLastSeen([room({ lastSeenTs: '2026-07-17T10:00:00.000Z' })])
    const rooms = [room({ lastSeenTs: '2026-07-17T10:15:00.000Z' })]
    const advanced = computeAdvancedRoomIds(rooms, previous)
    expect(advanced.has('atlas-0.710')).toBe(true)
  })

  test('a room whose lastSeenTs is unchanged is not advanced', () => {
    const previous = snapshotLastSeen([room({ lastSeenTs: '2026-07-17T10:00:00.000Z' })])
    const rooms = [room({ lastSeenTs: '2026-07-17T10:00:00.000Z' })]
    const advanced = computeAdvancedRoomIds(rooms, previous)
    expect(advanced.size).toBe(0)
  })

  test('mixed grid: only the rooms that changed are reported', () => {
    const previous = snapshotLastSeen([
      room({ roomId: 'a', lastSeenTs: '2026-07-17T10:00:00.000Z' }),
      room({ roomId: 'b', lastSeenTs: '2026-07-17T10:00:00.000Z' }),
    ])
    const rooms = [
      room({ roomId: 'a', lastSeenTs: '2026-07-17T10:15:00.000Z' }),
      room({ roomId: 'b', lastSeenTs: '2026-07-17T10:00:00.000Z' }),
    ]
    const advanced = computeAdvancedRoomIds(rooms, previous)
    expect([...advanced]).toEqual(['a'])
  })
})
