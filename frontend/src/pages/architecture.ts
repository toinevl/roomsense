import { svgEl } from '../lib/charts'
import type { Page } from './types'

/**
 * Static architecture diagram: the DEMO path this app actually runs, next to
 * the REAL production path it stands in for, converging on one adapter
 * seam. Hand-rolled SVG, no diagram library — wishlist #17.
 */

interface BoxSpec {
  x: number
  y: number
  w: number
  h: number
  title: string
  subtitle?: string
  variant?: 'demo' | 'real' | 'seam' | 'shared' | 'outofscope'
}

const FILL: Record<NonNullable<BoxSpec['variant']>, string> = {
  demo: 'var(--surface-card-2)',
  real: 'var(--surface-card-2)',
  seam: 'color-mix(in srgb, var(--series-5) 16%, var(--surface-card-2))',
  shared: 'var(--surface-card-2)',
  outofscope: 'var(--surface-card-2)',
}
const STROKE: Record<NonNullable<BoxSpec['variant']>, string> = {
  demo: 'var(--series-1)',
  real: 'var(--border-strong)',
  seam: 'var(--series-5)',
  shared: 'var(--series-2)',
  outofscope: 'var(--border)',
}

function box(spec: BoxSpec): SVGGElement {
  const variant = spec.variant ?? 'demo'
  const g = svgEl('g')
  const dashed = variant === 'real' || variant === 'outofscope'
  const rect = svgEl('rect', {
    x: spec.x,
    y: spec.y,
    width: spec.w,
    height: spec.h,
    rx: 8,
    fill: FILL[variant],
    stroke: STROKE[variant],
    'stroke-width': variant === 'seam' ? 2 : 1.4,
  })
  if (dashed) rect.setAttribute('stroke-dasharray', '5 4')
  g.appendChild(rect)

  const titleEl = svgEl('text', {
    x: spec.x + spec.w / 2,
    y: spec.y + (spec.subtitle ? spec.h / 2 - 4 : spec.h / 2 + 4),
    'text-anchor': 'middle',
  })
  titleEl.setAttribute('font-family', 'var(--font-display)')
  titleEl.setAttribute('font-size', '13')
  titleEl.setAttribute('font-weight', '700')
  titleEl.setAttribute('fill', dashed ? 'var(--text-secondary)' : 'var(--text-primary)')
  titleEl.textContent = spec.title
  g.appendChild(titleEl)

  if (spec.subtitle) {
    const subEl = svgEl('text', { x: spec.x + spec.w / 2, y: spec.y + spec.h / 2 + 13, 'text-anchor': 'middle' })
    subEl.setAttribute('font-family', 'var(--font-mono)')
    subEl.setAttribute('font-size', '10')
    subEl.setAttribute('fill', 'var(--text-muted)')
    subEl.textContent = spec.subtitle
    g.appendChild(subEl)
  }

  return g
}

interface ArrowSpec {
  x1: number
  y1: number
  x2: number
  y2: number
  dashed?: boolean
  label?: string
  color?: string
}

function arrow(spec: ArrowSpec): SVGGElement {
  const g = svgEl('g')
  const line = svgEl('line', {
    x1: spec.x1,
    y1: spec.y1,
    x2: spec.x2,
    y2: spec.y2,
    stroke: spec.color ?? 'var(--text-muted)',
    'stroke-width': 1.6,
    'marker-end': 'url(#arrowhead)',
  })
  if (spec.dashed) line.setAttribute('stroke-dasharray', '4 4')
  g.appendChild(line)
  if (spec.label) {
    const midX = (spec.x1 + spec.x2) / 2
    const midY = (spec.y1 + spec.y2) / 2
    const bg = svgEl('rect', { x: midX - spec.label.length * 2.9, y: midY - 8, width: spec.label.length * 5.8, height: 13, fill: 'var(--surface-0)' })
    g.appendChild(bg)
    const text = svgEl('text', { x: midX, y: midY + 2, 'text-anchor': 'middle' })
    text.setAttribute('font-family', 'var(--font-mono)')
    text.setAttribute('font-size', '9')
    text.setAttribute('fill', 'var(--text-muted)')
    text.textContent = spec.label
    g.appendChild(text)
  }
  return g
}

function sectionLabel(x: number, y: number, text: string, color: string): SVGTextElement {
  const el = svgEl('text', { x, y })
  el.setAttribute('font-family', 'var(--font-mono)')
  el.setAttribute('font-size', '11')
  el.setAttribute('font-weight', '700')
  el.setAttribute('letter-spacing', '0.08em')
  el.setAttribute('fill', color)
  el.textContent = text.toUpperCase()
  return el
}

function buildDiagram(): SVGSVGElement {
  const svg = svgEl('svg', {
    viewBox: '0 0 1040 620',
    role: 'img',
    'aria-label':
      'Architecture diagram: demo path (seed generator and Azure Table Storage) versus real path (Terabee sensor, LoRa gateway, Azure IoT Hub, Databricks), converging on a SourceAdapter seam that feeds the same normalized tables, API and frontend.',
  })

  const defs = svgEl('defs')
  const marker = svgEl('marker', {
    id: 'arrowhead',
    viewBox: '0 0 10 10',
    refX: '8',
    refY: '5',
    markerWidth: '7',
    markerHeight: '7',
    orient: 'auto-start-reverse',
  })
  const arrowPath = svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'var(--text-muted)' })
  marker.appendChild(arrowPath)
  defs.appendChild(marker)
  svg.appendChild(defs)

  // ---- section labels ----
  svg.appendChild(sectionLabel(28, 70, 'Demo path — this app', 'var(--series-1)'))
  svg.appendChild(sectionLabel(28, 335, 'Real path — production, not built here', 'var(--text-muted)'))
  svg.appendChild(sectionLabel(728, 70, 'Shared downstream', 'var(--series-2)'))

  // ---- seam highlight (drawn first so boxes sit on top) ----
  const seamHighlight = svgEl('rect', {
    x: 196, y: 196, width: 488, height: 118, rx: 14,
    fill: 'none', stroke: 'var(--series-5)', 'stroke-width': 1.5, 'stroke-dasharray': '2 5',
  })
  svg.appendChild(seamHighlight)
  const seamLabel = svgEl('text', { x: 440, y: 190, 'text-anchor': 'middle' })
  seamLabel.setAttribute('font-family', 'var(--font-mono)')
  seamLabel.setAttribute('font-size', '11')
  seamLabel.setAttribute('font-weight', '700')
  seamLabel.setAttribute('letter-spacing', '0.06em')
  seamLabel.setAttribute('fill', 'var(--series-5)')
  seamLabel.textContent = 'SOURCEADAPTER SEAM'
  svg.appendChild(seamLabel)

  // ---- demo sources (top) ----
  const seedGen = { x: 220, y: 90, w: 200, h: 60, title: 'Seed generator', subtitle: 'packages/seed', variant: 'demo' as const }
  const outlookMock = { x: 460, y: 90, w: 200, h: 60, title: 'Outlook mock', subtitle: 'fixture reservations', variant: 'demo' as const }
  svg.appendChild(box(seedGen))
  svg.appendChild(box(outlookMock))

  // ---- adapter seam boxes ----
  const adapterTerabee = { x: 220, y: 220, w: 200, h: 70, title: 'SourceAdapter', subtitle: 'terabee-iothub-mock', variant: 'seam' as const }
  const adapterOutlook = { x: 460, y: 220, w: 200, h: 70, title: 'SourceAdapter', subtitle: 'outlook-mock', variant: 'seam' as const }
  svg.appendChild(box(adapterTerabee))
  svg.appendChild(box(adapterOutlook))

  svg.appendChild(arrow({ x1: 320, y1: 150, x2: 320, y2: 220, color: 'var(--series-1)' }))
  svg.appendChild(arrow({ x1: 560, y1: 150, x2: 560, y2: 220, color: 'var(--series-1)' }))

  // ---- real sources (bottom, dashed, feeding up into the same seam) ----
  const sensor = { x: 220, y: 340, w: 200, h: 44, title: 'Terabee sensor', variant: 'real' as const }
  const gateway = { x: 220, y: 396, w: 200, h: 44, title: 'LoRa gateway', variant: 'real' as const }
  const iotHub = { x: 220, y: 452, w: 200, h: 44, title: 'Azure IoT Hub', variant: 'real' as const }
  svg.appendChild(box(sensor))
  svg.appendChild(box(gateway))
  svg.appendChild(box(iotHub))
  svg.appendChild(arrow({ x1: 320, y1: 384, x2: 320, y2: 396, dashed: true }))
  svg.appendChild(arrow({ x1: 320, y1: 440, x2: 320, y2: 452, dashed: true }))
  svg.appendChild(
    arrow({ x1: 320, y1: 452, x2: 320, y2: 290, dashed: true, label: 'future adapter, same shape' }),
  )

  const databricks = { x: 460, y: 452, w: 200, h: 44, title: 'Databricks lakehouse', variant: 'outofscope' as const }
  svg.appendChild(box(databricks))
  svg.appendChild(arrow({ x1: 420, y1: 474, x2: 460, y2: 474, dashed: true }))
  const dbNote = svgEl('text', { x: 560, y: 512, 'text-anchor': 'middle' })
  dbNote.setAttribute('font-family', 'var(--font-mono)')
  dbNote.setAttribute('font-size', '9')
  dbNote.setAttribute('fill', 'var(--text-muted)')
  dbNote.textContent = 'analytics destination — out of scope here'
  svg.appendChild(dbNote)

  const graphApi = { x: 460, y: 340, w: 200, h: 44, title: 'Microsoft Graph API', subtitle: 'real calendar/rooms', variant: 'real' as const }
  svg.appendChild(box(graphApi))
  svg.appendChild(
    arrow({ x1: 560, y1: 340, x2: 560, y2: 290, dashed: true, label: 'future Graph adapter' }),
  )

  // ---- shared downstream chain ----
  const tables = {
    x: 728, y: 190, w: 280, h: 80,
    title: 'Normalized Azure Tables', subtitle: 'Rooms · Readings · Snapshots · Reservations',
    variant: 'shared' as const,
  }
  const api = { x: 728, y: 320, w: 280, h: 56, title: 'Azure Functions API', subtitle: 'frozen HTTP contract', variant: 'shared' as const }
  const frontend = { x: 728, y: 420, w: 280, h: 56, title: 'RoomSense SPA', subtitle: 'this app', variant: 'shared' as const }
  svg.appendChild(box(tables))
  svg.appendChild(box(api))
  svg.appendChild(box(frontend))

  svg.appendChild(arrow({ x1: 420, y1: 255, x2: 728, y2: 225, color: 'var(--series-5)' }))
  svg.appendChild(arrow({ x1: 560, y1: 290, x2: 728, y2: 250, color: 'var(--series-5)' }))
  svg.appendChild(arrow({ x1: 868, y1: 270, x2: 868, y2: 320, color: 'var(--series-2)' }))
  svg.appendChild(arrow({ x1: 868, y1: 376, x2: 868, y2: 420, color: 'var(--series-2)' }))

  return svg
}

function renderContent(): string {
  return `
    <div class="page-header">
      <div class="page-eyebrow">How the data gets here</div>
      <h1 class="page-title">Architecture: demo path vs. real path</h1>
      <p class="page-sub">
        This app's dashboard and live view are real code reading a real HTTP API — but the room-occupancy
        <strong>data in this environment is generated</strong> by a deterministic seed, not live sensor
        traffic. The diagram below shows exactly where the mock stands in for the real ingestion path, and
        the seam where a real adapter would plug in without touching the API or this frontend.
      </p>
    </div>
    <div class="arch-legend">
      <span class="legend-item"><span class="legend-swatch" style="background:var(--series-1)"></span>Demo path (active today)</span>
      <span class="legend-item"><span class="legend-swatch" style="background:var(--series-2)"></span>Shared downstream</span>
      <span class="legend-item"><span class="legend-swatch" style="background:transparent;border:1px dashed var(--border-strong)"></span>Real path (not built here)</span>
      <span class="legend-item"><span class="legend-swatch" style="background:transparent;border:1px dashed var(--series-5)"></span>SourceAdapter seam</span>
    </div>
    <div class="arch-diagram-wrap" id="arch-diagram"></div>
    <div class="arch-note seam-callout">
      <strong>The seam:</strong> the API and frontend only ever read the normalized Azure Tables
      (<code>Rooms</code>, <code>SensorReadings</code>, <code>OccupancySnapshots</code>, <code>Reservations</code>,
      <code>Sources</code>). Today those tables are filled by <code>packages/seed</code>'s deterministic
      generator, registered as source <code>terabee-iothub-mock</code>, plus a fixture-based
      <code>outlook-mock</code> adapter for reservations. Swapping in a real Terabee/IoT Hub ingestion
      adapter or a real Microsoft Graph adapter means writing one new module that fills the same tables in
      the same shape — zero changes to the API surface or to this SPA.
    </div>
    <div class="arch-note">
      <strong>Honesty check:</strong> nothing on the Live or Dashboard pages is a live sensor reading.
      Every number traces back to <code>packages/seed/src/generate.ts</code>, a mulberry32-seeded
      generator that models office-hours traffic, ~20% ghost meetings, and daily 04:00 counter resets to
      match Terabee's real cumulative-counter behaviour — realistic in shape, not in origin.
    </div>
    <div class="arch-note limitation-callout">
      <strong>Known limitation — Presenter mode's live tick:</strong> reading data (Dashboard, Live,
      the reservations overlay) works normally — it's plain <code>GET</code> requests, which browsers
      never preflight. But <a href="#live">Presenter mode</a>'s <code>POST /api/simulate/tick</code>
      currently fails in the browser with a CORS error, even with a correct key. This is a
      <a href="https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan#considerations" target="_blank" rel="noopener">documented Azure Flex Consumption platform
      limitation</a>, not a bug in this app's code: Flex Consumption's front-end intercepts the
      browser's CORS preflight and returns an empty response before it ever reaches our function —
      confirmed by zero request telemetry for the blocked calls. Fixing it for real means moving off
      Flex Consumption (Consumption/Premium plan), proxying the API through the Static Web App's
      managed API integration, or fronting it with Azure Front Door/API Management — see the project
      wiki for the full diagnosis and options. Left as a known limitation for now; every other part of
      the demo is unaffected.
    </div>
  `
}

export const architecturePage: Page = {
  mount(container: HTMLElement) {
    container.innerHTML = renderContent()
    container.querySelector('#arch-diagram')!.appendChild(buildDiagram())
  },
}
