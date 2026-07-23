import { z } from 'zod'

/** Decoded Terabee PCL uplink — field names match Terabee's official pcl_lora_payload_decoder. */
export const SensorReadingSchema = z.object({
  deviceId: z.string().min(1),
  ts: z.string().datetime(),
  countIn: z.number().int().nonnegative(), // cumulative since last reset (04:00)
  countOut: z.number().int().nonnegative(), // cumulative since last reset (04:00)
  flags: z.number().int().min(0).max(255),
  batteryPct: z.number().min(0).max(100),
  rssi: z.number(),
  snr: z.number(),
  sourceId: z.string(),
})
export type SensorReading = z.infer<typeof SensorReadingSchema>

export const RoomSchema = z.object({
  roomId: z.string(),
  building: z.string(),
  floor: z.number().int(),
  name: z.string(),
  capacity: z.number().int().positive(),
  deviceId: z.string(),
  outlookAddress: z.string().email(),
  sourceId: z.string(),
})
export type Room = z.infer<typeof RoomSchema>

export const ReservationSchema = z.object({
  roomId: z.string(),
  subject: z.string(),
  organizer: z.string(),
  startTs: z.string().datetime(),
  endTs: z.string().datetime(),
  attendeeCount: z.number().int().positive(),
  sourceId: z.string(),
})
export type Reservation = z.infer<typeof ReservationSchema>

export const OccupancySnapshotSchema = z.object({
  roomId: z.string(),
  ts: z.string().datetime(),
  occupancy: z.number().int().nonnegative(),
  utilizationPct: z.number().min(0),
  intervalMinutes: z.literal(15),
})
export type OccupancySnapshot = z.infer<typeof OccupancySnapshotSchema>

export const SourceSchema = z.object({
  sourceId: z.string(),
  displayName: z.string(),
  kind: z.enum(['sensor', 'calendar']),
  status: z.enum(['active', 'inactive']),
  lastSyncTs: z.string().datetime(),
})
export type Source = z.infer<typeof SourceSchema>

// ─── Social Feature Types (Phase 2, #37) ───

export const FriendLinkSchema = z.object({
  userId: z.string(),
  friendId: z.string(),
  friendName: z.string(),
  status: z.enum(['active', 'pending']),
  canSeeLive: z.boolean().default(true),
  connectedAt: z.string().datetime(),
})
export type FriendLink = z.infer<typeof FriendLinkSchema>

export const UserPresenceSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  building: z.string(),
  roomId: z.string().optional(),
  status: z.enum(['available', 'busy', 'offline']),
  lastSeenTs: z.string().datetime(),
})
export type UserPresence = z.infer<typeof UserPresenceSchema>

export const RoomReviewSchema = z.object({
  reviewId: z.string(),
  roomId: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(3).max(50),
  body: z.string().min(10).max(500),
  tags: z.array(z.string()),
  helpfulCount: z.number().int().nonnegative().default(0),
  status: z.enum(['active', 'flagged', 'deleted']).default('active'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type RoomReview = z.infer<typeof RoomReviewSchema>

export const PrivacySettingsSchema = z.object({
  userId: z.string(),
  locationSharingEnabled: z.boolean().default(false),
  friendVisibility: z.enum(['friends-only', 'campus', 'public']).default('friends-only'),
  reviewAttributionDefault: z.enum(['anonymous', 'named']).default('anonymous'),
  dataRetentionDays: z.number().int().min(1).max(365).default(1),
  lastUpdated: z.string().datetime(),
})
export type PrivacySettings = z.infer<typeof PrivacySettingsSchema>

// Tag enum for reviews
export const REVIEW_TAGS = [
  'quiet', 'noisy', 'fast-wifi', 'slow-wifi',
  'great-whiteboard', 'broken-equipment',
  'near-bathrooms', 'near-food', 'temperature-cold', 'temperature-hot',
  'good-lighting', 'dim', 'wheelchair-accessible', 'group-friendly',
] as const
export type ReviewTag = (typeof REVIEW_TAGS)[number]
