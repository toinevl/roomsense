import { apiClient } from '../lib/api'
import type { UserPresence } from '../lib/apiTypes'
import type { Page } from './types'

const POLL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

const styles = `
  .friends-page {
    max-width: 700px;
    margin: 0 auto;
  }

  .friends-page .page-header {
    margin-bottom: 1.5rem;
  }

  .friends-page h1 {
    font-size: clamp(1.6rem, 3vw, 2.2rem);
    margin: 0;
    color: var(--text-primary);
  }

  .friends-subtitle {
    color: var(--text-secondary);
    margin: 0.4rem 0 0;
    font-size: 0.95rem;
  }

  .friends-count {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }

  .friend-cards {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .friend-card {
    background: var(--surface-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem 1.15rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    text-align: left;
    transition: border-color 0.15s;
  }

  .friend-card:hover {
    border-color: var(--border-strong);
  }

  .friend-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .friend-name {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .friend-location {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--text-muted);
  }

  .friend-time {
    font-size: 0.74rem;
    color: var(--text-secondary);
    margin-top: 0.15rem;
  }

  .friend-status {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.35rem 0.65rem;
    border-radius: 999px;
    flex: none;
    min-height: 48px;
  }

  .friend-status.available {
    background: color-mix(in srgb, var(--status-good) 14%, transparent);
    color: var(--status-good);
  }

  .friend-status.busy {
    background: color-mix(in srgb, var(--status-serious) 14%, transparent);
    color: var(--status-serious);
  }

  .friend-status.offline {
    background: var(--surface-card-2);
    color: var(--text-muted);
  }

  .friend-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
  }

  .friends-empty {
    text-align: center;
    padding: 3rem 1.5rem;
    color: var(--text-muted);
  }

  .friends-empty p {
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }

  .friends-empty .empty-sub {
    font-size: 0.85rem;
  }

  .friends-loading {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }
`

function relativeTime(isoTs: string): string {
  const now = Date.now()
  const then = Date.parse(isoTs)
  if (Number.isNaN(then)) return ''
  const diffMs = now - then
  const minutes = Math.round(diffMs / 60000)
  const hours = Math.round(minutes / 60)
  const days = Math.round(hours / 24)
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} ago`
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  if (minutes >= 1) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  return 'just now'
}

function buildingLabel(building: string): string {
  return building.charAt(0).toUpperCase() + building.slice(1)
}

export const friendsPage: Page = {
  mount(container: HTMLElement) {
    const styleEl = document.createElement('style')
    styleEl.textContent = styles
    container.appendChild(styleEl)

    const wrapper = document.createElement('div')
    wrapper.className = 'friends-page'

    const header = document.createElement('header')
    header.className = 'page-header'
    const heading = document.createElement('h1')
    heading.textContent = 'Friends Near Me'
    header.appendChild(heading)
    const subtitle = document.createElement('p')
    subtitle.className = 'friends-subtitle'
    subtitle.textContent = 'See which friends are currently on campus.'
    header.appendChild(subtitle)
    wrapper.appendChild(header)

    const content = document.createElement('div')
    content.className = 'friends-content'
    wrapper.appendChild(content)

    container.appendChild(wrapper)

    let destroyed = false

    async function renderFriends(): Promise<void> {
      if (destroyed) return
      content.innerHTML = ''

      const loading = document.createElement('div')
      loading.className = 'friends-loading'
      loading.textContent = 'Loading…'
      content.appendChild(loading)

      try {
        const [friends, presence] = await Promise.all([
          apiClient.getFriends('user-1'),
          apiClient.getPresence(),
        ])

        if (destroyed) return
        content.innerHTML = ''

        // Only active friends — pending don't share presence
        const activeFriendIds = new Set(
          friends
            .filter((f) => f.status === 'active')
            .map((f) => f.friendId),
        )

        // Cross-reference: friends who are present (available or busy)
        const presentFriends = presence.filter(
          (p) => activeFriendIds.has(p.userId) && p.status !== 'offline',
        )

        const countLabel = document.createElement('div')
        countLabel.className = 'friends-count'
        countLabel.textContent =
          presentFriends.length === 0
            ? 'No friends currently on campus'
            : `${presentFriends.length} friend${presentFriends.length === 1 ? '' : 's'} on campus`
        content.appendChild(countLabel)

        if (presentFriends.length === 0) {
          const empty = document.createElement('div')
          empty.className = 'friends-empty'
          const main = document.createElement('p')
          main.textContent = 'No friends nearby right now.'
          const sub = document.createElement('p')
          sub.className = 'empty-sub'
          sub.textContent = 'When your friends arrive on campus, they will appear here.'
          empty.appendChild(main)
          empty.appendChild(sub)
          content.appendChild(empty)
          return
        }

        const cardsContainer = document.createElement('div')
        cardsContainer.className = 'friend-cards'
        for (const friend of presentFriends) {
          cardsContainer.appendChild(createFriendCard(friend))
        }
        content.appendChild(cardsContainer)
      } catch {
        if (destroyed) return
        content.innerHTML = ''
        const errorEl = document.createElement('div')
        errorEl.className = 'friends-empty'
        errorEl.textContent = 'Unable to load presence data. Please try again later.'
        content.appendChild(errorEl)
      }
    }

    function createFriendCard(p: UserPresence): HTMLElement {
      const card = document.createElement('div')
      card.className = 'friend-card'

      const info = document.createElement('div')
      info.className = 'friend-info'

      const name = document.createElement('div')
      name.className = 'friend-name'
      name.textContent = p.displayName
      info.appendChild(name)

      const location = document.createElement('div')
      location.className = 'friend-location'
      location.textContent = p.roomId
        ? `${buildingLabel(p.building)} · ${p.roomId}`
        : `${buildingLabel(p.building)}`
      info.appendChild(location)

      const time = document.createElement('div')
      time.className = 'friend-time'
      const rel = relativeTime(p.lastSeenTs)
      time.textContent = rel ? `Seen ${rel}` : ''
      info.appendChild(time)

      card.appendChild(info)

      const badge = document.createElement('div')
      badge.className = `friend-status ${p.status}`
      const dot = document.createElement('span')
      dot.className = 'friend-status-dot'
      badge.appendChild(dot)
      const label = document.createElement('span')
      label.textContent = p.status
      badge.appendChild(label)
      card.appendChild(badge)

      return card
    }

    // Initial render
    void renderFriends()

    // Poll every 5 minutes
    const intervalHandle = setInterval(() => void renderFriends(), POLL_INTERVAL_MS)

    // Store cleanup
    cleanup = () => {
      destroyed = true
      clearInterval(intervalHandle)
    }
  },

  unmount() {
    if (cleanup) cleanup()
  },
}

// Module-scoped cleanup handler so unmount can reach the interval.
let cleanup: (() => void) | null = null
