import type { OccupancyPredictionResponse } from '../lib/apiTypes'

/** Simple 3-bar occupancy chart: now, +30m, +60m. capacity clamps bar heights. */
export function createOccupancyPredictionChart(
  container: HTMLElement,
  prediction: OccupancyPredictionResponse,
  capacity: number,
): void {
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
      <div class="occupancy-prediction-fill" style="height: ${pct}%"></div>
      <div class="occupancy-prediction-value">${point.occupancy}</div>
      <div class="occupancy-prediction-label">${point.label}</div>
    `
    wrap.append(bar)
  }

  container.append(wrap)
}
