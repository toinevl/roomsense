import type { StreakResponse, UnlockInfo } from '../lib/apiTypes'

export interface StreakCounterHandle {
  openModal(): void
  closeModal(): void
}

export function createStreakCounter(
  container: HTMLElement,
  streak: StreakResponse,
  unlocks: UnlockInfo[],
): StreakCounterHandle {
  container.innerHTML = ''

  const badge = document.createElement('button')
  badge.type = 'button'
  badge.className = 'streak-badge'
  badge.textContent = `🔥 ${streak.currentStreakDays}`
  badge.title = `${streak.currentStreakDays}-day booking streak`

  const modal = document.createElement('div')
  modal.className = 'streak-modal'
  modal.hidden = true

  const unlockList = unlocks
    .map(
      (u) => `
        <li class="streak-unlock-item" data-unlocked="${u.unlocked}">
          <span class="streak-unlock-check">${u.unlocked ? '✓' : '○'}</span>
          <span class="streak-unlock-label">${u.label}</span>
          <span class="streak-unlock-threshold">${u.threshold}-day streak</span>
        </li>`,
    )
    .join('')

  modal.innerHTML = `
    <div class="streak-modal-content">
      <div class="streak-modal-title">${streak.currentStreakDays}-day streak</div>
      <div class="streak-modal-sub">Longest: ${streak.longestStreakDays} days · ${streak.totalBookings} total bookings</div>
      <ul class="streak-unlock-list">${unlockList}</ul>
      <button type="button" class="streak-modal-close" data-action="close">Close</button>
    </div>
  `

  function openModal(): void {
    modal.hidden = false
  }
  function closeModal(): void {
    modal.hidden = true
  }

  badge.addEventListener('click', openModal)
  modal.querySelector('[data-action="close"]')?.addEventListener('click', closeModal)

  container.append(badge, modal)
  return { openModal, closeModal }
}
