interface ConsentOptions {
  onEnable?: () => void
  onSkip?: () => void
}

const CONSENT_KEY = 'roomsense.socialConsent'

const styles = `
  .consent-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .consent-modal {
    background: var(--surface-card, #1a1a19);
    border: 1px solid var(--border, rgba(255,255,255,0.10));
    border-radius: var(--radius, 8px);
    padding: 2rem;
    max-width: 440px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
    animation: consent-slide-up 0.3s ease-out;
  }

  @keyframes consent-slide-up {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .consent-title {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0 0 0.75rem 0;
    color: var(--text-primary, #fff);
  }

  .consent-desc {
    font-size: 0.9rem;
    color: var(--text-secondary, #c3c2b7);
    margin: 0 0 1.25rem 0;
    line-height: 1.5;
  }

  .consent-checkboxes {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .consent-checkbox-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-height: 48px;
    padding: 0.5rem 0;
  }

  .consent-checkbox-row input[type="checkbox"] {
    width: 20px;
    height: 20px;
    flex: none;
    cursor: pointer;
    accent-color: var(--series-2, #008300);
  }

  .consent-checkbox-row label {
    font-size: 0.9rem;
    color: var(--text-primary, #fff);
    cursor: pointer;
  }

  .consent-buttons {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .consent-btn {
    min-height: 48px;
    min-width: 120px;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--radius-sm, 4px);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    font-family: inherit;
  }

  .consent-btn:active { transform: scale(0.98); }

  .consent-btn-enable {
    background: var(--status-good, #0ca30c);
    color: white;
  }
  .consent-btn-enable:hover { opacity: 0.88; }

  .consent-btn-skip {
    background: var(--surface-card-2, #201f1c);
    color: var(--text-secondary, #c3c2b7);
    border: 1px solid var(--border-strong, rgba(255,255,255,0.18));
  }
  .consent-btn-skip:hover { opacity: 0.88; }
`

export function createConsentModal(
  container: HTMLElement,
  options: ConsentOptions = {},
): void {
  const { onEnable, onSkip } = options

  // Inject styles once
  if (!document.querySelector('style[data-consent-modal]')) {
    const styleEl = document.createElement('style')
    styleEl.setAttribute('data-consent-modal', 'consent')
    styleEl.textContent = styles
    document.head.appendChild(styleEl)
  }

  const overlay = document.createElement('div')
  overlay.className = 'consent-overlay'

  const modal = document.createElement('div')
  modal.className = 'consent-modal'

  // Title
  const title = document.createElement('h2')
  title.className = 'consent-title'
  title.textContent = 'Enable Social Features'
  modal.appendChild(title)

  // Description
  const desc = document.createElement('p')
  desc.className = 'consent-desc'
  desc.textContent =
    'Location sharing is completely opt-in. We never use GPS — only building-level ' +
    'presence. Your data is automatically deleted after 24 hours. ' +
    'You can change this anytime in Privacy Settings.'
  modal.appendChild(desc)

  // Checkboxes
  const checkboxContainer = document.createElement('div')
  checkboxContainer.className = 'consent-checkboxes'

  const shareLocId = 'consent-share-location'
  const shareLocRow = document.createElement('div')
  shareLocRow.className = 'consent-checkbox-row'
  const shareLocInput = document.createElement('input')
  shareLocInput.type = 'checkbox'
  shareLocInput.id = shareLocId
  shareLocInput.checked = true
  shareLocInput.setAttribute('data-consent', 'share-location')
  const shareLocLabel = document.createElement('label')
  shareLocLabel.htmlFor = shareLocId
  shareLocLabel.textContent = 'Share my location with friends'
  shareLocRow.appendChild(shareLocInput)
  shareLocRow.appendChild(shareLocLabel)
  checkboxContainer.appendChild(shareLocRow)

  const seeNearbyId = 'consent-see-nearby'
  const seeNearbyRow = document.createElement('div')
  seeNearbyRow.className = 'consent-checkbox-row'
  const seeNearbyInput = document.createElement('input')
  seeNearbyInput.type = 'checkbox'
  seeNearbyInput.id = seeNearbyId
  seeNearbyInput.checked = true
  seeNearbyInput.setAttribute('data-consent', 'see-nearby')
  const seeNearbyLabel = document.createElement('label')
  seeNearbyLabel.htmlFor = seeNearbyId
  seeNearbyLabel.textContent = 'Show me when friends are nearby'
  seeNearbyRow.appendChild(seeNearbyInput)
  seeNearbyRow.appendChild(seeNearbyLabel)
  checkboxContainer.appendChild(seeNearbyRow)

  modal.appendChild(checkboxContainer)

  // Buttons
  const buttonRow = document.createElement('div')
  buttonRow.className = 'consent-buttons'

  const skipBtn = document.createElement('button')
  skipBtn.className = 'consent-btn consent-btn-skip'
  skipBtn.textContent = 'Skip'
  skipBtn.setAttribute('data-action', 'skip')
  skipBtn.addEventListener('click', () => {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ enabled: false }))
    } catch {
      /* localStorage may be unavailable in some environments */
    }
    overlay.remove()
    if (onSkip) onSkip()
  })
  buttonRow.appendChild(skipBtn)

  const enableBtn = document.createElement('button')
  enableBtn.className = 'consent-btn consent-btn-enable'
  enableBtn.textContent = 'Enable'
  enableBtn.setAttribute('data-action', 'enable')
  enableBtn.addEventListener('click', () => {
    try {
      localStorage.setItem(
        CONSENT_KEY,
        JSON.stringify({
          enabled: true,
          shareLocation: shareLocInput.checked,
          seeNearby: seeNearbyInput.checked,
        }),
      )
    } catch {
      /* localStorage may be unavailable in some environments */
    }
    overlay.remove()
    if (onEnable) onEnable()
  })
  buttonRow.appendChild(enableBtn)

  modal.appendChild(buttonRow)
  overlay.appendChild(modal)
  container.appendChild(overlay)
}

/** Read the persisted consent choice, or null if not set. */
export function getConsentChoice(): { enabled: boolean; shareLocation?: boolean; seeNearby?: boolean } | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}
