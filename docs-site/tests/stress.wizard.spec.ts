import { test, expect } from '@playwright/test'

test.describe('Docs Site Stress Tests', () => {
  test.skip(process.env.STRESS !== '1', 'Set STRESS=1 to run stress tests')

  test('arr-stack bootstrap rapid clicks (stress test API)', async ({ page }) => {
    const clicks = Number(process.env.STRESS_BOOTSTRAP_CLICKS || 10)
    test.setTimeout(Math.max(60000, clicks * 5000))

    let bootstrapCalls = 0

    // Mock the API to respond quickly
    await page.route('**/api/arr/bootstrap', async (route) => {
      bootstrapCalls++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          keys: {
            SONARR_API_KEY: `key-${bootstrapCalls}`,
            RADARR_API_KEY: `radarr-${bootstrapCalls}`,
          },
        }),
      })
    })

    // Mock other required endpoints
    await page.route('**/api/settings/openai-key', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hasKey: true, model: 'gpt-4o' }),
      })
    })
    await page.route('**/api/settings/tts-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ elevenlabs: { hasKey: false, voiceId: null } }),
      })
    })
    await page.route('**/api/compose/services', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ services: ['wizard-api'] }),
      })
    })
    await page.route('**/api/containers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: '1', name: 'wizard-api', status: 'Up', state: 'running' }]),
      })
    })
    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    })

    await page.goto('/settings')
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 })

    const criticalErrors: string[] = []
    page.on('pageerror', (error) => criticalErrors.push(error.message))

    for (let i = 0; i < clicks; i++) {
      const localButton = page.getByRole('button', { name: /Local/i })
      await expect(localButton).toBeVisible({ timeout: 10000 })
      await localButton.click()

      // Wait for keys to be displayed
      await expect(page.getByText('Retrieved keys')).toBeVisible({ timeout: 15000 })
    }

    expect(bootstrapCalls).toBeGreaterThanOrEqual(clicks)
    expect(criticalErrors, `Critical JS errors: ${criticalErrors.join(' | ')}`).toHaveLength(0)
  })

  test('arr-stack modal open/close cycles', async ({ page }) => {
    const cycles = Number(process.env.STRESS_MODAL_CYCLES || 15)
    test.setTimeout(Math.max(60000, cycles * 3000))

    // Mock required endpoints
    await page.route('**/api/settings/openai-key', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hasKey: true }),
      })
    })
    await page.route('**/api/settings/tts-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ elevenlabs: { hasKey: false, voiceId: null } }),
      })
    })
    await page.route('**/api/compose/services', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ services: [] }),
      })
    })
    await page.route('**/api/containers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })
    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    })

    await page.goto('/settings')
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 })

    const criticalErrors: string[] = []
    page.on('pageerror', (error) => criticalErrors.push(error.message))

    for (let i = 0; i < cycles; i++) {
      // Open Remote dialog
      const remoteButton = page.getByRole('button', { name: /Remote/i })
      await remoteButton.click()

      await expect(page.getByText('Remote Arr Key Bootstrap')).toBeVisible({ timeout: 5000 })

      // Close dialog
      const cancelButton = page.getByRole('button', { name: /Cancel/i })
      await cancelButton.click()

      await expect(page.getByText('Remote Arr Key Bootstrap')).not.toBeVisible({ timeout: 5000 })
    }

    expect(criticalErrors, `Critical JS errors: ${criticalErrors.join(' | ')}`).toHaveLength(0)
  })

  test('rapid route changes (no blank screens / crashes)', async ({ page }) => {
    const loops = Number(process.env.STRESS_ROUTE_LOOPS || 20)
    test.setTimeout(Math.max(120000, loops * 6000))
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
    const loops = Number(process.env.STRESS_WIZARD_LOOPS || 5)
    // Scale timeout with loop count to avoid false negatives on slower machines/CI.
    // Rough budget: ~60s per loop, minimum 3 minutes.
    test.setTimeout(Math.max(180000, loops * 60000))

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
