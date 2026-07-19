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
