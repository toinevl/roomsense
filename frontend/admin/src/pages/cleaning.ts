import { apiClient } from '../../../src/lib/api'
import type { CleaningSavingsResponse } from '../../../src/lib/apiTypes'
import { formatEur } from '../../../src/lib/format'
import type { Page } from '../../../src/pages/types'

/**
 * Cleaning savings report (#65) — simulated interval-OR-threshold cleaning
 * policy vs. a fixed-daily-schedule baseline, trailing 7 days.
 *
 * Per-room detail was explicitly chosen over an aggregate-only headline
 * (wishlist #65), so this page renders a totals header row above a full
 * per-room table, same overall shape as rooms.ts (filter sidebar → list
 * card becomes: totals tiles → breakdown table here).
 */

const WINDOW_DAYS = 7

async function loadCleaningSavingsData(): Promise<CleaningSavingsResponse> {
  const rooms = await apiClient.getRooms()
  // Trailing-window anchor: the latest lastSeenTs across all rooms, same
  // referenceTs pattern overview.ts uses — never raw Date.now().
  const referenceTs = rooms.reduce(
    (max, r) => (r.lastSeenTs > max ? r.lastSeenTs : max),
    rooms[0]?.lastSeenTs ?? new Date(0).toISOString(),
  )
  const fromTs = new Date(Date.parse(referenceTs) - WINDOW_DAYS * 86_400_000).toISOString()
  return apiClient.getCleaningSavings(fromTs, referenceTs)
}

function renderSkeleton(): string {
  return `
    <div class="page-header">
      <div class="page-eyebrow">Facility operations</div>
      <h1 class="page-title">Cleaning</h1>
      <p class="page-sub">Simulated interval-or-threshold cleaning policy vs. a fixed daily schedule, trailing ${WINDOW_DAYS} days.</p>
    </div>
    <div class="kpi-row" id="kpi-row" aria-busy="true"></div>
    <section class="chart-card" id="cleaning-table-card"></section>
  `
}

function kpiTile(label: string, valueHtml: string, note: string): HTMLDivElement {
  const tile = document.createElement('div')
  tile.className = 'kpi-tile'
  const labelEl = document.createElement('div')
  labelEl.className = 'kpi-label'
  labelEl.textContent = label
  const valueEl = document.createElement('div')
  valueEl.className = 'kpi-value'
  valueEl.textContent = valueHtml
  const noteEl = document.createElement('div')
  noteEl.className = 'kpi-note'
  noteEl.textContent = note
  tile.append(labelEl, valueEl, noteEl)
  return tile
}

function renderTotals(container: HTMLElement, data: CleaningSavingsResponse): void {
  const row = container.querySelector('#kpi-row')!
  row.setAttribute('aria-busy', 'false')
  row.innerHTML = ''

  const { totals } = data
  row.append(
    kpiTile(
      'Fewer cleans this week',
      String(totals.cleansAvoided),
      `${totals.policyCleans} policy cleans vs. ${totals.baselineCleans} on a fixed daily schedule`,
    ),
    kpiTile(
      'Estimated savings',
      formatEur(totals.eurSaved),
      `Across ${data.rooms.length} rooms this week`,
    ),
  )
}

function cleaningRow(room: CleaningSavingsResponse['rooms'][number]): HTMLTableRowElement {
  const tr = document.createElement('tr')
  tr.className = 'cleaning-row'

  const tdRoomId = document.createElement('td')
  tdRoomId.className = 'mono'
  tdRoomId.textContent = room.roomId
  const tdName = document.createElement('td')
  tdName.textContent = room.name
  const tdBaseline = document.createElement('td')
  tdBaseline.className = 'num'
  tdBaseline.textContent = String(room.baselineCleans)
  const tdPolicy = document.createElement('td')
  tdPolicy.className = 'num'
  tdPolicy.textContent = String(room.policyCleans)
  const tdAvoided = document.createElement('td')
  tdAvoided.className = 'num'
  tdAvoided.textContent = String(room.cleansAvoided)
  const tdSaved = document.createElement('td')
  tdSaved.className = 'num'
  tdSaved.textContent = formatEur(room.eurSaved)

  tr.append(tdRoomId, tdName, tdBaseline, tdPolicy, tdAvoided, tdSaved)
  return tr
}

function renderTable(container: HTMLElement, data: CleaningSavingsResponse): void {
  const card = container.querySelector('#cleaning-table-card')!
  card.innerHTML = `
    <div class="chart-card-head">
      <div>
        <div class="chart-title">Per-room breakdown</div>
        <div class="chart-caption">${data.rooms.length} rooms — simulated cleans under the interval-or-threshold policy vs. a fixed daily schedule.</div>
      </div>
    </div>
  `
  const scrollWrap = document.createElement('div')
  scrollWrap.className = 'cleaning-table-scroll'
  const table = document.createElement('table')
  table.className = 'sr-table'
  table.innerHTML = `<thead><tr>
    <th>Room ID</th><th>Name</th><th class="num">Baseline cleans</th><th class="num">Policy cleans</th><th class="num">Cleans avoided</th><th class="num">Saved</th>
  </tr></thead>`
  const tbody = document.createElement('tbody')
  for (const room of data.rooms) {
    tbody.appendChild(cleaningRow(room))
  }
  table.appendChild(tbody)
  scrollWrap.appendChild(table)
  card.appendChild(scrollWrap)
}

function renderError(container: HTMLElement, err: unknown): void {
  container.innerHTML = `
    <div class="chart-card">
      <div class="chart-title">Couldn't load cleaning savings</div>
      <p class="chart-caption">${err instanceof Error ? err.message.replace(/[<>]/g, '') : 'Unknown error'}</p>
    </div>
  `
}

export const cleaningPage: Page = {
  async mount(container: HTMLElement) {
    container.innerHTML = renderSkeleton()
    try {
      const data = await loadCleaningSavingsData()
      renderTotals(container, data)
      renderTable(container, data)
    } catch (err) {
      renderError(container, err)
    }
  },
}
