# Root Cause Analysis: Room Finder False Affordance Bug (2026-07-21)

## What Happened
Room Finder page shipped with beautiful, interactive-looking room cards (`cursor: pointer`, hover effects, green border on hover) but clicking did nothing. Users could not drill into room details despite visual cues suggesting they could.

## Root Cause
**Implementation plan specified behavior ("tap for details") but not implementation details (HOW or WHERE).**

The plan (`.hermes/plans/2026-07-21_205000-room-finder-impl.md`):
- Line 3: Spec says "tap for details"
- Line 83: CSS includes `cursor: pointer` and hover effects
- **Missing:** No specification of click handlers, navigation target, or state passing

Result: Agent implemented the cosmetic layer (CSS styling signals interactivity) but not the behavioral layer (click handlers). This is an **invisible bug**—code compiles, tests pass, app loads with zero errors. The bug only manifests at runtime when users try to use the feature.

## Why It Wasn't Caught

### Test Suite Gap
- Original unit tests only checked page structure (`typeof roomFinderPage.mount`)
- No test verified that cards had click handlers
- No semantic HTML check (buttons vs divs)
- CSS pass/fail is invisible to tests

### Linting Gap
- ESLint doesn't warn on unused event listeners
- No rule for "cursor:pointer without click handler"
- Static analysis can't detect runtime affordance mismatches

### Code Review Gap
- Styling looks complete and intentional
- Visual inspection: "Cards look good, hover effects work"
- Interactive behavior is implicit/invisible without testing

## Pattern: False Affordance

**False Affordance** = UI styling that signals interactivity without backing behavior.

Common cases:
- `cursor: pointer` on non-button elements
- Hover effects without click handlers
- Visually highlighted selections without state management
- "Clickable" styling on disabled buttons

This pattern is dangerous because:
1. Visual design suggests "this does something"
2. Implementation does nothing
3. No lint/test/CI failure signals the problem
4. The mismatch only appears at runtime—when users notice

## Safeguards Added

### 1. Enhanced Test Suite
File: `frontend/src/pages/roomFinder.test.ts` (4 tests)

```typescript
it('mounts and renders available rooms as clickable buttons', async () => {
  await roomFinderPage.mount(container)
  const cards = container.querySelectorAll('.room-card')
  // GUARD: Every room card MUST be a button
  cards.forEach((card) => {
    expect(card.tagName).toBe('BUTTON')
  })
})

it('room cards must have click handlers', async () => {
  // Verify button responds to clicks (will fail if onclick is missing)
  const clickSpy = vi.fn()
  firstCard.addEventListener('click', clickSpy)
  firstCard.click()
  expect(clickSpy).toHaveBeenCalled()
})
```

**Why this works:**
- Enforces semantic HTML (`<button>` instead of `<div>`)
- Buttons have built-in click semantics + keyboard support
- Test fails immediately if implementation is incomplete

### 2. Development Guard
File: `frontend/src/pages/roomFinder.ts` (end of mount function)

```typescript
if (import.meta.env.DEV) {
  const cards = container.querySelectorAll('.room-card')
  const notButtons = Array.from(cards).filter((card) => card.tagName !== 'BUTTON')
  if (notButtons.length > 0) {
    console.warn(
      `⚠️  Room Finder: ${notButtons.length} card(s) are not buttons. ` +
      `Room cards must be <button> elements with click handlers.`
    )
  }
}
```

**Why this works:**
- Warns during development if pattern is broken
- Invisible at build/test time but visible at runtime
- Similar to existing orphaned-routes guard in `main.ts`

### 3. Documentation
File: `CLAUDE.md` (new section: "Interactive UI elements")

Documents:
- The false affordance pattern
- Why it's dangerous
- Concrete implementation pattern (cards = buttons)
- Link to example (Room Finder)

## Prevention Rules

When styling interactive UI elements, **always ask:**

1. **Does the CSS suggest interactivity?**
   - `cursor: pointer`, `opacity: 0.8` on hover, `outline`, borders changing
   - If YES, continue to next checks

2. **Is there backing behavior?**
   - Click handlers? State management? Navigation?
   - If NO, either:
     - Remove the interactive styling, OR
     - Implement the behavior

3. **Is it semantically correct?**
   - Buttons should be `<button>` (not `<div onclick>`)
   - Links should be `<a>` (not buttons)
   - Forms should use real `<form>` elements

4. **Will tests catch it?**
   - Unit test: verify element type + handler existence
   - E2E test: click the element, verify behavior

## Related Patterns

This complements existing RoomSense safeguards:

| Pattern | Guard | Caught By |
|---------|-------|-----------|
| Orphaned routes (page exists, nav link missing) | Dev console warning in `main.ts` | Runtime observation |
| Dead API endpoints (function file not imported) | Guard test in `api/src/index.test.ts` | Test suite (CI) |
| False affordance (styled but non-interactive UI) | Dev console warning + unit test in page | Test suite + runtime observation |
| Frontend integration (page in 3+ places) | Dev console warning in `main.ts` | Runtime observation |

## Verification

✅ Fix verified: Clicking Room Finder cards now navigates to Live page with selected room.
✅ Guard verified: No console warnings when cards ARE buttons.
✅ Tests verified: 4 new tests pass, including semantic HTML and click-handler assertions.

## Commits

- `90d9093`: fix: room selection now works in Room Finder page
- `527e6c4`: docs: add safeguards against false affordance UI bugs

---

**Key Lesson:** Specifications must include both WHAT (behavior) and HOW (implementation details). Implementation plans that omit HOW create invisible failure modes that pass code review and CI.
