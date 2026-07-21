import { describe, it, expect } from 'vitest'
import { wrappedPage } from './wrapped'

describe('wrapped', () => {
  it('renders without error', async () => {
    const container = document.createElement('div')
    await wrappedPage.mount(container)
    expect(container.querySelector('.wrapped-card')).toBeDefined()
  })
})
