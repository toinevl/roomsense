import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke config: chromium only, dev server runs with VITE_MOCK=1 so the
 * suite never depends on Lane A's live API (frozen contract, mock mode).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5183',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm exec vite --port 5183',
    url: 'http://localhost:5183',
    reuseExistingServer: !process.env.CI,
    env: { VITE_MOCK: '1' },
  },
})
