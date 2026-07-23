import type { RoomReview } from '../lib/apiTypes'

const styles = `
  .review-card {
    background: var(--surface-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.25rem 1.35rem;
    margin-bottom: 1rem;
  }

  .review-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .review-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.3;
  }

  .review-stars {
    font-size: 1rem;
    color: var(--series-4, #c98500);
    letter-spacing: 1px;
    flex: none;
  }

  .review-body {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin: 0.5rem 0 0.75rem 0;
    line-height: 1.5;
  }

  .review-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.6rem;
  }

  .review-tag {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.03em;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    background: var(--surface-card-2);
    border: 1px solid var(--border);
    color: var(--text-secondary);
  }

  .review-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .review-author {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .review-helpful {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    min-height: 48px;
    padding: 0.35rem 0.75rem;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--text-secondary);
    background: transparent;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .review-helpful:hover { color: var(--text-primary); border-color: var(--series-1); }
`

let stylesInjected = false

function injectStyles(): void {
  if (stylesInjected || document.querySelector('style[data-review-card]')) {
    stylesInjected = true
    return
  }
  const styleEl = document.createElement('style')
  styleEl.setAttribute('data-review-card', 'true')
  styleEl.textContent = styles
  document.head.appendChild(styleEl)
  stylesInjected = true
}

function formatStars(rating: number): string {
  const full = Math.max(0, Math.min(5, rating))
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

function relativeTime(isoTs: string): string {
  const now = Date.now()
  const then = Date.parse(isoTs)
  if (Number.isNaN(then)) return ''
  const diffMs = now - then
  const seconds = Math.round(diffMs / 1000)
  const minutes = Math.round(seconds / 60)
  const hours = Math.round(minutes / 60)
  const days = Math.round(hours / 24)

  if (days > 30) {
    const date = new Date(then)
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} ago`
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  if (minutes >= 1) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  return 'just now'
}

export function createReviewCard(review: RoomReview): HTMLElement {
  injectStyles()

  const card = document.createElement('article')
  card.className = 'review-card'

  // Header: title + stars
  const header = document.createElement('div')
  header.className = 'review-card-header'

  const title = document.createElement('h3')
  title.className = 'review-title'
  title.textContent = review.title
  header.appendChild(title)

  const stars = document.createElement('span')
  stars.className = 'review-stars'
  stars.textContent = formatStars(review.rating)
  header.appendChild(stars)

  card.appendChild(header)

  // Body
  const body = document.createElement('p')
  body.className = 'review-body'
  body.textContent = review.body
  card.appendChild(body)

  // Tags
  if (review.tags.length > 0) {
    const tagRow = document.createElement('div')
    tagRow.className = 'review-tags'
    for (const tag of review.tags) {
      const pill = document.createElement('span')
      pill.className = 'review-tag'
      pill.textContent = tag
      tagRow.appendChild(pill)
    }
    card.appendChild(tagRow)
  }

  // Footer: author/time + helpful count
  const footer = document.createElement('div')
  footer.className = 'review-footer'

  const author = document.createElement('span')
  author.className = 'review-author'
  const timeAgo = relativeTime(review.createdAt)
  author.textContent = timeAgo
    ? `${review.authorName} · ${timeAgo}`
    : review.authorName
  footer.appendChild(author)

  const helpfulBtn = document.createElement('button')
  helpfulBtn.className = 'review-helpful'
  helpfulBtn.type = 'button'
  helpfulBtn.textContent = `👍 ${review.helpfulCount} helpful`
  footer.appendChild(helpfulBtn)

  card.appendChild(footer)
  return card
}
