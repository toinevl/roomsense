import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { bookingSuccessPage } from './bookingSuccess'

vi.mock('../lib/api', () => ({
  apiClient: {
    getRooms: vi.fn().mockResolvedValue([
      {
        roomId: 'r1',
        name: 'Senaatzaal',
        building: 'atlas',
        floor: 0,
        capacity: 80,
        occupancy: 5,
      },
    ]),
  },
}))

describe('bookingSuccessPage', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('page exports a valid Page object', () => {
    expect(bookingSuccessPage).toBeDefined()
    expect(typeof bookingSuccessPage.mount).toBe('function')
  })

  it('renders success heading and confirmation message', async () => {
    sessionStorage.setItem('roomsense.selectedRoomId', 'r1')
    sessionStorage.setItem('roomsense.bookingTime', new Date().toISOString())

    await bookingSuccessPage.mount(container)

    expect(container.textContent).toContain('Booking Confirmed!')
    expect(container.textContent).toContain('Senaatzaal')
  })

  it('displays celebration emoji and animation', async () => {
    sessionStorage.setItem('roomsense.selectedRoomId', 'r1')
    sessionStorage.setItem('roomsense.bookingTime', new Date().toISOString())

    await bookingSuccessPage.mount(container)

    const celebration = container.querySelector('.success-celebration')
    expect(celebration).toBeTruthy()
  })

  it('renders navigation buttons (back to finder, go to live)', async () => {
    sessionStorage.setItem('roomsense.selectedRoomId', 'r1')
    sessionStorage.setItem('roomsense.bookingTime', new Date().toISOString())

    await bookingSuccessPage.mount(container)

    const finderBtn = container.querySelector('button[data-action="find-another"]')
    const liveBtn = container.querySelector('button[data-action="go-live"]')

    expect(finderBtn).toBeTruthy()
    expect(liveBtn).toBeTruthy()
    expect(finderBtn?.textContent).toContain('Find Another Room')
    expect(liveBtn?.textContent).toContain('View Live Occupancy')
  })

  it('finder button navigates back to room finder', async () => {
    sessionStorage.setItem('roomsense.selectedRoomId', 'r1')
    sessionStorage.setItem('roomsense.bookingTime', new Date().toISOString())

    await bookingSuccessPage.mount(container)

    const finderBtn = container.querySelector('button[data-action="find-another"]') as HTMLButtonElement
    finderBtn.click()

    expect(window.location.hash).toBe('#finder')
  })

  it('live button navigates to live occupancy page', async () => {
    sessionStorage.setItem('roomsense.selectedRoomId', 'r1')
    sessionStorage.setItem('roomsense.bookingTime', new Date().toISOString())

    await bookingSuccessPage.mount(container)

    const liveBtn = container.querySelector('button[data-action="go-live"]') as HTMLButtonElement
    liveBtn.click()

    expect(window.location.hash).toBe('#live')
  })

  it('displays room details (name, floor, occupancy)', async () => {
    sessionStorage.setItem('roomsense.selectedRoomId', 'r1')
    sessionStorage.setItem('roomsense.bookingTime', new Date().toISOString())

    await bookingSuccessPage.mount(container)

    expect(container.textContent).toContain('Senaatzaal')
    expect(container.textContent).toContain('Atlas / Floor 0')
    expect(container.textContent).toContain('5 / 80')
  })

  it('shows countdown timer for next page redirect', async () => {
    sessionStorage.setItem('roomsense.selectedRoomId', 'r1')
    sessionStorage.setItem('roomsense.bookingTime', new Date().toISOString())

    await bookingSuccessPage.mount(container)

    const timer = container.querySelector('.auto-redirect-timer')
    expect(timer).toBeTruthy()
  })
})
