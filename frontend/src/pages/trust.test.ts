import { describe, it, expect } from 'vitest'
import { trustPage } from './trust'

describe('trust', () => {
  it('renders faq page', () => {
    const container = document.createElement('div')
    trustPage.mount(container)
    expect(container.innerHTML).toBeDefined()
    expect(container.innerHTML.length).toBeGreaterThan(0)
  })
})
