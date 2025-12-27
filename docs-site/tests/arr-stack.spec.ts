import { test, expect } from '@playwright/test'

test.describe('Settings: Arr-Stack Automation', () => {
  // Mock routes for all tests
  test.beforeEach(async ({ page }) => {
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
          { id: '1', name: 'media-stack-wizard-api', status: 'Up', state: 'running' },
        ]),
      })
    })

    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    })

    await page.route('**/api/settings/openai-key', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hasKey: true, model: 'gpt-5.2' }),
      })
    })

    await page.route('**/api/settings/tts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          defaultProvider: 'openai',
          openai: { hasKey: true, ttsModel: 'tts-1', ttsVoice: 'alloy' },
          elevenlabs: { hasKey: false, ttsModel: 'eleven_multilingual_v2', voiceId: null },
        }),
      })
    })
  })

  test('displays Arr-Stack Automation section', async ({ page }) => {
    await page.route('**/api/arr/bootstrap', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, keys: {}, error: 'No containers running' }),
      })
    })

    await page.goto('/settings')

    // Verify the section exists
    await expect(page.getByText('Arr-Stack Automation')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Capture API Keys')).toBeVisible()
    await expect(page.getByText('Extracts keys from config.xml inside running containers')).toBeVisible()

    // Verify Local and Remote buttons exist
    await expect(page.getByRole('button', { name: /Local/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Remote/i })).toBeVisible()
  })

  test('Local button triggers API call and displays found keys', async ({ page }) => {
    let bootstrapCalled = 0

    await page.route('**/api/arr/bootstrap', async (route) => {
      bootstrapCalled++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          keys: {
            SONARR_API_KEY: 'test-sonarr-key-12345',
            RADARR_API_KEY: 'test-radarr-key-67890',
            PROWLARR_API_KEY: 'test-prowlarr-key-abcde',
          },
        }),
      })
    })

    await page.goto('/settings')

    // Click the Local button
    const localButton = page.getByRole('button', { name: /Local/i })
    await expect(localButton).toBeVisible({ timeout: 15000 })
    await localButton.click()

    // Verify API was called
    await expect.poll(() => bootstrapCalled, { timeout: 15000 }).toBeGreaterThan(0)

    // Verify keys are displayed - use exact match to avoid toast message conflicts
    await expect(page.getByText('Retrieved keys')).toBeVisible({ timeout: 15000 })

    // Find the keys section and verify keys are displayed
    const keysSection = page.locator('.space-y-2').filter({ hasText: 'Retrieved keys' })
    await expect(keysSection.getByText('SONARR_API_KEY', { exact: true })).toBeVisible()
    await expect(keysSection.getByText('test-sonarr-key-12345')).toBeVisible()
    await expect(keysSection.getByText('RADARR_API_KEY', { exact: true })).toBeVisible()
    await expect(keysSection.getByText('test-radarr-key-67890')).toBeVisible()
    await expect(keysSection.getByText('PROWLARR_API_KEY', { exact: true })).toBeVisible()
    await expect(keysSection.getByText('test-prowlarr-key-abcde')).toBeVisible()
  })

  test('shows error message when no keys found', async ({ page }) => {
    await page.route('**/api/arr/bootstrap', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          keys: {},
          error: 'No keys were found. Make sure your containers are running and initialized (config.xml must exist).',
        }),
      })
    })

    await page.goto('/settings')

    const localButton = page.getByRole('button', { name: /Local/i })
    await expect(localButton).toBeVisible({ timeout: 15000 })
    await localButton.click()

    // Verify error message is displayed - use first() to handle multiple matches
    await expect(page.getByText(/No keys were found/i).first()).toBeVisible({ timeout: 15000 })
  })

  test('Local button shows loading state during bootstrap', async ({ page }) => {
    // Delay the response to test loading state
    await page.route('**/api/arr/bootstrap', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, keys: { SONARR_API_KEY: 'key123' } }),
      })
    })

    await page.goto('/settings')

    const localButton = page.getByRole('button', { name: /Local/i })
    await expect(localButton).toBeVisible({ timeout: 15000 })
    await localButton.click()

    // Verify loading state (button text changes to Scanning...)
    await expect(page.getByRole('button', { name: /Scanning/i })).toBeVisible({ timeout: 5000 })
  })

  test('Remote button opens remote bootstrap dialog', async ({ page }) => {
    await page.goto('/settings')

    const remoteButton = page.getByRole('button', { name: /Remote/i })
    await expect(remoteButton).toBeVisible({ timeout: 15000 })
    await remoteButton.click()

    // Verify dialog appears
    await expect(page.getByText('Remote Arr Key Bootstrap')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Scan host')).toBeVisible()
    await expect(page.getByText('Port')).toBeVisible()
    await expect(page.getByText('Username')).toBeVisible()
    await expect(page.getByText('Auth')).toBeVisible()
    await expect(page.getByText('Remote .env path')).toBeVisible()
  })

  test('displays success toast with key count', async ({ page }) => {
    await page.route('**/api/arr/bootstrap', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          keys: {
            SONARR_API_KEY: 'key1',
            RADARR_API_KEY: 'key2',
          },
        }),
      })
    })

    await page.goto('/settings')

    const localButton = page.getByRole('button', { name: /Local/i })
    await localButton.click()

    // Verify success toast mentions key count
    await expect(page.getByText(/Successfully captured 2 API keys/i)).toBeVisible({ timeout: 15000 })
  })

  test('displays all supported arr services when keys are found', async ({ page }) => {
    await page.route('**/api/arr/bootstrap', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          keys: {
            SONARR_API_KEY: 'sonarr-123',
            RADARR_API_KEY: 'radarr-456',
            PROWLARR_API_KEY: 'prowlarr-789',
            READARR_API_KEY: 'readarr-abc',
            LIDARR_API_KEY: 'lidarr-def',
            BAZARR_API_KEY: 'bazarr-ghi',
          },
        }),
      })
    })

    await page.goto('/settings')

    const localButton = page.getByRole('button', { name: /Local/i })
    await localButton.click()

    // Verify all keys are displayed
    await expect(page.getByText('Retrieved keys')).toBeVisible({ timeout: 15000 })

    // Find the keys section and verify all keys are displayed
    const keysSection = page.locator('.space-y-2').filter({ hasText: 'Retrieved keys' })
    const keyNames = ['SONARR_API_KEY', 'RADARR_API_KEY', 'PROWLARR_API_KEY', 'READARR_API_KEY', 'LIDARR_API_KEY', 'BAZARR_API_KEY']
    for (const keyName of keyNames) {
      await expect(keysSection.getByText(keyName, { exact: true })).toBeVisible()
    }
  })

  test('handles API errors gracefully', async ({ page }) => {
    await page.route('**/api/arr/bootstrap', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    })

    await page.goto('/settings')

    const localButton = page.getByRole('button', { name: /Local/i })
    await localButton.click()

    // Should show error message
    await expect(page.getByText(/Bootstrap failed/i)).toBeVisible({ timeout: 15000 })
  })
})
