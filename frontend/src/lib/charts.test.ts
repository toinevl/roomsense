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
})
