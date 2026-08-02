import type { UnlockInfo } from '../lib/apiTypes'

/** One-time celebration modal for a newly-crossed streak threshold. */
export function showFeatureUnlockModal(container: HTMLElement, unlock: UnlockInfo): void {
  const overlay = document.createElement('div')
  overlay.className = 'feature-unlock-modal'
  overlay.innerHTML = `
    <div class="feature-unlock-content">
      <div class="feature-unlock-icon">🎉</div>
      <div class="feature-unlock-title">New unlock!</div>
      <div class="feature-unlock-label">${escapeHtml(unlock.label)}</div>
      <div class="feature-unlock-sub">${unlock.threshold}-day booking streak</div>
      <button type="button" class="feature-unlock-close" data-action="close">Nice!</button>
    </div>
  `
  overlay.querySelector('[data-action="close"]')?.addEventListener('click', () => overlay.remove())
  container.append(overlay)
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
