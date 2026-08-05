import type { StreakResponse, UnlockInfo } from '../lib/apiTypes'
import { escapeHtml } from '../lib/format'

export interface StreakCounterHandle {
  openModal(): void
  closeModal(): void
}

const styles = `
  .streak-badge {
    display: inline-flex; align-items: center; gap: 0.3rem;
    font-family: var(--font-mono); font-size: 0.82rem; font-weight: 600;
    color: var(--text-primary); background: var(--surface-card);
    border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
    padding: 0.35rem 0.65rem; cursor: pointer;
  }
  .streak-badge:hover { border-color: var(--brand); }
  .streak-modal {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000;
  }
  /* Author-stylesheet display:flex above would otherwise beat the UA
     stylesheet's [hidden] { display: none } rule (author origin always wins
     over user-agent origin regardless of specificity), silently breaking the
     open/close toggle and leaving an invisible-but-clickable overlay. */
  .streak-modal[hidden] { display: none; }
  .streak-modal-content {
    background: var(--surface-card); border-radius: var(--radius);
    padding: 1.75rem; max-width: 380px; width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  }
  .streak-modal-title { font-size: 1.3rem; font-weight: 700; color: var(--text-primary); }
  .streak-modal-sub { font-size: 0.82rem; color: var(--text-muted); margin: 0.35rem 0 1rem; }
  .streak-unlock-list { list-style: none; margin: 0 0 1.25rem; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
  .streak-unlock-item { display: flex; align-items: center; gap: 0.6rem; font-size: 0.86rem; color: var(--text-secondary); }
  .streak-unlock-item[data-unlocked="true"] { color: var(--text-primary); }
  .streak-unlock-check { font-weight: 700; color: var(--status-good); flex: none; width: 1.2rem; text-align: center; }
  .streak-unlock-item[data-unlocked="false"] .streak-unlock-check { color: var(--text-muted); }
  .streak-unlock-label { flex: 1; }
  .streak-unlock-threshold { font-size: 0.72rem; color: var(--text-muted); }
  .streak-modal-close {
    font-family: var(--font-display); font-weight: 600; color: var(--text-secondary);
    background: transparent; border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
    padding: 0.5rem 1rem; cursor: pointer; width: 100%;
  }
  .streak-modal-close:hover { color: var(--text-primary); border-color: var(--brand); }
`

export function createStreakCounter(
  container: HTMLElement,
  streak: StreakResponse,
  unlocks: UnlockInfo[],
): StreakCounterHandle {
  if (!document.querySelector('style[data-component="streak-counter"]')) {
    const styleEl = document.createElement('style')
    styleEl.setAttribute('data-component', 'streak-counter')
    styleEl.textContent = styles
    document.head.appendChild(styleEl)
  }

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
          <span class="streak-unlock-label">${escapeHtml(u.label)}</span>
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
