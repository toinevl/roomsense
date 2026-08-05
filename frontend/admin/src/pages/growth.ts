import type { Page } from '../../../src/pages/types'

/**
 * Phase 3c (#38) — ILLUSTRATIVE ONLY. This demo app has no real user
 * traffic to A/B test or measure; these are static sample numbers shown to
 * demonstrate what a real measurement panel would look like, not a claim
 * about actual usage. See spec's "Scope decisions" section.
 */

const SAMPLE_METRICS = [
  { label: 'CTR on recommendation card', value: '42%', note: 'vs. 40% target' },
  { label: 'Time-to-decision', value: '-48%', note: 'vs. 50% target reduction' },
  { label: 'DAU (feature-flag on cohort)', value: '+31%', note: 'vs. 30% target' },
  { label: 'Statistical significance', value: 'p = 0.03', note: 'below 0.05 threshold' },
]

async function mount(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-eyebrow">Growth (illustrative)</div>
      <h1 class="page-title">Recommendations A/B results</h1>
      <p class="page-sub">
        <strong>Illustrative sample data</strong> — this demo app has no real user
        traffic to measure. These numbers show what a real measurement panel
        would look like, not actual results.
      </p>
    </div>
    <div class="arch-note limitation-callout">
      <strong>Not real data:</strong> this demo app has no real user traffic to A/B
      test. Every metric below is a static, illustrative sample number chosen to show
      what a real growth-metrics panel would display — none of it was measured from
      actual usage.
    </div>
    <div class="kpi-row">
      ${SAMPLE_METRICS.map(
        (m) => `
        <div class="kpi-tile">
          <div class="kpi-label">${m.label}</div>
          <div class="kpi-value">${m.value}</div>
          <div class="kpi-note">${m.note}</div>
        </div>`,
      ).join('')}
    </div>
  `
}

export const growthPage: Page = { mount }
