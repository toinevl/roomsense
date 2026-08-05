import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { isFeatureEnabled } from './featureFlag'

describe('isFeatureEnabled', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is deterministic across repeated calls (stable session id)', () => {
    const first = isFeatureEnabled('recommendations')
    const second = isFeatureEnabled('recommendations')
    expect(second).toBe(first)
  })

  it('persists the session id in localStorage', () => {
    isFeatureEnabled('recommendations')
    expect(localStorage.getItem('roomsense.flagSessionId')).toBeTruthy()
  })

  it('respects a pre-existing session id already in localStorage', () => {
    localStorage.setItem('roomsense.flagSessionId', 'fixed-id-for-test')
    isFeatureEnabled('recommendations')
    // The pre-existing id must not be overwritten by the function.
    expect(localStorage.getItem('roomsense.flagSessionId')).toBe('fixed-id-for-test')
  })

  it('does not throw when localStorage is blocked (private browsing, embedded iframe, etc.)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => isFeatureEnabled('recommendations')).not.toThrow()
  })
})
