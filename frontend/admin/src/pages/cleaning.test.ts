import { beforeEach, describe, expect, it, vi } from 'vitest'

const REFERENCE_TS = '2026-07-29T11:20:00.000Z'

// vi.mock's factory is hoisted above top-level const declarations, so fixtures
// it references must be declared via vi.hoisted (hoisted to the same point).
const { ROOMS, CLEANING_SAVINGS } = vi.hoisted(() => {
  const referenceTs = '2026-07-29T11:20:00.000Z'
  return {
    ROOMS: [
      {
        roomId: 'atlas-a1',
        building: 'atlas',
        floor: 1,
        name: 'Vergaderzaal Höganäs',
        capacity: 4,
        deviceId: 'dev-1',
        outlookAddress: 'atlas-a1@tue.nl',
        sourceId: 'terabee',
        occupancy: 0,
        utilizationPct: 0,
        lastSeenTs: referenceTs,
      },
      {
        roomId: 'atlas-b1',
        building: 'atlas',
        floor: 1,
        name: 'Zaal Curaçao',
        capacity: 10,
        deviceId: 'dev-2',
        outlookAddress: 'atlas-b1@tue.nl',
        sourceId: 'terabee',
        occupancy: 0,
        utilizationPct: 0,
        lastSeenTs: referenceTs,
      },
    ],
    CLEANING_SAVINGS: {
      rooms: [
        {
          roomId: 'atlas-a1',
          name: 'Vergaderzaal Höganäs',
          baselineCleans: 7,
          policyCleans: 1,
          cleansAvoided: 6,
          eurSaved: 90,
        },
        {
          roomId: 'atlas-b1',
          name: 'Zaal Curaçao',
          baselineCleans: 7,
          policyCleans: 4,
          cleansAvoided: 3,
          eurSaved: 45,
        },
      ],
      totals: {
        baselineCleans: 14,
        policyCleans: 5,
        cleansAvoided: 9,
        eurSaved: 135,
      },
    },
  }
})

vi.mock('../../../src/lib/api', () => ({
  apiClient: {
    getRooms: vi.fn().mockResolvedValue(ROOMS),
    getCleaningSavings: vi.fn().mockResolvedValue(CLEANING_SAVINGS),
  },
}))

import { cleaningPage } from './cleaning'

describe('admin cleaning page', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    vi.clearAllMocks()
  })

  it('renders the totals as a kpi-row header above the table', async () => {
    await cleaningPage.mount(container)
    const tiles = container.querySelectorAll('.kpi-tile')
    expect(tiles.length).toBe(2)
    expect(container.querySelector('#kpi-row')?.textContent).toContain('9')
    expect(container.querySelector('#kpi-row')?.textContent).toContain('€135')
  })

  it('renders one row per room in the breakdown table', async () => {
    await cleaningPage.mount(container)
    const rows = container.querySelectorAll('.cleaning-row')
    expect(rows.length).toBe(2)
  })

  it("the first row shows atlas-a1's baseline/policy/avoided/saved figures", async () => {
    await cleaningPage.mount(container)
    const rows = container.querySelectorAll('.cleaning-row')
    const first = rows[0]!
    expect(first.textContent).toContain('atlas-a1')
    expect(first.textContent).toContain('Vergaderzaal Höganäs')
    expect(first.textContent).toContain('7')
    expect(first.textContent).toContain('1')
    expect(first.textContent).toContain('6')
    expect(first.textContent).toContain('€90')
  })

  it("the second row shows the non-ASCII room name 'Zaal Curaçao' preserved", async () => {
    await cleaningPage.mount(container)
    const rows = container.querySelectorAll('.cleaning-row')
    const second = rows[1]!
    expect(second.textContent).toContain('Zaal Curaçao')
    expect(second.textContent).toContain('€45')
  })

  it('calls getCleaningSavings with a trailing 7-day range anchored on the latest lastSeenTs', async () => {
    const { apiClient } = await import('../../../src/lib/api')
    await cleaningPage.mount(container)
    expect(apiClient.getCleaningSavings).toHaveBeenCalledTimes(1)
    const [from, to] = (apiClient.getCleaningSavings as any).mock.calls[0]
    expect(to).toBe(REFERENCE_TS)
    expect(Date.parse(to) - Date.parse(from)).toBe(7 * 86_400_000)
  })

  it('renders an error state when the API call rejects', async () => {
    const { apiClient } = await import('../../../src/lib/api')
    ;(apiClient.getCleaningSavings as any).mockRejectedValueOnce(new Error('boom'))
    await cleaningPage.mount(container)
    expect(container.textContent).toContain("Couldn't load cleaning savings")
  })
})
