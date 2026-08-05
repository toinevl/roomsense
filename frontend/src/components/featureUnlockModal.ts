import type { UnlockInfo } from '../lib/apiTypes'
import { escapeHtml } from '../lib/format'

const styles = `
  .feature-unlock-modal {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000;
  }
  .feature-unlock-content {
    background: var(--surface-card); border-radius: var(--radius);
    padding: 2rem; max-width: 360px; width: 90%; text-align: center;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  }
  .feature-unlock-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
  .feature-unlock-title { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; }
  .feature-unlock-label { font-size: 1rem; color: var(--text-primary); margin-bottom: 0.25rem; }
  .feature-unlock-sub { font-size: 0.82rem; color: var(--text-muted); margin-bottom: 1.25rem; }
  .feature-unlock-close {
    font-family: var(--font-display); font-weight: 600; color: #fff;
    background: var(--brand); border: none; border-radius: var(--radius-sm);
    padding: 0.6rem 1.5rem; cursor: pointer;
  }
  .feature-unlock-close:hover { background: var(--brand-strong); }
`

/** One-time celebration modal for a newly-crossed streak threshold. */
export function showFeatureUnlockModal(container: HTMLElement, unlock: UnlockInfo): void {
  if (!document.querySelector('style[data-component="feature-unlock"]')) {
    const styleEl = document.createElement('style')
    styleEl.setAttribute('data-component', 'feature-unlock')
    styleEl.textContent = styles
    document.head.appendChild(styleEl)
  }

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
