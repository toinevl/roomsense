import { apiClient } from '../lib/api'
import type { KpisResponse } from '../lib/apiTypes'
import type { Page } from './types'

/**
 * Semester in Review — one-page printable report for leadership.
 * Fetches KPIs and displays metrics in a print-friendly format.
 */

function renderSkeleton(): string {
  return `
    <div class="report">
      <div id="report-content" aria-busy="true"></div>
    </div>
  `
}

function renderError(container: HTMLElement, err: unknown): void {
  const content = container.querySelector('#report-content')!
  content.innerHTML = `
    <div class="report-error">
      <p>Couldn't load report data</p>
      <p>${err instanceof Error ? err.message.replace(/[<>]/g, '') : 'Unknown error'}</p>
    </div>
  `
}

function renderReport(container: HTMLElement, kpis: KpisResponse): void {
  const content = container.querySelector('#report-content')!
  content.setAttribute('aria-busy', 'false')

  // Illustrative CO2 estimate: 1 wasted euro ≈ 0.5 kg CO2 (placeholder)
  const co2Estimate = (kpis.wastedEur ?? 0) * 0.5

  content.innerHTML = `
    <div class="report-header">
      <h1>Semester in Review</h1>
      <p class="date-range">Last 30 days</p>
    </div>

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
      ${
        kpis.underusedRooms && kpis.underusedRooms.length > 0
          ? `
      <ul>
        ${kpis.underusedRooms.map((room) => `<li>${room.name}: ${room.utilizationPct.toFixed(1)}% utilization</li>`).join('')}
      </ul>
      `
          : '<p>No underused rooms data</p>'
      }
    </section>

    <footer class="report-footer">
      <p>Print or export this page to share with your team.</p>
    </footer>
  `
}

export const reportPage: Page = {
  async mount(container: HTMLElement) {
    container.innerHTML = renderSkeleton()
    try {
      const kpis = await apiClient.getKpis()
      renderReport(container, kpis)
    } catch (err) {
      renderError(container, err)
    }
  },
}
