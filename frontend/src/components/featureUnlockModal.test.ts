import { describe, it, expect } from 'vitest'
import { showFeatureUnlockModal } from './featureUnlockModal'
import type { UnlockInfo } from '../lib/apiTypes'

const UNLOCK: UnlockInfo = { threshold: 3, label: 'Early access to RoomSense Wrapped', unlocked: true }

describe('featureUnlockModal', () => {
  it('renders the unlock label as a celebration', () => {
    const container = document.createElement('div')
    showFeatureUnlockModal(container, UNLOCK)
    expect(container.textContent).toContain('Early access to RoomSense Wrapped')
    expect(container.querySelector('.feature-unlock-modal')).toBeTruthy()
  })

  it('closes and removes itself when the close button is clicked', () => {
    const container = document.createElement('div')
    showFeatureUnlockModal(container, UNLOCK)
    const closeBtn = container.querySelector('button[data-action="close"]') as HTMLButtonElement
    closeBtn.click()
    expect(container.querySelector('.feature-unlock-modal')).toBeFalsy()
  })
})
