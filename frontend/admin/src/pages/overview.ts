import { apiClient } from '../../../src/lib/api'
import type { OccupancySnapshot, Reservation, RoomWithOccupancy } from '../../../src/lib/apiTypes'
import { formatEur, formatPercent } from '../../../src/lib/format'
import { SEQUENTIAL_STEPS, buildSparklinePath, sequentialStepForPct, svgEl } from '../../../src/lib/charts'
import type { Page } from '../../../src/pages/types'
import { computeRoomStatus, maxOccupancyDuring, minutesUntilNextBooking, type RoomStatus } from '../lib/roomStatus'
import { buildReclaimSlots, type PastGhostReservation, type ReclaimSlots } from '../lib/reclaim'
import { appendAuditLog, readAuditLog, renderAuditLog, showToast } from '../components/toast'

const WEEK_DAYS = 7
const SPARK_DAYS = 10
const FREE_LONG_MINUTES = 45

function buildingLabel(building: string): string {
  return building.charAt(0).toUpperCase() + building.slice(1)
}

function isoDateOnly(iso: string): string {
  return iso.slice(0, 10)
}

function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString()
}

function reservationHours(r: Reservation): number {
  return (Date.parse(r.endTs) - Date.parse(r.startTs)) / 3_600_000
}

const STATUS_COLOR: Record<RoomStatus['status'], string> = {
  free: 'var(--status-good)',
  'in-use': 'var(--status-warning)',
  ghost: 'var(--status-critical)',
  offline: 'var(--text-muted)',
}

const STATUS_LABEL: Record<RoomStatus['status'], string> = {
  free: 'Free',
  'in-use': 'In use',
  ghost: 'Ghost',
  offline: 'Offline',
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

interface WeeklyData {
  referenceTs: string
  rooms: RoomWithOccupancy[]
  statuses: Map<string, RoomStatus>
  occupancyByRoom: Map<string, OccupancySnapshot[]>
  reservationsTodayByRoom: Map<string, Reservation[]>
  ghostCount: number
  wastedHours: number
  wastedEur: number
  pastGhosts: PastGhostReservation[]
  utilSeries: number[] // oldest -> newest, last entry = today
}

async function loadWeeklyData(): Promise<WeeklyData> {
  const rooms = await apiClient.getRooms()
  const referenceTs = rooms.reduce((max, r) => (r.lastSeenTs > max ? r.lastSeenTs : max), rooms[0]?.lastSeenTs ?? new Date(0).toISOString())

  // Day 0 = today, back to day 6 — oldest last so index 0 is always "today".
  const weekDates = Array.from({ length: WEEK_DAYS }, (_, i) => isoDateOnly(addDaysIso(referenceTs, -i)))
  const weekStart = `${weekDates[weekDates.length - 1]}T00:00:00.000Z`

  const [occupancyByRoomArr, reservationsByRoomArr] = await Promise.all([
    Promise.all(rooms.map((room) => apiClient.getRoomOccupancy(room.roomId, weekStart, referenceTs))),
    Promise.all(rooms.map((room) => Promise.all(weekDates.map((date) => apiClient.getRoomReservations(room.roomId, date))))),
  ])

  const occupancyByRoom = new Map<string, OccupancySnapshot[]>()
  const reservationsTodayByRoom = new Map<string, Reservation[]>()
  const statuses = new Map<string, RoomStatus>()
  let ghostCount = 0
  let wastedHours = 0
  const pastGhosts: PastGhostReservation[] = []

  rooms.forEach((room, i) => {
    const occupancy = occupancyByRoomArr[i]!
    const reservationsByDate = reservationsByRoomArr[i]!
    occupancyByRoom.set(room.roomId, occupancy)
    reservationsTodayByRoom.set(room.roomId, reservationsByDate[0]!)

    const status = computeRoomStatus({
      room,
      referenceTs,
      reservationsToday: reservationsByDate[0]!,
      recentOccupancy: occupancy,
    })
    statuses.set(room.roomId, status)

    for (const dayReservations of reservationsByDate) {
      for (const r of dayReservations) {
        const startMs = Date.parse(r.startTs)
        const endMs = Date.parse(r.endTs)
        if (maxOccupancyDuring(occupancy, startMs, endMs) > 0) continue
        ghostCount += 1
        wastedHours += reservationHours(r)
        const isCurrentlyActive =
          status.activeReservation?.startTs === r.startTs && status.activeReservation?.endTs === r.endTs
        if (!isCurrentlyActive) pastGhosts.push({ room, reservation: r })
      }
    }
  })

  const sparkDates = Array.from({ length: SPARK_DAYS }, (_, i) => isoDateOnly(addDaysIso(referenceTs, -(SPARK_DAYS - 1 - i))))
  const [dailyKpis, weekKpis] = await Promise.all([
    Promise.all(sparkDates.map((date) => apiClient.getKpis(`${date}T00:00:00.000Z`, `${date}T23:59:59.999Z`))),
    apiClient.getKpis(weekStart, referenceTs),
  ])

  return {
    referenceTs,
    rooms,
    statuses,
    occupancyByRoom,
    reservationsTodayByRoom,
    ghostCount,
    wastedHours,
    wastedEur: weekKpis.wastedEur,
    pastGhosts,
    utilSeries: dailyKpis.map((k) => k.avgUtilizationPct),
  }
}

// ---------------------------------------------------------------------------
// Rendering — skeleton, KPI tiles, room grid
// ---------------------------------------------------------------------------

function renderSkeleton(): string {
  return `
    <div class="page-header">
      <div class="page-eyebrow">Facility overview</div>
      <h1 class="page-title">RoomSense Admin</h1>
      <p class="page-sub">Live room status, this week's ghost-meeting cost, and the rooms worth reclaiming right now.</p>
    </div>
    <div class="kpi-row" id="kpi-row" aria-busy="true"></div>
    <div class="admin-overview-grid">
      <section class="chart-card" id="room-grid-card"></section>
      <section class="chart-card" id="reclaim-card"></section>
    </div>
  `
}

function kpiTile(label: string, valueHtml: string, note: string, accentClass = ''): HTMLDivElement {
  const tile = document.createElement('div')
  tile.className = `kpi-tile ${accentClass}`.trim()
  const labelEl = document.createElement('div')
  labelEl.className = 'kpi-label'
  labelEl.textContent = label
  const valueEl = document.createElement('div')
  valueEl.className = 'kpi-value'
  valueEl.innerHTML = valueHtml // safe: built only from our own formatted numbers below
  const noteEl = document.createElement('div')
  noteEl.className = 'kpi-note'
  noteEl.textContent = note
  tile.append(labelEl, valueEl, noteEl)
  return tile
}

function sparklineSvg(values: number[]): SVGSVGElement {
  const width = 90
  const height = 24
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'sparkline' })
  const d = buildSparklinePath(values, width, height)
  if (d) svg.appendChild(svgEl('path', { d, fill: 'none', stroke: 'var(--brand)', 'stroke-width': 1.5 }))
  return svg
}

function renderKpiTiles(container: HTMLElement, data: WeeklyData): void {
  const row = container.querySelector('#kpi-row')!
  row.setAttribute('aria-busy', 'false')
  row.innerHTML = ''

  const freeRooms = data.rooms.filter((r) => data.statuses.get(r.roomId)?.status === 'free')
  const freeLongEnough = freeRooms.filter((r) => {
    const reservationsToday = data.reservationsTodayByRoom.get(r.roomId) ?? []
    return minutesUntilNextBooking(reservationsToday, data.referenceTs) >= FREE_LONG_MINUTES
  })

  row.append(
    kpiTile(
      'Free right now',
      `${freeRooms.length}<span class="kpi-unit">/ ${data.rooms.length} rooms</span>`,
      `${freeLongEnough.length} of them unbooked for ${FREE_LONG_MINUTES}+ min`,
    ),
  )

  const utilToday = data.utilSeries[data.utilSeries.length - 1] ?? 0
  const utilYesterday = data.utilSeries[data.utilSeries.length - 2] ?? utilToday
  const utilDelta = utilToday - utilYesterday
  const utilTile = kpiTile(
    'Utilization today',
    formatPercent(utilToday, 0),
    `${utilDelta >= 0 ? '+' : ''}${utilDelta.toFixed(1)} pts vs. yesterday`,
  )
  utilTile.querySelector('.kpi-value')!.appendChild(sparklineSvg(data.utilSeries))
  row.append(utilTile)

  const ghostAccent = data.ghostCount >= 25 ? 'accent-critical' : data.ghostCount >= 10 ? 'accent-warn' : ''
  row.append(
    kpiTile('Ghost meetings · 7 days', String(data.ghostCount), 'Booked, nobody showed up', ghostAccent),
  )

  row.append(
    kpiTile(
      'Wasted room-hours',
      `${data.wastedHours.toFixed(0)}<span class="kpi-unit">h</span>`,
      `≈ ${formatEur(data.wastedEur)} in space cost this week`,
    ),
  )
}

function barStrip(occupancy: OccupancySnapshot[]): HTMLDivElement {
  const strip = document.createElement('div')
  strip.className = 'bar-strip'
  const recent = occupancy.slice(-12)
  for (const snap of recent) {
    const bar = document.createElement('span')
    bar.className = 'bar-strip-bar'
    bar.style.background = SEQUENTIAL_STEPS[sequentialStepForPct(snap.utilizationPct)]!
    strip.appendChild(bar)
  }
  return strip
}

function roomStatusCard(room: RoomWithOccupancy, status: RoomStatus, occupancy: OccupancySnapshot[]): HTMLDivElement {
  const card = document.createElement('div')
  card.className = 'admin-room-card'
  card.dataset.status = status.status

  const top = document.createElement('div')
  top.className = 'admin-room-card-top'
  const name = document.createElement('div')
  name.className = 'admin-room-name'
  name.textContent = room.name
  const meta = document.createElement('div')
  meta.className = 'admin-room-meta mono'
  meta.textContent = `${buildingLabel(room.building)} ${room.floor} · ${room.capacity} seats`
  const nameWrap = document.createElement('div')
  nameWrap.append(name, meta)
  const dot = document.createElement('span')
  dot.className = 'admin-room-dot'
  dot.style.background = STATUS_COLOR[status.status]
  top.append(nameWrap, dot)

  const statusLine = document.createElement('div')
  statusLine.className = `admin-room-status admin-room-status--${status.status}`
  statusLine.textContent = `${STATUS_LABEL[status.status]} · ${status.untilText}`

  const footer = document.createElement('div')
  footer.className = 'admin-room-footer mono'
  footer.textContent = status.footerText

  card.append(top, statusLine, barStrip(occupancy), footer)
  card.setAttribute(
    'aria-label',
    `${room.name}, ${STATUS_LABEL[status.status]}, ${status.untilText}, ${status.footerText}`,
  )
  return card
}

function renderRoomGrid(container: HTMLElement, data: WeeklyData): void {
  const card = container.querySelector('#room-grid-card')!
  const buildingCount = new Set(data.rooms.map((r) => r.building)).size
  const scopeLabel =
    buildingCount === 1 && data.rooms[0] ? buildingLabel(data.rooms[0].building) : `${buildingCount} buildings`
  card.innerHTML = `
    <div class="chart-card-head">
      <div>
        <div class="chart-title">Live rooms · ${scopeLabel}</div>
        <div class="chart-caption">Current status per room, from the latest sensor telemetry.</div>
      </div>
      <div class="admin-status-legend">
        <span><span class="legend-swatch" style="background:${STATUS_COLOR.free}"></span>Free</span>
        <span><span class="legend-swatch" style="background:${STATUS_COLOR['in-use']}"></span>In use</span>
        <span><span class="legend-swatch" style="background:${STATUS_COLOR.ghost}"></span>Ghost</span>
        <span><span class="legend-swatch" style="background:${STATUS_COLOR.offline}"></span>Offline</span>
      </div>
    </div>
    <div class="admin-room-grid" id="admin-room-grid"></div>
  `
  const grid = card.querySelector('#admin-room-grid')!
  for (const room of data.rooms) {
    const status = data.statuses.get(room.roomId)!
    const occupancy = data.occupancyByRoom.get(room.roomId) ?? []
    grid.appendChild(roomStatusCard(room, status, occupancy))
  }
}

// ---------------------------------------------------------------------------
// Reclaim now panel
// ---------------------------------------------------------------------------

let dismissedSlots = new Set<'ghost' | 'oversized' | 'offline'>()

function reclaimActionButton(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'reclaim-action'
  btn.textContent = label
  btn.addEventListener('click', onClick)
  return btn
}

function reclaimEmptyState(text: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'reclaim-empty'
  el.textContent = text
  return el
}

function renderReclaimPanel(
  container: HTMLElement,
  slots: ReclaimSlots,
  referenceTs: string,
  onDismiss: () => void,
): void {
  const card = container.querySelector('#reclaim-card')!
  card.innerHTML = `
    <div class="chart-card-head">
      <div>
        <div class="chart-title">Reclaim now</div>
        <div class="chart-caption">No backend action exists for these buttons in this demo — they log locally only.</div>
      </div>
    </div>
    <div class="reclaim-panel" id="reclaim-panel"></div>
  `
  const panel = card.querySelector('#reclaim-panel')!

  // Ghost slot
  if (!dismissedSlots.has('ghost') && slots.ghost) {
    const { room, reservation, isCurrentlyActive } = slots.ghost
    const cardEl = document.createElement('div')
    cardEl.className = 'reclaim-card'
    const badge = isCurrentlyActive ? 'GHOST' : 'PAST GHOST'
    const body = isCurrentlyActive
      ? `Booked by ${reservation.organizer} for "${reservation.subject}", ${reservation.attendeeCount} expected. Sensor sees nobody.`
      : `Was booked by ${reservation.organizer} for "${reservation.subject}" earlier this week, ${reservation.attendeeCount} expected — sensor saw nobody. The room is free again now.`
    cardEl.innerHTML = `
      <div class="reclaim-card-head"><span class="reclaim-title">${room.name}</span><span class="reclaim-badge reclaim-badge--critical mono">${badge}</span></div>
      <p class="reclaim-body">${body}</p>
    `
    const actions = document.createElement('div')
    actions.className = 'reclaim-card-actions'
    // "Release room" only makes sense while the ghost meeting is still holding the
    // room right now — a past ghost has already ended, so only notifying the
    // organizer (for next time) is offered.
    if (isCurrentlyActive) {
      actions.append(
        reclaimActionButton('Release room', () => {
          dismissedSlots.add('ghost')
          appendAuditLog('Release room', room.name, referenceTs)
          showToast(container, `Released ${room.name} — logged locally only; no Outlook or ticketing system was contacted.`)
          onDismiss()
        }),
      )
    }
    actions.append(
      reclaimActionButton('Notify owner', () => {
        dismissedSlots.add('ghost')
        appendAuditLog('Notify owner', `${room.name} → ${reservation.organizer}`, referenceTs)
        showToast(container, `Notified ${reservation.organizer} — logged locally only; no email was sent.`)
        onDismiss()
      }),
    )
    cardEl.appendChild(actions)
    panel.appendChild(cardEl)
  } else {
    panel.appendChild(reclaimEmptyState('No ghost meetings to reclaim right now.'))
  }

  // Oversized slot
  if (!dismissedSlots.has('oversized') && slots.oversized) {
    const { room, reservation, suggestedRoom } = slots.oversized
    const cardEl = document.createElement('div')
    cardEl.className = 'reclaim-card'
    const suggestionText = suggestedRoom
      ? `Suggest ${suggestedRoom.name} (${suggestedRoom.capacity}).`
      : 'No smaller room available to suggest.'
    cardEl.innerHTML = `
      <div class="reclaim-card-head"><span class="reclaim-title">${room.name}</span><span class="reclaim-badge reclaim-badge--warning mono">OVERSIZED</span></div>
      <p class="reclaim-body">${reservation.attendeeCount} people in a ${room.capacity}-seat room. ${suggestionText}</p>
    `
    if (suggestedRoom) {
      const actions = document.createElement('div')
      actions.className = 'reclaim-card-actions'
      actions.append(
        reclaimActionButton('Suggest swap', () => {
          dismissedSlots.add('oversized')
          appendAuditLog('Suggest swap', `${room.name} → ${suggestedRoom.name}`, referenceTs)
          showToast(container, `Suggested ${suggestedRoom.name} to ${reservation.organizer} — logged locally only; no email was sent.`)
          onDismiss()
        }),
      )
      cardEl.appendChild(actions)
    }
    panel.appendChild(cardEl)
  } else {
    panel.appendChild(reclaimEmptyState('No oversized-room bookings right now.'))
  }

  // Offline slot
  if (!dismissedSlots.has('offline') && slots.offline) {
    const { room } = slots.offline
    const cardEl = document.createElement('div')
    cardEl.className = 'reclaim-card'
    cardEl.innerHTML = `
      <div class="reclaim-card-head"><span class="reclaim-title">${room.name}</span><span class="reclaim-badge reclaim-badge--muted mono">OFFLINE</span></div>
      <p class="reclaim-body">Sensor stopped reporting. Battery or connectivity issue likely.</p>
    `
    const actions = document.createElement('div')
    actions.className = 'reclaim-card-actions'
    actions.append(
      reclaimActionButton('Create ticket', () => {
        dismissedSlots.add('offline')
        appendAuditLog('Create ticket', room.name, referenceTs)
        showToast(container, `Ticket logged for ${room.name} — local audit log only; no ticketing system was contacted.`)
        onDismiss()
      }),
    )
    cardEl.appendChild(actions)
    panel.appendChild(cardEl)
  } else {
    panel.appendChild(reclaimEmptyState('No offline sensors right now.'))
  }

  const logSection = document.createElement('div')
  logSection.id = 'reclaim-audit-log'
  card.appendChild(logSection)
  renderAuditLog(logSection, readAuditLog())
}

// ---------------------------------------------------------------------------

function renderError(container: HTMLElement, err: unknown): void {
  container.innerHTML = `
    <div class="chart-card">
      <div class="chart-title">Couldn't load admin overview</div>
      <p class="chart-caption">${err instanceof Error ? err.message.replace(/[<>]/g, '') : 'Unknown error'}</p>
    </div>
  `
}

export const overviewPage: Page = {
  async mount(container: HTMLElement) {
    dismissedSlots = new Set()
    container.innerHTML = renderSkeleton()
    try {
      const data = await loadWeeklyData()
      renderKpiTiles(container, data)
      renderRoomGrid(container, data)

      const slots = buildReclaimSlots(data.rooms, data.statuses, data.pastGhosts)
      const rerenderReclaim = () => renderReclaimPanel(container, slots, data.referenceTs, rerenderReclaim)
      rerenderReclaim()
    } catch (err) {
      renderError(container, err)
    }
  },
}
