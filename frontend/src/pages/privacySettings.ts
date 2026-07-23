import { apiClient } from '../lib/api'
import type { PrivacySettings } from '../lib/apiTypes'
import type { Page } from './types'

const styles = `
  .privacy-page {
    max-width: 640px;
    margin: 0 auto;
  }

  .privacy-page h1 {
    font-size: clamp(1.6rem, 3vw, 2.2rem);
    margin: 0 0 0.4rem 0;
    color: var(--text-primary);
  }

  .privacy-subtitle {
    color: var(--text-secondary);
    font-size: 0.95rem;
    margin: 0 0 2rem 0;
  }

  .privacy-section {
    background: var(--surface-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.25rem 1.35rem;
    margin-bottom: 1rem;
  }

  .privacy-section-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }

  .privacy-section-desc {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin: 0 0 1rem 0;
    line-height: 1.5;
  }

  /* ── Toggle switch ── */
  .privacy-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .privacy-toggle-label {
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .privacy-switch {
    position: relative;
    width: 52px;
    height: 30px;
    flex: none;
  }

  .privacy-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .privacy-switch-slider {
    position: absolute;
    inset: 0;
    background: var(--surface-card-2);
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .privacy-switch-slider::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    background: var(--text-muted);
    border-radius: 50%;
    transition: transform 0.2s, background 0.2s;
  }

  .privacy-switch input:checked + .privacy-switch-slider {
    background: color-mix(in srgb, var(--status-good) 30%, transparent);
    border-color: var(--status-good);
  }

  .privacy-switch input:checked + .privacy-switch-slider::before {
    transform: translateX(22px);
    background: var(--status-good);
  }

  /* ── Radio groups ── */
  .privacy-radio-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .privacy-radio-option {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-height: 48px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .privacy-radio-option:hover {
    border-color: var(--border-strong);
  }

  .privacy-radio-option input[type="radio"] {
    width: 20px;
    height: 20px;
    flex: none;
    cursor: pointer;
    accent-color: var(--series-1);
  }

  .privacy-radio-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .privacy-radio-label-text {
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .privacy-radio-desc {
    font-size: 0.76rem;
    color: var(--text-muted);
  }

  /* ── Info / reassurance ── */
  .privacy-retention {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    color: var(--text-secondary);
  }

  .privacy-retention-value {
    font-weight: 700;
    color: var(--text-primary);
  }

  .privacy-reassurance {
    text-align: center;
    padding: 1.25rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
    background: color-mix(in srgb, var(--series-5) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--series-5) 30%, transparent);
    border-radius: var(--radius);
    margin-top: 1.5rem;
    margin-bottom: 1rem;
  }

  .privacy-reassurance strong {
    color: var(--text-primary);
  }

  .privacy-saved-indicator {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--status-good);
    opacity: 0;
    transition: opacity 0.3s;
    min-height: 1rem;
  }

  .privacy-saved-indicator.visible {
    opacity: 1;
  }

  .privacy-loading {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }
`

export const privacySettingsPage: Page = {
  mount(container: HTMLElement) {
    const styleEl = document.createElement('style')
    styleEl.textContent = styles
    container.appendChild(styleEl)

    const wrapper = document.createElement('div')
    wrapper.className = 'privacy-page'

    const heading = document.createElement('h1')
    heading.textContent = 'Privacy Settings'
    wrapper.appendChild(heading)

    const subtitle = document.createElement('p')
    subtitle.className = 'privacy-subtitle'
    subtitle.textContent = 'You are in control. Adjust what others can see about you.'
    wrapper.appendChild(subtitle)

    const content = document.createElement('div')
    content.className = 'privacy-content'
    wrapper.appendChild(content)

    // Saved indicator (shared)
    const savedIndicator = document.createElement('div')
    savedIndicator.className = 'privacy-saved-indicator'
    savedIndicator.textContent = '✓ Saved'
    wrapper.appendChild(savedIndicator)

    container.appendChild(wrapper)

    let destroyed = false
    let saveTimer: ReturnType<typeof setTimeout> | null = null

    function showSaved(): void {
      savedIndicator.classList.add('visible')
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => savedIndicator.classList.remove('visible'), 2000)
    }

    async function autoSave(settings: Partial<PrivacySettings>): Promise<void> {
      try {
        await apiClient.updatePrivacy('user-1', settings)
        if (!destroyed) showSaved()
      } catch {
        // silent fail — UI already reflects user's choice
      }
    }

    async function load(): Promise<void> {
      const loading = document.createElement('div')
      loading.className = 'privacy-loading'
      loading.textContent = 'Loading settings…'
      content.appendChild(loading)

      try {
        const settings = await apiClient.getPrivacy('user-1')
        if (destroyed) return
        content.innerHTML = ''
        renderSections(settings)
      } catch {
        if (destroyed) return
        content.innerHTML = ''
        const err = document.createElement('div')
        err.className = 'privacy-loading'
        err.textContent = 'Unable to load settings.'
        content.appendChild(err)
      }
    }

    function renderSections(settings: PrivacySettings): void {
      // ── Location sharing toggle ──
      const locSection = document.createElement('section')
      locSection.className = 'privacy-section'

      const locTitle = document.createElement('h2')
      locTitle.className = 'privacy-section-title'
      locTitle.textContent = 'Location Sharing'
      locSection.appendChild(locTitle)

      const locDesc = document.createElement('p')
      locDesc.className = 'privacy-section-desc'
      locDesc.textContent =
        'When enabled, friends can see which building you are in. ' +
        'We never use GPS — only building-level presence from room sensors.'
      locSection.appendChild(locDesc)

      const toggleRow = document.createElement('div')
      toggleRow.className = 'privacy-toggle-row'
      const toggleLabel = document.createElement('span')
      toggleLabel.className = 'privacy-toggle-label'
      toggleLabel.textContent = 'Share my location'
      toggleRow.appendChild(toggleLabel)

      const switchWrap = document.createElement('label')
      switchWrap.className = 'privacy-switch'
      const switchInput = document.createElement('input')
      switchInput.type = 'checkbox'
      switchInput.checked = settings.locationSharingEnabled
      switchInput.setAttribute('data-privacy', 'location-sharing')
      switchInput.addEventListener('change', () => {
        void autoSave({ locationSharingEnabled: switchInput.checked })
      })
      const slider = document.createElement('span')
      slider.className = 'privacy-switch-slider'
      switchWrap.appendChild(switchInput)
      switchWrap.appendChild(slider)
      toggleRow.appendChild(switchWrap)
      locSection.appendChild(toggleRow)
      content.appendChild(locSection)

      // ── Friend visibility ──
      const visSection = document.createElement('section')
      visSection.className = 'privacy-section'

      const visTitle = document.createElement('h2')
      visTitle.className = 'privacy-section-title'
      visTitle.textContent = 'Who Can See Me'
      visSection.appendChild(visTitle)

      const visDesc = document.createElement('p')
      visDesc.className = 'privacy-section-desc'
      visDesc.textContent = 'Control who can see your presence on campus.'
      visSection.appendChild(visDesc)

      const visGroup = document.createElement('div')
      visGroup.className = 'privacy-radio-group'

      const visOptions: Array<{
        value: PrivacySettings['friendVisibility']
        label: string
        desc: string
      }> = [
        { value: 'friends-only', label: 'Friends only', desc: 'Only people you have added as friends' },
        { value: 'campus', label: 'Campus', desc: 'Anyone with a campus account' },
        { value: 'public', label: 'Public', desc: 'Anyone with the link' },
      ]

      for (const opt of visOptions) {
        const row = document.createElement('label')
        row.className = 'privacy-radio-option'
        const radio = document.createElement('input')
        radio.type = 'radio'
        radio.name = 'friend-visibility'
        radio.value = opt.value
        radio.checked = settings.friendVisibility === opt.value
        radio.setAttribute('data-privacy', 'friend-visibility')
        radio.addEventListener('change', () => {
          if (radio.checked) void autoSave({ friendVisibility: opt.value })
        })
        row.appendChild(radio)
        const text = document.createElement('div')
        text.className = 'privacy-radio-text'
        const labelText = document.createElement('span')
        labelText.className = 'privacy-radio-label-text'
        labelText.textContent = opt.label
        text.appendChild(labelText)
        const descText = document.createElement('span')
        descText.className = 'privacy-radio-desc'
        descText.textContent = opt.desc
        text.appendChild(descText)
        row.appendChild(text)
        visGroup.appendChild(row)
      }
      visSection.appendChild(visGroup)
      content.appendChild(visSection)

      // ── Review attribution ──
      const attrSection = document.createElement('section')
      attrSection.className = 'privacy-section'

      const attrTitle = document.createElement('h2')
      attrTitle.className = 'privacy-section-title'
      attrTitle.textContent = 'Review Attribution'
      attrSection.appendChild(attrTitle)

      const attrDesc = document.createElement('p')
      attrDesc.className = 'privacy-section-desc'
      attrDesc.textContent = 'How should your name appear on reviews you write?'
      attrSection.appendChild(attrDesc)

      const attrGroup = document.createElement('div')
      attrGroup.className = 'privacy-radio-group'

      const attrOptions: Array<{
        value: PrivacySettings['reviewAttributionDefault']
        label: string
        desc: string
      }> = [
        { value: 'anonymous', label: 'Anonymous', desc: 'Reviews show as "anonymous"' },
        { value: 'named', label: 'Use my name', desc: 'Reviews display your display name' },
      ]

      for (const opt of attrOptions) {
        const row = document.createElement('label')
        row.className = 'privacy-radio-option'
        const radio = document.createElement('input')
        radio.type = 'radio'
        radio.name = 'review-attribution'
        radio.value = opt.value
        radio.checked = settings.reviewAttributionDefault === opt.value
        radio.setAttribute('data-privacy', 'review-attribution')
        radio.addEventListener('change', () => {
          if (radio.checked) void autoSave({ reviewAttributionDefault: opt.value })
        })
        row.appendChild(radio)
        const text = document.createElement('div')
        text.className = 'privacy-radio-text'
        const labelText = document.createElement('span')
        labelText.className = 'privacy-radio-label-text'
        labelText.textContent = opt.label
        text.appendChild(labelText)
        const descText = document.createElement('span')
        descText.className = 'privacy-radio-desc'
        descText.textContent = opt.desc
        text.appendChild(descText)
        row.appendChild(text)
        attrGroup.appendChild(row)
      }
      attrSection.appendChild(attrGroup)
      content.appendChild(attrSection)

      // ── Data retention ──
      const retSection = document.createElement('section')
      retSection.className = 'privacy-section'

      const retTitle = document.createElement('h2')
      retTitle.className = 'privacy-section-title'
      retTitle.textContent = 'Data Retention'
      retSection.appendChild(retTitle)

      const retRow = document.createElement('div')
      retRow.className = 'privacy-retention'
      retRow.textContent = 'Presence data is automatically deleted after '
      const retValue = document.createElement('span')
      retValue.className = 'privacy-retention-value'
      retValue.textContent = `${settings.dataRetentionDays} day${settings.dataRetentionDays === 1 ? '' : 's'}`
      retRow.appendChild(retValue)
      retSection.appendChild(retRow)
      content.appendChild(retSection)

      // ── Reassurance ──
      const reassurance = document.createElement('div')
      reassurance.className = 'privacy-reassurance'
      reassurance.textContent = 'Your data is never sold or used for targeting.'
      const strongEl = document.createElement('strong')
      strongEl.textContent = ''
      reassurance.appendChild(strongEl)
      content.appendChild(reassurance)
    }

    void load()

    cleanup = () => {
      destroyed = true
      if (saveTimer) clearTimeout(saveTimer)
    }
  },

  unmount() {
    if (cleanup) cleanup()
  },
}

let cleanup: (() => void) | null = null
