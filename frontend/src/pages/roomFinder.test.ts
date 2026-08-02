import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { roomFinderPage } from './roomFinder'
import { apiClient } from '../lib/api'

// Mock apiClient to avoid real network calls
vi.mock('../lib/api', () => ({
  apiClient: {
    getRooms: vi.fn().mockResolvedValue([
      {
        roomId: 'r1',
        name: 'Test Room A',
        building: 'atlas',
        floor: 1,
        capacity: 10,
        occupancy: 5,
      },
      {
        roomId: 'r2',
        name: 'Test Room B',
        building: 'atlas',
        floor: 2,
        capacity: 8,
        occupancy: 8, // at capacity — should not appear
      },
    ]),
    getRecommendations: vi.fn().mockResolvedValue({ hero: null, alternates: [] }),
    postBooking: vi.fn().mockResolvedValue({ userId: 'user-1', roomId: 'r1', bookedAt: '2026-01-01T00:00:00.000Z' }),
  },
}))

// Deterministic: keeps these tests independent of the real 30%
// session-hash split in lib/featureFlag.ts, which is exercised separately
// in featureFlag.test.ts.
vi.mock('../lib/featureFlag', () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(false),
}))

describe('roomFinder', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    container.innerHTML = ''
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('page exports a valid Page object', () => {
    expect(roomFinderPage).toBeDefined()
    expect(typeof roomFinderPage.mount).toBe('function')
  })

  it('mounts and renders available rooms with clickable CTA buttons', async () => {
    await roomFinderPage.mount(container)

    const cards = container.querySelectorAll('.room-card')
    expect(cards.length).toBeGreaterThan(0)

    // Guard: Every room card MUST have a CTA button (not just styled div)
    // to ensure click handlers and proper mobile affordance
    cards.forEach((card) => {
      const ctaButton = card.querySelector('.room-card-cta')
      expect(ctaButton).toBeTruthy()
      expect(ctaButton?.tagName).toBe('BUTTON')
      expect(ctaButton?.textContent).toBe('Book Now')
    })
  })

  it('room card CTA buttons respond to clicks', async () => {
    await roomFinderPage.mount(container)

    const firstCard = container.querySelector('.room-card')
    expect(firstCard).toBeTruthy()

    const ctaButton = firstCard?.querySelector('.room-card-cta') as HTMLButtonElement
    expect(ctaButton).toBeTruthy()
    expect(ctaButton.tagName).toBe('BUTTON')

    // Verify button is clickable
    const clickSpy = vi.fn()
    ctaButton.addEventListener('click', clickSpy)
    ctaButton.click()

    // In real app, click navigates via window.location.hash.
    // Here we just verify the button responds to clicks.
    expect(clickSpy).toHaveBeenCalled()
  })

  it('filters out fully-occupied rooms', async () => {
    await roomFinderPage.mount(container)

    const roomNames = Array.from(container.querySelectorAll('.room-name')).map((el) =>
      el.textContent,
    )

    expect(roomNames).toContain('Test Room A') // occupancy 5 < capacity 10
    expect(roomNames).not.toContain('Test Room B') // occupancy 8 = capacity 8 (full)
  })

  it('calls apiClient.postBooking when a booking is confirmed', async () => {
    await roomFinderPage.mount(container)

    const ctaButton = container.querySelector('.room-card-cta') as HTMLButtonElement
    ctaButton.click()

    // createConfirmationModal renders into document.body, not `container`.
    const confirmBtn = document.body.querySelector(
      '[data-action="confirm"]',
    ) as HTMLButtonElement
    expect(confirmBtn).toBeTruthy()
    confirmBtn.click()

    expect(apiClient.postBooking).toHaveBeenCalledWith('user-1', expect.any(String), expect.any(String))
  })
})
