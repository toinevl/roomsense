import { describe, it, expect } from 'vitest'
import { createOccupancyPredictionChart } from './occupancyPrediction'
import type { OccupancyPredictionResponse } from '../lib/apiTypes'

describe('occupancyPrediction chart', () => {
  it('renders 3 bars: now, +30m, +60m', () => {
    const container = document.createElement('div')
    const prediction: OccupancyPredictionResponse = {
      roomId: 'r1',
      now: { occupancy: 2 },
      plus30m: { occupancy: 5 },
      plus60m: { occupancy: 1 },
    }
    createOccupancyPredictionChart(container, prediction, 10)
    const bars = container.querySelectorAll('[data-prediction-bar]')
    expect(bars.length).toBe(3)
  })

  it('labels each bar with its occupancy count', () => {
    const container = document.createElement('div')
    createOccupancyPredictionChart(
      container,
      { roomId: 'r1', now: { occupancy: 2 }, plus30m: { occupancy: 5 }, plus60m: { occupancy: 1 } },
      10,
    )
    expect(container.textContent).toContain('2')
    expect(container.textContent).toContain('5')
    expect(container.textContent).toContain('1')
  })
})
