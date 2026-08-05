import { apiClient } from '../../../src/lib/api'
import type { RoomSchedulingHealth } from '../../../src/lib/apiTypes'
import type { Page } from '../../../src/pages/types'

/**
 * Scheduling health page (wishlist #64) — one row per room, three
 * independent metrics (ghost rate, oversized rate, utilization), sortable
 * by any column. Deliberately NOT a composite score — budget-holder trust
 * over a clever single number, per #47-#55.
 */

const WINDOW_DAYS = 7

type SortKey = 'name' | 'building' | 'ghostRatePct' | 'oversizedRatePct' | 'utilizationPct'
type SortDir = 'asc' | 'desc'

interface ColumnDef {
  key: SortKey
  label: string
  numeric: boolean
}

const COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Room', numeric: false },
  { key: 'building', label: 'Building', numeric: false },
  { key: 'ghostRatePct', label: 'Ghost rate', numeric: true },
  { key: 'oversizedRatePct', label: 'Oversized rate', numeric: true },
  { key: 'utilizationPct', label: 'Utilization', numeric: true },
]

// Worst ghost rate first — the single most actionable signal for a facility
// manager landing on this page (a room bleeding booked-but-empty hours).
const DEFAULT_SORT: { key: SortKey; dir: SortDir } = { key: 'ghostRatePct', dir: 'desc' }

function buildingLabel(building: string): string {
  return building.charAt(0).toUpperCase() + building.slice(1)
}

interface SchedulingData {
  rooms: RoomSchedulingHealth[]
  from: string
  to: string
}

async function loadSchedulingData(): Promise<SchedulingData> {
  const rooms = await apiClient.getRooms()
  // Anchor "now" on the latest lastSeenTs across all rooms — never
  // Date.now(), same referenceTs pattern as overview.ts/rooms.ts.
  const referenceTs = rooms.reduce(
    (max, r) => (r.lastSeenTs > max ? r.lastSeenTs : max),
    rooms[0]?.lastSeenTs ?? new Date(0).toISOString(),
  )
  const to = referenceTs
  const from = new Date(Date.parse(referenceTs) - WINDOW_DAYS * 86_400_000).toISOString()
  const health = await apiClient.getSchedulingHealth(from, to)
  return { rooms: health.rooms, from, to }
}

function renderSkeleton(): string {
  return `
    <div class="page-header">
      <div class="page-eyebrow">Operations</div>
      <h1 class="page-title">Scheduling health</h1>
      <p class="page-sub">Per-room ghost-meeting rate, oversized-booking rate, and utilization over the trailing 7 days. Click a column to sort.</p>
    </div>
    <section class="chart-card" id="scheduling-card" aria-busy="true"></section>
  `
}

function sortRooms(rooms: RoomSchedulingHealth[], key: SortKey, dir: SortDir): RoomSchedulingHealth[] {
  const sorted = [...rooms].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    const cmp = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : (av as number) - (bv as number)
    return cmp
  })
  return dir === 'asc' ? sorted : sorted.reverse()
}

function sortIndicator(dir: SortDir): string {
  return dir === 'asc' ? '▲' : '▼'
}

function renderTable(
  card: HTMLElement,
  data: SchedulingData,
  sortState: { key: SortKey; dir: SortDir },
  onSort: (key: SortKey) => void,
): void {
  card.setAttribute('aria-busy', 'false')
  card.innerHTML = `
    <div class="chart-card-head">
      <div>
        <div class="chart-title">Rooms</div>
        <div class="chart-caption">${data.rooms.length} rooms — window ${data.from.slice(0, 10)} to ${data.to.slice(0, 10)}.</div>
      </div>
    </div>
  `

  const scrollWrap = document.createElement('div')
  scrollWrap.className = 'rooms-list-scroll'
  const table = document.createElement('table')
  table.className = 'sr-table'

  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const col of COLUMNS) {
    const th = document.createElement('th')
    if (col.numeric) th.className = 'num'
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'sr-table-sort-btn'
    const active = sortState.key === col.key
    btn.textContent = active ? `${col.label} ${sortIndicator(sortState.dir)}` : col.label
    btn.setAttribute('aria-sort', active ? (sortState.dir === 'asc' ? 'ascending' : 'descending') : 'none')
    btn.addEventListener('click', () => onSort(col.key))
    th.appendChild(btn)
    headRow.appendChild(th)
  }
  thead.appendChild(headRow)
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  const sorted = sortRooms(data.rooms, sortState.key, sortState.dir)
  for (const room of sorted) {
    const tr = document.createElement('tr')
    const tdName = document.createElement('td')
    tdName.textContent = room.name
    const tdBuilding = document.createElement('td')
    tdBuilding.textContent = buildingLabel(room.building)
    const tdGhost = document.createElement('td')
    tdGhost.className = 'num'
    tdGhost.textContent = `${room.ghostRatePct.toFixed(1)}%`
    const tdOversized = document.createElement('td')
    tdOversized.className = 'num'
    tdOversized.textContent = `${room.oversizedRatePct.toFixed(1)}%`
    const tdUtil = document.createElement('td')
    tdUtil.className = 'num'
    tdUtil.textContent = `${room.utilizationPct.toFixed(1)}%`
    tr.append(tdName, tdBuilding, tdGhost, tdOversized, tdUtil)
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  scrollWrap.appendChild(table)
  card.appendChild(scrollWrap)

  if (sorted.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'chart-caption'
    empty.textContent = 'No rooms to show.'
    card.appendChild(empty)
  }
}

function renderError(container: HTMLElement, err: unknown): void {
  container.innerHTML = `
    <div class="chart-card">
      <div class="chart-title">Couldn't load scheduling health</div>
      <p class="chart-caption">${err instanceof Error ? err.message.replace(/[<>]/g, '') : 'Unknown error'}</p>
    </div>
  `
}

export const schedulingPage: Page = {
  async mount(container: HTMLElement) {
    container.innerHTML = renderSkeleton()
    try {
      const data = await loadSchedulingData()
      const card = container.querySelector<HTMLElement>('#scheduling-card')!
      let sortState = { ...DEFAULT_SORT }
      const rerender = () => renderTable(card, data, sortState, handleSort)
      function handleSort(key: SortKey): void {
        if (sortState.key === key) {
          sortState = { key, dir: sortState.dir === 'asc' ? 'desc' : 'asc' }
        } else {
          // First click on a new column: numeric columns start worst-first
          // (descending), text columns start alphabetical (ascending).
          const col = COLUMNS.find((c) => c.key === key)!
          sortState = { key, dir: col.numeric ? 'desc' : 'asc' }
        }
        rerender()
      }
      rerender()
    } catch (err) {
      renderError(container, err)
    }
  },
}
