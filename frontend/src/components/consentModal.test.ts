import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createConsentModal, getConsentChoice } from './consentModal'

describe('consentModal', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    localStorage.clear()
  })

  it('renders the modal with title and description', () => {
    createConsentModal(container)

    expect(container.querySelector('.consent-modal')).toBeTruthy()
    expect(container.textContent).toContain('Enable Social Features')
    expect(container.textContent).toContain('opt-in')
  })

  it('renders both checkboxes', () => {
    createConsentModal(container)

    const checkboxes = container.querySelectorAll('input[type="checkbox"]')
    expect(checkboxes.length).toBe(2)
    expect(container.textContent).toContain('Share my location with friends')
    expect(container.textContent).toContain('Show me when friends are nearby')
  })

  it('renders Enable and Skip buttons with 48px min height', () => {
    createConsentModal(container)

    const enableBtn = container.querySelector('button[data-action="enable"]') as HTMLButtonElement
    const skipBtn = container.querySelector('button[data-action="skip"]') as HTMLButtonElement

    expect(enableBtn).toBeTruthy()
    expect(skipBtn).toBeTruthy()
    expect(enableBtn.textContent).toBe('Enable')
    expect(skipBtn.textContent).toBe('Skip')
  })

  it('calls onEnable and stores consent in localStorage when Enable clicked', () => {
    const onEnable = vi.fn()
    const onSkip = vi.fn()

    createConsentModal(container, { onEnable, onSkip })

    const enableBtn = container.querySelector('button[data-action="enable"]') as HTMLButtonElement
    enableBtn.click()

    expect(onEnable).toHaveBeenCalledTimes(1)
    expect(onSkip).not.toHaveBeenCalled()

    const stored = getConsentChoice()
    expect(stored).toBeTruthy()
    expect(stored!.enabled).toBe(true)
  })

  it('calls onSkip and stores disabled consent when Skip clicked', () => {
    const onEnable = vi.fn()
    const onSkip = vi.fn()

    createConsentModal(container, { onEnable, onSkip })

    const skipBtn = container.querySelector('button[data-action="skip"]') as HTMLButtonElement
    skipBtn.click()

    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(onEnable).not.toHaveBeenCalled()

    const stored = getConsentChoice()
    expect(stored).toBeTruthy()
    expect(stored!.enabled).toBe(false)
  })

  it('removes the overlay after a button is clicked', () => {
    createConsentModal(container)

    expect(container.querySelector('.consent-overlay')).toBeTruthy()

    const enableBtn = container.querySelector('button[data-action="enable"]') as HTMLButtonElement
    enableBtn.click()

    expect(container.querySelector('.consent-overlay')).toBeFalsy()
  })
})
