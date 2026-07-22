interface Room {
  roomId: string
  name: string
  building: string
  floor: number
  capacity: number
  occupancy: number
}

interface ModalOptions {
  onConfirm?: (roomId: string) => void
  onCancel?: () => void
}

const styles = `
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .confirmation-modal {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-heading {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 1.5rem 0;
    color: #000;
  }

  .modal-room-info {
    background: #f5f5f5;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  .modal-room-name {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: #000;
  }

  .modal-room-detail {
    font-size: 0.875rem;
    color: #666;
    margin: 0.25rem 0;
  }

  .modal-occupancy {
    font-size: 1rem;
    color: #4caf50;
    font-weight: 500;
    margin-top: 0.75rem;
  }

  .modal-buttons {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .modal-btn {
    min-height: 48px;
    min-width: 120px;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .modal-btn-confirm {
    background: #4caf50;
    color: white;
  }

  .modal-btn-confirm:hover {
    background: #45a049;
  }

  .modal-btn-confirm:active {
    transform: scale(0.98);
  }

  .modal-btn-cancel {
    background: #f0f0f0;
    color: #333;
    border: 1px solid #ddd;
  }

  .modal-btn-cancel:hover {
    background: #e8e8e8;
  }

  .modal-btn-cancel:active {
    transform: scale(0.98);
  }
`

export function createConfirmationModal(
  container: HTMLElement,
  room: Room,
  options: ModalOptions = {}
): void {
  const { onConfirm, onCancel } = options

  // Add styles if not already present
  if (!document.querySelector('style[data-modal="confirmation"]')) {
    const styleEl = document.createElement('style')
    styleEl.setAttribute('data-modal', 'confirmation')
    styleEl.textContent = styles
    document.head.appendChild(styleEl)
  }

  // Create overlay
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'

  // Create modal
  const modal = document.createElement('div')
  modal.className = 'confirmation-modal'

  // Heading
  const heading = document.createElement('h2')
  heading.className = 'modal-heading'
  heading.textContent = 'Confirm Booking'
  modal.appendChild(heading)

  // Room info box
  const infoBox = document.createElement('div')
  infoBox.className = 'modal-room-info'

  const roomName = document.createElement('div')
  roomName.className = 'modal-room-name'
  roomName.textContent = room.name
  infoBox.appendChild(roomName)

  const roomMeta = document.createElement('div')
  roomMeta.className = 'modal-room-detail'
  const buildingLabel = room.building.charAt(0).toUpperCase() + room.building.slice(1)
  roomMeta.textContent = `${buildingLabel} / Floor ${room.floor}`
  infoBox.appendChild(roomMeta)

  const occupancyPct = Math.round((room.occupancy / room.capacity) * 100)
  const occupancy = document.createElement('div')
  occupancy.className = 'modal-occupancy'
  occupancy.textContent = `${room.occupancy} / ${room.capacity} people (${occupancyPct}%)`
  infoBox.appendChild(occupancy)

  modal.appendChild(infoBox)

  // Buttons
  const buttonContainer = document.createElement('div')
  buttonContainer.className = 'modal-buttons'

  const cancelBtn = document.createElement('button')
  cancelBtn.className = 'modal-btn modal-btn-cancel'
  cancelBtn.textContent = 'Cancel'
  cancelBtn.setAttribute('data-action', 'cancel')
  cancelBtn.addEventListener('click', () => {
    if (onCancel) onCancel()
    overlay.remove()
  })
  buttonContainer.appendChild(cancelBtn)

  const confirmBtn = document.createElement('button')
  confirmBtn.className = 'modal-btn modal-btn-confirm'
  confirmBtn.textContent = 'Confirm Booking'
  confirmBtn.setAttribute('data-action', 'confirm')
  confirmBtn.addEventListener('click', () => {
    if (onConfirm) onConfirm(room.roomId)
    overlay.remove()
  })
  buttonContainer.appendChild(confirmBtn)

  modal.appendChild(buttonContainer)
  overlay.appendChild(modal)
  container.appendChild(overlay)
}
