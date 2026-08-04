import type { RecommendationsResponse } from '../lib/apiTypes'
import { escapeHtml } from '../lib/format'

export interface RecommendationCardOptions {
  onSelect?(roomId: string): void
}

const styles = `
  .recommendation-card { margin-bottom: 1.5rem; }
  .recommendation-hero {
    display: block; width: 100%; text-align: left;
    background: var(--surface-card); border: 1px solid var(--border-strong);
    border-radius: var(--radius); padding: 1.1rem 1.25rem; cursor: pointer;
    font-family: inherit; box-shadow: var(--shadow-card);
    transition: border-color 0.15s;
  }
  .recommendation-hero:hover { border-color: var(--brand); }
  .recommendation-eyebrow {
    font-family: var(--font-display); font-size: 0.78rem; font-weight: 600;
    color: var(--brand); margin-bottom: 0.3rem;
  }
  .recommendation-name { font-size: 1.15rem; font-weight: 700; color: var(--text-primary); }
  .recommendation-meta { font-size: 0.82rem; color: var(--text-muted); margin: 0.2rem 0 0.5rem; }
  .recommendation-why {
    display: inline-block; font-size: 0.76rem; color: var(--text-secondary);
    border-bottom: 1px dotted var(--border-strong); cursor: help;
  }
  .recommendation-alternates { display: flex; gap: 0.6rem; margin-top: 0.75rem; flex-wrap: wrap; }
  .recommendation-alternate {
    font-family: var(--font-display); font-size: 0.82rem; font-weight: 600;
    color: var(--text-secondary); background: var(--surface-card-2);
    border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
    padding: 0.45rem 0.85rem; cursor: pointer;
  }
  .recommendation-alternate:hover { color: var(--text-primary); border-color: var(--brand); }
`

/** Renders nothing (empty container) when there's no hero recommendation. */
export function createRecommendationCard(
  container: HTMLElement,
  recommendation: RecommendationsResponse,
  options: RecommendationCardOptions = {},
): void {
  if (!document.querySelector('style[data-component="recommendation-card"]')) {
    const styleEl = document.createElement('style')
    styleEl.setAttribute('data-component', 'recommendation-card')
    styleEl.textContent = styles
    document.head.appendChild(styleEl)
  }

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
