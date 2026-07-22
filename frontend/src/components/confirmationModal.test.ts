import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createConfirmationModal } from './confirmationModal'

describe('confirmationModal', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
  })

  it('renders modal with room details', () => {
    const room = {
      roomId: 'r1',
      name: 'Senaatzaal',
      building: 'atlas',
      floor: 0,
      capacity: 80,
      occupancy: 5,
    }

    createConfirmationModal(container, room)

    expect(container.querySelector('.confirmation-modal')).toBeTruthy()
    expect(container.textContent).toContain('Senaatzaal')
    expect(container.textContent).toContain('Atlas / Floor 0')
    expect(container.textContent).toContain('5 / 80 people')
  })

  it('renders confirm and cancel buttons', () => {
    const room = {
      roomId: 'r1',
      name: 'Test Room',
      building: 'atlas',
      floor: 1,
      capacity: 10,
      occupancy: 2,
    }

    createConfirmationModal(container, room)

    const confirmBtn = container.querySelector('button[data-action="confirm"]')
    const cancelBtn = container.querySelector('button[data-action="cancel"]')

    expect(confirmBtn).toBeTruthy()
    expect(cancelBtn).toBeTruthy()
    expect(confirmBtn?.textContent).toBe('Confirm Booking')
    expect(cancelBtn?.textContent).toBe('Cancel')
  })

  it('calls onConfirm when confirm button clicked', () => {
    const room = {
      roomId: 'r1',
      name: 'Test Room',
      building: 'atlas',
      floor: 1,
      capacity: 10,
      occupancy: 2,
    }

    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    createConfirmationModal(container, room, { onConfirm, onCancel })

    const confirmBtn = container.querySelector('button[data-action="confirm"]') as HTMLButtonElement
    confirmBtn.click()

    expect(onConfirm).toHaveBeenCalledWith(room.roomId)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onCancel when cancel button clicked', () => {
    const room = {
      roomId: 'r1',
      name: 'Test Room',
      building: 'atlas',
      floor: 1,
      capacity: 10,
      occupancy: 2,
    }

    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    createConfirmationModal(container, room, { onConfirm, onCancel })

    const cancelBtn = container.querySelector('button[data-action="cancel"]') as HTMLButtonElement
    cancelBtn.click()

    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('closes modal overlay when cancel clicked', () => {
    const room = {
      roomId: 'r1',
      name: 'Test Room',
      building: 'atlas',
      floor: 1,
      capacity: 10,
      occupancy: 2,
    }

    const onCancel = vi.fn()
    createConfirmationModal(container, room, { onCancel })

    const overlay = container.querySelector('.modal-overlay') as HTMLElement
    const cancelBtn = container.querySelector('button[data-action="cancel"]') as HTMLButtonElement

    expect(overlay).toBeTruthy()
    cancelBtn.click()

    // After cancel, modal should be removed or hidden
    expect(container.querySelector('.confirmation-modal')).toBeFalsy()
  })

  it('displays occupancy as percentage', () => {
    const room = {
      roomId: 'r1',
      name: 'Test Room',
      building: 'atlas',
      floor: 1,
      capacity: 10,
      occupancy: 2,
    }

    createConfirmationModal(container, room)

    // 2/10 = 20%
    expect(container.textContent).toContain('20%')
  })
})
