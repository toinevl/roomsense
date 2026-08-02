import { describe, it, expect, beforeEach } from 'vitest'
import { isFeatureEnabled } from './featureFlag'

describe('isFeatureEnabled', () => {
  beforeEach(() => {
    localStorage.clear()
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
    const result = isFeatureEnabled('recommendations')
    // Same fixed id must always produce the same result, run after run.
    localStorage.setItem('roomsense.flagSessionId', 'fixed-id-for-test')
    expect(isFeatureEnabled('recommendations')).toBe(result)
  })
})
