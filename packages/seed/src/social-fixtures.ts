/**
 * Social feature seed data for Phase 2 (#37).
 *
 * Deterministic fixtures: 6 users with presence, 4 friend links,
 * 8 room reviews, 3 privacy settings. Uses non-ASCII names per CLAUDE.md.
 * Timestamps are relative to "now" so data looks fresh on every seed.
 */

import type { Entity } from './social-upload'

export interface SocialSeedData {
  presence: Entity[]
  friends: Entity[]
  reviews: Entity[]
  privacy: Entity[]
}

export function generateSocialSeed(): SocialSeedData {
  const now = Date.now()
  const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString()

  // ─── Users ───
  const users = [
    { userId: 'user-1', displayName: 'Anaïs Dubois', building: 'atlas' },
    { userId: 'user-2', displayName: 'Björn Hölm', building: 'atlas' },
    { userId: 'user-3', displayName: 'Zoë Müller', building: 'flux' },
    { userId: 'user-4', displayName: 'François Çelik', building: 'flux' },
    { userId: 'user-5', displayName: 'Søren Bergström', building: 'neuron' },
    { userId: 'user-6', displayName: 'Louise Núñez', building: 'atlas' },
  ]

  // ─── Presence (PK: building, RK: userId) ───
  const presence: Entity[] = users.map((u) => ({
    partitionKey: u.building,
    rowKey: u.userId,
    userId: u.userId,
    displayName: u.displayName,
    building: u.building,
    roomId: u.building === 'atlas' ? 'atlas-0.710' : u.building === 'flux' ? 'flux-2.240' : 'neuron-0.150',
    status: u.userId === 'user-4' ? 'busy' : 'available',
    lastSeenTs: iso(-Math.floor(Math.random() * 1800000)), // 0-30 min ago
  }))

  // ─── Friend Links (PK: userId, RK: friendId) ───
  // user-1 is friends with user-2, user-3, user-5, user-6
  const friends: Entity[] = [
    { partitionKey: 'user-1', rowKey: 'user-2', userId: 'user-1', friendId: 'user-2', friendName: 'Björn Hölm', status: 'active', canSeeLive: true, connectedAt: iso(-7 * 86400000) },
    { partitionKey: 'user-1', rowKey: 'user-3', userId: 'user-1', friendId: 'user-3', friendName: 'Zoë Müller', status: 'active', canSeeLive: true, connectedAt: iso(-5 * 86400000) },
    { partitionKey: 'user-1', rowKey: 'user-5', userId: 'user-1', friendId: 'user-5', friendName: 'Søren Bergström', status: 'active', canSeeLive: false, connectedAt: iso(-3 * 86400000) },
    { partitionKey: 'user-1', rowKey: 'user-6', userId: 'user-1', friendId: 'user-6', friendName: 'Louise Núñez', status: 'pending', canSeeLive: true, connectedAt: iso(-1 * 86400000) },
    // Reciprocal links
    { partitionKey: 'user-2', rowKey: 'user-1', userId: 'user-2', friendId: 'user-1', friendName: 'Anaïs Dubois', status: 'active', canSeeLive: true, connectedAt: iso(-7 * 86400000) },
    { partitionKey: 'user-3', rowKey: 'user-1', userId: 'user-3', friendId: 'user-1', friendName: 'Anaïs Dubois', status: 'active', canSeeLive: true, connectedAt: iso(-5 * 86400000) },
  ]

  // ─── Room Reviews (PK: roomId, RK: reviewId) ───
  const reviewTemplates = [
    { roomId: 'atlas-0.710', authorId: 'user-1', authorName: 'Anaïs', rating: 5, title: 'Perfect for quiet work', body: 'Great lighting and very quiet, ideal for deep focus sessions.', tags: ['quiet', 'fast-wifi', 'good-lighting'], helpfulCount: 5 },
    { roomId: 'atlas-0.710', authorId: 'user-3', authorName: 'Zoë', rating: 4, title: 'Good for groups', body: 'Spacious and well-equipped, though can get warm in the afternoon.', tags: ['group-friendly', 'temperature-hot'], helpfulCount: 2 },
    { roomId: 'atlas-0.710', authorId: 'user-5', authorName: 'Søren', rating: 3, title: 'Decent but noisy', body: 'The ventilation is loud during peak hours, bring noise-cancelling.', tags: ['noisy', 'good-lighting'], helpfulCount: 1 },
    { roomId: 'flux-2.240', authorId: 'user-2', authorName: 'Björn', rating: 5, title: 'Amazing whiteboard space', body: 'The whiteboards are huge and markers are always stocked. Best room.', tags: ['great-whiteboard', 'quiet', 'fast-wifi'], helpfulCount: 8 },
    { roomId: 'flux-2.240', authorId: 'user-4', authorName: 'François', rating: 4, title: 'Great for pair programming', body: 'Two large screens and comfortable chairs. WiFi is very fast here.', tags: ['fast-wifi', 'group-friendly'], helpfulCount: 3 },
    { roomId: 'flux-2.240', authorId: 'user-6', authorName: 'Louise', rating: 2, title: 'Broken equipment', body: 'The projector was not working and the room was very cold.', tags: ['broken-equipment', 'temperature-cold'], helpfulCount: 0 },
    { roomId: 'neuron-0.150', authorId: 'user-1', authorName: 'Anaïs', rating: 4, title: 'Cozy and convenient', body: 'Close to the cafeteria, perfect for a quick lunch meeting.', tags: ['near-food', 'near-bathrooms', 'quiet'], helpfulCount: 4 },
    { roomId: 'neuron-0.150', authorId: 'user-5', authorName: 'Søren', rating: 5, title: 'Hidden gem on campus', body: 'Wheelchair accessible, great lighting, and never crowded. Highly recommend.', tags: ['wheelchair-accessible', 'good-lighting', 'quiet'], helpfulCount: 6 },
  ]

  const reviews: Entity[] = reviewTemplates.map((r, i) => {
    const reviewId = `seed-rev-${i + 1}`
    const createdAt = iso(-(i + 1) * 86400000) // staggered over past 8 days
    return {
      partitionKey: r.roomId,
      rowKey: reviewId,
      reviewId,
      roomId: r.roomId,
      authorId: r.authorId,
      authorName: r.authorName,
      rating: r.rating,
      title: r.title,
      body: r.body,
      tags: JSON.stringify(r.tags), // Azure Tables: no arrays, serialize as JSON string
      helpfulCount: r.helpfulCount,
      status: 'active',
      createdAt,
      updatedAt: createdAt,
    }
  })

  // ─── Privacy Settings (PK: userId, RK: 'settings') ───
  const privacy: Entity[] = [
    // user-1 has location sharing enabled (so presence shows for them)
    { partitionKey: 'user-1', rowKey: 'settings', userId: 'user-1', locationSharingEnabled: true, friendVisibility: 'friends-only', reviewAttributionDefault: 'named', dataRetentionDays: 1, lastUpdated: iso(-86400000) },
    // user-2 also opted in
    { partitionKey: 'user-2', rowKey: 'settings', userId: 'user-2', locationSharingEnabled: true, friendVisibility: 'campus', reviewAttributionDefault: 'anonymous', dataRetentionDays: 7, lastUpdated: iso(-3600000) },
    // user-5 opted in but friends-only
    { partitionKey: 'user-5', rowKey: 'settings', userId: 'user-5', locationSharingEnabled: true, friendVisibility: 'friends-only', reviewAttributionDefault: 'anonymous', dataRetentionDays: 1, lastUpdated: iso(-7200000) },
    // user-3 has NOT opted in (default: locationSharingEnabled=false)
    { partitionKey: 'user-3', rowKey: 'settings', userId: 'user-3', locationSharingEnabled: false, friendVisibility: 'friends-only', reviewAttributionDefault: 'anonymous', dataRetentionDays: 1, lastUpdated: iso(-86400000) },
  ]

  return { presence, friends, reviews, privacy }
}
