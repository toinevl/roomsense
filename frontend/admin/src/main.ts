import '../../src/styles/main.css'
import './admin.css'
import { apiClient } from '../../src/lib/api'
import { overviewPage } from './pages/overview'
import { roomsPage } from './pages/rooms'
import { growthPage } from './pages/growth'
import type { Page } from '../../src/pages/types'

/**
 * Own tiny router for the admin area — deliberately NOT part of the student
 * SPA's route table (frontend/src/main.ts) or nav. This is a separate Vite
 * HTML entry (admin/index.html) serving a facility-manager console; the two
 * apps share only frontend/src/styles/main.css (imported above) for visual
 * consistency (TU/e scarlet, Lato, flat/square tokens). No presenter-mode or
 * mock/live toggle here — those are demo-driving tools for the student app,
 * not something a facility manager needs; the health status dot is kept
 * since it's a cheap, useful "is the API up" signal.
 */

const routes: Record<string, { page: Page; title: string }> = {
  overview: { page: overviewPage, title: 'Overview' },
  rooms: { page: roomsPage, title: 'Rooms' },
  growth: { page: growthPage, title: 'Growth' },
}

const DEFAULT_ROUTE = 'overview'

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
  document.title = `${route.title} — RoomSense Admin`

  activePage = route.page
  await route.page.mount(appEl)
  appEl.focus()
}

window.addEventListener('hashchange', () => {
  void render()
})

if (!window.location.hash) {
  history.replaceState(null, '', `#${DEFAULT_ROUTE}`)
}
void render()

const statusDot = document.getElementById('status-dot')!
const statusLabel = document.getElementById('status-label')!

apiClient
  .getHealth()
  .then((health) => {
    statusDot.classList.add('ok')
    statusLabel.textContent = health.status === 'ok' ? 'connected' : health.status
  })
  .catch(() => {
    statusDot.classList.add('err')
    statusLabel.textContent = 'offline'
  })
