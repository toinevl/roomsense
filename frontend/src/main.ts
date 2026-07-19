import './styles/main.css'
import { apiClient } from './lib/api'
import { dashboardPage } from './pages/dashboard'
import { livePage } from './pages/live'
import { architecturePage } from './pages/architecture'
import type { Page } from './pages/types'

const routes: Record<string, { page: Page; title: string }> = {
  dashboard: { page: dashboardPage, title: 'Dashboard' },
  live: { page: livePage, title: 'Live' },
  architecture: { page: architecturePage, title: 'Architecture' },
}

const DEFAULT_ROUTE = 'dashboard'

const appEl = document.getElementById('app')!
const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.primary-nav a'))

let activePage: Page | null = null

function routeFromHash(): string {
  const raw = window.location.hash.replace(/^#/, '')
  return raw in routes ? raw : DEFAULT_ROUTE
}

async function render(): Promise<void> {
  const routeKey = routeFromHash()
  const route = routes[routeKey]!

  if (activePage?.unmount) activePage.unmount()
  appEl.innerHTML = ''

  for (const link of navLinks) {
    link.classList.toggle('active', link.dataset.route === routeKey)
  }
  document.title = `${route.title} — RoomSense`

  activePage = route.page
  await route.page.mount(appEl)
  appEl.focus()
}

window.addEventListener('hashchange', () => {
  void render()
})

// Normalize the empty-hash case without firing an extra hashchange/render.
if (!window.location.hash) {
  history.replaceState(null, '', `#${DEFAULT_ROUTE}`)
}
void render()

// ---------------------------------------------------------------------------
// Topbar health ping — mirrors nordicHolidays' warm-up pattern, but here it
// also drives the connectivity dot so a broken API is visible immediately.
// ---------------------------------------------------------------------------
const statusDot = document.getElementById('status-dot')!
const statusLabel = document.getElementById('status-label')!

apiClient
  .getHealth()
  .then((health) => {
    statusDot.classList.add('ok')
    statusLabel.textContent = health.status === 'ok' ? 'live' : health.status
  })
  .catch(() => {
    statusDot.classList.add('err')
    statusLabel.textContent = 'offline'
  })
