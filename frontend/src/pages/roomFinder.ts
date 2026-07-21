import { apiClient } from '../lib/api'
import type { Page } from './types'

const styles = `
  .room-finder {
    padding: 1rem;
    max-width: 100%;
  }
  .room-finder h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.75rem;
  }
  .room-finder .subtitle {
    margin: 0 0 1.5rem 0;
    color: #666;
    font-size: 0.875rem;
  }
  .room-cards {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
    margin-top: 0;
  }
  .room-card {
    padding: 1.25rem;
    border: 1px solid #ccc;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    background: #f9f9f9;
    min-height: 80px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: left;
    font-family: inherit;
    font-size: inherit;
  }
  .room-card:hover {
    background: #e8f5e9;
    border-color: #4caf50;
  }
  .room-name {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  .room-meta {
    font-size: 0.875rem;
    color: #666;
    margin-bottom: 0.5rem;
  }
  .occupancy {
    font-size: 0.875rem;
    color: #4caf50;
    font-weight: 500;
  }
  @media (min-width: 768px) {
    .room-cards {
      grid-template-columns: repeat(2, 1fr);
    }
  }
`

function buildingLabel(building: string): string {
  return building.charAt(0).toUpperCase() + building.slice(1)
}

export const roomFinderPage: Page = {
  async mount(container: HTMLElement) {
    // Add styles
    const styleEl = document.createElement('style')
    styleEl.textContent = styles
    container.appendChild(styleEl)

    // Create main wrapper
    const wrapper = document.createElement('div')
    wrapper.className = 'room-finder'

    const heading = document.createElement('h1')
    heading.textContent = 'Find a Room'
    wrapper.appendChild(heading)

    const subtitle = document.createElement('p')
    subtitle.className = 'subtitle'
    subtitle.textContent = 'Green = available now'
    wrapper.appendChild(subtitle)

    // Fetch rooms
    const rooms = await apiClient.getRooms()

    // Filter: occupancy < capacity (room is available)
    const available = rooms.filter((r) => (r.occupancy ?? 0) < r.capacity)

    // Sort by building, then floor
    available.sort((a, b) => {
      if (a.building !== b.building) return a.building.localeCompare(b.building)
      return (a.floor ?? 0) - (b.floor ?? 0)
    })

    // Create room cards
    const cardsContainer = document.createElement('div')
    cardsContainer.className = 'room-cards'

    for (const room of available) {
      const card = document.createElement('button')
      card.className = 'room-card'
      card.type = 'button'

      const roomName = document.createElement('div')
      roomName.className = 'room-name'
      roomName.textContent = room.name
      card.appendChild(roomName)

      const roomMeta = document.createElement('div')
      roomMeta.className = 'room-meta'
      roomMeta.textContent = `${buildingLabel(room.building)} / Floor ${room.floor ?? 'N/A'}`
      card.appendChild(roomMeta)

      const occupancy = document.createElement('div')
      occupancy.className = 'occupancy'
      occupancy.textContent = `${room.occupancy ?? 0} / ${room.capacity} people`
      card.appendChild(occupancy)

      card.addEventListener('click', () => {
        sessionStorage.setItem('roomsense.selectedRoomId', room.roomId)
        window.location.hash = '#live'
      })

      cardsContainer.appendChild(card)
    }

    wrapper.appendChild(cardsContainer)
    container.appendChild(wrapper)

    if (import.meta.env.DEV) {
      const cards = container.querySelectorAll('.room-card')
      const notButtons = Array.from(cards).filter((card) => card.tagName !== 'BUTTON')

      if (notButtons.length > 0) {
        console.warn(
          `⚠️  Room Finder: ${notButtons.length} card(s) are not buttons. ` +
          `Room cards must be <button> elements with click handlers to navigate to room details. ` +
          `Using divs creates false affordance: looks interactive but isn't.`
        )
      }
    }
  },
}
