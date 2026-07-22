import './styles/main.css'
import { apiClient } from './lib/api'
import { config } from './config'
import { dashboardPage } from './pages/dashboard'
import { livePage } from './pages/live'
import { architecturePage } from './pages/architecture'
import { roomFinderPage } from './pages/roomFinder'
import { reportPage } from './pages/report'
import { trustPage } from './pages/trust'
import { wrappedPage } from './pages/wrapped'
import { bookingSuccessPage } from './pages/bookingSuccess'
import type { Page } from './pages/types'

const routes: Record<string, { page: Page; title: string }> = {
  dashboard: { page: dashboardPage, title: 'Dashboard' },
  live: { page: livePage, title: 'Live' },
  architecture: { page: architecturePage, title: 'Architecture' },
  finder: { page: roomFinderPage, title: 'Find a Room' },
  report: { page: reportPage, title: 'Semester in Review' },
  trust: { page: trustPage, title: 'Trust & Transparency' },
  wrapped: { page: wrappedPage, title: 'RoomSense Wrapped' },
  'booking-success': { page: bookingSuccessPage, title: 'Booking Confirmed' },
}

const DEFAULT_ROUTE = 'dashboard'

const appEl = document.getElementById('app')!
const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.primary-nav a'))

// Guard: every route must have a corresponding nav link (prevents orphaned pages)
if (import.meta.env.DEV) {
  const navRoutes = new Set(navLinks.map(link => link.dataset.route))
  const routeKeys = Object.keys(routes)
  const orphaned = routeKeys.filter(r => !navRoutes.has(r) && r !== DEFAULT_ROUTE)
  if (orphaned.length > 0) {
    console.warn(
      `⚠️  Routes without nav links: ${orphaned.join(', ')}. ` +
      `Add them to frontend/index.html <nav class="primary-nav"> or update the guard check.`
    )
  }
}

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

// ---------------------------------------------------------------------------
// Presenter mode (#25) — global toggle, visible across every page, that
// calls POST /simulate/tick every 30s so telemetry visibly advances during a
// live demo instead of sitting on a static seeded snapshot. The 30s cadence
// is deliberately slower than the Live page's own 10s poll: this control
// advances the *server's* clock (real mode) or the shared mock clock (mock
// mode); the existing per-page polling is what displays the result.
//
// The x-sim-key is never baked into the bundle — it's entered once via a
// prompt and kept only in sessionStorage, so it doesn't survive in a public
// JS file anyone can read. In mock mode no key is needed at all.
// ---------------------------------------------------------------------------
const SIM_KEY_STORAGE = 'roomsense.simKey'
const TICK_INTERVAL_MS = 30_000

const presenterToggle = document.getElementById('presenter-toggle') as HTMLButtonElement
const presenterLabel = document.getElementById('presenter-label')!

let presenterActive = false
let presenterHandle: ReturnType<typeof setInterval> | null = null

function setPresenterLabel(text: string): void {
  presenterLabel.textContent = text
}

function stopPresenterMode(labelWhenStopped = 'Presenter mode'): void {
  if (presenterHandle) {
    clearInterval(presenterHandle)
    presenterHandle = null
  }
  presenterActive = false
  presenterToggle.classList.remove('active')
  presenterToggle.setAttribute('aria-pressed', 'false')
  setPresenterLabel(labelWhenStopped)
}

async function tickOnce(key: string): Promise<void> {
  await apiClient.simulateTick(key)
}

async function startPresenterMode(): Promise<void> {
  const key = config.mock ? '' : (sessionStorage.getItem(SIM_KEY_STORAGE) ?? window.prompt('Simulator key (x-sim-key):') ?? '')
  if (!config.mock && !key) return // cancelled prompt — stay off

  setPresenterLabel('Starting…')
  try {
    await tickOnce(key)
  } catch (err) {
    const unauthorized = err instanceof Error && err.message.startsWith('401')
    setPresenterLabel(unauthorized ? 'Invalid key' : 'Blocked — see Architecture')
    if (unauthorized) sessionStorage.removeItem(SIM_KEY_STORAGE)
    setTimeout(() => setPresenterLabel('Presenter mode'), unauthorized ? 2500 : 5000)
    return
  }

  if (!config.mock) sessionStorage.setItem(SIM_KEY_STORAGE, key)
  presenterActive = true
  presenterToggle.classList.add('active')
  presenterToggle.setAttribute('aria-pressed', 'true')
  setPresenterLabel('Presenting')

  presenterHandle = setInterval(() => {
    void tickOnce(key).catch((err) => {
      const unauthorized = err instanceof Error && err.message.startsWith('401')
      if (unauthorized) sessionStorage.removeItem(SIM_KEY_STORAGE)
      stopPresenterMode(unauthorized ? 'Invalid key' : 'Blocked — see Architecture')
    })
  }, TICK_INTERVAL_MS)
}

presenterToggle.addEventListener('click', () => {
  if (presenterActive) {
    stopPresenterMode()
  } else {
    void startPresenterMode()
  }
})
