import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * scheduling.ts unit tests (#64). Mirrors rooms.test.ts's mocking/assertion
 * style: mock the api client directly (no real network / mock-derivation
 * layer involved), assert the rendered table rows/values, and assert
 * clicking a column header re-sorts the rows.
 */

// vi.mock's factory is hoisted above top-level const declarations, so
// fixtures it references must be declared via vi.hoisted (hoisted to the
// same point) — same convention as rooms.test.ts.
const { ROOMS, HEALTH_ROOMS, getSchedulingHealth } = vi.hoisted(() => {
  const ROOMS = [
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
      lastSeenTs: '2026-07-29T11:20:00.000Z', // latest -> referenceTs
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
      lastSeenTs: '2026-07-29T09:00:00.000Z',
    },
  ]

  const HEALTH_ROOMS = [
    { roomId: 'r2', name: 'Helix', building: 'flux', ghostRatePct: 40, oversizedRatePct: 10, utilizationPct: 55 },
    { roomId: 'r1', name: 'Kelvin', building: 'atlas', ghostRatePct: 12, oversizedRatePct: 30, utilizationPct: 20 },
    {
      roomId: 'r3',
      name: 'Vergaderzaal Höganäs',
      building: 'atlas',
      ghostRatePct: 65,
      oversizedRatePct: 5,
      utilizationPct: 80,
    },
  ]

  return { ROOMS, HEALTH_ROOMS, getSchedulingHealth: vi.fn().mockResolvedValue({ rooms: HEALTH_ROOMS }) }
})

vi.mock('../../../src/lib/api', () => ({
  apiClient: {
    getRooms: vi.fn().mockResolvedValue(ROOMS),
    getSchedulingHealth: (...args: unknown[]) => getSchedulingHealth(...args),
  },
}))

import { schedulingPage } from './scheduling'

function rowTexts(container: HTMLElement): string[][] {
  return Array.from(container.querySelectorAll('tbody tr')).map((tr) =>
    Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim() ?? ''),
  )
}

function roomIdOrder(container: HTMLElement): string[] {
  // First column is the room name; map back through HEALTH_ROOMS to get roomId order.
  return rowTexts(container).map((cells) => {
    const name = cells[0]
    return HEALTH_ROOMS.find((r) => r.name === name)!.roomId
  })
}

describe('admin scheduling health page', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    getSchedulingHealth.mockClear()
  })

  it('renders one row per room with the expected values', async () => {
    await schedulingPage.mount(container)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(3)
    const texts = rowTexts(container)
    const kelvinRow = texts.find((cells) => cells[0] === 'Kelvin')!
    expect(kelvinRow[1]).toBe('Atlas')
    expect(kelvinRow[2]).toContain('12')
    expect(kelvinRow[3]).toContain('30')
    expect(kelvinRow[4]).toContain('20')
  })

  it('preserves non-ASCII room names', async () => {
    await schedulingPage.mount(container)
    const texts = rowTexts(container)
    expect(texts.some((cells) => cells[0] === 'Vergaderzaal Höganäs')).toBe(true)
  })

  it('requests scheduling health with a trailing-7-day range anchored on the latest room lastSeenTs', async () => {
    await schedulingPage.mount(container)
    expect(getSchedulingHealth).toHaveBeenCalledTimes(1)
    const [from, to] = getSchedulingHealth.mock.calls[0]!
    expect(to).toBe('2026-07-29T11:20:00.000Z')
    expect(from).toBe('2026-07-22T11:20:00.000Z')
  })

  it('defaults to worst-ghost-rate-first (descending)', async () => {
    await schedulingPage.mount(container)
    expect(roomIdOrder(container)).toEqual(['r3', 'r2', 'r1']) // 65, 40, 12
  })

  it('clicking the active sort column header toggles ascending/descending', async () => {
    await schedulingPage.mount(container)
    const ghostHeader = Array.from(container.querySelectorAll('th button')).find((b) =>
      b.textContent?.toLowerCase().includes('ghost'),
    ) as HTMLButtonElement
    ghostHeader.click()
    expect(roomIdOrder(container)).toEqual(['r1', 'r2', 'r3']) // 12, 40, 65 ascending
    ghostHeader.click()
    expect(roomIdOrder(container)).toEqual(['r3', 'r2', 'r1']) // back to descending
  })

  it('clicking a different column header re-sorts by that column', async () => {
    await schedulingPage.mount(container)
    const utilHeader = Array.from(container.querySelectorAll('th button')).find((b) =>
      b.textContent?.toLowerCase().includes('utilization'),
    ) as HTMLButtonElement
    utilHeader.click()
    // Utilization: r3=80, r2=55, r1=20 -> descending by default on first click of a new column.
    expect(roomIdOrder(container)).toEqual(['r3', 'r2', 'r1'])
  })

  it('sort header controls are real buttons (no false affordance)', async () => {
    await schedulingPage.mount(container)
    const headers = container.querySelectorAll('th button')
    expect(headers.length).toBeGreaterThan(0)
    headers.forEach((h) => expect(h.tagName).toBe('BUTTON'))
  })
})
