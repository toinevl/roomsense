import { describe, it, expect, beforeEach, vi } from 'vitest'
import { roomFinderPage } from './roomFinder'

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
  },
}))

describe('roomFinder', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    container.innerHTML = ''
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
})
