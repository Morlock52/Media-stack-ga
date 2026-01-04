import { test, expect } from '@playwright/test'

test.describe('Settings: Control server cockpit', () => {
  test('cockpit actions are clickable and update status', async ({ page }) => {
    let openAiKeyGets = 0
    let systemRestarts = 0
    let healthChecks = 0

    await page.route('**/api/settings/openai-key', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        openAiKeyGets += 1
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ hasKey: true, model: 'gpt-4o' }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    })

    await page.route('**/api/system/restart', async (route) => {
      systemRestarts += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    })

    // StatusBadge dependencies
    await page.route('**/api/compose/services', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ services: ['media-stack-wizard-api'] }),
      })
    })

    await page.route('**/api/containers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: '1',
            name: 'media-stack-wizard-api',
            status: 'Up',
            state: 'running',
          },
        ]),
      })
    })

    // Health used by the "Open /api/health" link and offline fallbacks
    await page.route('**/api/health', async (route) => {
      healthChecks += 1

      // Simulate a brief restart window where /api/health is temporarily unavailable.
      // The UI should keep polling until it becomes reachable again.
      if (systemRestarts > 0 && healthChecks < 3) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ ok: false }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    })

    await page.goto('/settings')

    const recheck = page.getByTestId('cockpit-recheck')
    await expect(recheck).toBeVisible({ timeout: 15000 })
    const cockpit = recheck.locator('xpath=ancestor::section[1]')

    const lastCheck = cockpit.getByText(/^Last checked:/)
    await expect(lastCheck).toBeVisible()

    // Ensure initial refresh happened
    await expect
      .poll(() => openAiKeyGets, { timeout: 15000 })
      .toBeGreaterThan(0)

    const beforeLastCheck = (await lastCheck.textContent()) || ''

    await expect(recheck).toBeEnabled()
    await recheck.click()

    await expect
      .poll(() => openAiKeyGets, { timeout: 15000 })
      .toBeGreaterThan(1)

    const afterLastCheck = (await lastCheck.textContent()) || ''
    expect(afterLastCheck).not.toContain('—')

    // Timestamp text may not change within the same second; assert non-empty + correct label.
    expect(afterLastCheck.length).toBeGreaterThan(10)
    expect(afterLastCheck).toContain('Last checked:')

    // Restart server action should be clickable and show a toast
    const restart = cockpit.getByTestId('cockpit-restart')
    await expect(restart).toBeEnabled()
    await restart.click()

    await expect
      .poll(() => systemRestarts, { timeout: 15000 })
      .toBeGreaterThan(0)

    await expect(page.getByText(/Restart requested\./i)).toBeVisible({ timeout: 15000 })

    // During restart polling the UI should not get stuck showing "offline".
    await expect(page.getByText(/Control server offline/i)).not.toBeVisible({ timeout: 15000 })

    // Ensure the restart poll loop actually exercised /api/health.
    await expect
      .poll(() => healthChecks, { timeout: 15000 })
      .toBeGreaterThan(1)

    // StatusBadge should render without blocking clicks
    await expect(cockpit.getByTestId('status-badge')).toBeVisible({ timeout: 15000 })

    // Sanity: the page should not regress to showing a blank/unknown last check
    const finalLastCheck = (await lastCheck.textContent()) || ''
    expect(finalLastCheck).not.toContain('—')

    // Use the before value so we don't silently accept a broken label
    expect(beforeLastCheck).toContain('Last checked:')
  })
})
