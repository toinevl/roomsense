/**
 * Generic W3C WAI-ARIA APG "Disclosure" pattern for site navigation:
 * https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/
 *
 * Deliberately does NOT use role="menu"/menuitem or aria-haspopup — those require
 * keyboard-menu semantics (roving focus, first-character nav) meant for app-style
 * menus, not a plain list of nav links. A button toggling aria-expanded + a hidden
 * list of ordinary links is the correct, simpler pattern here.
 */

export interface DisclosureHandle {
  close(): void
  isOpen(): boolean
}

export interface DisclosureOptions {
  /**
   * When set, open/closed state toggles this class on `panel` instead of the
   * `hidden` attribute. Use for a panel that must stay visible outside some
   * viewport range (e.g. the primary nav, always shown on desktop, collapsible
   * behind a hamburger on mobile). Omit for a panel that should be hidden on
   * every viewport when closed (e.g. a dropdown submenu).
   */
  openClass?: string
}

export function initDisclosure(
  button: HTMLButtonElement,
  panel: HTMLElement,
  options: DisclosureOptions = {}
): DisclosureHandle {
  const { openClass } = options

  function isOpen(): boolean {
    return openClass ? panel.classList.contains(openClass) : !panel.hidden
  }

  function setOpen(next: boolean): void {
    if (openClass) {
      panel.classList.toggle(openClass, next)
    } else {
      panel.hidden = !next
    }
    button.setAttribute('aria-expanded', String(next))
  }

  function close(): void {
    if (isOpen()) setOpen(false)
  }

  function toggle(): void {
    setOpen(!isOpen())
  }

  function onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node
    if (!button.contains(target) && !panel.contains(target)) close()
  }

  function onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && isOpen()) {
      close()
      button.focus()
    }
  }

  function onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null
    if (next && (button.contains(next) || panel.contains(next))) return
    close()
  }

  function onPanelClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('a')) close()
  }

  setOpen(isOpen()) // sync aria-expanded to whatever the markup already says
  button.addEventListener('click', toggle)
  panel.addEventListener('click', onPanelClick)
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
  button.addEventListener('focusout', onFocusOut)
  panel.addEventListener('focusout', onFocusOut)

  return { close, isOpen }
}
