import { describe, it, expect, vi } from 'vitest'
import { createRecommendationCard } from './recommendationCard'
import type { RecommendationsResponse } from '../lib/apiTypes'

function fixture(): RecommendationsResponse {
  return {
    hero: {
      roomId: 'atlas-0.710', name: 'Senaatzaal', building: 'atlas', floor: 0, capacity: 80,
      occupancy: 0, utilizationPct: 80, lastSeenTs: '2026-08-04T10:00:00.000Z', score: 0.62,
    },
    alternates: [
      { roomId: 'flux-1.02', name: 'Brainstorm Lounge', building: 'flux', floor: 1, capacity: 10,
        occupancy: 0, utilizationPct: 40, lastSeenTs: '2026-08-04T10:00:00.000Z', score: 0.3 },
    ],
  }
}

describe('recommendationCard', () => {
  it('renders the hero room name and a why-recommended tooltip', () => {
    const container = document.createElement('div')
    createRecommendationCard(container, fixture())
    expect(container.textContent).toContain('Senaatzaal')
    expect(container.querySelector('[data-why-recommended]')).toBeTruthy()
  })

  it('renders nothing when hero is null', () => {
    const container = document.createElement('div')
    createRecommendationCard(container, { hero: null, alternates: [] })
    expect(container.children.length).toBe(0)
  })

  it('calls onSelect with the hero roomId when clicked', () => {
    const container = document.createElement('div')
    const onSelect = vi.fn()
    createRecommendationCard(container, fixture(), { onSelect })
    const btn = container.querySelector('button[data-action="select-hero"]') as HTMLButtonElement
    btn.click()
    expect(onSelect).toHaveBeenCalledWith('atlas-0.710')
  })

  it('renders alternate rooms as buttons too', () => {
    const container = document.createElement('div')
    const onSelect = vi.fn()
    createRecommendationCard(container, fixture(), { onSelect })
    const altBtns = container.querySelectorAll('button[data-action="select-alternate"]')
    expect(altBtns.length).toBe(1)
    ;(altBtns[0] as HTMLButtonElement).click()
    expect(onSelect).toHaveBeenCalledWith('flux-1.02')
  })
})
