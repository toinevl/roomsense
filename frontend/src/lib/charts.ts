/**
 * Small hand-rolled SVG chart helpers — no chart library, per wishlist #15.
 * Built following the dataviz skill: thin marks, hairline recessive grid,
 * a shared hover tooltip, and CSS custom properties for color roles so
 * light/dark both work from the same markup.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value))
  }
  return el
}

/** Linear scale: maps a value in [domainMin, domainMax] to [rangeMin, rangeMax]. */
export function linearScale(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
): (value: number) => number {
  const domainSpan = domainMax - domainMin || 1
  return (value: number) => rangeMin + ((value - domainMin) / domainSpan) * (rangeMax - rangeMin)
}

/** The eight categorical CSS custom properties, in the fixed, validated order. */
export const SERIES_VARS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
  'var(--series-7)',
  'var(--series-8)',
]

/** Sequential (single-hue) ramp steps, light -> dark, for magnitude encodings. */
export const SEQUENTIAL_STEPS = [
  'var(--seq-100)',
  'var(--seq-250)',
  'var(--seq-400)',
  'var(--seq-550)',
  'var(--seq-700)',
]

/** Picks a sequential step index (0..steps-1) for a 0..100 utilization value. */
export function sequentialStepForPct(pct: number, steps = SEQUENTIAL_STEPS.length): number {
  const clamped = Math.max(0, Math.min(100, pct))
  return Math.min(steps - 1, Math.floor((clamped / 100) * steps))
}

export interface TooltipHandle {
  el: HTMLDivElement
  show(clientX: number, clientY: number, container: HTMLElement, contentNodes: Node[]): void
  hide(): void
}

/**
 * A single shared tooltip element per chart card. Content is built from DOM
 * nodes (never innerHTML) so untrusted labels (room/organizer names) can
 * never inject markup — see dataviz interaction.md "Labels are untrusted data".
 */
export function createTooltip(): TooltipHandle {
  const el = document.createElement('div')
  el.className = 'viz-tooltip'
  el.setAttribute('role', 'status')
  el.setAttribute('aria-live', 'polite')

  return {
    el,
    show(clientX, clientY, container, contentNodes) {
      el.replaceChildren(...contentNodes)
      const rect = container.getBoundingClientRect()
      const x = clientX - rect.left + 12
      const y = clientY - rect.top - 8
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      el.classList.add('visible')
    },
    hide() {
      el.classList.remove('visible')
    },
  }
}

export function tooltipRow(colorVar: string, label: string, value: string): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'tt-row'
  const key = document.createElement('span')
  key.className = 'tt-key'
  key.style.background = colorVar
  const labelEl = document.createElement('span')
  labelEl.className = 'tt-label'
  labelEl.textContent = label
  const valueEl = document.createElement('span')
  valueEl.className = 'tt-value'
  valueEl.textContent = value
  valueEl.style.marginLeft = 'auto'
  row.append(key, labelEl, valueEl)
  return row
}

/** Builds an SVG path `d` string for a single-series sparkline over `values`,
 *  scaled to fit [0, width] x [0, height] (y inverted so higher values sit
 *  higher on screen, matching every other chart in this file). */
export function buildSparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const x = linearScale(0, Math.max(1, values.length - 1), 0, width)
  const y = linearScale(min, max, height, 0)
  const points = values.map((v, i) => `${x(i)},${y(v)}`)
  return `M ${points.join(' L ')}`
}
