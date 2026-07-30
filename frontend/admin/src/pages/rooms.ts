import { apiClient } from '../../../src/lib/api'
import type { RoomWithOccupancy } from '../../../src/lib/apiTypes'
import type { Page } from '../../../src/pages/types'
import { computeRoomStatus, type RoomLifecycleStatus, type RoomStatus } from '../lib/roomStatus'

/** Mirrors mockup option 1d — a filterable/searchable room list, chrome-matched to Overview (1a). */

interface CapacityBucket {
  label: string
  min: number
  max: number
}

const CAPACITY_BUCKETS: CapacityBucket[] = [
  { label: '1–4', min: 1, max: 4 },
  { label: '5–10', min: 5, max: 10 },
  { label: '11–20', min: 11, max: 20 },
  { label: '21–50', min: 21, max: 50 },
  { label: '50+', min: 51, max: Infinity },
]

const STATUS_OPTIONS: RoomLifecycleStatus[] = ['free', 'in-use', 'ghost', 'offline']
const STATUS_LABEL: Record<RoomLifecycleStatus, string> = {
  free: 'Free',
  'in-use': 'In use',
  ghost: 'Ghost',
  offline: 'Offline',
}
const STATUS_COLOR: Record<RoomLifecycleStatus, string> = {
  free: 'var(--status-good)',
  'in-use': 'var(--status-warning)',
  ghost: 'var(--status-critical)',
  offline: 'var(--text-muted)',
}

function buildingLabel(building: string): string {
  return building.charAt(0).toUpperCase() + building.slice(1)
}

interface RoomsData {
  rooms: RoomWithOccupancy[]
  statuses: Map<string, RoomStatus>
}

async function loadRoomsData(): Promise<RoomsData> {
  const rooms = await apiClient.getRooms()
  const referenceTs = rooms.reduce((max, r) => (r.lastSeenTs > max ? r.lastSeenTs : max), rooms[0]?.lastSeenTs ?? new Date(0).toISOString())
  const todayDate = referenceTs.slice(0, 10)
  const windowStart = new Date(Date.parse(referenceTs) - 4 * 3_600_000).toISOString()

  const perRoom = await Promise.all(
    rooms.map(async (room) => {
      const [reservationsToday, recentOccupancy] = await Promise.all([
        apiClient.getRoomReservations(room.roomId, todayDate),
        apiClient.getRoomOccupancy(room.roomId, windowStart, referenceTs),
      ])
      return computeRoomStatus({ room, referenceTs, reservationsToday, recentOccupancy })
    }),
  )

  const statuses = new Map<string, RoomStatus>()
  rooms.forEach((room, i) => statuses.set(room.roomId, perRoom[i]!))
  return { rooms, statuses }
}

interface FilterState {
  search: string
  statuses: Set<RoomLifecycleStatus>
  capacityBuckets: Set<string>
  buildings: Set<string>
  floors: Set<number>
}

function matchesFilters(room: RoomWithOccupancy, status: RoomLifecycleStatus, filters: FilterState): boolean {
  if (filters.search) {
    const haystack = `${room.name} ${room.building} ${room.roomId}`.toLowerCase()
    if (!haystack.includes(filters.search.toLowerCase())) return false
  }
  if (filters.statuses.size > 0 && !filters.statuses.has(status)) return false
  if (filters.capacityBuckets.size > 0) {
    const inAnyBucket = CAPACITY_BUCKETS.some(
      (b) => filters.capacityBuckets.has(b.label) && room.capacity >= b.min && room.capacity <= b.max,
    )
    if (!inAnyBucket) return false
  }
  if (filters.buildings.size > 0 && !filters.buildings.has(room.building)) return false
  if (filters.floors.size > 0 && !filters.floors.has(room.floor)) return false
  return true
}

function renderSkeleton(): string {
  return `
    <div class="page-header">
      <div class="page-eyebrow">Facility overview</div>
      <h1 class="page-title">Rooms</h1>
      <p class="page-sub">Search and filter the full room portfolio by availability, capacity, building and floor.</p>
    </div>
    <div class="admin-rooms-layout">
      <aside class="filter-sidebar" id="filter-sidebar" aria-busy="true"></aside>
      <section class="chart-card" id="rooms-list-card"></section>
    </div>
  `
}

function checkboxRow(name: string, value: string, label: string, colorDot?: string): HTMLLabelElement {
  const row = document.createElement('label')
  row.className = 'filter-checkbox-row'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.name = name
  input.value = value
  const text = document.createElement('span')
  if (colorDot) {
    const dot = document.createElement('span')
    dot.className = 'admin-room-dot admin-room-dot--inline'
    dot.style.background = colorDot
    row.appendChild(input)
    row.appendChild(dot)
  } else {
    row.appendChild(input)
  }
  text.textContent = label
  row.appendChild(text)
  return row
}

function renderSidebar(sidebar: HTMLElement, data: RoomsData, filters: FilterState, onChange: () => void): void {
  sidebar.setAttribute('aria-busy', 'false')
  sidebar.innerHTML = ''

  const title = document.createElement('div')
  title.className = 'filter-sidebar-title'
  title.textContent = 'Filters'
  sidebar.appendChild(title)

  const search = document.createElement('input')
  search.type = 'search'
  search.className = 'filter-search'
  search.placeholder = 'Search room or building'
  search.setAttribute('aria-label', 'Search room or building')
  search.addEventListener('input', () => {
    filters.search = search.value
    onChange()
  })
  sidebar.appendChild(search)

  const availabilityGroup = document.createElement('div')
  availabilityGroup.className = 'filter-group'
  const availabilityLabel = document.createElement('div')
  availabilityLabel.className = 'filter-group-label'
  availabilityLabel.textContent = 'Availability'
  availabilityGroup.appendChild(availabilityLabel)
  for (const status of STATUS_OPTIONS) {
    const row = checkboxRow('availability', status, STATUS_LABEL[status], STATUS_COLOR[status])
    row.querySelector('input')!.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked
      if (checked) filters.statuses.add(status)
      else filters.statuses.delete(status)
      onChange()
    })
    availabilityGroup.appendChild(row)
  }
  sidebar.appendChild(availabilityGroup)

  const capacityGroup = document.createElement('div')
  capacityGroup.className = 'filter-group'
  const capacityLabel = document.createElement('div')
  capacityLabel.className = 'filter-group-label'
  capacityLabel.textContent = 'Capacity'
  capacityGroup.appendChild(capacityLabel)
  const chipRow = document.createElement('div')
  chipRow.className = 'capacity-chip-row'
  for (const bucket of CAPACITY_BUCKETS) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'capacity-chip'
    chip.textContent = bucket.label
    chip.setAttribute('aria-pressed', 'false')
    chip.addEventListener('click', () => {
      const active = chip.classList.toggle('active')
      chip.setAttribute('aria-pressed', String(active))
      if (active) filters.capacityBuckets.add(bucket.label)
      else filters.capacityBuckets.delete(bucket.label)
      onChange()
    })
    chipRow.appendChild(chip)
  }
  capacityGroup.appendChild(chipRow)
  sidebar.appendChild(capacityGroup)

  const buildings = [...new Set(data.rooms.map((r) => r.building))].sort()
  const buildingGroup = document.createElement('div')
  buildingGroup.className = 'filter-group'
  const buildingLabelEl = document.createElement('div')
  buildingLabelEl.className = 'filter-group-label'
  buildingLabelEl.textContent = 'Building'
  buildingGroup.appendChild(buildingLabelEl)
  for (const building of buildings) {
    const row = checkboxRow('building', building, buildingLabel(building))
    row.querySelector('input')!.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked
      if (checked) filters.buildings.add(building)
      else filters.buildings.delete(building)
      onChange()
    })
    buildingGroup.appendChild(row)
  }
  sidebar.appendChild(buildingGroup)

  const floors = [...new Set(data.rooms.map((r) => r.floor))].sort((a, b) => a - b)
  const floorGroup = document.createElement('div')
  floorGroup.className = 'filter-group'
  const floorLabelEl = document.createElement('div')
  floorLabelEl.className = 'filter-group-label'
  floorLabelEl.textContent = 'Floor'
  floorGroup.appendChild(floorLabelEl)
  for (const floor of floors) {
    const row = checkboxRow('floor', String(floor), `Floor ${floor}`)
    row.querySelector('input')!.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked
      if (checked) filters.floors.add(floor)
      else filters.floors.delete(floor)
      onChange()
    })
    floorGroup.appendChild(row)
  }
  sidebar.appendChild(floorGroup)
}

function roomRow(room: RoomWithOccupancy, status: RoomStatus): HTMLTableRowElement {
  const tr = document.createElement('tr')
  tr.className = 'rooms-list-row'

  const tdName = document.createElement('td')
  tdName.textContent = room.name
  const tdLocation = document.createElement('td')
  tdLocation.className = 'mono'
  tdLocation.textContent = `${buildingLabel(room.building)} · floor ${room.floor}`
  const tdCapacity = document.createElement('td')
  tdCapacity.className = 'num'
  tdCapacity.textContent = String(room.capacity)
  const tdStatus = document.createElement('td')
  const statusDot = document.createElement('span')
  statusDot.className = 'admin-room-dot admin-room-dot--inline'
  statusDot.style.background = STATUS_COLOR[status.status]
  tdStatus.append(statusDot, document.createTextNode(` ${STATUS_LABEL[status.status]}`))
  const tdOccupancy = document.createElement('td')
  tdOccupancy.className = 'num'
  tdOccupancy.textContent = String(room.occupancy)
  const tdAction = document.createElement('td')
  const link = document.createElement('a')
  link.href = '/#live'
  link.textContent = 'View live'
  link.addEventListener('click', () => {
    sessionStorage.setItem('roomsense.selectedRoomId', room.roomId)
  })
  tdAction.appendChild(link)

  tr.append(tdName, tdLocation, tdCapacity, tdStatus, tdOccupancy, tdAction)
  return tr
}

function renderRoomsList(listCard: HTMLElement, data: RoomsData, filters: FilterState): void {
  const visible = data.rooms.filter((room) => matchesFilters(room, data.statuses.get(room.roomId)!.status, filters))

  listCard.innerHTML = `
    <div class="chart-card-head">
      <div>
        <div class="chart-title">Rooms</div>
        <div class="chart-caption">${visible.length} of ${data.rooms.length} rooms match the current filters.</div>
      </div>
    </div>
  `
  const scrollWrap = document.createElement('div')
  scrollWrap.className = 'rooms-list-scroll'
  const table = document.createElement('table')
  table.className = 'sr-table'
  table.innerHTML = `<thead><tr>
    <th>Room</th><th>Location</th><th class="num">Capacity</th><th>Status</th><th class="num">Occupancy</th><th>Live</th>
  </tr></thead>`
  const tbody = document.createElement('tbody')
  for (const room of visible) {
    tbody.appendChild(roomRow(room, data.statuses.get(room.roomId)!))
  }
  table.appendChild(tbody)
  scrollWrap.appendChild(table)
  listCard.appendChild(scrollWrap)

  if (visible.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'chart-caption'
    empty.textContent = 'No rooms match the current filters.'
    listCard.appendChild(empty)
  }
}

function renderError(container: HTMLElement, err: unknown): void {
  container.innerHTML = `
    <div class="chart-card">
      <div class="chart-title">Couldn't load rooms</div>
      <p class="chart-caption">${err instanceof Error ? err.message.replace(/[<>]/g, '') : 'Unknown error'}</p>
    </div>
  `
}

export const roomsPage: Page = {
  async mount(container: HTMLElement) {
    container.innerHTML = renderSkeleton()
    try {
      const data = await loadRoomsData()
      const filters: FilterState = {
        search: '',
        statuses: new Set(),
        capacityBuckets: new Set(),
        buildings: new Set(),
        floors: new Set(),
      }
      const sidebar = container.querySelector<HTMLElement>('#filter-sidebar')!
      const listCard = container.querySelector<HTMLElement>('#rooms-list-card')!
      const rerenderList = () => renderRoomsList(listCard, data, filters)
      renderSidebar(sidebar, data, filters, rerenderList)
      rerenderList()
    } catch (err) {
      renderError(container, err)
    }
  },
}
