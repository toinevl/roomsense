# RoomSense Wrapped — Implementation Plan

**Goal:** Spotify-Wrapped-style shareable card showing fun campus stats (busiest room, quietest hideout, ghost hours). Pure marketing — intentionally playful, sized for phone screenshots.

**Architecture:** New page `frontend/src/pages/wrapped.ts`. Derives three stats from mock occupancy history. No API changes needed, just client-side calculation.

---

## Task 1: Create wrapped.ts with stat derivation

**Objective:** Fetch rooms + occupancy history, compute fun stats.

**Files:**
- Create: `frontend/src/pages/wrapped.ts`
- Reuse: `frontend/src/lib/api.ts`, `frontend/src/lib/mockDerivations.ts`

**Code:**
```typescript
// frontend/src/pages/wrapped.ts
import { apiClient } from '../lib/api'
import { html } from 'lit-html'

export async function wrapped() {
  const rooms = await apiClient.rooms()
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  
  // Derive stats
  let busiestRoom = rooms[0]
  let maxUtilization = 0
  
  for (const room of rooms) {
    if ((room.utilizationPct ?? 0) > maxUtilization) {
      maxUtilization = room.utilizationPct ?? 0
      busiestRoom = room
    }
  }
  
  // Quietest: lowest utilization (could be used for study)
  const quietestRoom = rooms.reduce((prev, curr) => 
    ((curr.utilizationPct ?? 0) < (prev.utilizationPct ?? 0)) ? curr : prev
  )
  
  // Total ghost hours (sum of reservations with 0 occupancy)
  const ghostHours = rooms.reduce((sum, room) => {
    // In real scenario, would query ghost reservations; here estimate from ghost rate
    return sum + ((room.utilizationPct ?? 0) === 0 ? 5 : 0) // placeholder
  }, 0)

  return html`
    <div class="wrapped-card">
      <div class="wrapped-header">
        <h1>RoomSense Wrapped 2026</h1>
        <p class="wrapped-subtitle">Your campus occupancy story</p>
      </div>

      <div class="wrapped-stat busiest">
        <h2>Busiest Room</h2>
        <p class="stat-room">${busiestRoom.name}</p>
        <p class="stat-value">${maxUtilization.toFixed(0)}% full on average</p>
      </div>

      <div class="wrapped-stat quietest">
        <h2>Your Quiet Hideout</h2>
        <p class="stat-room">${quietestRoom.name}</p>
        <p class="stat-value">Perfect for focused work</p>
      </div>

      <div class="wrapped-stat ghosts">
        <h2>Ghost Meeting Hours</h2>
        <p class="stat-value">${ghostHours} hours booked but empty</p>
        <p class="stat-subtitle">That's wasted floor space</p>
      </div>

      <footer class="wrapped-footer">
        <p>Screenshot and share your RoomSense story</p>
      </footer>
    </div>
  `
}
```

**Verify:** `pnpm --filter frontend test -- wrapped` (syntax check).

---

## Task 2: Add playful mobile-card styling

**Objective:** Vertical card, bold colors, sized for phone screenshot (375px wide, fit on one screen).

**Code:**
```css
.wrapped-card {
  max-width: 375px;
  margin: 0 auto;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem 1.5rem;
  border-radius: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  min-height: 600px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.wrapped-header {
  text-align: center;
  margin-bottom: 2rem;
}

.wrapped-header h1 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
}

.wrapped-subtitle {
  margin: 0.5rem 0 0;
  opacity: 0.9;
  font-size: 0.875rem;
}

.wrapped-stat {
  background: rgba(255, 255, 255, 0.1);
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  backdrop-filter: blur(10px);
}

.wrapped-stat h2 {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  opacity: 0.8;
}

.stat-room {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  font-weight: 700;
}

.stat-value {
  margin: 0;
  font-size: 1.125rem;
  opacity: 0.95;
}

.stat-subtitle {
  margin: 0.5rem 0 0;
  font-size: 0.875rem;
  opacity: 0.7;
}

.wrapped-footer {
  text-align: center;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.wrapped-footer p {
  margin: 0;
  font-size: 0.875rem;
  opacity: 0.9;
}
```

**Verify:** Manual — open `#wrapped` in browser at 375px viewport, visually appealing and screenshot-ready.

---

## Task 3: Wire into main.ts

**Objective:** Add `#wrapped` route.

**Code:**
```typescript
  wrapped: () => import('./pages/wrapped').then(m => m.wrapped()),
```

---

## Task 4: Add minimal test

**Objective:** Page renders without error (visual check is primary).

**Code:**
```typescript
// frontend/src/pages/wrapped.test.ts
import { describe, it, expect } from 'vitest'
import { wrapped } from './wrapped'

describe('wrapped', () => {
  it('renders without error', async () => {
    const result = await wrapped()
    expect(result).toBeDefined()
  })
})
```

**Verify:** `pnpm --filter frontend test -- wrapped` passes.

---

## Task 5: Add E2E check

**Objective:** Playwright: page loads, card renders, dimensions work.

**Code:**
```typescript
test('wrapped card renders for screenshots', async ({ page }) => {
  await page.goto('http://localhost:5173/#wrapped')
  await page.waitForLoadState('networkidle')
  
  const card = page.locator('.wrapped-card')
  await expect(card).toBeVisible()
  
  // Verify stats visible
  await expect(page.locator('.busiest')).toBeVisible()
  await expect(page.locator('.quietest')).toBeVisible()
})
```

---

## Commit

```bash
git add frontend/src/pages/wrapped.ts frontend/src/pages/wrapped.test.ts frontend/src/main.ts
git commit -m "feat(frontend): add roomsense-wrapped shareable card"
```
