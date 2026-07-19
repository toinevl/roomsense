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

// BUILD_SHA is injected at bundle time so /api/health can report the deployed
// commit. In CI the workflow exports GITHUB_SHA into env before `pnpm build`;
// locally it falls back to 'dev'. esbuild `define` inlines a string literal —
// we must JSON-quote it so the bundled source sees a valid JS string.
const BUILD_SHA = JSON.stringify(process.env.BUILD_SHA ?? 'dev')

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
  define: {
    'process.env.BUILD_SHA': BUILD_SHA,
  },
  banner: {
    js: '// Bundled by esbuild. Do not edit; regenerate with: pnpm bundle',
  },
}

await build(opts)
console.log(`bundle: wrote dist/src/index.js (BUILD_SHA=${JSON.parse(BUILD_SHA)})`)
