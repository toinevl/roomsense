import { apiClient } from '../lib/api'
import type { RoomWithOccupancy, SensorReading } from '../lib/apiTypes'
import { formatPercent, formatTimestamp } from '../lib/format'
import { SEQUENTIAL_STEPS, sequentialStepForPct } from '../lib/charts'
import type { Page } from './types'

const POLL_INTERVAL_MS = 10_000
const READINGS_LIMIT = 50

function buildingLabel(building: string): string {
  return building.charAt(0).toUpperCase() + building.slice(1)
}

let pollHandle: ReturnType<typeof setInterval> | null = null
let selectedRoomId: string | null = null
let rootEl: HTMLElement | null = null

function renderSkeleton(): string {
  return `
    <div class="page-header">
      <div class="page-eyebrow">Technical view</div>
      <h1 class="page-title">Live room telemetry</h1>
      <p class="page-sub">Raw Terabee people-counting readings per room. Click a room to drill into its device and the last ${READINGS_LIMIT} readings.</p>
    </div>
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

function renderRoomGrid(rooms: RoomWithOccupancy[]): void {
  if (!rootEl) return
  const grid = rootEl.querySelector('#room-grid')!
  grid.innerHTML = ''
  for (const room of rooms) {
    grid.appendChild(roomCard(room))
  }
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

function telemetryRow(reading: SensorReading): HTMLTableRowElement {
  const tr = document.createElement('tr')
  const cells: Array<[string, boolean]> = [
    [formatTimestamp(reading.ts), false],
    [String(reading.countIn), true],
    [String(reading.countOut), true],
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
    <th class="num">Battery</th><th class="num">RSSI</th><th class="num">SNR</th>
  </tr></thead>`
  const tbody = document.createElement('tbody')
  for (const reading of readings) tbody.appendChild(telemetryRow(reading))
  table.appendChild(tbody)
  scrollWrap.appendChild(table)
  panel.appendChild(scrollWrap)

  slot.appendChild(panel)
}

async function refresh(): Promise<void> {
  if (!rootEl) return
  apiClient.tickMockClock()
  const rooms = await apiClient.getRooms()
  renderRoomGrid(rooms)
  if (selectedRoomId) await renderDrillPanel()
}

export const livePage: Page = {
  async mount(container: HTMLElement) {
    rootEl = container
    selectedRoomId = null
    container.innerHTML = renderSkeleton()

    const rooms = await apiClient.getRooms()
    renderRoomGrid(rooms)

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
  },
}
