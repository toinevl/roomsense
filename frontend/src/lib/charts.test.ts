import { describe, expect, test } from 'vitest'
import { buildSparklinePath } from './charts'

describe('buildSparklinePath', () => {
  test('returns an SVG path string spanning the given width/height', () => {
    const path = buildSparklinePath([10, 20, 15, 30], 100, 20)
    expect(path.startsWith('M ')).toBe(true)
    expect(path).toContain('L ')
  })

  test('a single value still returns a valid (degenerate) path, not a crash', () => {
    expect(() => buildSparklinePath([42], 100, 20)).not.toThrow()
  })

  test('empty input returns an empty string', () => {
    expect(buildSparklinePath([], 100, 20)).toBe('')
  })

  test('plots higher values higher on screen (smaller y) and later in array order further right (larger x)', () => {
    // SVG y grows downward, so the y-scale must map the larger value to the
    // SMALLER y (higher on screen). This is the exact contract sparkline()
    // in pages/live.ts relies on when it reverses newest-first readings to
    // oldest-first before calling buildSparklinePath — if this scaling were
    // ever inverted, the trend would render backwards with no test to catch it.
    const path = buildSparklinePath([0, 10], 100, 20)
    const [, p0, , p1] = path.split(' ')
    const [x0, y0] = p0!.split(',').map(Number)
    const [x1, y1] = p1!.split(',').map(Number)
    expect(y1).toBeLessThan(y0!)
    expect(x1).toBeGreaterThan(x0!)
  })
})
