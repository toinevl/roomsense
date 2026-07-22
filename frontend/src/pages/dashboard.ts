import { apiClient } from '../lib/api'
import type { KpisResponse, Reservation, RoomWithOccupancy } from '../lib/apiTypes'
import { formatEur, formatPercent } from '../lib/format'
import {
  SEQUENTIAL_STEPS,
  SERIES_VARS,
  createTooltip,
  linearScale,
  sequentialStepForPct,
  svgEl,
  tooltipRow,
} from '../lib/charts'
import type { Page } from './types'

function buildingLabel(building: string): string {
  return building.charAt(0).toUpperCase() + building.slice(1)
}

// ---------------------------------------------------------------------------
// "Booked vs actually used" — derived client-side from the frozen contract's
// per-room reservations + occupancy endpoints (there is no dedicated KPI
// field for this; ghost status is derived the same way /kpis derives it:
// a reservation counts as "used" when occupancy peaked above zero during
// its slot). Scoped to the most recent day that actually has reservations,
// found by probing backwards from the latest known snapshot — never the
// wall clock, since mock mode's dataset window is fixed independently of
// "today" for reproducibility (see lib/seedData.ts).
// ---------------------------------------------------------------------------

interface BuildingUsage {
  building: string
  bookedHours: number
  usedHours: number
}

async function findRecentReservationDate(rooms: RoomWithOccupancy[]): Promise<string> {
  const sampleRoomId = rooms[0]?.roomId
  const latestTs = rooms.reduce((max, r) => (r.lastSeenTs > max ? r.lastSeenTs : max), rooms[0]?.lastSeenTs ?? '')
  let cursor = new Date(latestTs || Date.now())
  cursor.setUTCHours(0, 0, 0, 0)
  if (!sampleRoomId) return cursor.toISOString().slice(0, 10)

  for (let i = 0; i < 8; i++) {
    const dateStr = cursor.toISOString().slice(0, 10)
    const sample = await apiClient.getRoomReservations(sampleRoomId, dateStr)
    if (sample.length > 0) return dateStr
    cursor = new Date(cursor.getTime() - 24 * 3_600_000)
  }
  return cursor.toISOString().slice(0, 10)
}

function reservationHours(r: Reservation): number {
  return (Date.parse(r.endTs) - Date.parse(r.startTs)) / 3_600_000
}

async function loadBookedVsUsed(rooms: RoomWithOccupancy[]): Promise<{ date: string; usage: BuildingUsage[] }> {
  const date = await findRecentReservationDate(rooms)
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd = `${date}T23:59:59.999Z`

  const perRoom = await Promise.all(
    rooms.map(async (room) => {
      const [reservations, occupancy] = await Promise.all([
        apiClient.getRoomReservations(room.roomId, date),
        apiClient.getRoomOccupancy(room.roomId, dayStart, dayEnd),
      ])
      let bookedHours = 0
      let usedHours = 0
      for (const r of reservations) {
        const hours = reservationHours(r)
        bookedHours += hours
        const startMs = Date.parse(r.startTs)
        const endMs = Date.parse(r.endTs)
        const maxOccupancy = occupancy.reduce((peak, snap) => {
          const ts = Date.parse(snap.ts)
          if (ts < startMs || ts >= endMs) return peak
          return snap.occupancy > peak ? snap.occupancy : peak
        }, 0)
        if (maxOccupancy > 0) usedHours += hours
      }
      return { building: room.building, bookedHours, usedHours }
    }),
  )

  const byBuilding = new Map<string, BuildingUsage>()
  for (const entry of perRoom) {
    const bucket = byBuilding.get(entry.building) ?? { building: entry.building, bookedHours: 0, usedHours: 0 }
    bucket.bookedHours += entry.bookedHours
    bucket.usedHours += entry.usedHours
    byBuilding.set(entry.building, bucket)
  }

  return { date, usage: [...byBuilding.values()].sort((a, b) => a.building.localeCompare(b.building)) }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderSkeleton(): string {
  return `
    <div class="page-header">
      <div class="page-eyebrow">Portfolio overview</div>
      <h1 class="page-title">RoomSense Dashboard</h1>
      <p class="page-sub">Utilization, ghost-meeting rate and estimated wasted floor cost across the room portfolio, from the latest sensor telemetry.</p>
    </div>
    <div class="kpi-row" id="kpi-row" aria-busy="true"></div>
    <section class="chart-card" id="heatmap-card"></section>
    <section class="chart-card" id="weather-card"></section>
    <section class="chart-card" id="booked-used-card"></section>
    <section class="chart-card" id="ghost-table-card"></section>
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

function renderKpiTiles(container: HTMLElement, kpis: KpisResponse, roomCount: number): void {
  const row = container.querySelector('#kpi-row')!
  row.setAttribute('aria-busy', 'false')

  const ghostAccent = kpis.ghostRatePct >= 25 ? 'accent-critical' : kpis.ghostRatePct >= 15 ? 'accent-warn' : ''

  row.append(
    kpiTile(
      'Avg. utilization',
      `${formatPercent(kpis.avgUtilizationPct, 1)}`,
      `Peak ${formatPercent(kpis.peakUtilizationPct, 1)} across ${roomCount} rooms`,
    ),
    kpiTile(
      'Ghost-meeting rate',
      `${formatPercent(kpis.ghostRatePct, 1)}`,
      'Booked slots where no one showed up',
      ghostAccent,
    ),
    kpiTile(
      'Wasted floor cost',
      `${formatEur(kpis.wastedEur)}<span class="kpi-unit">/mo</span>`,
      'Indicatief — modeled from ghost-hours × capacity × €/desk-hour',
    ),
    kpiTile('Busiest building', buildingLabel(kpis.busiestBuilding), 'By average utilization this period'),
  )
}

// --- Heatmap: current utilization by building × floor -----------------------

function renderHeatmap(container: HTMLElement, rooms: RoomWithOccupancy[]): void {
  const card = container.querySelector('#heatmap-card')!
  const buildings = [...new Set(rooms.map((r) => r.building))].sort()
  const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b)

  const cellStats = new Map<string, { sum: number; count: number; rooms: RoomWithOccupancy[] }>()
  for (const room of rooms) {
    const key = `${room.building}|${room.floor}`
    const entry = cellStats.get(key) ?? { sum: 0, count: 0, rooms: [] }
    entry.sum += room.utilizationPct
    entry.count += 1
    entry.rooms.push(room)
    cellStats.set(key, entry)
  }

  card.innerHTML = `
    <div class="chart-card-head">
      <div>
        <div class="chart-title">Utilization by building &amp; floor</div>
        <div class="chart-caption">Current occupancy reading per room, averaged per floor.</div>
      </div>
      <button type="button" class="table-toggle" id="heatmap-toggle">Table view</button>
    </div>
    <div class="heatmap-scroll">
      <div class="heatmap-grid" id="heatmap-grid" style="position:relative; grid-template-columns: 90px repeat(${buildings.length}, 1fr);"></div>
    </div>
    <div class="heatmap-scale">
      <span>0%</span>
      <span class="heatmap-scale-ramp" style="background: linear-gradient(to right, ${SEQUENTIAL_STEPS.join(', ')});"></span>
      <span>100%</span>
    </div>
  `

  const grid = card.querySelector('#heatmap-grid')!
  const tooltip = createTooltip()
  grid.appendChild(tooltip.el)

  const corner = document.createElement('div')
  grid.appendChild(corner)
  for (const building of buildings) {
    const head = document.createElement('div')
    head.className = 'heatmap-col-label'
    head.textContent = buildingLabel(building)
    grid.appendChild(head)
  }

  for (const floor of floors) {
    const rowLabel = document.createElement('div')
    rowLabel.className = 'heatmap-row-label'
    rowLabel.textContent = `Floor ${floor}`
    grid.appendChild(rowLabel)

    for (const building of buildings) {
      const key = `${building}|${floor}`
      const stat = cellStats.get(key)
      const cell = document.createElement('div')
      cell.className = 'heatmap-cell'
      if (!stat) {
        cell.style.background = 'transparent'
        cell.style.border = '1px dashed var(--gridline)'
        grid.appendChild(cell)
        continue
      }
      const avgPct = stat.sum / stat.count
      const stepIdx = sequentialStepForPct(avgPct)
      cell.style.background = SEQUENTIAL_STEPS[stepIdx]!
      cell.style.color = stepIdx >= 2 ? '#ffffff' : '#0b0b0b'
      cell.tabIndex = 0
      cell.setAttribute('role', 'img')
      const roomWord = stat.count === 1 ? 'room' : 'rooms'
      cell.setAttribute(
        'aria-label',
        `${buildingLabel(building)}, floor ${floor}: ${avgPct.toFixed(1)}% average utilization across ${stat.count} ${roomWord}`,
      )

      const labelEl = document.createElement('span')
      labelEl.className = 'cell-label'
      labelEl.textContent = `${stat.count} ${roomWord}`
      const valueEl = document.createElement('span')
      valueEl.className = 'cell-value'
      valueEl.textContent = formatPercent(avgPct, 0)
      cell.append(labelEl, valueEl)

      const showTooltip = (e: PointerEvent | FocusEvent) => {
        const clientX = 'clientX' in e ? e.clientX : cell.getBoundingClientRect().left
        const clientY = 'clientY' in e ? e.clientY : cell.getBoundingClientRect().top
        const rows = stat.rooms
          .slice()
          .sort((a, b) => b.utilizationPct - a.utilizationPct)
          .map((r) => tooltipRow(SERIES_VARS[0]!, r.name, formatPercent(r.utilizationPct, 0)))
        tooltip.show(clientX, clientY, grid as HTMLElement, rows)
      }
      cell.addEventListener('pointermove', showTooltip)
      cell.addEventListener('focus', showTooltip)
      cell.addEventListener('pointerleave', () => tooltip.hide())
      cell.addEventListener('blur', () => tooltip.hide())

      grid.appendChild(cell)
    }
  }

  // Table-view twin (accessibility)
  const table = document.createElement('table')
  table.className = 'sr-table hidden'
  table.innerHTML = `<caption>Utilization by building &amp; floor, table view</caption>
    <thead><tr><th>Building</th><th>Floor</th><th class="num">Rooms</th><th class="num">Avg. utilization</th></tr></thead>`
  const tbody = document.createElement('tbody')
  for (const [key, stat] of cellStats) {
    const [building, floor] = key.split('|')
    const tr = document.createElement('tr')
    const tdBuilding = document.createElement('td')
    tdBuilding.textContent = buildingLabel(building!)
    const tdFloor = document.createElement('td')
    tdFloor.textContent = floor!
    const tdCount = document.createElement('td')
    tdCount.className = 'num'
    tdCount.textContent = String(stat.count)
    const tdPct = document.createElement('td')
    tdPct.className = 'num'
    tdPct.textContent = formatPercent(stat.sum / stat.count, 1)
    tr.append(tdBuilding, tdFloor, tdCount, tdPct)
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  card.appendChild(table)

  card.querySelector('#heatmap-toggle')!.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLButtonElement
    const showingTable = table.classList.toggle('hidden') === false
    ;(grid as HTMLElement).style.display = showingTable ? 'none' : ''
    card.querySelector('.heatmap-scale')!.setAttribute('style', showingTable ? 'display:none' : '')
    btn.textContent = showingTable ? 'Chart view' : 'Table view'
  })
}

// --- Booked vs actually used --------------------------------------------

function renderBookedVsUsed(container: HTMLElement, date: string, usage: BuildingUsage[]): void {
  const card = container.querySelector('#booked-used-card')!
  if (usage.length === 0) {
    card.innerHTML = `<div class="chart-title">Booked vs. actually used</div><p class="chart-caption">No reservations found in the sampled window.</p>`
    return
  }

  const width = 720
  const height = 300
  const marginLeft = 44
  const marginBottom = 34
  const marginTop = 12
  const marginRight = 16
  const plotWidth = width - marginLeft - marginRight
  const plotHeight = height - marginTop - marginBottom

  const maxHours = Math.max(1, ...usage.flatMap((u) => [u.bookedHours, u.usedHours]))
  const yScale = linearScale(0, maxHours * 1.15, plotHeight, 0)

  const groupWidth = plotWidth / usage.length
  const barWidth = Math.min(24, groupWidth / 3)
  const barGap = 6

  card.innerHTML = `
    <div class="chart-card-head">
      <div>
        <div class="chart-title">Booked vs. actually used</div>
        <div class="chart-caption">Reservation hours vs. hours the sensor actually saw someone, by building — ${date}.</div>
      </div>
      <button type="button" class="table-toggle" id="booked-toggle">Table view</button>
    </div>
  `

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Booked vs actually used hours by building' })
  const plot = svgEl('g', { transform: `translate(${marginLeft},${marginTop})` })
  svg.appendChild(plot)

  // gridlines (hairline, recessive) at 0/25/50/75/100% of max
  for (let i = 0; i <= 4; i++) {
    const val = (maxHours * 1.15 * i) / 4
    const y = yScale(val)
    const line = svgEl('line', { x1: 0, x2: plotWidth, y1: y, y2: y, stroke: 'var(--gridline)', 'stroke-width': 1 })
    plot.appendChild(line)
    const label = svgEl('text', { x: -8, y: y + 4, 'text-anchor': 'end', class: 'mono' })
    label.setAttribute('font-size', '10')
    label.setAttribute('fill', 'var(--text-muted)')
    label.textContent = `${Math.round(val)}h`
    plot.appendChild(label)
  }
  // baseline
  plot.appendChild(svgEl('line', { x1: 0, x2: plotWidth, y1: plotHeight, y2: plotHeight, stroke: 'var(--baseline)', 'stroke-width': 1 }))

  const tooltip = createTooltip()
  const wrap = document.createElement('div')
  wrap.style.position = 'relative'
  wrap.appendChild(svg)
  wrap.appendChild(tooltip.el)

  usage.forEach((u, i) => {
    const groupX = i * groupWidth + groupWidth / 2
    const bars: Array<[number, string, string]> = [
      [u.bookedHours, SERIES_VARS[0]!, 'Booked'],
      [u.usedHours, SERIES_VARS[1]!, 'Used'],
    ]
    bars.forEach(([value, color, seriesLabel], j) => {
      const barX = groupX - barWidth - barGap / 2 + j * (barWidth + barGap)
      const barY = yScale(value)
      const barHeight = plotHeight - barY
      const rect = svgEl('rect', {
        x: barX,
        y: barY,
        width: barWidth,
        height: Math.max(0, barHeight),
        rx: 4,
        fill: color,
      })
      rect.setAttribute('tabindex', '0')
      const showTooltip = (e: PointerEvent | FocusEvent) => {
        const rect0 = wrap.getBoundingClientRect()
        const clientX = 'clientX' in e ? e.clientX : rect0.left + barX
        const clientY = 'clientY' in e ? e.clientY : rect0.top + barY
        tooltip.show(clientX, clientY, wrap, [
          tooltipRow(color, `${buildingLabel(u.building)} · ${seriesLabel}`, `${value.toFixed(1)}h`),
        ])
      }
      rect.addEventListener('pointermove', showTooltip)
      rect.addEventListener('focus', showTooltip)
      rect.addEventListener('pointerleave', () => tooltip.hide())
      rect.addEventListener('blur', () => tooltip.hide())
      plot.appendChild(rect)

      // value at the tip
      const valueLabel = svgEl('text', { x: barX + barWidth / 2, y: barY - 6, 'text-anchor': 'middle' })
      valueLabel.setAttribute('font-size', '10')
      valueLabel.setAttribute('font-family', 'var(--font-mono)')
      valueLabel.setAttribute('fill', 'var(--text-secondary)')
      valueLabel.textContent = value.toFixed(0)
      plot.appendChild(valueLabel)
    })

    const catLabel = svgEl('text', { x: groupX, y: plotHeight + 20, 'text-anchor': 'middle' })
    catLabel.setAttribute('font-size', '11')
    catLabel.setAttribute('font-family', 'var(--font-mono)')
    catLabel.setAttribute('fill', 'var(--text-secondary)')
    catLabel.textContent = buildingLabel(u.building)
    plot.appendChild(catLabel)
  })

  card.appendChild(wrap)

  const legend = document.createElement('div')
  legend.className = 'chart-legend'
  legend.innerHTML = `
    <span class="legend-item"><span class="legend-swatch" style="background:${SERIES_VARS[0]}"></span>Booked</span>
    <span class="legend-item"><span class="legend-swatch" style="background:${SERIES_VARS[1]}"></span>Actually used</span>
  `
  card.appendChild(legend)

  const table = document.createElement('table')
  table.className = 'sr-table hidden'
  table.innerHTML = `<caption>Booked vs. actually used, table view (${date})</caption>
    <thead><tr><th>Building</th><th class="num">Booked (h)</th><th class="num">Used (h)</th><th class="num">Ghost (h)</th></tr></thead>`
  const tbody = document.createElement('tbody')
  for (const u of usage) {
    const tr = document.createElement('tr')
    const tdB = document.createElement('td')
    tdB.textContent = buildingLabel(u.building)
    const tdBooked = document.createElement('td')
    tdBooked.className = 'num'
    tdBooked.textContent = u.bookedHours.toFixed(1)
    const tdUsed = document.createElement('td')
    tdUsed.className = 'num'
    tdUsed.textContent = u.usedHours.toFixed(1)
    const tdGhost = document.createElement('td')
    tdGhost.className = 'num'
    tdGhost.textContent = (u.bookedHours - u.usedHours).toFixed(1)
    tr.append(tdB, tdBooked, tdUsed, tdGhost)
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  card.appendChild(table)

  card.querySelector('#booked-toggle')!.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLButtonElement
    const showingTable = table.classList.toggle('hidden') === false
    wrap.style.display = showingTable ? 'none' : ''
    legend.style.display = showingTable ? 'none' : ''
    btn.textContent = showingTable ? 'Chart view' : 'Table view'
  })
}

// --- Top-5 ghost rooms table ------------------------------------------------

function renderGhostTable(container: HTMLElement, kpis: KpisResponse): void {
  const card = container.querySelector('#ghost-table-card')!
  card.innerHTML = `
    <div class="chart-card-head">
      <div>
        <div class="chart-title">Top 5 underused rooms</div>
        <div class="chart-caption">Lowest measured utilization — the strongest ghost-meeting candidates.</div>
      </div>
    </div>
  `
  const table = document.createElement('table')
  table.className = 'sr-table'
  table.innerHTML = `<thead><tr><th>Room</th><th class="num">Utilization</th></tr></thead>`
  const tbody = document.createElement('tbody')
  for (const room of kpis.underusedRooms) {
    const tr = document.createElement('tr')
    const tdName = document.createElement('td')
    tdName.textContent = room.name
    const tdPct = document.createElement('td')
    tdPct.className = 'num'
    const wrap = document.createElement('div')
    wrap.style.display = 'flex'
    wrap.style.alignItems = 'center'
    wrap.style.gap = '0.5rem'
    wrap.style.justifyContent = 'flex-end'
    const track = document.createElement('span')
    track.className = 'ghost-bar-track'
    track.style.width = '70px'
    const fill = document.createElement('span')
    fill.className = 'ghost-bar-fill'
    fill.style.display = 'block'
    fill.style.width = `${Math.max(2, room.utilizationPct)}%`
    track.appendChild(fill)
    const valueSpan = document.createElement('span')
    valueSpan.className = 'mono'
    valueSpan.textContent = formatPercent(room.utilizationPct, 1)
    wrap.append(track, valueSpan)
    tdPct.appendChild(wrap)
    tr.append(tdName, tdPct)
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  card.appendChild(table)
}

// ---------------------------------------------------------------------------
// Fake weather mock-up — no external API. Deterministic, no key, no network.
// ---------------------------------------------------------------------------

import { buildWeatherState } from '../lib/weather'
import type { FakeWeatherReading } from '../lib/weatherMock'

const WEATHER_ICON: Record<string, string> = {
  clear: '☀️',
  cloudy: '☁️',
  rain: '🌧️',
  wind: '🌬️',
}

function weatherIcon(reading: FakeWeatherReading): string {
  if (reading.rainMm >= 1.5) return WEATHER_ICON.rain
  if (reading.windKph >= 35) return WEATHER_ICON.wind
  return WEATHER_ICON.clear
}

function weatherLabel(reading: FakeWeatherReading): string {
  if (reading.rainMm >= 1.5) return 'Rain'
  if (reading.windKph >= 35) return 'Windy'
  return 'Clear'
}

function weatherClass(reading: FakeWeatherReading): string {
  if (reading.rainMm >= 1.5) return 'weather-rain'
  if (reading.windKph >= 35) return 'weather-wind'
  return 'weather-clear'
}

const WIND_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

function windLabel(windKph: number): string {
  let deg = windKph >= 35 ? 90 : windKph >= 20 ? 45 : windKph >= 10 ? 135 : 0
  deg = ((deg %= 360) < 0 ? deg + 360 : deg)
  const idx = Math.round(deg / 45) % 8
  return WIND_DIRECTIONS[idx]
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function renderWeather(container: HTMLElement): void {
  const card = container.querySelector('#weather-card')!
  let state
  try {
    state = buildWeatherState()
  } catch (err) {
    card.innerHTML = `
      <div class="chart-card-head">
        <div>
          <div class="chart-title">Weather</div>
          <div class="chart-caption">${err instanceof Error ? err.message.replace(/[<>]/g, '') : 'Unknown error'}</div>
        </div>
      </div>
    `
    return
  }

  const readings = state.readings
  const updatedAt = formatUpdatedAt(state.updatedAt)

  card.innerHTML = `
    <div class="chart-card-head">
      <div>
        <div class="chart-title">Weather</div>
        <div class="chart-caption">Fake demo data — no external weather API.</div>
      </div>
      <div class="weather-meta">
        <span class="weather-pill" aria-label="mock weather">MOCK</span>
        <span class="mono weather-meta-time">Updated ${updatedAt}</span>
      </div>
    </div>
    <div class="weather-grid">
      ${readings.map((reading) => `
        <div class="weather-card ${weatherClass(reading)}">
          <div class="weather-building">${buildingLabel(reading.building)}</div>
          <div class="weather-icon" aria-label="${weatherLabel(reading)}">${weatherIcon(reading)}</div>
          <div class="weather-temp mono">${reading.temperatureC.toFixed(1)}°C</div>
          <div class="weather-row">
            <span class="weather-rain">💧 ${reading.rainMm.toFixed(1)} mm</span>
            <span class="weather-wind">💨 ${reading.windKph.toFixed(1)} km/h ${windLabel(reading.windKph)}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `
}

function renderError(container: HTMLElement, err: unknown): void {
  container.innerHTML = `
    <div class="chart-card">
      <div class="chart-title">Couldn't load dashboard data</div>
      <p class="chart-caption">${err instanceof Error ? err.message.replace(/[<>]/g, '') : 'Unknown error'}</p>
    </div>
  `
}

export const dashboardPage: Page = {
  async mount(container: HTMLElement) {
    container.innerHTML = renderSkeleton()
    try {
      const [rooms, kpis] = await Promise.all([apiClient.getRooms(), apiClient.getKpis()])
      renderKpiTiles(container, kpis, rooms.length)
      renderHeatmap(container, rooms)
      renderWeather(container)
      const { date, usage } = await loadBookedVsUsed(rooms)
      renderBookedVsUsed(container, date, usage)
      renderGhostTable(container, kpis)
    } catch (err) {
      renderError(container, err)
    }
  },
}
