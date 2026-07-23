import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reviewsPage } from './reviews'

// Mock apiClient
const mockGetRooms = vi.fn()
const mockGetReviews = vi.fn()
const mockCreateReview = vi.fn()

vi.mock('../lib/api', () => ({
  apiClient: {
    getRooms: (...args: unknown[]) => mockGetRooms(...args),
    getReviews: (...args: unknown[]) => mockGetReviews(...args),
    createReview: (...args: unknown[]) => mockCreateReview(...args),
  },
}))

describe('reviewsPage', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    vi.clearAllMocks()
  })

  const mockRooms = [
    { roomId: 'atlas-0.710', name: 'Senaatzaal', building: 'atlas', floor: 0, capacity: 80 },
    { roomId: 'flux-2.240', name: 'Focus Lab', building: 'flux', floor: 2, capacity: 12 },
  ]

  const mockReviewList = [
    {
      reviewId: 'rev-1',
      roomId: 'atlas-0.710',
      authorId: 'user-2',
      authorName: 'Anaïs Dubois',
      rating: 5,
      title: 'Excellent focus room',
      body: 'Very quiet and well-lit.',
      tags: ['quiet', 'good-lighting'],
      helpfulCount: 12,
      status: 'active',
      createdAt: '2025-02-28T10:00:00.000Z',
      updatedAt: '2025-02-28T10:00:00.000Z',
    },
    {
      reviewId: 'rev-2',
      roomId: 'atlas-0.710',
      authorId: 'user-3',
      authorName: 'Björn Hölm',
      rating: 4,
      title: 'Solid choice',
      body: 'Good room overall.',
      tags: ['quiet'],
      helpfulCount: 7,
      status: 'active',
      createdAt: '2025-03-01T14:20:00.000Z',
      updatedAt: '2025-03-01T14:20:00.000Z',
    },
  ]

  it('exports a valid Page object with mount and unmount', () => {
    expect(reviewsPage).toBeDefined()
    expect(typeof reviewsPage.mount).toBe('function')
    expect(typeof reviewsPage.unmount).toBe('function')
  })

  it('renders the heading "Room Reviews"', async () => {
    mockGetRooms.mockResolvedValue(mockRooms)
    mockGetReviews.mockResolvedValue([])

    await reviewsPage.mount(container)

    // Wait for async load
    await vi.waitFor(() => {
      const h1 = container.querySelector('h1')
      expect(h1?.textContent).toBe('Room Reviews')
    })
  })

  it('renders room selector populated from getRooms', async () => {
    mockGetRooms.mockResolvedValue(mockRooms)
    mockGetReviews.mockResolvedValue(mockReviewList)

    await reviewsPage.mount(container)

    await vi.waitFor(() => {
      const select = container.querySelector('.reviews-room-select') as HTMLSelectElement
      expect(select).toBeTruthy()
      const options = select.querySelectorAll('option')
      expect(options.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows reviews for the selected room', async () => {
    mockGetRooms.mockResolvedValue(mockRooms)
    mockGetReviews.mockResolvedValue(mockReviewList)

    await reviewsPage.mount(container)

    await vi.waitFor(() => {
      const reviewCards = container.querySelectorAll('.review-card')
      expect(reviewCards.length).toBe(2)
      expect(container.textContent).toContain('Excellent focus room')
      expect(container.textContent).toContain('Anaïs Dubois')
    })
  })

  it('sort toggle switches between recent and helpful', async () => {
    mockGetRooms.mockResolvedValue(mockRooms)
    mockGetReviews.mockResolvedValue(mockReviewList)

    await reviewsPage.mount(container)

    // Wait for initial load
    await vi.waitFor(() => {
      expect(mockGetReviews).toHaveBeenCalled()
    })

    // Clear and click "Most Helpful"
    mockGetReviews.mockClear()
    const helpfulBtn = container.querySelector('button[data-sort="helpful"]') as HTMLButtonElement
    expect(helpfulBtn).toBeTruthy()
    helpfulBtn.click()

    await vi.waitFor(() => {
      expect(mockGetReviews).toHaveBeenCalledWith('atlas-0.710', 'helpful')
    })
  })

  it('renders Write a Review button', async () => {
    mockGetRooms.mockResolvedValue(mockRooms)
    mockGetReviews.mockResolvedValue(mockReviewList)

    await reviewsPage.mount(container)

    await vi.waitFor(() => {
      const writeBtn = container.querySelector('.reviews-write-btn') as HTMLButtonElement
      expect(writeBtn).toBeTruthy()
      expect(writeBtn.textContent).toContain('Write a Review')
    })
  })

  it('cleans up on unmount', async () => {
    mockGetRooms.mockResolvedValue(mockRooms)
    mockGetReviews.mockResolvedValue([])

    await reviewsPage.mount(container)
    expect(() => reviewsPage.unmount!()).not.toThrow()
  })
})
