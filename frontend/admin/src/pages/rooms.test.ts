import { beforeEach, describe, expect, it, vi } from 'vitest'

const REFERENCE_TS = '2026-07-29T11:20:00.000Z'
const TODAY_DATE = '2026-07-29'

// vi.mock's factory is hoisted above top-level const declarations, so fixtures
// it references must be declared via vi.hoisted (hoisted to the same point).
const { ROOMS, GHOST_RESERVATION } = vi.hoisted(() => {
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
        building: 'flux',
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
        building: 'atlas',
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
  }
})

vi.mock('../../../src/lib/api', () => ({
  apiClient: {
    getRooms: vi.fn().mockResolvedValue(ROOMS),
    getRoomOccupancy: vi.fn().mockResolvedValue([]),
    getRoomReservations: vi.fn((roomId: string, date: string) =>
      Promise.resolve(roomId === 'r1' && date === TODAY_DATE ? [GHOST_RESERVATION] : []),
    ),
  },
}))

import { roomsPage } from './rooms'

describe('admin rooms page', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    sessionStorage.clear()
  })

  it('shows all rooms on initial mount', async () => {
    await roomsPage.mount(container)
    const rows = container.querySelectorAll('.rooms-list-row')
    expect(rows.length).toBe(3)
  })

  it('search filters rows by substring', async () => {
    await roomsPage.mount(container)
    const search = container.querySelector<HTMLInputElement>('.filter-search')!
    search.value = 'Kelvin'
    search.dispatchEvent(new Event('input'))

    const rows = container.querySelectorAll('.rooms-list-row')
    expect(rows.length).toBe(1)
    expect(rows[0]?.textContent).toContain('Kelvin')
  })

  it('an availability checkbox filters rows by derived status', async () => {
    await roomsPage.mount(container)
    const offlineCheckbox = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[name="availability"]'),
    ).find((cb) => cb.value === 'offline')!
    offlineCheckbox.checked = true
    offlineCheckbox.dispatchEvent(new Event('change'))

    const rows = container.querySelectorAll('.rooms-list-row')
    expect(rows.length).toBe(1)
    expect(rows[0]?.textContent).toContain('Bohr')
  })

  it('a capacity chip filters rows by bucket', async () => {
    await roomsPage.mount(container)
    const chip = Array.from(container.querySelectorAll<HTMLButtonElement>('.capacity-chip')).find(
      (c) => c.textContent === '5–10',
    )!
    chip.click()

    // Helix (8) and Bohr (6) fall in 5-10; Kelvin (4) does not.
    const rows = container.querySelectorAll('.rooms-list-row')
    expect(rows.length).toBe(2)
    const names = Array.from(rows).map((r) => r.textContent)
    expect(names.some((t) => t?.includes('Helix'))).toBe(true)
    expect(names.some((t) => t?.includes('Bohr'))).toBe(true)
  })

  it('combines a building filter with search (AND semantics)', async () => {
    await roomsPage.mount(container)
    const atlasCheckbox = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[name="building"]'),
    ).find((cb) => cb.value === 'atlas')!
    atlasCheckbox.checked = true
    atlasCheckbox.dispatchEvent(new Event('change'))

    const search = container.querySelector<HTMLInputElement>('.filter-search')!
    search.value = 'Bohr'
    search.dispatchEvent(new Event('input'))

    const rows = container.querySelectorAll('.rooms-list-row')
    expect(rows.length).toBe(1)
    expect(rows[0]?.textContent).toContain('Bohr')
  })

  it('each row has a real link that sets sessionStorage and points at the main app live page', async () => {
    await roomsPage.mount(container)
    const link = container.querySelector<HTMLAnchorElement>('.rooms-list-row a')!
    expect(link.getAttribute('href')).toBe('/#live')
    link.click()
    expect(sessionStorage.getItem('roomsense.selectedRoomId')).toBeTruthy()
  })
})
