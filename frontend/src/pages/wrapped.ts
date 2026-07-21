import { apiClient } from '../lib/api'
import type { RoomWithOccupancy } from '../lib/apiTypes'
import type { Page } from './types'

async function deriveStats(rooms: RoomWithOccupancy[]): Promise<{
  busiestRoom: RoomWithOccupancy
  quietestRoom: RoomWithOccupancy
  ghostHours: number
}> {
  let busiestRoom = rooms[0]
  let maxUtilization = 0

  for (const room of rooms) {
    if ((room.utilizationPct ?? 0) > maxUtilization) {
      maxUtilization = room.utilizationPct ?? 0
      busiestRoom = room
    }
  }

  const quietestRoom = rooms.reduce((prev, curr) =>
    ((curr.utilizationPct ?? 0) < (prev.utilizationPct ?? 0)) ? curr : prev
  )

  // Total ghost hours (sum of rooms with 0 utilization)
  const ghostHours = rooms.reduce((sum, room) => {
    return sum + ((room.utilizationPct ?? 0) === 0 ? 5 : 0) // placeholder
  }, 0)

  return { busiestRoom, quietestRoom, ghostHours }
}

function renderWrappedCard(container: HTMLElement, stats: {
  busiestRoom: RoomWithOccupancy
  quietestRoom: RoomWithOccupancy
  ghostHours: number
}): void {
  const card = document.createElement('div')
  card.className = 'wrapped-card'

  card.innerHTML = `
    <div class="wrapped-header">
      <h1>RoomSense Wrapped 2026</h1>
      <p class="wrapped-subtitle">Your campus occupancy story</p>
    </div>

    <div class="wrapped-stat busiest">
      <h2>Busiest Room</h2>
      <p class="stat-room">${stats.busiestRoom.name}</p>
      <p class="stat-value">${Math.round(stats.busiestRoom.utilizationPct ?? 0)}% full on average</p>
    </div>

    <div class="wrapped-stat quietest">
      <h2>Your Quiet Hideout</h2>
      <p class="stat-room">${stats.quietestRoom.name}</p>
      <p class="stat-value">Perfect for focused work</p>
    </div>

    <div class="wrapped-stat ghosts">
      <h2>Ghost Meeting Hours</h2>
      <p class="stat-value">${stats.ghostHours} hours booked but empty</p>
      <p class="stat-subtitle">That's wasted floor space</p>
    </div>

    <footer class="wrapped-footer">
      <p>Screenshot and share your RoomSense story</p>
    </footer>
  `

  container.appendChild(card)
}

function renderError(container: HTMLElement, err: unknown): void {
  container.innerHTML = `
    <div class="chart-card">
      <div class="chart-title">Couldn't load wrapped card</div>
      <p class="chart-caption">${err instanceof Error ? err.message.replace(/[<>]/g, '') : 'Unknown error'}</p>
    </div>
  `
}

export const wrappedPage: Page = {
  async mount(container: HTMLElement) {
    try {
      const rooms = await apiClient.getRooms()
      const stats = await deriveStats(rooms)
      renderWrappedCard(container, stats)
    } catch (err) {
      renderError(container, err)
    }
  },
}
