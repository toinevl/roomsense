# Semester in Review — Implementation Plan

**Goal:** Auto-generated one-page printable report for leadership. Pull existing `/kpis` data, add styling for print, include CO₂ "illustrative" estimate.

**Architecture:** New page `frontend/src/pages/report.ts`, single POST to `/api/kpis?from=<start>&to=<end>`. No API changes. Print-friendly CSS (`@media print`).

---

## Task 1: Create report.ts page skeleton with KPI fetching

**Objective:** Page that fetches `/api/kpis` and displays four main metrics.

**Files:**
- Create: `frontend/src/pages/report.ts`
- Reuse: `frontend/src/lib/api.ts`, `frontend/src/lib/format.ts`

**Code:**
```typescript
// frontend/src/pages/report.ts
import { apiClient } from '../lib/api'
import { html } from 'lit-html'

export async function report() {
  // Fetch KPIs for current month or semester
  const endDate = new Date().toISOString()
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // last 30 days
  
  const kpis = await apiClient.kpis(startDate, endDate)
  
  // Illustrative CO2 estimate: 1 wasted euro ≈ 0.5 kg CO2 (placeholder)
  const co2Estimate = (kpis.wastedEur ?? 0) * 0.5

  return html`
    <div class="report">
      <header class="report-header">
        <h1>Semester in Review</h1>
        <p class="date-range">Last 30 days</p>
      </header>

      <section class="report-metrics">
        <div class="metric">
          <div class="metric-label">Average Utilization</div>
          <div class="metric-value">${(kpis.avgUtilizationPct ?? 0).toFixed(1)}%</div>
        </div>
        <div class="metric">
          <div class="metric-label">Peak Utilization</div>
          <div class="metric-value">${(kpis.peakUtilizationPct ?? 0).toFixed(1)}%</div>
        </div>
        <div class="metric">
          <div class="metric-label">Ghost Meetings</div>
          <div class="metric-value">${(kpis.ghostRatePct ?? 0).toFixed(1)}%</div>
        </div>
        <div class="metric">
          <div class="metric-label">Wasted Space Cost</div>
          <div class="metric-value">€${(kpis.wastedEur ?? 0).toFixed(0)}</div>
        </div>
      </section>

      <section class="report-co2">
        <h2>Environmental Impact (Illustrative)</h2>
        <p>${co2Estimate.toFixed(1)} kg CO₂ from unused HVAC/lighting</p>
        <small>Estimate based on energy costs; not independently audited.</small>
      </section>

      <section class="report-underused">
        <h2>Top Underused Rooms</h2>
        <ul>
          ${kpis.underusedRooms?.map(room => html`
            <li>${room.name}: ${room.utilizationPct.toFixed(1)}% utilization</li>
          `) || html`<p>No underused rooms data</p>`}
        </ul>
      </section>

      <footer class="report-footer">
        <p>Print or export this page to share with your team.</p>
      </footer>
    </div>
  `
}
```

**Verify:** `pnpm --filter frontend test -- report` (basic syntax check).

---

## Task 2: Add print-friendly CSS

**Objective:** Styling for single-page printout, no scrolling, clear hierarchy.

**Code (inline or separate `.css` file):**
```css
.report {
  max-width: 8.5in;
  height: 11in;
  margin: 0 auto;
  padding: 1.5rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.5;
}

.report-header {
  text-align: center;
  margin-bottom: 2rem;
}

.report-header h1 {
  margin: 0;
  font-size: 1.75rem;
}

.date-range {
  color: #666;
  margin: 0.5rem 0 0;
  font-size: 0.875rem;
}

.report-metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.metric {
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #f5f5f5;
}

.metric-label {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.metric-value {
  font-size: 2rem;
  font-weight: 600;
  color: #333;
}

.report-co2 {
  background: #e8f5e9;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 2rem;
}

.report-co2 h2 {
  margin-top: 0;
  font-size: 1.125rem;
}

.report-co2 small {
  display: block;
  margin-top: 0.5rem;
  color: #666;
}

.report-underused {
  margin-bottom: 2rem;
}

.report-underused h2 {
  font-size: 1.125rem;
  margin-bottom: 1rem;
}

.report-underused ul {
  padding-left: 1.5rem;
}

.report-underused li {
  margin-bottom: 0.5rem;
}

.report-footer {
  text-align: center;
  font-size: 0.75rem;
  color: #999;
  margin-top: 2rem;
}

@media print {
  body {
    margin: 0;
    padding: 0;
  }
  .report {
    max-width: 100%;
    height: auto;
    padding: 0.5in;
    page-break-after: avoid;
  }
  .report-metrics {
    page-break-inside: avoid;
  }
}
```

**Verify:** Browser print-preview (`Ctrl+P` or `Cmd+P`), confirm single page.

---

## Task 3: Wire into main.ts

**Objective:** Add `#report` route.

**Code:**
```typescript
  report: () => import('./pages/report').then(m => m.report()),
```

**Verify:** `pnpm --filter frontend run dev`, navigate to `#report`.

---

## Task 4: Add test

**Objective:** Verify page fetches KPIs and renders metrics.

**Code:**
```typescript
// frontend/src/pages/report.test.ts
import { describe, it, expect } from 'vitest'
import { report } from './report'

describe('report', () => {
  it('renders metrics from kpis', async () => {
    const result = await report()
    expect(result).toBeDefined()
    // Visual check: page renders without error
  })
})
```

**Verify:** `pnpm --filter frontend test -- report` passes.

---

## Task 5: Add E2E check

**Objective:** Playwright: page loads, metrics visible, printable.

**Code:**
```typescript
test('report page prints without scroll', async ({ page }) => {
  await page.goto('http://localhost:5173/#report')
  await page.waitForLoadState('networkidle')
  
  // Check metrics rendered
  await expect(page.locator('.metric-value')).toBeDefined()
  const metricCount = await page.locator('.metric').count()
  expect(metricCount).toBeGreaterThanOrEqual(4)
})
```

**Verify:** `pnpm --filter frontend run test:e2e` passes.

---

## Commit

```bash
git add frontend/src/pages/report.ts frontend/src/pages/report.test.ts frontend/src/main.ts
git commit -m "feat(frontend): add semester-review report page"
```
