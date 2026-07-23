import { describe, it, expect, beforeEach, vi } from 'vitest'
import { privacySettingsPage } from './privacySettings'

// Mock apiClient
const mockGetPrivacy = vi.fn()
const mockUpdatePrivacy = vi.fn()

vi.mock('../lib/api', () => ({
  apiClient: {
    getPrivacy: (...args: unknown[]) => mockGetPrivacy(...args),
    updatePrivacy: (...args: unknown[]) => mockUpdatePrivacy(...args),
  },
}))

describe('privacySettingsPage', () => {
  let container: HTMLElement

  const mockSettings = {
    userId: 'user-1',
    locationSharingEnabled: true,
    friendVisibility: 'friends-only' as const,
    reviewAttributionDefault: 'named' as const,
    dataRetentionDays: 1,
    lastUpdated: '2025-03-10T08:00:00.000Z',
  }

  beforeEach(() => {
    container = document.createElement('div')
    vi.clearAllMocks()
    mockGetPrivacy.mockResolvedValue(mockSettings)
    mockUpdatePrivacy.mockResolvedValue(mockSettings)
  })

  it('exports a valid Page object with mount and unmount', () => {
    expect(privacySettingsPage).toBeDefined()
    expect(typeof privacySettingsPage.mount).toBe('function')
    expect(typeof privacySettingsPage.unmount).toBe('function')
  })

  it('renders the heading "Privacy Settings"', async () => {
    await privacySettingsPage.mount(container)

    await vi.waitFor(() => {
      const h1 = container.querySelector('h1')
      expect(h1?.textContent).toBe('Privacy Settings')
    })
  })

  it('renders location sharing toggle switch', async () => {
    await privacySettingsPage.mount(container)

    await vi.waitFor(() => {
      const toggle = container.querySelector('input[data-privacy="location-sharing"]') as HTMLInputElement
      expect(toggle).toBeTruthy()
      expect(toggle.type).toBe('checkbox')
      expect(toggle.checked).toBe(true)
    })
  })

  it('renders friend visibility radio options', async () => {
    await privacySettingsPage.mount(container)

    await vi.waitFor(() => {
      const radios = container.querySelectorAll('input[name="friend-visibility"]')
      expect(radios.length).toBe(3) // friends-only, campus, public
      expect(container.textContent).toContain('Friends only')
      expect(container.textContent).toContain('Campus')
      expect(container.textContent).toContain('Public')
    })
  })

  it('renders review attribution radio options', async () => {
    await privacySettingsPage.mount(container)

    await vi.waitFor(() => {
      const radios = container.querySelectorAll('input[name="review-attribution"]')
      expect(radios.length).toBe(2) // anonymous, named
      expect(container.textContent).toContain('Anonymous')
      expect(container.textContent).toContain('Use my name')
    })
  })

  it('renders data retention info', async () => {
    await privacySettingsPage.mount(container)

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Data Retention')
      expect(container.textContent).toContain('1 day')
    })
  })

  it('renders reassurance message', async () => {
    await privacySettingsPage.mount(container)

    await vi.waitFor(() => {
      expect(container.textContent).toContain('never sold')
    })
  })

  it('auto-saves when toggle is changed', async () => {
    await privacySettingsPage.mount(container)

    await vi.waitFor(() => {
      expect(mockGetPrivacy).toHaveBeenCalledWith('user-1')
    })

    const toggle = container.querySelector('input[data-privacy="location-sharing"]') as HTMLInputElement
    toggle.checked = false
    toggle.dispatchEvent(new Event('change'))

    await vi.waitFor(() => {
      expect(mockUpdatePrivacy).toHaveBeenCalledWith('user-1', { locationSharingEnabled: false })
    })
  })

  it('cleans up on unmount', async () => {
    await privacySettingsPage.mount(container)
    expect(() => privacySettingsPage.unmount!()).not.toThrow()
  })
})
