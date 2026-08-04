import type { OccupancyPredictionResponse } from '../lib/apiTypes'

const styles = `
  .occupancy-prediction-chart { display: flex; gap: 0.75rem; align-items: flex-end; margin: 0.75rem 0; }
  .occupancy-prediction-bar { flex: 1; display: flex; flex-direction: column; align-items: center; }
  .occupancy-prediction-bar-track {
    height: 56px; width: 100%; max-width: 40px;
    display: flex; align-items: flex-end;
  }
  .occupancy-prediction-fill {
    width: 100%; background: var(--brand);
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    min-height: 2px; transition: height 0.2s;
  }
  .occupancy-prediction-value { font-size: 0.86rem; font-weight: 700; color: var(--text-primary); margin-top: 0.35rem; }
  .occupancy-prediction-label { font-size: 0.72rem; color: var(--text-muted); }
`

/** Simple 3-bar occupancy chart: now, +30m, +60m. capacity clamps bar heights. */
export function createOccupancyPredictionChart(
  container: HTMLElement,
  prediction: OccupancyPredictionResponse,
  capacity: number,
): void {
  if (!document.querySelector('style[data-component="occupancy-prediction"]')) {
    const styleEl = document.createElement('style')
    styleEl.setAttribute('data-component', 'occupancy-prediction')
    styleEl.textContent = styles
    document.head.appendChild(styleEl)
  }

  container.innerHTML = ''
  const wrap = document.createElement('div')
  wrap.className = 'occupancy-prediction-chart'

  const points: Array<{ label: string; occupancy: number }> = [
    { label: 'Now', occupancy: prediction.now.occupancy },
    { label: '+30m', occupancy: prediction.plus30m.occupancy },
    { label: '+60m', occupancy: prediction.plus60m.occupancy },
  ]

  for (const point of points) {
    const bar = document.createElement('div')
    bar.dataset.predictionBar = ''
    bar.className = 'occupancy-prediction-bar'
    const pct = capacity > 0 ? Math.min(100, (point.occupancy / capacity) * 100) : 0
    bar.innerHTML = `
      <div class="occupancy-prediction-bar-track">
        <div class="occupancy-prediction-fill" style="height: ${pct}%"></div>
      </div>
      <div class="occupancy-prediction-value">${point.occupancy}</div>
      <div class="occupancy-prediction-label">${point.label}</div>
    `
    wrap.append(bar)
  }

  container.append(wrap)
}
