import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Integration tests (those that hit Azurite) are flagged with a `.integration.` filename
    // segment and skipped unless RUN_INTEGRATION=1, so `pnpm test` stays fast and hermetic.
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts', 'node_modules/**'],
    testTimeout: 15000,
  },
})
