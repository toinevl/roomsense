import { expect, test } from '@playwright/test'

/**
 * Smoke suite for the admin (facility-manager) area (#47) — a separate Vite
 * HTML entry at /admin/, own nav/router, not part of the student SPA's route
 * table. Runs against the same mock-mode dev server as smoke.spec.ts.
 */

test.describe('RoomSense Admin smoke (mock mode)', () => {
  test('overview renders KPI tiles and one room card per room', async ({ page }) => {
    await page.goto('/admin/')
    await expect(page.getByRole('heading', { name: 'RoomSense Admin' })).toBeVisible()

    const tiles = page.locator('.kpi-tile')
    await expect(tiles).toHaveCount(4)
    for (const tile of await tiles.all()) {
      const value = await tile.locator('.kpi-value').innerText()
      expect(value.trim().length).toBeGreaterThan(0)
    }

    const roomCards = page.locator('.admin-room-card')
    await expect(roomCards).toHaveCount(15)
  })

  test('reclaim now panel always shows exactly three slots (candidate card or empty state)', async ({ page }) => {
    await page.goto('/admin/')
    const cards = page.locator('.reclaim-card')
    const emptyStates = page.locator('.reclaim-empty')
    await expect(cards.or(emptyStates)).toHaveCount(3)
  })

  test('a reclaim action removes its card and logs a local audit entry', async ({ page }) => {
    await page.goto('/admin/')
    const firstAction = page.locator('.reclaim-card .reclaim-action').first()
    const actionCount = await firstAction.count()
    test.skip(actionCount === 0, 'No reclaim candidates in this seed run — nothing to dismiss.')

    const cardsBefore = await page.locator('.reclaim-card').count()
    await firstAction.click()

    await expect(page.locator('.reclaim-card')).toHaveCount(cardsBefore - 1)
    await expect(page.locator('.audit-log-entry')).toHaveCount(1)
  })

  test('rooms page lists all rooms and supports search + filters', async ({ page }) => {
    await page.goto('/admin/#rooms')
    await expect(page.getByRole('heading', { name: 'Rooms' })).toBeVisible()

    const rows = page.locator('.rooms-list-row')
    await expect(rows).toHaveCount(15)

    const firstRoomName = (await rows.first().locator('td').first().innerText()).trim()
    await page.locator('.filter-search').fill(firstRoomName)
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText(firstRoomName)

    await page.locator('.filter-search').fill('')
    await expect(rows).toHaveCount(15)

    const offlineCheckbox = page.locator('input[name="availability"][value="offline"]')
    await offlineCheckbox.check()
    const offlineCount = await rows.count()
    expect(offlineCount).toBeLessThanOrEqual(15)
    for (const row of await rows.all()) {
      await expect(row).toContainText('Offline')
    }
  })

  test('a room row link navigates to the main app live page with the room pre-selected', async ({ page }) => {
    await page.goto('/admin/#rooms')
    const firstRow = page.locator('.rooms-list-row').first()
    const roomName = (await firstRow.locator('td').first().innerText()).trim()

    await firstRow.locator('a', { hasText: 'View live' }).click()
    await expect(page).toHaveURL(/\/#live$/)
    await expect(page.locator('.drill-panel')).toBeVisible()
    await expect(page.locator('.drill-head .chart-title')).toHaveText(roomName)
  })

  test('admin nav switches between Overview and Rooms without touching the student app', async ({ page }) => {
    await page.goto('/admin/')
    await page.getByRole('link', { name: 'Rooms', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/#rooms$/)
    await expect(page.locator('.primary-nav a.active')).toHaveText('Rooms')

    await page.getByRole('link', { name: 'Overview', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/#overview$/)
    await expect(page.locator('.primary-nav a.active')).toHaveText('Overview')

    // The student app's own nav is untouched — it has no Overview/Rooms links.
    await page.goto('/#dashboard')
    await expect(page.getByRole('link', { name: 'Overview', exact: true })).toHaveCount(0)
  })
})
