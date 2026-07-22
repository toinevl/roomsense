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
import type {
  HealthResponse,
  KpisResponse,
  OccupancySnapshot,
  Reservation,
  RoomWithOccupancy,
  SensorReading,
  SimulateTickResponse,
  SourceStatus,
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
