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
    min-height: 140px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    text-align: left;
    font-family: inherit;
    font-size: inherit;
  }
  .room-card:hover {
    background: #e8f5e9;
    border-color: #4caf50;
  }
  .room-card:active {
    background: #d4edda;
    transform: scale(0.98);
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
    margin-bottom: 0.75rem;
  }
  .room-card-cta {
    min-height: 48px;
    min-width: 48px;
    padding: 0.75rem 1rem;
    background: #4caf50;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    align-self: flex-start;
  }
  .room-card-cta:hover {
    background: #45a049;
  }
  .room-card-cta:active {
    transform: scale(0.95);
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
      const card = document.createElement('div')
      card.className = 'room-card'

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

      const ctaButton = document.createElement('button')
      ctaButton.className = 'room-card-cta'
      ctaButton.textContent = 'Book Now'
      ctaButton.addEventListener('click', (e) => {
        e.stopPropagation()
        sessionStorage.setItem('roomsense.selectedRoomId', room.roomId)
        window.location.hash = '#live'
      })
      card.appendChild(ctaButton)

      cardsContainer.appendChild(card)
    }

    wrapper.appendChild(cardsContainer)
    container.appendChild(wrapper)

    if (import.meta.env.DEV) {
      const cards = container.querySelectorAll('.room-card')
      const missingCTA = Array.from(cards).filter((card) => {
        const ctaButton = card.querySelector('.room-card-cta')
        return !ctaButton
      })

      if (missingCTA.length > 0) {
        console.warn(
          `⚠️  Room Finder: ${missingCTA.length} card(s) missing CTA button. ` +
          `Each room card must have a .room-card-cta element to navigate to room details. ` +
          `Missing CTA creates false affordance: card looks interactive but isn't.`
        )
      }
    }
  },
}
