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

// ─── Social Feature Types (Phase 2, #37) ───

import {
  FriendLinkSchema,
  UserPresenceSchema,
  RoomReviewSchema,
  PrivacySettingsSchema,
  REVIEW_TAGS,
} from './types'

describe('FriendLinkSchema', () => {
  const f = {
    userId: 'user-1',
    friendId: 'user-2',
    friendName: 'Anaïs Dubois',
    status: 'active' as const,
    canSeeLive: true,
    connectedAt: '2026-07-21T10:00:00.000Z',
  }

  test('accepts a valid friend link with non-ASCII name', () => {
    expect(FriendLinkSchema.parse(f).friendName).toBe('Anaïs Dubois')
  })

  test('rejects invalid status', () => {
    expect(() => FriendLinkSchema.parse({ ...f, status: 'blocked' })).toThrow()
  })
})

describe('UserPresenceSchema', () => {
  test('accepts presence with optional roomId', () => {
    const p = {
      userId: 'user-1',
      displayName: 'François Çelik',
      building: 'atlas',
      status: 'available',
      lastSeenTs: '2026-07-21T10:00:00.000Z',
    }
    const parsed = UserPresenceSchema.parse(p)
    expect(parsed.roomId).toBeUndefined()
    expect(parsed.displayName).toBe('François Çelik')
  })
})

describe('RoomReviewSchema', () => {
  const validReview = {
    reviewId: 'rev-1',
    roomId: 'atlas-0.710',
    authorId: 'user-1',
    authorName: 'anonymous',
    rating: 5,
    title: 'Perfect for quiet work',
    body: 'Great lighting and very quiet, ideal for deep focus sessions.',
    tags: ['quiet', 'fast-wifi', 'good-lighting'],
    helpfulCount: 3,
    status: 'active',
    createdAt: '2026-07-21T09:00:00.000Z',
    updatedAt: '2026-07-21T09:00:00.000Z',
  }

  test('accepts a valid review', () => {
    expect(RoomReviewSchema.parse(validReview).rating).toBe(5)
  })

  test('rejects rating outside 1-5', () => {
    expect(() => RoomReviewSchema.parse({ ...validReview, rating: 6 })).toThrow()
    expect(() => RoomReviewSchema.parse({ ...validReview, rating: 0 })).toThrow()
  })

  test('rejects title shorter than 3 chars', () => {
    expect(() => RoomReviewSchema.parse({ ...validReview, title: 'OK' })).toThrow()
  })
})

describe('PrivacySettingsSchema', () => {
  test('defaults to privacy-safe values', () => {
    const p = {
      userId: 'user-1',
      lastUpdated: '2026-07-21T10:00:00.000Z',
    }
    const parsed = PrivacySettingsSchema.parse(p)
    expect(parsed.locationSharingEnabled).toBe(false)
    expect(parsed.friendVisibility).toBe('friends-only')
    expect(parsed.reviewAttributionDefault).toBe('anonymous')
    expect(parsed.dataRetentionDays).toBe(1)
  })
})

describe('REVIEW_TAGS', () => {
  test('contains expected tags', () => {
    expect(REVIEW_TAGS).toContain('quiet')
    expect(REVIEW_TAGS).toContain('group-friendly')
    expect(REVIEW_TAGS.length).toBe(14)
  })
})
