import { describe, it, expect, beforeEach, vi } from 'vitest'
import { friendsPage } from './friends'

// Mock apiClient
const mockGetPresence = vi.fn()
const mockGetFriends = vi.fn()

vi.mock('../lib/api', () => ({
  apiClient: {
    getPresence: (...args: unknown[]) => mockGetPresence(...args),
    getFriends: (...args: unknown[]) => mockGetFriends(...args),
  },
}))

describe('friendsPage', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    vi.clearAllMocks()
  })

  it('exports a valid Page object with mount and unmount', () => {
    expect(friendsPage).toBeDefined()
    expect(typeof friendsPage.mount).toBe('function')
    expect(typeof friendsPage.unmount).toBe('function')
  })

  it('renders the heading "Friends Near Me"', async () => {
    mockGetPresence.mockResolvedValue([])
    mockGetFriends.mockResolvedValue([])

    await friendsPage.mount(container)

    const h1 = container.querySelector('h1')
    expect(h1).toBeTruthy()
    expect(h1?.textContent).toBe('Friends Near Me')
  })

  it('renders friend cards when friends are present', async () => {
    // user-2 (Anaïs) and user-3 (Björn) are friends of user-1 and are present
    mockGetPresence.mockResolvedValue([
      {
        userId: 'user-2',
        displayName: 'Anaïs Dubois',
        building: 'atlas',
        roomId: 'atlas-0.710',
        status: 'available',
        lastSeenTs: '2025-03-10T09:15:00.000Z',
      },
      {
        userId: 'user-3',
        displayName: 'Björn Hölm',
        building: 'atlas',
        roomId: 'atlas-1.420',
        status: 'busy',
        lastSeenTs: '2025-03-10T09:42:00.000Z',
      },
    ])

    mockGetFriends.mockResolvedValue([
      {
        userId: 'user-1',
        friendId: 'user-2',
        friendName: 'Anaïs Dubois',
        status: 'active',
        canSeeLive: true,
        connectedAt: '2025-01-15T10:00:00.000Z',
      },
      {
        userId: 'user-1',
        friendId: 'user-3',
        friendName: 'Björn Hölm',
        status: 'active',
        canSeeLive: true,
        connectedAt: '2025-01-20T14:30:00.000Z',
      },
    ])

    await friendsPage.mount(container)

    await vi.waitFor(() => {
      const cards = container.querySelectorAll('.friend-card')
      expect(cards.length).toBe(2)
    })

    // Verify non-ASCII names render
    expect(container.textContent).toContain('Anaïs Dubois')
    expect(container.textContent).toContain('Björn Hölm')
  })

  it('shows empty state when no friends are nearby', async () => {
    mockGetPresence.mockResolvedValue([
      {
        userId: 'user-99',
        displayName: 'Stranger',
        building: 'atlas',
        roomId: 'atlas-0.710',
        status: 'available',
        lastSeenTs: '2025-03-10T09:15:00.000Z',
      },
    ])

    mockGetFriends.mockResolvedValue([
      {
        userId: 'user-1',
        friendId: 'user-2',
        friendName: 'Anaïs Dubois',
        status: 'active',
        canSeeLive: true,
        connectedAt: '2025-01-15T10:00:00.000Z',
      },
    ])

    await friendsPage.mount(container)

    await vi.waitFor(() => {
      const empty = container.querySelector('.friends-empty')
      expect(empty).toBeTruthy()
    })
    expect(container.textContent).toContain('No friends nearby')

    // No friend cards rendered
    const cards = container.querySelectorAll('.friend-card')
    expect(cards.length).toBe(0)
  })

  it('cleans up polling on unmount', async () => {
    mockGetPresence.mockResolvedValue([])
    mockGetFriends.mockResolvedValue([])

    await friendsPage.mount(container)

    // Should not throw
    expect(() => friendsPage.unmount!()).not.toThrow()
  })
})
