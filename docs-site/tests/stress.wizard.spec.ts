import { test, expect } from '@playwright/test'

test.describe('Docs Site Stress Tests', () => {
  test.skip(process.env.STRESS !== '1', 'Set STRESS=1 to run stress tests')

  test('rapid route changes (no blank screens / crashes)', async ({ page }) => {
    test.setTimeout(120000)

    const loops = Number(process.env.STRESS_ROUTE_LOOPS || 20)
    const criticalErrors: string[] = []

    page.on('pageerror', (error) => criticalErrors.push(error.message))

    for (let i = 0; i < loops; i += 1) {
      await page.goto('/')
      await expect(page.locator('main')).toBeVisible({ timeout: 15000 })

      await page.goto('/docs')
      await expect(page.locator('main')).toBeVisible({ timeout: 15000 })

      await page.goto('/settings')
      await expect(page.locator('main')).toBeVisible({ timeout: 15000 })
    }

    expect(criticalErrors, `Critical JS errors: ${criticalErrors.join(' | ')}`).toHaveLength(0)
  })

  test('wizard loop (repeat end-to-end flow)', async ({ page }) => {
    test.setTimeout(180000)

    const loops = Number(process.env.STRESS_WIZARD_LOOPS || 5)

    for (let i = 0; i < loops; i += 1) {
      await page.goto('/')
      await expect(page.locator('main')).toBeVisible({ timeout: 15000 })

      // Ensure each loop starts from a clean wizard state (persisted storage can keep you on later steps).
      await page.evaluate(() => {
        try {
          localStorage.removeItem('setup-wizard-storage')
        } catch {
          // ignore
        }
      })
      await page.reload()
      await expect(page.locator('main')).toBeVisible({ timeout: 15000 })

      await page.getByRole('button', { name: /start configuration/i }).click()

      // Step 2: Basic config
      await expect(page.getByRole('heading', { name: /basic configuration/i })).toBeVisible({ timeout: 15000 })
      await page.locator('input[name="domain"]:visible').fill(`stress-${i}.mydomain.net`)
      await page.locator('input[name="password"]:visible').fill('TestPassword123!')
      await page.getByRole('button', { name: /^next$/i }).click()

      // Step 3: Stack selection
      await expect(page.getByRole('heading', { name: /choose your stack/i })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /expert mode/i }).click()
      await page.getByText('*Arr Stack', { exact: true }).click()
      await page.getByText('Plex', { exact: true }).click()
      await page.getByText('Torrent Client', { exact: true }).click()
      await page.getByText('Gluetun VPN', { exact: true }).click()
      await page.getByRole('button', { name: /^next$/i }).click()

      // Step 4: Service config
      await page.getByRole('button', { name: /^next$/i }).click()

      // Step 5: Advanced
      await page.getByRole('button', { name: /^next$/i }).click()

      // Step 6: Review
      await expect(page.getByText('Review & Generate', { exact: true })).toBeVisible({ timeout: 15000 })
      await expect(page.locator('pre').first()).toContainText('COMPOSE_PROFILES=')
    }
  })
})
