import { expect, test } from '@playwright/test'

/**
 * Smoke suite (wishlist #18): runs against the dev server started with
 * VITE_MOCK=1 (see playwright.config.ts webServer env), so it never depends
 * on Lane A's live API — everything is derived in-browser from the seed
 * generator against the frozen API contract.
 */

test.describe('RoomSense smoke (mock mode)', () => {
  test('dashboard renders with non-empty KPI tiles', async ({ page }) => {
    await page.goto('/#dashboard')
    await expect(page.getByRole('heading', { name: 'RoomSense Dashboard' })).toBeVisible()

    const tiles = page.locator('.kpi-tile')
    await expect(tiles).toHaveCount(4)
    for (const tile of await tiles.all()) {
      const value = await tile.locator('.kpi-value').innerText()
      expect(value.trim().length).toBeGreaterThan(0)
    }

    // Building/floor heatmap and ghost table both mounted.
    await expect(page.locator('#heatmap-card .chart-title')).toHaveText(/Utilization by building/)
    await expect(page.locator('#ghost-table-card table tbody tr')).toHaveCount(5)
  })

  test('live page shows 15 rooms and supports drill-in', async ({ page }) => {
    await page.goto('/#live')
    await expect(page.getByRole('heading', { name: 'Live room telemetry' })).toBeVisible()

    const roomCards = page.locator('.room-card')
    await expect(roomCards).toHaveCount(15)

    await roomCards.first().click()
    await expect(page.locator('.drill-panel')).toBeVisible()
    await expect(page.locator('.telemetry-scroll table tbody tr')).toHaveCount(50)

    await page.locator('.drill-close').click()
    await expect(page.locator('.drill-panel')).toHaveCount(0)
  })

  test('architecture page renders the diagram with honest labeling', async ({ page }) => {
    await page.goto('/#architecture')
    await expect(page.getByRole('heading', { name: /demo path vs\. real path/i })).toBeVisible()
    await expect(page.locator('#arch-diagram svg')).toBeVisible()
    await expect(page.getByText(/data in this environment is generated/i).first()).toBeVisible()
  })

  test('hash navigation switches the active nav link', async ({ page }) => {
    await page.goto('/#dashboard')
    await page.getByRole('link', { name: 'Live' }).click()
    await expect(page).toHaveURL(/#live$/)
    await expect(page.locator('.primary-nav a.active')).toHaveText('Live')
  })
})
