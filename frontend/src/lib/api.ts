import { config } from '../config'
import {
  buildIndex,
  deriveHealth,
  deriveKpis,
  deriveOccupancy,
  deriveReadings,
  deriveReservations,
  deriveRooms,
  deriveSources,
  findLatestActiveIndex,
} from './mockDerivations'
import { getSeedData } from './seedData'
import { addMockReview, getMockFriends, getMockPresence, getMockPrivacy, getMockReviews } from './mockSocialData'
import type {
  FriendLink,
  HealthResponse,
  KpisResponse,
  OccupancySnapshot,
  PrivacySettings,
  Reservation,
  RoomReview,
  RoomWithOccupancy,
  SensorReading,
  SimulateTickResponse,
  SourceStatus,
  UserPresence,
} from './apiTypes'

/**
 * Typed client against the frozen API contract (wishlist.md, "API contract
 * for #5-#12"). Two implementations behind one interface: `fetch` against
 * the live Functions API, or `mock` derived in-browser from the seed
 * generator — same shapes either way, so pages never branch on mode.
 */
export interface ApiClient {
  getHealth(): Promise<HealthResponse>
  getRooms(): Promise<RoomWithOccupancy[]>
  getRoomOccupancy(roomId: string, from?: string, to?: string): Promise<OccupancySnapshot[]>
  getRoomReadings(roomId: string, limit?: number): Promise<SensorReading[]>
  getRoomReservations(roomId: string, date?: string): Promise<Reservation[]>
  getKpis(from?: string, to?: string): Promise<KpisResponse>
  getSources(): Promise<SourceStatus[]>
  simulateTick(key: string): Promise<SimulateTickResponse>
  /**
   * Mock-only: advances the deterministic "live" tick used to make the room
   * grid visibly move across polls without any randomness or real wall-clock
   * dependency. No-op (and unused) against the real API, which has its own
   * simulate/tick endpoint for that purpose.
   */
  tickMockClock(): number

  // ── Social features (Phase 2, #37) ──

  getPresence(building?: string): Promise<UserPresence[]>
  getFriends(userId: string): Promise<FriendLink[]>
  getReviews(roomId: string, sort?: 'recent' | 'helpful'): Promise<RoomReview[]>
  createReview(review: {
    roomId: string
    authorId: string
    authorName: string
    rating: number
    title: string
    body: string
    tags: string[]
  }): Promise<RoomReview>
  getPrivacy(userId: string): Promise<PrivacySettings>
  updatePrivacy(userId: string, settings: Partial<PrivacySettings>): Promise<PrivacySettings>
}

// ---------------------------------------------------------------------------
// Fetch-backed implementation
// ---------------------------------------------------------------------------

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.apiBaseUrl}${path}`, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res.json() as Promise<T>
}

function qs(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) usp.set(key, String(value))
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

const fetchClient: ApiClient = {
  getHealth: () => request('/health'),
  getRooms: () => request('/rooms'),
  getRoomOccupancy: (roomId, from, to) =>
    request(`/rooms/${encodeURIComponent(roomId)}/occupancy${qs({ from, to })}`),
  getRoomReadings: (roomId, limit) =>
    request(`/rooms/${encodeURIComponent(roomId)}/readings${qs({ limit })}`),
  getRoomReservations: (roomId, date) =>
    request(`/rooms/${encodeURIComponent(roomId)}/reservations${qs({ date })}`),
  getKpis: (from, to) => {
    // The frozen contract requires an explicit range (the API 400s without
    // one — the mock is lenient, live is strict). Default: trailing 30 days.
    const toTs = to ?? new Date().toISOString()
    const fromTs = from ?? new Date(Date.parse(toTs) - 30 * 24 * 60 * 60 * 1000).toISOString()
    return request(`/kpis${qs({ from: fromTs, to: toTs })}`)
  },
  getSources: () => request('/sources'),
  simulateTick: (key) =>
    request('/simulate/tick', { method: 'POST', headers: { 'x-sim-key': key } }),
  tickMockClock: () => 0,

  // ── Social features (Phase 2, #37) ──
  getPresence: (building) => request(`/presence${qs({ building })}`),
  getFriends: (userId) => request(`/users/${encodeURIComponent(userId)}/friends`),
  getReviews: (roomId, sort) =>
    request(`/rooms/${encodeURIComponent(roomId)}/reviews${qs({ sort })}`),
  createReview: (review) =>
    request('/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review),
    }),
  getPrivacy: (userId) => request(`/users/${encodeURIComponent(userId)}/privacy`),
  updatePrivacy: (userId, settings) =>
    request(`/users/${encodeURIComponent(userId)}/privacy`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }),
}

// ---------------------------------------------------------------------------
// Mock implementation — computed in-browser from @roomsense/seed
// ---------------------------------------------------------------------------

/** How many of a room's trailing snapshots the mock "live" tick cycles through. */
const LIVE_WINDOW = 8

let mockTick = 0

function makeMockClient(): ApiClient {
  const seed = getSeedData()
  const index = buildIndex(seed)

  return {
    getHealth: async () => deriveHealth(),

    getRooms: async () => {
      const base = deriveRooms(seed, index)
      if (mockTick === 0) return base
      // Cycle each room's displayed occupancy through its own trailing
      // window of real, already-generated snapshots — deterministic on
      // `mockTick`, never random, and always a value the seed actually
      // produced (never fabricated).
      return base.map((room) => {
        const snaps = index.snapshotsByRoom.get(room.roomId) ?? []
        if (snaps.length === 0) return room
        // Anchor the cycling window on the latest *office-hours* reading
        // (same anchor deriveRooms uses) rather than the literal tail —
        // the tail is always a dead-of-night reading (see deriveRooms'
        // doc comment), which would make the "live" grid visibly flatline.
        const activeIdx = findLatestActiveIndex(snaps)
        const windowStart = Math.max(0, activeIdx - LIVE_WINDOW + 1)
        const window = snaps.slice(windowStart, activeIdx + 1)
        const snap = window[mockTick % window.length] ?? snaps[activeIdx]!
        return { ...room, occupancy: snap.occupancy, utilizationPct: snap.utilizationPct, lastSeenTs: snap.ts }
      })
    },

    getRoomOccupancy: async (roomId, from, to) => deriveOccupancy(seed, index, roomId, from, to),

    getRoomReadings: async (roomId, limit = 50) => deriveReadings(index, roomId, limit),

    getRoomReservations: async (roomId, date) => deriveReservations(index, roomId, date),

    getKpis: async (from, to) => deriveKpis(seed, index, from, to),

    getSources: async () => deriveSources(seed),

    simulateTick: async () => {
      mockTick += 1
      return { appended: seed.rooms.length, ts: new Date().toISOString() }
    },

    tickMockClock: () => {
      mockTick += 1
      return mockTick
    },

    // ── Social features (Phase 2, #37) ──
    getPresence: async (building) => getMockPresence(building),
    getFriends: async (userId) => getMockFriends(userId),
    getReviews: async (roomId, sort = 'recent') => {
      const reviews = getMockReviews(roomId)
      if (sort === 'helpful') {
        return [...reviews].sort((a, b) => b.helpfulCount - a.helpfulCount)
      }
      return [...reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    createReview: async (input) => addMockReview(input),
    getPrivacy: async (userId) => {
      const settings = getMockPrivacy(userId)
      if (!settings) {
        return {
          userId,
          locationSharingEnabled: false,
          friendVisibility: 'friends-only' as const,
          reviewAttributionDefault: 'anonymous' as const,
          dataRetentionDays: 1,
          lastUpdated: new Date().toISOString(),
        }
      }
      return settings
    },
    updatePrivacy: async (userId, settings) => {
      const current = getMockPrivacy(userId)
      return {
        userId,
        locationSharingEnabled: current?.locationSharingEnabled ?? false,
        friendVisibility: current?.friendVisibility ?? ('friends-only' as const),
        reviewAttributionDefault: current?.reviewAttributionDefault ?? ('anonymous' as const),
        dataRetentionDays: current?.dataRetentionDays ?? 1,
        lastUpdated: new Date().toISOString(),
        ...settings,
      }
    },
  }
}

export const apiClient: ApiClient = config.mock ? makeMockClient() : fetchClient

export function setApiClientMode(mock: boolean): void {
  ;(config as any).mock = mock
  ;(apiClient as any) = mock ? makeMockClient() : fetchClient
}

/** Test-only escape hatch. */
export function __resetMockTick(): void {
  mockTick = 0
}
