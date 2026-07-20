import type { RoomWithOccupancy } from './apiTypes'

/**
 * Snapshot of each room's lastSeenTs at a point in time, for diffing against
 * the next poll. Deliberately NOT compared against Date.now() anywhere in
 * this module — the mock dataset's clock is frozen (seedData.ts MOCK_END),
 * so "recency vs wall clock" is meaningless here; "did the value change
 * since the last poll" is the only signal that's true in both mock and live
 * modes.
 */
export function snapshotLastSeen(rooms: RoomWithOccupancy[]): Map<string, string> {
  return new Map(rooms.map((r) => [r.roomId, r.lastSeenTs]))
}

/** Room IDs whose lastSeenTs differs from the previous snapshot. Rooms with
 *  no previous entry (first poll) are never reported as advanced — there is
 *  nothing to compare against yet. */
export function computeAdvancedRoomIds(
  rooms: RoomWithOccupancy[],
  previous: Map<string, string>,
): Set<string> {
  const advanced = new Set<string>()
  for (const room of rooms) {
    const prevTs = previous.get(room.roomId)
    if (prevTs !== undefined && prevTs !== room.lastSeenTs) advanced.add(room.roomId)
  }
  return advanced
}
