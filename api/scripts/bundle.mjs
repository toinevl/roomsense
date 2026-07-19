#!/usr/bin/env node
/**
 * Bundle the API into a single CJS file for the Azure Functions Node worker.
 *
 * Why: packages/shared is "type": "module" with main=src/index.ts (TS source).
 * vitest+tsx tolerate the extensionless `export * from './types'` in shared;
 * the Functions Node worker (strict ESM resolver) does not — it fails with
 * ERR_MODULE_NOT_FOUND at entry-point load, producing "No job functions found"
 * and 404s for every endpoint. Bundling collapses the workspace dependency
 * graph into one file and sidesteps the runtime resolver entirely.
 *
 * What: esbuild, platform=node, format=cjs, target=node20, externalizing only
 * the packages the Functions host provides at runtime (@azure/functions).
 * Everything else (data-tables, identity, zod, @roomsense/shared) is inlined
 * so there are zero cross-package resolution surprises.
 */
import { build } from 'esbuild'

const opts = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  logLevel: 'info',
  entryPoints: ['src/index.ts'],
  outfile: 'dist/src/index.js',
  // @azure/functions is provided by the Functions host at runtime — do not inline.
  external: ['@azure/functions'],
  // Anything else is inlined — no surprises from pnpm workspace symlinks or ESM/CJS mix.
  banner: {
    js: '// Bundled by esbuild. Do not edit; regenerate with: pnpm bundle',
  },
}

await build(opts)
console.log('bundle: wrote dist/src/index.js')
