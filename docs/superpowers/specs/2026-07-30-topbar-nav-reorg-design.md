# Topbar navigation reorg + admin link — design

**Date:** 2026-07-30
**Status:** Approved, ready for implementation
**Wishlist:** #59

## Context

The student app's primary nav (`frontend/index.html`'s `<nav class="primary-nav">`) has
grown to 10 flat links as features were added over time: Dashboard, Live, Architecture,
Find a Room, Semester Report, Wrapped, Trust, Friends, Reviews, Privacy. These mix three
different kinds of pages with no visual distinction:

- **Features** a student actually uses: Dashboard, Live, Find a Room, Friends, Reviews, Privacy
- **Generated reports/shareables**, not daily-use: Semester Report, Wrapped
- **Documentation/explainer pages**, not features at all: Architecture ("How the data gets
  here"), Trust (privacy FAQ)

Toine also wants a link to the admin facility-manager console (`frontend/admin/`, added in
#57) from the student app. It was deliberately not linked when #57 shipped (admin's own
footer says "Internal tool, not linked from the student app") — this reverses that.

Separately, the existing mobile CSS (`@media (max-width: 760px)`) makes `.topbar` wrap and
gives `.primary-nav` its own full-width row, but that was written for 10 flat items — it
reflows into 2-3 messy rows rather than truly collapsing, and adding 2 dropdown triggers +
an Admin link on top makes it worse. Current responsive-nav practice (checked against
UXPin/dev.to 2025-2026 guides) is to collapse primary nav behind a hamburger/off-canvas
toggle below a breakpoint, not rely on flex-wrap reflow.

## Goals

1. Reorganize the 10 flat links into: 6 feature links (flat) + 2 grouped dropdowns
   (Reports, About) + 1 Admin link.
2. Add a visible link to `/admin/index.html` from the student app's topbar.
3. Replace the current mobile flex-wrap reflow with a proper hamburger/off-canvas collapse
   at the existing 760px breakpoint.
4. Use the correct, current W3C ARIA pattern for the dropdowns (not an app-menu pattern).

## Non-goals

- No changes to page content, routes, or hash URLs.
- No changes to the mode-toggle / presenter-toggle / status-dot controls on the topbar's
  right side.
- No changes to the admin app itself.

## Design

### Desktop (≥760px) nav structure

```
[Logo]  Dashboard  Live  Find a Room  Friends  Reviews  Privacy   Reports ▾   About ▾   Admin ↗
```

- Flat links: Dashboard, Live, Find a Room, Friends, Reviews, Privacy (unchanged `<a data-route>`
  markup and unchanged active-route highlighting logic in `main.ts`).
- **Reports ▾**: Semester Report, Wrapped.
- **About ▾**: Architecture, Trust.
- **Admin ↗**: plain `<a href="/admin/index.html">`, not a hash route (full navigation to a
  separate Vite entry/app) — styled with a small external-navigation glyph to signal it
  leaves the student SPA.

### Dropdown accessibility pattern

Per the W3C WAI-ARIA APG "Disclosure Navigation Menu" pattern
(https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/), site
navigation dropdowns should NOT use `role="menu"`/`menuitem` or `aria-haspopup` — those
require keyboard-menu semantics (arrow-key roving focus, first-character navigation) that
assistive tech expects from app-style menus and that add complexity with no benefit for a
plain list of links.

Instead, each dropdown is:
- A `<button type="button" aria-expanded="false" aria-controls="reports-menu">Reports</button>`
  wrapping a hidden `<ul id="reports-menu">` of ordinary `<a>` links.
- `aria-expanded` toggles true/false on click; CSS uses `[aria-expanded="true"]` attribute
  selectors to sync visual state (no separate JS-managed class needed for open/closed).
- Escape closes the open dropdown. Focus leaving the nav region also closes it (required
  for WCAG 2.1 SC 1.4.13, Content on Hover or Focus).
- The active link (if the current route is inside a dropdown) gets `aria-current="page"` in
  addition to the existing `.active` CSS class; the dropdown's own trigger button also gets
  the `.active` treatment so e.g. "About ▾" reads as active while on `#trust`.
- Existing `data-route` attributes on child links are unchanged, so `main.ts`'s current
  active-route detection continues to work for them without modification — it's extended
  only to also toggle the parent trigger's `.active` state.

### Mobile (<760px) collapse

Replaces the current `.topbar { flex-wrap: wrap }` / `.primary-nav { order: 3; width: 100% }`
rule (`main.css:492-497`), which was written for 10 flat items and reflows badly with the
new dropdown triggers + Admin link added on top.

- A hamburger `<button aria-expanded aria-controls="mobile-nav-panel">` replaces the
  visible flat nav below 760px.
- Toggling it reveals an in-flow vertical panel — the nav becomes a full-width vertical
  block in normal document flow directly under the topbar (not a sliding/overlay
  off-canvas panel) — containing the SAME nav content, restructured for vertical
  stacking: flat links first, then Reports and About render as nested disclosure
  sections (accordion) — this is literally the APG's own nested top-level-links example
  (https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation-hybrid/),
  applied one level deeper — then Admin at the bottom.
- Same Escape/focus-out-closes behavior as the desktop dropdowns.

## Files touched

- `frontend/index.html` — nav markup restructure: dropdown wrappers for Reports/About,
  hamburger button + off-canvas panel markup, Admin link.
- `frontend/src/main.ts` — dropdown/hamburger controller (toggle, `aria-expanded` sync,
  Escape + outside-click/focus-out close); extend existing active-route logic to also set
  `aria-current` and propagate `.active` to a dropdown's trigger button.
- `frontend/src/styles/main.css` — dropdown positioning/caret (attribute-selector driven),
  hamburger icon + off-canvas panel styles replacing the `760px` block's current nav rules,
  Admin link styling.
- `frontend/admin/index.html` — no changes (admin nav is out of scope; only 2 items, no
  reorg needed there).
- New unit tests for the dropdown/hamburger controller: open/close, Escape, outside-click,
  active-state propagation to trigger buttons — for both desktop dropdowns and the mobile
  hamburger panel.
- `frontend/e2e/*.spec.ts` — update the existing smoke spec for the new nav structure
  (open a dropdown → click a child link) and add a mobile-viewport case (open hamburger →
  navigate).

## Testing plan

- Unit tests (vitest): dropdown/hamburger controller behavior in isolation.
- e2e (Playwright): desktop dropdown open/click-through at a normal viewport; mobile
  hamburger open/click-through at a narrow viewport (e.g. 390px, matching prior mobile
  verification in this project).
- Manual/browser verification: screenshot both breakpoints before/after, confirm no
  console errors, confirm admin link navigates correctly, confirm all existing routes
  still reachable.
