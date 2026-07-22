import { apiClient } from '../lib/api'
import type { Page } from './types'

const styles = `
  .booking-success {
    padding: 2rem 1rem;
    max-width: 600px;
    margin: 0 auto;
    text-align: center;
  }

  .success-celebration {
    font-size: 4rem;
    margin-bottom: 1rem;
    animation: bounce 0.6s ease-out;
  }

  @keyframes bounce {
    0% {
      transform: scale(0.3);
      opacity: 0;
    }
    50% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .success-heading {
    font-size: 2rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: #4caf50;
  }

  .success-subheading {
    font-size: 1rem;
    color: #666;
    margin: 0 0 2rem 0;
  }

  .booking-details {
    background: #f5f5f5;
    border-left: 4px solid #4caf50;
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 2rem;
    text-align: left;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    font-size: 0.95rem;
  }

  .detail-label {
    color: #666;
    font-weight: 500;
  }

  .detail-value {
    color: #000;
    font-weight: 600;
  }

  .auto-redirect-timer {
    font-size: 0.875rem;
    color: #999;
    margin-top: 1rem;
  }

  .success-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .success-btn {
    min-height: 48px;
    min-width: 150px;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .success-btn-primary {
    background: #4caf50;
    color: white;
  }

  .success-btn-primary:hover {
    background: #45a049;
  }

  .success-btn-primary:active {
    transform: scale(0.98);
  }

  .success-btn-secondary {
    background: #f0f0f0;
    color: #333;
    border: 1px solid #ddd;
  }

  .success-btn-secondary:hover {
    background: #e8e8e8;
  }

  .success-btn-secondary:active {
    transform: scale(0.98);
  }

  @media (max-width: 480px) {
    .booking-success {
      padding: 1.5rem 1rem;
    }

    .success-celebration {
      font-size: 3rem;
    }

    .success-heading {
      font-size: 1.5rem;
    }

    .success-actions {
      flex-direction: column;
    }

    .success-btn {
      width: 100%;
    }
  }
`

export const bookingSuccessPage: Page = {
  async mount(container: HTMLElement) {
    // Add styles
    const styleEl = document.createElement('style')
    styleEl.textContent = styles
    container.appendChild(styleEl)

    // Get booking details from sessionStorage
    const selectedRoomId = sessionStorage.getItem('roomsense.selectedRoomId')
    const bookingTime = sessionStorage.getItem('roomsense.bookingTime')

    if (!selectedRoomId || !bookingTime) {
      container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #666;">No booking found. Redirecting...</div>'
      setTimeout(() => {
        window.location.hash = '#finder'
      }, 2000)
      return
    }

    // Fetch rooms to get details of booked room
    const rooms = await apiClient.getRooms()
    const bookedRoom = rooms.find((r) => r.roomId === selectedRoomId)

    if (!bookedRoom) {
      container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #666;">Room not found. Redirecting...</div>'
      setTimeout(() => {
        window.location.hash = '#finder'
      }, 2000)
      return
    }

    // Create main wrapper
    const wrapper = document.createElement('div')
    wrapper.className = 'booking-success'

    // Celebration emoji
    const celebration = document.createElement('div')
    celebration.className = 'success-celebration'
    celebration.textContent = '✅'
    wrapper.appendChild(celebration)

    // Heading
    const heading = document.createElement('h1')
    heading.className = 'success-heading'
    heading.textContent = 'Booking Confirmed!'
    wrapper.appendChild(heading)

    // Subheading
    const subheading = document.createElement('p')
    subheading.className = 'success-subheading'
    subheading.textContent = `Your booking is confirmed. We'll see you in ${bookedRoom.name}!`
    wrapper.appendChild(subheading)

    // Booking details
    const details = document.createElement('div')
    details.className = 'booking-details'

    const roomRow = document.createElement('div')
    roomRow.className = 'detail-row'
    roomRow.innerHTML = `
      <span class="detail-label">Room</span>
      <span class="detail-value">${bookedRoom.name}</span>
    `
    details.appendChild(roomRow)

    const buildingLabel = bookedRoom.building.charAt(0).toUpperCase() + bookedRoom.building.slice(1)
    const locationRow = document.createElement('div')
    locationRow.className = 'detail-row'
    locationRow.innerHTML = `
      <span class="detail-label">Location</span>
      <span class="detail-value">${buildingLabel} / Floor ${bookedRoom.floor}</span>
    `
    details.appendChild(locationRow)

    const occupancyPct = Math.round((bookedRoom.occupancy / bookedRoom.capacity) * 100)
    const occupancyRow = document.createElement('div')
    occupancyRow.className = 'detail-row'
    occupancyRow.innerHTML = `
      <span class="detail-label">Current Occupancy</span>
      <span class="detail-value">${bookedRoom.occupancy} / ${bookedRoom.capacity} (${occupancyPct}%)</span>
    `
    details.appendChild(occupancyRow)

    const timeRow = document.createElement('div')
    timeRow.className = 'detail-row'
    const bookingDate = new Date(bookingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    timeRow.innerHTML = `
      <span class="detail-label">Booked At</span>
      <span class="detail-value">${bookingDate}</span>
    `
    details.appendChild(timeRow)

    wrapper.appendChild(details)

    // Auto-redirect timer
    const timer = document.createElement('div')
    timer.className = 'auto-redirect-timer'
    timer.textContent = 'Redirecting to live occupancy in 5 seconds...'
    wrapper.appendChild(timer)

    // Action buttons
    const actions = document.createElement('div')
    actions.className = 'success-actions'

    const finderBtn = document.createElement('button')
    finderBtn.className = 'success-btn success-btn-secondary'
    finderBtn.textContent = 'Find Another Room'
    finderBtn.setAttribute('data-action', 'find-another')
    finderBtn.addEventListener('click', () => {
      sessionStorage.removeItem('roomsense.selectedRoomId')
      sessionStorage.removeItem('roomsense.bookingTime')
      window.location.hash = '#finder'
    })
    actions.appendChild(finderBtn)

    const liveBtn = document.createElement('button')
    liveBtn.className = 'success-btn success-btn-primary'
    liveBtn.textContent = 'View Live Occupancy'
    liveBtn.setAttribute('data-action', 'go-live')
    liveBtn.addEventListener('click', () => {
      window.location.hash = '#live'
    })
    actions.appendChild(liveBtn)

    wrapper.appendChild(actions)
    container.appendChild(wrapper)

    // Auto-redirect to live page after 5 seconds
    setTimeout(() => {
      window.location.hash = '#live'
    }, 5000)
  },
}
