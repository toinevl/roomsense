import { apiClient } from '../lib/api'
import type { OccupancySnapshot, Reservation, RoomWithOccupancy, SourceStatus } from '../lib/apiTypes'
import { formatPercent, formatTimestamp } from '../lib/format'
import {
  SEQUENTIAL_STEPS,
  buildSparklinePath,
  createTooltip,
  linearScale,
  sequentialStepForPct,
  svgEl,
  tooltipRow,
} from '../lib/charts'
import { computeReadingDeltas, type ReadingDelta } from '../lib/readingDeltas'
import { computeAdvancedRoomIds, snapshotLastSeen } from '../lib/roomFreshness'
import type { Page } from './types'

const POLL_INTERVAL_MS = 10_000
const READINGS_LIMIT = 50

function buildingLabel(building: string): string {
  return building.charAt(0).toUpperCase() + building.slice(1)
}

let pollHandle: ReturnType<typeof setInterval> | null = null
let selectedRoomId: string | null = null
let rootEl: HTMLElement | null = null
let previousLastSeen: Map<string, string> = new Map()

function renderSkeleton(): string {
  return `
    <div class="page-header">
      <div class="page-eyebrow">Technical view</div>
      <h1 class="page-title">Live room telemetry</h1>
      <p class="page-sub">Raw Terabee people-counting readings per room. Click a room to drill into its device and the last ${READINGS_LIMIT} readings.</p>
    </div>
    <div class="sources-strip" id="sources-strip" role="list" aria-label="Data sources"></div>
    <div class="live-toolbar">
      <div class="poll-indicator"><span class="poll-ring" aria-hidden="true"></span><span id="poll-label">auto-refreshing every 10s</span></div>
      <button type="button" class="table-toggle" id="manual-refresh">Refresh now</button>
    </div>
    <div class="room-grid" id="room-grid" role="list" aria-label="Rooms"></div>
    <div id="drill-slot"></div>
  `
}

function roomCard(room: RoomWithOccupancy): HTMLButtonElement {
  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'room-card'
  card.setAttribute('role', 'listitem')
  card.dataset.roomId = room.roomId
  const stepIdx = sequentialStepForPct(room.utilizationPct)

  const top = document.createElement('div')
  top.className = 'room-card-top'
  const dot = document.createElement('span')
  dot.className = 'room-dot'
  dot.style.background = SEQUENTIAL_STEPS[stepIdx]!
  const util = document.createElement('span')
  util.className = 'room-util mono'
  util.textContent = formatPercent(room.utilizationPct, 0)
  top.append(dot, util)

  const name = document.createElement('div')
  name.className = 'room-name'
  name.textContent = room.name

  const meta = document.createElement('div')
  meta.className = 'room-meta'
  meta.textContent = `${buildingLabel(room.building)} · floor ${room.floor} · cap ${room.capacity}`

  card.append(top, name, meta)
  card.setAttribute(
    'aria-label',
    `${room.name}, ${buildingLabel(room.building)} floor ${room.floor}, ${formatPercent(room.utilizationPct, 0)} utilization. Open telemetry.`,
  )
  card.addEventListener('click', () => {
    selectedRoomId = room.roomId
    void renderDrillPanel()
  })
  return card
}

function renderRoomGrid(rooms: RoomWithOccupancy[], advanced: Set<string> = new Set()): void {
  if (!rootEl) return
  const grid = rootEl.querySelector('#room-grid')!
  grid.innerHTML = ''
  for (const room of rooms) {
    const card = roomCard(room)
    if (advanced.has(room.roomId)) card.classList.add('room-card--updated')
    grid.appendChild(card)
  }
}

function sourcePill(source: SourceStatus): HTMLDivElement {
  const pill = document.createElement('div')
  pill.className = 'source-pill'
  pill.setAttribute('role', 'listitem')

  const dot = document.createElement('span')
  dot.className = `status-dot ${source.status === 'active' ? 'ok' : 'err'}`

  const label = document.createElement('span')
  label.className = 'source-label'
  label.textContent = `${source.displayName} (${source.kind})`

  const synced = document.createElement('span')
  synced.className = 'source-synced mono'
  // Absolute timestamp only — never a "Xm ago" relative string. The mock
  // dataset's clock is frozen (seedData.ts MOCK_END), not wall-clock "now";
  // a relative-time label would read as "3 months ago" for every adapter,
  // always, regardless of when the demo runs (same trap documented on
  // findLatestActiveIndex / findRecentReservationDay).
  synced.textContent = source.lastSyncTs ? `synced ${formatTimestamp(source.lastSyncTs)}` : 'never synced'

  pill.append(dot, label, synced)
  pill.setAttribute(
    'aria-label',
    `${source.displayName} (${source.kind}), ${source.status}, ${source.lastSyncTs ? `last synced ${formatTimestamp(source.lastSyncTs)}` : 'never synced'}`,
  )
  return pill
}

function renderSourcesStrip(sources: SourceStatus[]): void {
  if (!rootEl) return
  const strip = rootEl.querySelector('#sources-strip')
  if (!strip) return
  strip.innerHTML = ''
  for (const source of sources) strip.appendChild(sourcePill(source))
}

function deviceMetaItem(label: string, value: string): HTMLDivElement {
  const item = document.createElement('div')
  item.className = 'device-meta-item'
  const l = document.createElement('span')
  l.className = 'dm-label'
  l.textContent = label
  const v = document.createElement('span')
  v.className = 'dm-value'
  v.textContent = value
  item.append(l, v)
  return item
}

const SPARK_WIDTH = 120
const SPARK_HEIGHT = 28

/** Small inline trend line for a device metric. `values` is expected in the
 *  API-contract order (descending by ts, newest first) — this reverses it
 *  internally so the sparkline reads left-to-right as oldest -> newest. */
function sparkline(values: number[], colorVar: string): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: `0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`, class: 'sparkline' })
  const oldestFirst = [...values].reverse()
  const d = buildSparklinePath(oldestFirst, SPARK_WIDTH, SPARK_HEIGHT)
  if (d) svg.appendChild(svgEl('path', { d, fill: 'none', stroke: colorVar, 'stroke-width': 1.5 }))
  return svg
}

function telemetryRow(delta: ReadingDelta): HTMLTableRowElement {
  const { reading } = delta
  const tr = document.createElement('tr')
  if (delta.reset) tr.classList.add('reading-reset')

  const cells: Array<[string, boolean]> = [
    [formatTimestamp(reading.ts), false],
    [String(reading.countIn), true],
    [String(reading.countOut), true],
    [delta.reset ? '↺ reset' : delta.deltaIn === null ? '—' : `+${delta.deltaIn}`, true],
    [delta.reset ? '↺ reset' : delta.deltaOut === null ? '—' : `+${delta.deltaOut}`, true],
    [delta.reset ? '↺ reset' : delta.deltaOccupancy === null ? '—' : String(delta.deltaOccupancy), true],
    [`${reading.batteryPct.toFixed(1)}%`, true],
    [`${reading.rssi} dBm`, true],
    [`${reading.snr.toFixed(2)} dB`, true],
  ]
  for (const [text, numeric] of cells) {
    const td = document.createElement('td')
    if (numeric) td.className = 'num'
    td.textContent = text
    tr.appendChild(td)
  }
  return tr
}

// ---------------------------------------------------------------------------
// Reservations overlay (#24) — booked slots (Outlook mock) laid over measured
// occupancy for one room on one day, so a "ghost meeting" (booked, sensor saw
// nobody) is visible at a glance next to the telemetry that proves it. Mirrors
// the dashboard's "booked vs actually used" derivation: ghost status comes
// from occupancy peaking at 0 during the slot, never a stored flag (see
// CLAUDE.md). Uses only apiClient calls, so it works identically in mock and
// fetch mode — no mock-only internals.
// ---------------------------------------------------------------------------

interface OverlayReservation extends Reservation {
  ghost: boolean
}

/** Most recent day (UTC) with at least one reservation for this room, probed
 *  backward from its last-seen timestamp — never the wall clock, since the
 *  mock's fixed dataset window is independent of "today" (see dashboard.ts). */
async function findRecentReservationDay(room: RoomWithOccupancy): Promise<string> {
  let cursor = new Date(room.lastSeenTs || Date.now())
  cursor.setUTCHours(0, 0, 0, 0)
  for (let i = 0; i < 8; i++) {
    const dateStr = cursor.toISOString().slice(0, 10)
    const sample = await apiClient.getRoomReservations(room.roomId, dateStr)
    if (sample.length > 0) return dateStr
    cursor = new Date(cursor.getTime() - 24 * 3_600_000)
  }
  return cursor.toISOString().slice(0, 10)
}

function maxOccupancyDuring(occupancy: OccupancySnapshot[], startMs: number, endMs: number): number {
  let peak = 0
  for (const snap of occupancy) {
    const ts = Date.parse(snap.ts)
    if (ts < startMs || ts >= endMs) continue
    if (snap.occupancy > peak) peak = snap.occupancy
  }
  return peak
}

function hourOfDayUtc(iso: string, dayStartMs: number): number {
  return (Date.parse(iso) - dayStartMs) / 3_600_000
}

const OVERLAY_WIDTH = 720
const OVERLAY_HEIGHT = 180
const OVERLAY_PAD = { top: 10, right: 12, bottom: 24, left: 12 }
const BAND_Y = OVERLAY_PAD.top
const BAND_HEIGHT = 16
const AREA_TOP = BAND_Y + BAND_HEIGHT + 10
const AREA_BOTTOM = OVERLAY_HEIGHT - OVERLAY_PAD.bottom

function renderReservationsOverlay(
  room: RoomWithOccupancy,
  date: string,
  reservations: OverlayReservation[],
  occupancy: OccupancySnapshot[],
): HTMLElement {
  const card = document.createElement('div')
  card.className = 'overlay-card'

  const title = document.createElement('div')
  title.className = 'chart-title'
  title.textContent = 'Booked vs. measured occupancy'
  const caption = document.createElement('div')
  caption.className = 'chart-caption'
  caption.textContent = reservations.length
    ? `${date} · ${reservations.length} booked slot${reservations.length === 1 ? '' : 's'}, ${reservations.filter((r) => r.ghost).length} ghost`
    : `No reservations found for ${room.name} in the sampled window.`
  card.append(title, caption)

  if (reservations.length === 0 && occupancy.every((s) => s.occupancy === 0)) {
    return card
  }

  const dayStartMs = Date.parse(`${date}T00:00:00.000Z`)
  const x = linearScale(0, 24, OVERLAY_PAD.left, OVERLAY_WIDTH - OVERLAY_PAD.right)
  const maxOcc = Math.max(1, room.capacity, ...occupancy.map((s) => s.occupancy))
  const y = linearScale(0, maxOcc, AREA_BOTTOM, AREA_TOP)

  const wrap = document.createElement('div')
  wrap.className = 'overlay-svg-wrap'
  const svg = svgEl('svg', {
    viewBox: `0 0 ${OVERLAY_WIDTH} ${OVERLAY_HEIGHT}`,
    role: 'img',
    'aria-label': `Booked slots and measured occupancy for ${room.name} on ${date}`,
  })
  svg.style.width = '100%'
  svg.style.height = `${OVERLAY_HEIGHT}px`

  // Hour gridlines every 3h, labeled every 6h.
  for (let h = 0; h <= 24; h += 3) {
    const gx = x(h)
    const line = svgEl('line', {
      x1: gx, x2: gx, y1: AREA_TOP, y2: AREA_BOTTOM,
      stroke: 'var(--gridline)', 'stroke-width': 1,
    })
    svg.appendChild(line)
    if (h % 6 === 0) {
      const label = svgEl('text', {
        x: gx, y: OVERLAY_HEIGHT - 6, 'font-size': 9, fill: 'var(--text-muted)',
        'text-anchor': h === 0 ? 'start' : h === 24 ? 'end' : 'middle',
      })
      label.textContent = `${String(h).padStart(2, '0')}:00`
      svg.appendChild(label)
    }
  }

  // Measured occupancy as a filled area.
  if (occupancy.length > 0) {
    const sorted = [...occupancy].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
    const points = sorted.map((s) => `${x(hourOfDayUtc(s.ts, dayStartMs))},${y(s.occupancy)}`)
    const first = sorted[0]!
    const last = sorted[sorted.length - 1]!
    const areaPath = [
      `M ${x(hourOfDayUtc(first.ts, dayStartMs))},${AREA_BOTTOM}`,
      `L ${points.join(' L ')}`,
      `L ${x(hourOfDayUtc(last.ts, dayStartMs))},${AREA_BOTTOM}`,
      'Z',
    ].join(' ')
    svg.appendChild(svgEl('path', { d: areaPath, fill: 'var(--series-1)', opacity: 0.18 }))
    svg.appendChild(
      svgEl('path', { d: `M ${points.join(' L ')}`, fill: 'none', stroke: 'var(--series-1)', 'stroke-width': 1.5 }),
    )
  }

  const tooltip = createTooltip()
  wrap.append(svg, tooltip.el)

  // Reservation bands: green = someone showed, red = ghost (booked, empty).
  for (const r of reservations) {
    const startH = hourOfDayUtc(r.startTs, dayStartMs)
    const endH = hourOfDayUtc(r.endTs, dayStartMs)
    const rectX = x(Math.max(0, startH))
    const rectW = Math.max(2, x(Math.min(24, endH)) - rectX)
    const rect = svgEl('rect', {
      x: rectX, y: BAND_Y, width: rectW, height: BAND_HEIGHT, rx: 3,
      fill: r.ghost ? 'var(--status-critical)' : 'var(--status-good)',
      opacity: 0.85,
    })
    rect.style.cursor = 'pointer'
    rect.addEventListener('pointermove', (ev) => {
      tooltip.show(ev.clientX, ev.clientY, wrap, [
        tooltipRow(r.ghost ? 'var(--status-critical)' : 'var(--status-good)', r.subject, r.ghost ? 'ghost' : 'used'),
        tooltipRow('transparent', 'Organizer', r.organizer),
        tooltipRow(
          'transparent',
          'Time',
          `${formatTimestamp(r.startTs).slice(-5)}–${formatTimestamp(r.endTs).slice(-5)}`,
        ),
        tooltipRow('transparent', 'Attendees', String(r.attendeeCount)),
      ])
    })
    rect.addEventListener('pointerleave', () => tooltip.hide())
    svg.appendChild(rect)
  }

  wrap.appendChild(svg)
  card.appendChild(wrap)

  const legend = document.createElement('div')
  legend.className = 'overlay-legend'
  legend.innerHTML = `
    <span class="legend-item"><span class="legend-swatch" style="background:var(--status-good)"></span>Booked, used</span>
    <span class="legend-item"><span class="legend-swatch" style="background:var(--status-critical)"></span>Ghost meeting</span>
    <span class="legend-item"><span class="legend-swatch" style="background:var(--series-1);opacity:.4"></span>Measured occupancy</span>
  `
  card.appendChild(legend)

  return card
}

async function loadReservationsOverlay(room: RoomWithOccupancy): Promise<HTMLElement> {
  const date = await findRecentReservationDay(room)
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd = `${date}T23:59:59.999Z`
  const [reservations, occupancy] = await Promise.all([
    apiClient.getRoomReservations(room.roomId, date),
    apiClient.getRoomOccupancy(room.roomId, dayStart, dayEnd),
  ])
  const overlayReservations: OverlayReservation[] = reservations.map((r) => {
    const startMs = Date.parse(r.startTs)
    const endMs = Date.parse(r.endTs)
    return { ...r, ghost: maxOccupancyDuring(occupancy, startMs, endMs) === 0 }
  })
  return renderReservationsOverlay(room, date, overlayReservations, occupancy)
}

async function renderDrillPanel(): Promise<void> {
  if (!rootEl) return
  const slot = rootEl.querySelector('#drill-slot')!
  if (!selectedRoomId) {
    slot.innerHTML = ''
    return
  }

  const [rooms, readings] = await Promise.all([
    apiClient.getRooms(),
    apiClient.getRoomReadings(selectedRoomId, READINGS_LIMIT),
  ])
  const room = rooms.find((r) => r.roomId === selectedRoomId)
  if (!room) {
    slot.innerHTML = ''
    return
  }

  const latest = readings[0]

  slot.innerHTML = ''
  const panel = document.createElement('div')
  panel.className = 'drill-panel'

  const head = document.createElement('div')
  head.className = 'drill-head'
  const headText = document.createElement('div')
  const title = document.createElement('div')
  title.className = 'chart-title'
  title.textContent = room.name
  const caption = document.createElement('div')
  caption.className = 'chart-caption'
  caption.textContent = `${buildingLabel(room.building)} · floor ${room.floor} · ${room.deviceId} · ${room.outlookAddress}`
  headText.append(title, caption)
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'drill-close'
  closeBtn.textContent = 'Close ✕'
  closeBtn.addEventListener('click', () => {
    selectedRoomId = null
    void renderDrillPanel()
  })
  head.append(headText, closeBtn)
  panel.appendChild(head)

  // Device metadata. Note: only fields actually present in the frozen
  // packages/shared schema are shown here — mounting height / push period
  // (mentioned in docs/plan.md's Terabee field-model prose) aren't part of
  // SensorReadingSchema/RoomSchema, so they're intentionally not fabricated.
  const metaGrid = document.createElement('div')
  metaGrid.className = 'device-meta-grid'
  metaGrid.append(
    deviceMetaItem('Device ID', room.deviceId),
    deviceMetaItem('Source', room.sourceId),
    deviceMetaItem('Capacity', String(room.capacity)),
    deviceMetaItem('Battery', latest ? `${latest.batteryPct.toFixed(1)}%` : '—'),
    deviceMetaItem('RSSI', latest ? `${latest.rssi} dBm` : '—'),
    deviceMetaItem('SNR', latest ? `${latest.snr.toFixed(2)} dB` : '—'),
    deviceMetaItem('Last seen', formatTimestamp(room.lastSeenTs)),
  )
  panel.appendChild(metaGrid)

  // Battery/RSSI trend sparklines — reuse the `readings` array already
  // fetched above for the telemetry table; no additional API call.
  const trendRow = document.createElement('div')
  trendRow.className = 'device-trend-row'
  const batteryTrend = document.createElement('div')
  batteryTrend.className = 'device-trend'
  batteryTrend.append('Battery trend: ', sparkline(readings.map((r) => r.batteryPct), 'var(--series-2)'))
  const rssiTrend = document.createElement('div')
  rssiTrend.className = 'device-trend'
  rssiTrend.append('Signal trend: ', sparkline(readings.map((r) => r.rssi), 'var(--series-3)'))
  trendRow.append(batteryTrend, rssiTrend)
  panel.appendChild(trendRow)

  panel.appendChild(await loadReservationsOverlay(room))

  const tableTitle = document.createElement('div')
  tableTitle.className = 'chart-title'
  tableTitle.style.marginBottom = '0.5rem'
  tableTitle.textContent = `Last ${readings.length} readings`
  panel.appendChild(tableTitle)

  const scrollWrap = document.createElement('div')
  scrollWrap.className = 'telemetry-scroll'
  const table = document.createElement('table')
  table.className = 'sr-table'
  table.innerHTML = `<thead><tr>
    <th>Timestamp</th><th class="num">Count in</th><th class="num">Count out</th>
    <th class="num">Δ in</th><th class="num">Δ out</th><th class="num">Δ occ</th>
    <th class="num">Battery</th><th class="num">RSSI</th><th class="num">SNR</th>
  </tr></thead>`
  const tbody = document.createElement('tbody')
  const deltas = computeReadingDeltas(readings)
  for (const delta of deltas) tbody.appendChild(telemetryRow(delta))
  table.appendChild(tbody)
  scrollWrap.appendChild(table)
  panel.appendChild(scrollWrap)

  slot.appendChild(panel)
}

async function refresh(): Promise<void> {
  if (!rootEl) return
  apiClient.tickMockClock()
  const rooms = await apiClient.getRooms()
  const advanced = computeAdvancedRoomIds(rooms, previousLastSeen)
  renderRoomGrid(rooms, advanced)
  previousLastSeen = snapshotLastSeen(rooms)

  const label = rootEl.querySelector('#poll-label')
  if (label) {
    label.textContent = `auto-refreshing every 10s · ${advanced.size}/${rooms.length} rooms reported new data last refresh`
  }

  if (selectedRoomId) await renderDrillPanel()
}

export const livePage: Page = {
  async mount(container: HTMLElement) {
    rootEl = container
    selectedRoomId = null
    container.innerHTML = renderSkeleton()

    const rooms = await apiClient.getRooms()
    renderRoomGrid(rooms)
    previousLastSeen = snapshotLastSeen(rooms)

    const sources = await apiClient.getSources()
    renderSourcesStrip(sources)

    container.querySelector('#manual-refresh')!.addEventListener('click', () => {
      void refresh()
    })

    pollHandle = setInterval(() => {
      void refresh()
    }, POLL_INTERVAL_MS)
  },

  unmount() {
    if (pollHandle) {
      clearInterval(pollHandle)
      pollHandle = null
    }
    rootEl = null
    selectedRoomId = null
    previousLastSeen = new Map()
  },
}
