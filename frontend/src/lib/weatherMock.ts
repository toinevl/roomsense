export interface FakeWeatherReading {
  building: string
  temperatureC: number
  rainMm: number
  windKph: number
  updatedAt: string
}

/**
 * Deterministic fake weather for the RoomSense frontend demo.
 *
 * This is intentionally not a real weather API call. It exists so the UI
 * can show a weather context alongside occupancy KPIs during demos and
 * user testing without adding a live dependency, an API key, or network
 * latency.
 *
 * If/when a real weather source is wanted, replace this module with an
 * adapter that reads from an actual weather API and returns the same
 * shape — the dashboard consumer doesn't care where the data comes from.
 */

const BUILDINGS = ['atlas', 'flux', 'neuron']

const SEED_BY_BUILDING: Record<string, { baseTemp: number; baseRain: number; baseWind: number }> = {
  atlas: { baseTemp: 19.5, baseRain: 0.2, baseWind: 12.0 },
  flux: { baseTemp: 18.5, baseRain: 0.4, baseWind: 14.0 },
  neuron: { baseTemp: 20.0, baseRain: 0.1, baseWind: 10.0 },
}

/** Tiny deterministic PRNG for stable per-building jitter without Date.now(). */
function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function getFakeWeather(): FakeWeatherReading[] {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  return BUILDINGS.map((building, idx) => {
    const rng = mulberry32(dayOfYear * 1000 + idx * 100)
    const base = SEED_BY_BUILDING[building]!
    const temperatureC = Number((base.baseTemp + (rng() - 0.5) * 6).toFixed(1))
    const rainMm = Number((Math.max(0, base.baseRain + (rng() - 0.3) * 3)).toFixed(1))
    const windKph = Number((clamp(base.baseWind + (rng() - 0.5) * 18, 0, 60)).toFixed(1))
    const updatedAt = new Date(Date.now() - Math.floor(rng() * 30 * 60 * 1000)).toISOString()
    return { building, temperatureC, rainMm, windKph, updatedAt }
  })
}
