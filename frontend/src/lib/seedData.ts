import { generate, type SeedOutput } from '@roomsense/seed'

/**
 * Fixed generation window: same seed + same window everywhere the mock
 * client is used, so a page reload and a fresh browser tab see the exact
 * same 30 days of "sensor history" — mirrors the fixed-END convention in
 * packages/seed/src/generate.test.ts, applied here so the whole demo (not
 * just its unit tests) is reproducible.
 */
export const MOCK_SEED = 42
export const MOCK_DAYS = 30
export const MOCK_END = new Date('2026-07-17T12:00:00.000Z')

let cached: SeedOutput | null = null

/** Lazily generates (once per page load) and caches the mock dataset. */
export function getSeedData(): SeedOutput {
  if (!cached) {
    cached = generate({ seed: MOCK_SEED, days: MOCK_DAYS, end: MOCK_END })
  }
  return cached
}

/** Test-only escape hatch to force regeneration against a different window. */
export function __resetSeedCache(): void {
  cached = null
}
