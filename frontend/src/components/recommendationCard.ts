import type { RecommendationsResponse } from '../lib/apiTypes'

export interface RecommendationCardOptions {
  onSelect?(roomId: string): void
}

/** Renders nothing (empty container) when there's no hero recommendation. */
export function createRecommendationCard(
  container: HTMLElement,
  recommendation: RecommendationsResponse,
  options: RecommendationCardOptions = {},
): void {
  container.innerHTML = ''
  if (!recommendation.hero) return

  const wrap = document.createElement('div')
  wrap.className = 'recommendation-card'

  const heroBtn = document.createElement('button')
  heroBtn.type = 'button'
  heroBtn.dataset.action = 'select-hero'
  heroBtn.className = 'recommendation-hero'
  heroBtn.innerHTML = `
    <div class="recommendation-eyebrow">Recommended for you</div>
    <div class="recommendation-name">${escapeHtml(recommendation.hero.name)}</div>
    <div class="recommendation-meta">${escapeHtml(recommendation.hero.building)} · floor ${recommendation.hero.floor}</div>
    <div data-why-recommended class="recommendation-why" title="Based on rooms you've booked before, how popular this room is, and how close it is to your last booking">Why this room?</div>
  `
  heroBtn.addEventListener('click', () => options.onSelect?.(recommendation.hero!.roomId))
  wrap.append(heroBtn)

  if (recommendation.alternates.length > 0) {
    const altList = document.createElement('div')
    altList.className = 'recommendation-alternates'
    for (const alt of recommendation.alternates) {
      const altBtn = document.createElement('button')
      altBtn.type = 'button'
      altBtn.dataset.action = 'select-alternate'
      altBtn.className = 'recommendation-alternate'
      altBtn.textContent = alt.name
      altBtn.addEventListener('click', () => options.onSelect?.(alt.roomId))
      altList.append(altBtn)
    }
    wrap.append(altList)
  }

  container.append(wrap)
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
