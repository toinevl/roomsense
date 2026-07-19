import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Registration guard — copied from nordicHolidays (standing lesson).
 *
 * The Azure Functions v4 programming model only registers functions whose
 * module actually gets imported in src/index.ts. A function file that isn't
 * imported compiles, tests green, and silently 404s in production. This
 * test fails the build before that can ship.
 *
 * Adding a new endpoint = create src/functions/<name>.ts AND append an
 * `import './functions/<name>'` line to src/index.ts. The guard enforces
 * the second step.
 */
describe('function registration entry point', () => {
  it('imports every non-test module in src/functions', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const functionsDir = join(here, 'functions')

    // Before any function exists, the directory may not yet — that's a passing
    // state (nothing to register). Once functions are added, the guard bites.
    if (!existsSync(functionsDir)) {
      return
    }

    const expected = readdirSync(functionsDir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .map((f) => f.replace(/\.ts$/, ''))

    const indexSource = readFileSync(join(here, 'index.ts'), 'utf8')

    const missing = expected.filter(
      (name) =>
        !new RegExp(`import\\s+['"]\\./functions/${name}(\\.js)?['"]`).test(indexSource),
    )
    expect(
      missing,
      `src/index.ts is missing imports for: ${missing.join(', ')} — those functions will 404 in production`,
    ).toEqual([])
  })
})
