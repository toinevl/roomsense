import { describe, it, expect } from 'vitest'
import { createStreakCounter } from './streakCounter'
import type { StreakResponse, UnlockInfo } from '../lib/apiTypes'

const STREAK: StreakResponse = { userId: 'user-1', currentStreakDays: 3, longestStreakDays: 5, totalBookings: 8 }
const UNLOCKS: UnlockInfo[] = [
  { threshold: 3, label: 'Early Wrapped', unlocked: true },
  { threshold: 7, label: 'Regular badge', unlocked: false },
  { threshold: 14, label: 'Trust shoutout', unlocked: false },
]

describe('streakCounter', () => {
  it('renders the current streak count as a badge', () => {
    const container = document.createElement('div')
    createStreakCounter(container, STREAK, UNLOCKS)
    expect(container.querySelector('.streak-badge')?.textContent).toContain('3')
  })

  it('modal is hidden until openModal() is called', () => {
    const container = document.createElement('div')
    const handle = createStreakCounter(container, STREAK, UNLOCKS)
    expect(container.querySelector('.streak-modal')?.hasAttribute('hidden')).toBe(true)
    handle.openModal()
    expect(container.querySelector('.streak-modal')?.hasAttribute('hidden')).toBe(false)
    handle.closeModal()
    expect(container.querySelector('.streak-modal')?.hasAttribute('hidden')).toBe(true)
  })

  it('modal lists all unlocks with their unlocked state', () => {
    const container = document.createElement('div')
    createStreakCounter(container, STREAK, UNLOCKS)
    const items = container.querySelectorAll('.streak-unlock-item')
    expect(items.length).toBe(3)
    expect(items[0]?.getAttribute('data-unlocked')).toBe('true')
    expect(items[1]?.getAttribute('data-unlocked')).toBe('false')
  })
})
