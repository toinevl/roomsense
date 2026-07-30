# Topbar Nav Reorg + Admin Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the student app's 10-item flat topbar nav into feature links + Reports/About dropdowns + an Admin link, add a proper mobile hamburger collapse, and use the correct W3C WAI-ARIA APG Disclosure pattern throughout.

**Architecture:** One small, pure, unit-tested module (`navDisclosures.ts`) implements the generic open/close/Escape/outside-click mechanics once; it is reused for both desktop dropdowns and the mobile hamburger panel (same mechanic, different "what does open mean" — hide/show an element vs. toggle a CSS class). `main.ts` wires it up and extends its existing active-route loop; `main.css` gets new dropdown/hamburger styles and a rewrite of the existing (inadequate) 760px mobile block.

**Tech Stack:** TypeScript, Vite, vitest (jsdom), Playwright. No new dependencies.

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-07-30-topbar-nav-reorg-design.md`.
- Wishlist item: #59 in `wishlist.md` — mark sub-items `[x]` as completed, reference commit SHAs, mark the parent `[x]` only when the whole feature is done and browser-verified.
- No `role="menu"`/`menuitem`/`aria-haspopup` anywhere in this feature — the W3C WAI-ARIA APG Disclosure Navigation Menu pattern is plain buttons + `aria-expanded`/`aria-controls` + ordinary links.
- Reuse the existing `760px` breakpoint (`frontend/src/styles/main.css`) for the mobile collapse — don't introduce a new breakpoint value.
- Follow existing lib conventions: pure logic in `frontend/src/lib/*.ts` with a co-located `*.test.ts` (see `readingDeltas.ts`/`readingDeltas.test.ts`).
- Commit with `git add <explicit paths>` — never `git add -A` (CLAUDE.md lane rule).
- Every commit message references `#59`.

---

### Task 1: Generic disclosure-toggle module

**Files:**
- Create: `frontend/src/lib/navDisclosures.ts`
- Test: `frontend/src/lib/navDisclosures.test.ts`

**Interfaces:**
- Produces: `initDisclosure(button: HTMLButtonElement, panel: HTMLElement, options?: { openClass?: string }): { close(): void; isOpen(): boolean }` — Task 2 and Task 3 both call this directly.

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/lib/navDisclosures.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { initDisclosure } from './navDisclosures'

function buildHiddenAttrFixture() {
  const button = document.createElement('button')
  const panel = document.createElement('ul')
  panel.hidden = true
  const link = document.createElement('a')
  link.href = '#target'
  panel.appendChild(link)
  document.body.appendChild(button)
  document.body.appendChild(panel)
  return { button, panel, link }
}

describe('initDisclosure (hidden-attribute mode)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('starts closed and opens on button click', () => {
    const { button, panel } = buildHiddenAttrFixture()
    const handle = initDisclosure(button, panel)

    expect(handle.isOpen()).toBe(false)
    expect(panel.hidden).toBe(true)
    expect(button.getAttribute('aria-expanded')).toBe('false')

    button.click()

    expect(handle.isOpen()).toBe(true)
    expect(panel.hidden).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('toggles closed again on a second button click', () => {
    const { button, panel } = buildHiddenAttrFixture()
    initDisclosure(button, panel)

    button.click()
    button.click()

    expect(panel.hidden).toBe(true)
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes on Escape and returns focus to the button', () => {
    const { button, panel } = buildHiddenAttrFixture()
    initDisclosure(button, panel)
    button.click()
    expect(panel.hidden).toBe(false)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(panel.hidden).toBe(true)
    expect(document.activeElement).toBe(button)
  })

  it('closes when a click happens outside the button and panel', () => {
    const { button, panel } = buildHiddenAttrFixture()
    initDisclosure(button, panel)
    button.click()
    expect(panel.hidden).toBe(false)

    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(panel.hidden).toBe(true)
  })

  it('closes when a link inside the panel is clicked', () => {
    const { button, panel, link } = buildHiddenAttrFixture()
    initDisclosure(button, panel)
    button.click()
    expect(panel.hidden).toBe(false)

    link.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(panel.hidden).toBe(true)
  })
})

describe('initDisclosure (openClass mode)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('toggles a CSS class instead of the hidden attribute, and never touches hidden', () => {
    const button = document.createElement('button')
    const panel = document.createElement('nav')
    document.body.appendChild(button)
    document.body.appendChild(panel)
    const handle = initDisclosure(button, panel, { openClass: 'nav-open' })

    expect(handle.isOpen()).toBe(false)
    expect(panel.classList.contains('nav-open')).toBe(false)
    expect(panel.hidden).toBe(false)

    button.click()

    expect(handle.isOpen()).toBe(true)
    expect(panel.classList.contains('nav-open')).toBe(true)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(panel.hidden).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm exec vitest run src/lib/navDisclosures.test.ts`
Expected: FAIL — `Cannot find module './navDisclosures'` (file doesn't exist yet)

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/lib/navDisclosures.ts

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm exec vitest run src/lib/navDisclosures.test.ts`
Expected: PASS — 6 tests (5 in hidden-attribute mode describe block, 1 in openClass mode)

- [ ] **Step 5: Run typecheck**

Run: `cd frontend && pnpm typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/navDisclosures.ts frontend/src/lib/navDisclosures.test.ts
git commit -m "feat(#59): add generic disclosure-toggle module for nav dropdowns/hamburger"
```

---

### Task 2: Desktop dropdown markup, wiring, and styling

**Files:**
- Modify: `frontend/index.html:39-51` (the `<nav class="primary-nav">` block)
- Modify: `frontend/src/main.ts:1` (import), `frontend/src/main.ts:33-35` (add disclosure init block after `navLinks`), `frontend/src/main.ts:62-66` (extend the active-route loop)
- Modify: `frontend/src/styles/main.css:153` (insert new rules after `.primary-nav a.active`)

**Interfaces:**
- Consumes: `initDisclosure` from `frontend/src/lib/navDisclosures.ts` (Task 1) — exact signature `initDisclosure(button, panel, options?)`.
- Produces: DOM ids `nav-reports-toggle`, `nav-reports-menu`, `nav-about-toggle`, `nav-about-menu` that Task 4's e2e tests target directly.

- [ ] **Step 1: Restructure the nav markup in `frontend/index.html`**

Replace the existing block (lines 39-51):

```html
      <nav class="primary-nav" aria-label="Primary">
        <a href="#dashboard" data-route="dashboard">Dashboard</a>
        <a href="#live" data-route="live">Live</a>
        <a href="#architecture" data-route="architecture">Architecture</a>
        <a href="#finder" data-route="finder">Find a Room</a>
        <a href="#report" data-route="report">Semester Report</a>
        <a href="#wrapped" data-route="wrapped">Wrapped</a>
        <a href="#trust" data-route="trust">Trust</a>
        <a href="#friends" data-route="friends">Friends</a>
        <a href="#reviews" data-route="reviews">Reviews</a>
        <a href="#privacy" data-route="privacy">Privacy</a>
      </nav>
```

with:

```html
      <button
        type="button"
        id="nav-hamburger"
        class="nav-hamburger"
        aria-expanded="false"
        aria-controls="primary-nav"
        aria-label="Menu"
      >
        <span class="nav-hamburger-bar"></span>
        <span class="nav-hamburger-bar"></span>
        <span class="nav-hamburger-bar"></span>
      </button>
      <nav class="primary-nav" id="primary-nav" aria-label="Primary">
        <a href="#dashboard" data-route="dashboard">Dashboard</a>
        <a href="#live" data-route="live">Live</a>
        <a href="#finder" data-route="finder">Find a Room</a>
        <a href="#friends" data-route="friends">Friends</a>
        <a href="#reviews" data-route="reviews">Reviews</a>
        <a href="#privacy" data-route="privacy">Privacy</a>

        <div class="nav-dropdown">
          <button
            type="button"
            class="nav-dropdown-toggle"
            id="nav-reports-toggle"
            aria-expanded="false"
            aria-controls="nav-reports-menu"
          >Reports</button>
          <ul class="nav-dropdown-menu" id="nav-reports-menu" hidden>
            <li><a href="#report" data-route="report">Semester Report</a></li>
            <li><a href="#wrapped" data-route="wrapped">Wrapped</a></li>
          </ul>
        </div>

        <div class="nav-dropdown">
          <button
            type="button"
            class="nav-dropdown-toggle"
            id="nav-about-toggle"
            aria-expanded="false"
            aria-controls="nav-about-menu"
          >About</button>
          <ul class="nav-dropdown-menu" id="nav-about-menu" hidden>
            <li><a href="#architecture" data-route="architecture">Architecture</a></li>
            <li><a href="#trust" data-route="trust">Trust</a></li>
          </ul>
        </div>

        <a class="nav-admin-link" href="/admin/index.html">Admin<span class="nav-external-icon" aria-hidden="true">↗</span></a>
      </nav>
```

- [ ] **Step 2: Wire up the disclosures in `frontend/src/main.ts`**

Add this import at the top (after the existing `import './styles/main.css'` on line 1):

```typescript
import { initDisclosure } from './lib/navDisclosures'
```

Add this block immediately after the existing `navLinks` declaration and orphaned-route guard (after line 47, before `let activePage: Page | null = null` on line 49):

```typescript
// ---------------------------------------------------------------------------
// Nav dropdowns + mobile hamburger (#59) — see frontend/src/lib/navDisclosures.ts
// ---------------------------------------------------------------------------
const reportsToggle = document.getElementById('nav-reports-toggle') as HTMLButtonElement
const reportsMenu = document.getElementById('nav-reports-menu') as HTMLElement
const aboutToggle = document.getElementById('nav-about-toggle') as HTMLButtonElement
const aboutMenu = document.getElementById('nav-about-menu') as HTMLElement
const navHamburger = document.getElementById('nav-hamburger') as HTMLButtonElement
const primaryNav = document.getElementById('primary-nav') as HTMLElement

initDisclosure(reportsToggle, reportsMenu)
initDisclosure(aboutToggle, aboutMenu)
initDisclosure(navHamburger, primaryNav, { openClass: 'nav-open' })
```

Replace the existing active-route loop inside `render()` (currently lines 63-65):

```typescript
  for (const link of navLinks) {
    link.classList.toggle('active', link.dataset.route === routeKey)
  }
```

with:

```typescript
  for (const link of navLinks) {
    const isActive = link.dataset.route === routeKey
    link.classList.toggle('active', isActive)
    if (isActive) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  }
  document.querySelectorAll<HTMLElement>('.nav-dropdown').forEach((dropdown) => {
    const toggle = dropdown.querySelector<HTMLButtonElement>('.nav-dropdown-toggle')
    toggle?.classList.toggle('active', dropdown.querySelector('a.active') !== null)
  })
```

Note: `navLinks` (line 34, `document.querySelectorAll<HTMLAnchorElement>('.primary-nav a')`) needs NO changes — it already finds every `<a>` descendant of `.primary-nav` regardless of dropdown nesting. The dev-mode orphaned-route guard (lines 36-47) also needs no changes for the same reason.

- [ ] **Step 3: Add dropdown/admin-link/hamburger CSS to `frontend/src/styles/main.css`**

Insert immediately after the existing line `.primary-nav a.active { color: var(--text-primary); background: var(--surface-card); box-shadow: inset 0 -2px 0 var(--brand); }` (line 153):

```css

.nav-dropdown { position: relative; }
.nav-dropdown-toggle {
  font-family: var(--font-display); font-size: 0.86rem; font-weight: 600;
  color: var(--text-secondary); background: transparent; border: none;
  padding: 0.5rem 0.75rem; border-radius: var(--radius-sm);
  cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;
  transition: color 0.15s, background 0.15s;
}
.nav-dropdown-toggle:hover { color: var(--text-primary); background: var(--surface-card); }
.nav-dropdown-toggle.active { color: var(--text-primary); background: var(--surface-card); box-shadow: inset 0 -2px 0 var(--brand); }
.nav-dropdown-toggle::after {
  content: ''; width: 6px; height: 6px; flex: none; margin-top: -3px;
  border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg); transition: transform 0.15s;
}
.nav-dropdown-toggle[aria-expanded="true"]::after { transform: rotate(225deg); margin-top: 3px; }

.nav-dropdown-menu {
  list-style: none; margin: 0; padding: 0.4rem;
  position: absolute; top: calc(100% + 4px); left: 0; min-width: 160px;
  background: var(--surface-card-2); border: 1px solid var(--border-strong);
  border-radius: var(--radius); box-shadow: var(--shadow-card);
  z-index: 110;
}
.nav-dropdown-menu a {
  display: block; font-family: var(--font-display); font-size: 0.86rem; font-weight: 600;
  color: var(--text-secondary); text-decoration: none;
  padding: 0.5rem 0.7rem; border-radius: var(--radius-sm);
}
.nav-dropdown-menu a:hover { color: var(--text-primary); background: var(--surface-card); }
.nav-dropdown-menu a.active { color: var(--text-primary); background: var(--surface-card); }

.nav-admin-link {
  font-family: var(--font-display); font-size: 0.86rem; font-weight: 600;
  color: var(--text-secondary); text-decoration: none;
  padding: 0.5rem 0.75rem; border-radius: var(--radius-sm);
  transition: color 0.15s, background 0.15s;
}
.nav-admin-link:hover { color: var(--text-primary); background: var(--surface-card); }
.nav-external-icon { margin-left: 0.2rem; font-size: 0.8em; }

.nav-hamburger {
  display: none; flex-direction: column; justify-content: center; gap: 4px;
  width: 34px; height: 34px; background: transparent; border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm); cursor: pointer; flex: none;
}
.nav-hamburger-bar { width: 16px; height: 2px; background: var(--text-primary); margin: 0 auto; }
```

- [ ] **Step 4: Run typecheck and unit tests**

Run: `cd frontend && pnpm typecheck && pnpm test`
Expected: typecheck clean; all existing unit tests still pass (no unit tests reference `.primary-nav` structure directly, so none should break)

- [ ] **Step 5: Manual browser check (desktop)**

Run: `cd frontend && pnpm dev` and open `http://localhost:5173/#dashboard` in a browser at a normal desktop width.
Verify: Reports and About buttons show a caret, clicking opens/closes their dropdown, clicking a link inside navigates and closes the dropdown, Escape closes an open dropdown, the Admin link is present with an "↗" and points at `/admin/index.html`.

- [ ] **Step 6: Commit**

```bash
git add frontend/index.html frontend/src/main.ts frontend/src/styles/main.css
git commit -m "feat(#59): group Reports/About nav dropdowns, add Admin link"
```

---

### Task 3: Mobile hamburger collapse

**Files:**
- Modify: `frontend/src/styles/main.css:492-497` (rewrite the existing `760px` block)

**Interfaces:**
- Consumes: `.nav-hamburger` / `#primary-nav` / `.nav-open` class already wired by Task 2's `initDisclosure(navHamburger, primaryNav, { openClass: 'nav-open' })` call — this task is CSS-only, no new JS.

- [ ] **Step 1: Rewrite the mobile breakpoint block**

Replace (current lines 492-497):

```css
@media (max-width: 760px) {
  .topbar { flex-wrap: wrap; gap: 0.75rem; }
  .primary-nav { order: 3; width: 100%; }
  .heatmap-grid { min-width: 420px; }
  .report-metrics { grid-template-columns: 1fr; }
}
```

with:

```css
@media (max-width: 760px) {
  .topbar { flex-wrap: wrap; gap: 0.75rem; }
  .nav-hamburger { display: flex; }
  .primary-nav {
    display: none; order: 3; width: 100%;
    flex-direction: column; align-items: stretch; gap: 0.15rem;
  }
  .primary-nav.nav-open { display: flex; }
  .nav-dropdown { position: static; }
  .nav-dropdown-menu {
    position: static; box-shadow: none; border: none;
    background: transparent; padding: 0 0 0.4rem 0.75rem;
  }
  .heatmap-grid { min-width: 420px; }
  .report-metrics { grid-template-columns: 1fr; }
}
```

This makes `.primary-nav` hidden by default below 760px (only the hamburger shows), visible when `initDisclosure`'s `openClass: 'nav-open'` toggle adds `.nav-open`, and flattens the dropdown submenus from floating absolute-positioned panels into an inline nested list (so they read as a simple accordion inside the mobile panel instead of floating over page content).

- [ ] **Step 2: Manual browser check (mobile)**

Run: `cd frontend && pnpm dev`, open the dev server, resize the browser (or use device emulation) to 390×844.
Verify: nav links are hidden, only the hamburger button shows; clicking the hamburger reveals the full nav stacked vertically including Reports/About as inline nested lists and the Admin link at the bottom; clicking any link navigates and the panel state doesn't visually break; resizing back to desktop width shows the normal flat+dropdown layout again.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/main.css
git commit -m "feat(#59): replace flex-wrap mobile nav reflow with hamburger collapse"
```

---

### Task 4: e2e coverage for the new nav

**Files:**
- Modify: `frontend/e2e/smoke.spec.ts` (add new tests; no existing tests need changes — the one existing nav test only clicks the still-flat "Live" link)

**Interfaces:**
- Consumes: DOM ids from Task 2 (`nav-reports-toggle`, `nav-reports-menu`, `nav-about-toggle`, `nav-about-menu`, `nav-hamburger`, `primary-nav`) and the `.active` class behavior from Task 2's `render()` extension.

- [ ] **Step 1: Add the new tests**

Add to `frontend/e2e/smoke.spec.ts` (inside the existing `test.describe('RoomSense smoke (mock mode)', ...)` block, after the existing `'hash navigation switches the active nav link'` test):

```typescript
  test('Reports dropdown opens, navigates, and shows active state on the trigger (#59)', async ({ page }) => {
    await page.goto('/#dashboard')
    const reportsToggle = page.getByRole('button', { name: 'Reports' })
    await reportsToggle.click()
    await expect(page.locator('#nav-reports-menu')).toBeVisible()

    await page.getByRole('link', { name: 'Semester Report' }).click()
    await expect(page).toHaveURL(/#report$/)
    await expect(page.locator('#nav-reports-menu')).toBeHidden()
    await expect(reportsToggle).toHaveClass(/active/)
  })

  test('About dropdown opens and navigates to Trust (#59)', async ({ page }) => {
    await page.goto('/#dashboard')
    await page.getByRole('button', { name: 'About' }).click()
    await expect(page.locator('#nav-about-menu')).toBeVisible()
    await page.getByRole('link', { name: 'Trust' }).click()
    await expect(page).toHaveURL(/#trust$/)
  })

  test('Admin link points to the admin console (#59)', async ({ page }) => {
    await page.goto('/#dashboard')
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin/index.html')
  })

  test('mobile hamburger opens the nav and navigates (#59)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#dashboard')
    await expect(page.locator('#primary-nav')).toBeHidden()

    await page.getByRole('button', { name: 'Menu' }).click()
    await expect(page.locator('#primary-nav')).toBeVisible()

    await page.getByRole('link', { name: 'Live' }).click()
    await expect(page).toHaveURL(/#live$/)
  })
```

- [ ] **Step 2: Run the e2e suite**

Run: `cd frontend && pnpm test:e2e`
Expected: all tests pass, including the 4 new ones and the pre-existing `'hash navigation switches the active nav link'` test (unaffected, since "Live" is still a flat link)

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/smoke.spec.ts
git commit -m "test(#59): e2e coverage for nav dropdowns, admin link, mobile hamburger"
```

---

### Task 5: Final verification and wishlist close-out

**Files:**
- Modify: `wishlist.md` (mark #59's sub-items and parent item `[x]`)

- [ ] **Step 1: Run the full check suite**

Run: `cd frontend && pnpm typecheck && pnpm test && pnpm test:e2e`
Expected: everything green, no regressions anywhere (not just the new tests)

- [ ] **Step 2: Full manual browser pass**

Using a real browser (or Playwright MCP), verify at both 1440×900 and 390×844:
- Every one of the 10 original routes is still reachable (6 flat links + 2 in Reports + 2 in About)
- Admin link navigates to `/admin/index.html` and the admin app still renders correctly
- No new console errors on any page
- Dropdown/hamburger open-close, Escape-close, and outside-click-close all work as designed

- [ ] **Step 3: Mark wishlist #59 complete**

Edit `wishlist.md`: change every `- [ ]` sub-item under #59 to `- [x]` with the relevant commit SHA, and change the parent line from `- [ ] (C) topbar nav reorg...— in progress 2026-07-30` to `- [x] (C) topbar nav reorg...— done 2026-07-30`, plus a short verification note (test counts, viewports checked).

- [ ] **Step 4: Commit**

```bash
git add wishlist.md
git commit -m "chore(#59): mark topbar nav reorg complete"
```
