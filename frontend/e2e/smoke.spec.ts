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

  test('live page telemetry table shows occupancy deltas, not just raw counters (#live-deltas)', async ({ page }) => {
    await page.goto('/#live')
    await page.locator('.room-card').first().click()
    const headerCells = page.locator('.telemetry-scroll thead th')
    await expect(headerCells).toContainText(['Δ in', 'Δ out', 'Δ occ'])
    // At least one row (the newest reading has no older row to diff against,
    // so row 0 is legitimately "—"; row 1 must have a real delta or a reset).
    const secondRowDeltaIn = page.locator('.telemetry-scroll tbody tr').nth(1).locator('td').nth(3)
    await expect(secondRowDeltaIn).not.toHaveText('')
  })

  test('live page drill panel shows battery/signal trend sparklines (#live-sparklines)', async ({ page }) => {
    await page.goto('/#live')
    await page.locator('.room-card').first().click()
    await expect(page.locator('.device-trend-row .sparkline')).toHaveCount(2)
  })

  test('live page drill-in shows the reservations overlay (#24)', async ({ page }) => {
    await page.goto('/#live')
    const roomCards = page.locator('.room-card')

    // Find a room whose overlay actually has booked slots — several rooms
    // in the seeded window have none, so scan a few before asserting.
    let overlayCaption = ''
    const count = await roomCards.count()
    for (let i = 0; i < count; i++) {
      await roomCards.nth(i).click()
      await expect(page.locator('.overlay-card')).toBeVisible()
      overlayCaption = await page.locator('.overlay-card .chart-caption').innerText()
      if (/booked slot/.test(overlayCaption)) break
    }

    expect(overlayCaption).toMatch(/booked slot/)
    await expect(page.locator('.overlay-svg-wrap svg')).toBeVisible()
    await expect(page.locator('.overlay-legend .legend-item')).toHaveCount(3)
  })

  test('presenter mode toggles on/off without a key in mock mode (#25)', async ({ page }) => {
    await page.goto('/#dashboard')
    const toggle = page.locator('#presenter-toggle')
    await expect(toggle).toHaveText('Presenter mode')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await toggle.click()
    await expect(toggle).toHaveText('Presenting')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(toggle).toHaveClass(/active/)

    await toggle.click()
    await expect(toggle).toHaveText('Presenter mode')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(toggle).not.toHaveClass(/active/)
  })

  test('architecture page renders the diagram with honest labeling', async ({ page }) => {
    await page.goto('/#architecture')
    await expect(page.getByRole('heading', { name: /demo path vs\. real path/i })).toBeVisible()
    await expect(page.locator('#arch-diagram svg')).toBeVisible()
    await expect(page.getByText(/data in this environment is generated/i).first()).toBeVisible()
  })

  test('live page shows both data source adapters (#sources-strip)', async ({ page }) => {
    await page.goto('/#live')
    const pills = page.locator('.source-pill')
    await expect(pills).toHaveCount(2)
    for (const pill of await pills.all()) {
      await expect(pill.locator('.status-dot')).toBeVisible()
      const label = await pill.locator('.source-label').innerText()
      expect(label.length).toBeGreaterThan(0)
    }
  })

  test('live page poll label reports how many rooms updated after a manual refresh (#live-freshness)', async ({ page }) => {
    await page.goto('/#live')
    await page.locator('#manual-refresh').click()
    await expect(page.locator('#poll-label')).toContainText(/\d+\/15 rooms reported new data/)
  })

  test('hash navigation switches the active nav link', async ({ page }) => {
    await page.goto('/#dashboard')
    await page.getByRole('link', { name: 'Live' }).click()
    await expect(page).toHaveURL(/#live$/)
    await expect(page.locator('.primary-nav a.active')).toHaveText('Live')
  })

  test('room finder page loads and shows available rooms', async ({ page }) => {
    await page.goto('/#finder')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Find a Room' })).toBeVisible()

    const cards = page.locator('.room-card')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)

    // Check first card has expected content
    const firstCard = cards.first()
    await expect(firstCard).toContainText(/\d+ \/ \d+ people/)
  })

  test('report page loads and displays metrics', async ({ page }) => {
    await page.goto('/#report')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Semester in Review' })).toBeVisible()

    const metrics = page.locator('.metric')
    await expect(metrics).toHaveCount(4)

    const values = page.locator('.metric-value')
    for (const value of await values.all()) {
      const text = await value.innerText()
      expect(text.trim().length).toBeGreaterThan(0)
    }

    await expect(page.locator('.report-co2')).toBeVisible()
    await expect(page.locator('.report-underused')).toBeVisible()
  })

  test('trust page loads all faq items', async ({ page }) => {
    await page.goto('/#trust')

    // Check header visible
    await expect(page.locator('.trust-header h1')).toContainText('Trust')

    // Check FAQ items render
    const faqItems = page.locator('.faq-item')
    const count = await faqItems.count()
    expect(count).toBeGreaterThanOrEqual(6)
  })

  test('wrapped card renders for screenshots', async ({ page }) => {
    await page.goto('/#wrapped')
    await page.waitForLoadState('networkidle')

    const card = page.locator('.wrapped-card')
    await expect(card).toBeVisible()

    // Verify stats visible
    await expect(page.locator('.busiest')).toBeVisible()
    await expect(page.locator('.quietest')).toBeVisible()
  })
})
