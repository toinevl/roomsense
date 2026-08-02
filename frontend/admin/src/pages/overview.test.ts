import { beforeEach, describe, expect, it, vi } from 'vitest'

const REFERENCE_TS = '2026-07-29T11:20:00.000Z'
const TODAY_DATE = '2026-07-29'

// vi.mock's factory is hoisted above top-level const declarations, so fixtures
// it references must be declared via vi.hoisted (hoisted to the same point).
const { ROOMS, GHOST_RESERVATION, KPIS_FIXTURE } = vi.hoisted(() => {
  const referenceTs = '2026-07-29T11:20:00.000Z'
  return {
    GHOST_RESERVATION: {
      roomId: 'r1',
      subject: 'Weekly sync',
      organizer: 'Anaïs Dubois',
      startTs: '2026-07-29T10:30:00.000Z',
      endTs: '2026-07-29T12:00:00.000Z',
      attendeeCount: 4,
      sourceId: 'outlook',
    },
    ROOMS: [
      {
        roomId: 'r1',
        building: 'atlas',
        floor: 2,
        name: 'Kelvin',
        capacity: 4,
        deviceId: 'dev-1',
        outlookAddress: 'kelvin@tue.nl',
        sourceId: 'sensor-1',
        occupancy: 0,
        utilizationPct: 0,
        lastSeenTs: referenceTs,
      },
      {
        roomId: 'r2',
        building: 'atlas',
        floor: 1,
        name: 'Helix',
        capacity: 8,
        deviceId: 'dev-2',
        outlookAddress: 'helix@tue.nl',
        sourceId: 'sensor-2',
        occupancy: 0,
        utilizationPct: 0,
        lastSeenTs: referenceTs,
      },
      {
        roomId: 'r3',
        building: 'flux',
        floor: 0,
        name: 'Bohr',
        capacity: 6,
        deviceId: 'dev-3',
        outlookAddress: 'bohr@tue.nl',
        sourceId: 'sensor-3',
        occupancy: 0,
        utilizationPct: 0,
        lastSeenTs: '2026-07-29T08:00:00.000Z', // > 60min before reference => offline
      },
    ],
    KPIS_FIXTURE: {
      avgUtilizationPct: 50,
      peakUtilizationPct: 80,
      ghostRatePct: 10,
      wastedEur: 120,
      busiestBuilding: 'atlas',
      underusedRooms: [],
    },
  }
})

vi.mock('../../../src/lib/api', () => ({
  apiClient: {
    getRooms: vi.fn().mockResolvedValue(ROOMS),
    getRoomOccupancy: vi.fn().mockResolvedValue([]),
    getRoomReservations: vi.fn((roomId: string, date: string) =>
      Promise.resolve(roomId === 'r1' && date === TODAY_DATE ? [GHOST_RESERVATION] : []),
    ),
    getKpis: vi.fn().mockResolvedValue(KPIS_FIXTURE),
  },
}))

import { overviewPage } from './overview'

describe('admin overview page', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    sessionStorage.clear()
  })

  it('renders 4 KPI tiles with non-empty values', async () => {
    await overviewPage.mount(container)
    const tiles = container.querySelectorAll('.kpi-tile')
    expect(tiles.length).toBe(4)
    for (const tile of tiles) {
      const value = tile.querySelector('.kpi-value')?.textContent?.trim() ?? ''
      expect(value.length).toBeGreaterThan(0)
    }
  })

  it('renders one room card per room, with the derived status', async () => {
    await overviewPage.mount(container)
    const cards = container.querySelectorAll('.admin-room-card')
    expect(cards.length).toBe(3)

    const byRoomName = (name: string) =>
      Array.from(cards).find((c) => c.querySelector('.admin-room-name')?.textContent === name)

    expect(byRoomName('Kelvin')?.getAttribute('data-status')).toBe('ghost')
    expect(byRoomName('Helix')?.getAttribute('data-status')).toBe('free')
    expect(byRoomName('Bohr')?.getAttribute('data-status')).toBe('offline')
  })

  it('does not repeat the status word in the rendered status line (#60)', async () => {
    await overviewPage.mount(container)
    const cards = container.querySelectorAll('.admin-room-card')
    const byRoomName = (name: string) =>
      Array.from(cards).find((c) => c.querySelector('.admin-room-name')?.textContent === name)

    // Helix is free with no reservation today — asserts the exact composed
    // text, not just the status key, so a regression like #60 (status word
    // restated inside untilText, doubling up with the STATUS_LABEL prefix)
    // fails here even though computeRoomStatus()'s own unit tests pass.
    const statusText = byRoomName('Helix')?.querySelector('.admin-room-status')?.textContent
    expect(statusText).toBe('Free · for the rest of today')
  })

  it('shows an explicit empty state for a reclaim slot with no qualifying candidate', async () => {
    await overviewPage.mount(container)
    // No room is booked near its capacity limit, so the "oversized" slot must be empty.
    const emptyStates = container.querySelectorAll('.reclaim-empty')
    expect(emptyStates.length).toBeGreaterThanOrEqual(1)
    const texts = Array.from(emptyStates).map((el) => el.textContent)
    expect(texts.some((t) => t?.includes('oversized'))).toBe(true)
  })

  it('clicking a reclaim action button removes the card and logs a local audit entry', async () => {
    await overviewPage.mount(container)

    const ghostCard = Array.from(container.querySelectorAll('.reclaim-card')).find((c) =>
      c.textContent?.includes('Kelvin'),
    ) as HTMLElement
    expect(ghostCard).toBeTruthy()

    const releaseButton = Array.from(ghostCard.querySelectorAll('button')).find(
      (b) => b.textContent === 'Release room',
    ) as HTMLButtonElement
    expect(releaseButton).toBeTruthy()
    releaseButton.click()

    const remainingGhostCards = Array.from(container.querySelectorAll('.reclaim-card')).filter((c) =>
      c.textContent?.includes('Kelvin'),
    )
    expect(remainingGhostCards.length).toBe(0)

    const logEntries = container.querySelectorAll('.audit-log-entry')
    expect(logEntries.length).toBe(1)
    expect(logEntries[0]?.textContent).toContain('Release room')
  })
})
