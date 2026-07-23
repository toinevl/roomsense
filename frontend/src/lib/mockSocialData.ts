import type { FriendLink, PrivacySettings, RoomReview, UserPresence } from './apiTypes'

/**
 * Deterministic mock fixtures for the social features (Phase 2b/2d, #37).
 * Same shape as the Azure seed data — built once, served in-browser when
 * mock mode is active. Uses non-ASCII names per CLAUDE.md convention.
 */

// ─── 6 users with presence ───
const PRESENCE: UserPresence[] = [
  {
    userId: 'user-2',
    displayName: 'Anaïs Dubois',
    building: 'atlas',
    roomId: 'atlas-0.710',
    status: 'available',
    lastSeenTs: '2025-03-10T09:15:00.000Z',
  },
  {
    userId: 'user-3',
    displayName: 'Björn Hölm',
    building: 'atlas',
    roomId: 'atlas-1.420',
    status: 'busy',
    lastSeenTs: '2025-03-10T09:42:00.000Z',
  },
  {
    userId: 'user-4',
    displayName: 'Zoë Müller',
    building: 'flux',
    roomId: 'flux-2.240',
    status: 'available',
    lastSeenTs: '2025-03-10T10:05:00.000Z',
  },
  {
    userId: 'user-5',
    displayName: 'François Çelik',
    building: 'flux',
    roomId: undefined,
    status: 'offline',
    lastSeenTs: '2025-03-10T07:30:00.000Z',
  },
  {
    userId: 'user-6',
    displayName: 'Søren Bergström',
    building: 'neuron',
    roomId: 'neuron-0.150',
    status: 'available',
    lastSeenTs: '2025-03-10T09:58:00.000Z',
  },
  {
    userId: 'user-7',
    displayName: 'Louise Núñez',
    building: 'neuron',
    roomId: 'neuron-1.310',
    status: 'busy',
    lastSeenTs: '2025-03-10T10:12:00.000Z',
  },
]

// ─── 4 friend links for user-1 (3 active, 1 pending) ───
const FRIENDS: FriendLink[] = [
  {
    userId: 'user-1',
    friendId: 'user-2',
    friendName: 'Anaïs Dubois',
    status: 'active',
    canSeeLive: true,
    connectedAt: '2025-01-15T10:00:00.000Z',
  },
  {
    userId: 'user-1',
    friendId: 'user-3',
    friendName: 'Björn Hölm',
    status: 'active',
    canSeeLive: true,
    connectedAt: '2025-01-20T14:30:00.000Z',
  },
  {
    userId: 'user-1',
    friendId: 'user-4',
    friendName: 'Zoë Müller',
    status: 'active',
    canSeeLive: false,
    connectedAt: '2025-02-01T09:00:00.000Z',
  },
  {
    userId: 'user-1',
    friendId: 'user-6',
    friendName: 'Søren Bergström',
    status: 'pending',
    canSeeLive: false,
    connectedAt: '2025-03-05T16:45:00.000Z',
  },
]

// ─── 8 room reviews across atlas-0.710, flux-2.240, neuron-0.150 ───
const REVIEWS: RoomReview[] = [
  {
    reviewId: 'rev-1',
    roomId: 'atlas-0.710',
    authorId: 'user-2',
    authorName: 'Anaïs Dubois',
    rating: 5,
    title: 'Excellent focus room',
    body: 'Very quiet and well-lit. Perfect for deep work sessions. The whiteboard is large and clean.',
    tags: ['quiet', 'great-whiteboard', 'good-lighting'],
    helpfulCount: 12,
    status: 'active',
    createdAt: '2025-02-28T10:00:00.000Z',
    updatedAt: '2025-02-28T10:00:00.000Z',
  },
  {
    reviewId: 'rev-2',
    roomId: 'atlas-0.710',
    authorId: 'user-3',
    authorName: 'Björn Hölm',
    rating: 4,
    title: 'Solid choice',
    body: 'Good room overall but the WiFi can be spotty during peak hours. Still one of the better rooms in atlas.',
    tags: ['quiet', 'slow-wifi', 'near-bathrooms'],
    helpfulCount: 7,
    status: 'active',
    createdAt: '2025-03-01T14:20:00.000Z',
    updatedAt: '2025-03-01T14:20:00.000Z',
  },
  {
    reviewId: 'rev-3',
    roomId: 'atlas-0.710',
    authorId: 'user-4',
    authorName: 'Zoë Müller',
    rating: 3,
    title: 'A bit cold',
    body: 'The room is fine but the AC is always cranked up. Bring a sweater. Lighting is good though.',
    tags: ['temperature-cold', 'good-lighting'],
    helpfulCount: 3,
    status: 'active',
    createdAt: '2025-03-02T09:15:00.000Z',
    updatedAt: '2025-03-02T09:15:00.000Z',
  },
  {
    reviewId: 'rev-4',
    roomId: 'flux-2.240',
    authorId: 'user-5',
    authorName: 'François Çelik',
    rating: 4,
    title: 'Great for group work',
    body: 'Spacious and group-friendly. The WiFi is fast and the room is near the café which is convenient.',
    tags: ['group-friendly', 'fast-wifi', 'near-food'],
    helpfulCount: 9,
    status: 'active',
    createdAt: '2025-02-25T11:30:00.000Z',
    updatedAt: '2025-02-25T11:30:00.000Z',
  },
  {
    reviewId: 'rev-5',
    roomId: 'flux-2.240',
    authorId: 'user-6',
    authorName: 'Søren Bergström',
    rating: 2,
    title: 'Too noisy',
    body: 'The walls are thin and you can hear everything from the hallway. Not great if you need to concentrate.',
    tags: ['noisy', 'broken-equipment'],
    helpfulCount: 5,
    status: 'active',
    createdAt: '2025-02-27T13:00:00.000Z',
    updatedAt: '2025-02-27T13:00:00.000Z',
  },
  {
    reviewId: 'rev-6',
    roomId: 'flux-2.240',
    authorId: 'user-7',
    authorName: 'Louise Núñez',
    rating: 5,
    title: 'My favorite room',
    body: 'Bright, spacious, and close to food. The projector works perfectly every time. Highly recommend.',
    tags: ['good-lighting', 'near-food', 'group-friendly', 'wheelchair-accessible'],
    helpfulCount: 15,
    status: 'active',
    createdAt: '2025-03-03T08:45:00.000Z',
    updatedAt: '2025-03-03T08:45:00.000Z',
  },
  {
    reviewId: 'rev-7',
    roomId: 'neuron-0.150',
    authorId: 'user-2',
    authorName: 'Anaïs Dubois',
    rating: 4,
    title: 'Cozy and convenient',
    body: 'Small but cozy. Close to bathrooms which is handy. Good for quick meetings or calls.',
    tags: ['quiet', 'near-bathrooms', 'dim'],
    helpfulCount: 6,
    status: 'active',
    createdAt: '2025-02-26T15:10:00.000Z',
    updatedAt: '2025-02-26T15:10:00.000Z',
  },
  {
    reviewId: 'rev-8',
    roomId: 'neuron-0.150',
    authorId: 'user-5',
    authorName: 'François Çelik',
    rating: 3,
    title: 'Decent but warm',
    body: 'The room gets quite warm in the afternoon. Fine for short sessions. Equipment all works.',
    tags: ['temperature-hot', 'great-whiteboard'],
    helpfulCount: 2,
    status: 'active',
    createdAt: '2025-03-04T10:30:00.000Z',
    updatedAt: '2025-03-04T10:30:00.000Z',
  },
]

// ─── 3 privacy settings (user-1 on, others off) ───
const PRIVACY: PrivacySettings[] = [
  {
    userId: 'user-1',
    locationSharingEnabled: true,
    friendVisibility: 'friends-only',
    reviewAttributionDefault: 'named',
    dataRetentionDays: 1,
    lastUpdated: '2025-03-10T08:00:00.000Z',
  },
  {
    userId: 'user-2',
    locationSharingEnabled: false,
    friendVisibility: 'friends-only',
    reviewAttributionDefault: 'anonymous',
    dataRetentionDays: 1,
    lastUpdated: '2025-03-09T12:00:00.000Z',
  },
  {
    userId: 'user-3',
    locationSharingEnabled: false,
    friendVisibility: 'campus',
    reviewAttributionDefault: 'anonymous',
    dataRetentionDays: 1,
    lastUpdated: '2025-03-08T09:30:00.000Z',
  },
]

// ─── Accessor functions ───

export function getMockPresence(building?: string): UserPresence[] {
  if (!building) return [...PRESENCE]
  return PRESENCE.filter((p) => p.building === building)
}

export function getMockFriends(userId: string): FriendLink[] {
  return FRIENDS.filter((f) => f.userId === userId)
}

export function getMockReviews(roomId: string): RoomReview[] {
  return REVIEWS.filter((r) => r.roomId === roomId && r.status === 'active')
}

export function getMockPrivacy(userId: string): PrivacySettings | undefined {
  return PRIVACY.find((p) => p.userId === userId)
}

/** Creates a new review in the in-memory store and returns it. */
export function addMockReview(input: {
  roomId: string
  authorId: string
  authorName: string
  rating: number
  title: string
  body: string
  tags: string[]
}): RoomReview {
  const now = new Date().toISOString()
  const review: RoomReview = {
    reviewId: `rev-${REVIEWS.length + 1}`,
    roomId: input.roomId,
    authorId: input.authorId,
    authorName: input.authorName,
    rating: input.rating,
    title: input.title,
    body: input.body,
    tags: input.tags,
    helpfulCount: 0,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  REVIEWS.push(review)
  return review
}
