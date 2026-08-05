import { describe, it, expect } from 'vitest'
import { growthPage } from './growth'

describe('admin growth page', () => {
  it('renders a visible illustrative-data disclaimer', async () => {
    const container = document.createElement('div')
    await growthPage.mount(container)
    expect(container.textContent).toMatch(/illustrative/i)
    expect(container.textContent).toMatch(/no real user traffic/i)
  })

  it('renders sample CTR/time-to-decision/DAU/p-value metrics', async () => {
    const container = document.createElement('div')
    await growthPage.mount(container)
    const tiles = container.querySelectorAll('.kpi-tile')
    expect(tiles.length).toBeGreaterThanOrEqual(4)
  })
})
