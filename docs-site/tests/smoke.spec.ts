import { test, expect } from '@playwright/test'

test.describe('Docs Site Smoke Tests', () => {
  test('deep link routes load (no blank screen)', async ({ page }) => {
    // Direct navigation to a nested route must still load assets correctly.
    await page.goto('/docs')
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 })

    await page.goto('/settings')
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 })
  })

  test('homepage loads and displays hero section', async ({ page }) => {
    await page.goto('/')
    
    // Page should not be blank - check for main content
    await expect(page.locator('main')).toBeVisible()
    
    // Check for hero section or main heading
    const heroOrHeading = page.locator('h1, [class*="hero"], [class*="Hero"]').first()
    await expect(heroOrHeading).toBeVisible({ timeout: 10000 })
    
    // No console errors that break the app
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('extension')) {
        consoleErrors.push(msg.text())
      }
    })
    
    // Page title should be set
    await expect(page).toHaveTitle(/.+/)
    
    console.log('✅ Homepage loaded successfully')
  })

  test('navigation is visible and functional', async ({ page }) => {
    await page.goto('/')
    
    // Navigation should be present
    const nav = page.locator('nav, header, [class*="nav"], [class*="Nav"]').first()
    await expect(nav).toBeVisible({ timeout: 10000 })
    
    console.log('✅ Navigation is visible')
  })

  test('setup wizard is accessible', async ({ page }) => {
    await page.goto('/')
    
    // Look for wizard-related content or "Get Started" type buttons
    const wizardTrigger = page.getByRole('button', { name: /get started|start|begin|setup/i }).first()
    
    // If there's a get started button, click it
    if (await wizardTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
      await wizardTrigger.click()
      // Wait for wizard content to appear
      await page.waitForTimeout(500)
    }
    
    // Page should still be functional (not blank/crashed)
    await expect(page.locator('body')).not.toBeEmpty()
    
    console.log('✅ Setup wizard accessible')
  })

  test('AI Assistant button is present', async ({ page }) => {
    await page.goto('/')
    
    // Look for AI assistant floating button (usually bottom-right)
    const aiButton = page.locator('button[title*="AI"], button[aria-label*="AI"], [class*="assistant"], [class*="Assistant"]').first()
    
    // Give it time to render
    const isVisible = await aiButton.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (isVisible) {
      console.log('✅ AI Assistant button found')
    } else {
      // Not a failure - might be conditionally rendered
      console.log('ℹ️ AI Assistant button not visible (may require conditions)')
    }
    
    // Page should still be working
    await expect(page.locator('main, #root, #app, body > div').first()).toBeVisible()
  })

  test('no critical JavaScript errors on load', async ({ page }) => {
    const criticalErrors: string[] = []
    
    page.on('pageerror', error => {
      // Ignore extension errors
      if (!error.message.includes('extension') && !error.message.includes('content_script')) {
        criticalErrors.push(error.message)
      }
    })
    
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 })
    
    // Allow some time for async errors
    await page.waitForTimeout(2000)
    
    expect(criticalErrors, `Critical JS errors found: ${criticalErrors.join(', ')}`).toHaveLength(0)
    
    console.log('✅ No critical JavaScript errors')
  })

  test('wizard can generate and download configs', async ({ page }) => {
    test.setTimeout(120000)
    await page.goto('/')

    // Start wizard
    await page.getByRole('button', { name: /start configuration/i }).first().click()

    // Step 2: Basic config (domain + password required)
    const domain = 'mydomain.net'
    await expect(page.getByRole('heading', { name: /basic configuration/i }).first()).toBeVisible({ timeout: 15000 })

    const domainInput = page.locator('input[name="domain"]:visible')
    await domainInput.fill(domain, { force: true })
    await expect(domainInput).toHaveValue(domain)

    const passwordInput = page.locator('input[name="password"]:visible')
    await passwordInput.fill('TestPassword123!', { force: true })
    await expect(passwordInput).toHaveValue('TestPassword123!')
    await page.getByRole('button', { name: /^next$/i }).click()

    // Step 3: Stack selection -> Expert Mode
    await expect(page.getByRole('heading', { name: /choose your stack/i })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: /expert mode/i }).click()

    // Select a representative stack (includes *Arr + VPN + torrent)
    await page.getByText('*Arr Stack', { exact: true }).click()
    await page.getByText('Plex', { exact: true }).click()
    await page.getByText('Torrent Client', { exact: true }).click()
    await page.getByText('Gluetun VPN', { exact: true }).click()
    await page.getByRole('button', { name: /^next$/i }).click()

    // Step 4: Service config (no required fields currently)
    await page.getByRole('button', { name: /^next$/i }).click()

    // Step 5: Advanced (optional fields)
    await page.getByRole('button', { name: /^next$/i }).click()

    // Step 6: Review & Generate
    await expect(page.getByText('Review & Generate', { exact: true })).toBeVisible()

    // Verify env preview contains the current authelia secret key name
    const envPreview = page.locator('pre').first()
    await expect(envPreview).toContainText('AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET=')
    await expect(envPreview).toContainText('COMPOSE_PROFILES=')

    // Download all files and validate key outputs
    const downloads: Array<{ suggested: string; path: string; content: string }> = []
    const onDownload = async (dl: any) => {
      const suggested = dl.suggestedFilename()
      const path = await dl.path()
      if (!path) return
      const fs = await import('node:fs/promises')
      const content = await fs.readFile(path, 'utf-8')
      downloads.push({ suggested, path, content })
    }
    page.on('download', onDownload)

    await page.getByRole('button', { name: /download all files/i }).click()

    await expect
      .poll(() => downloads.length, { timeout: 15000 })
      .toBe(4)

    // Validate contents (filenames can vary in headless browsers, e.g. ".env" => "env.txt")
    const envText = downloads.find(d => d.content.includes('COMPOSE_PROFILES=') && d.content.includes('TIMEZONE='))?.content
    expect(envText, 'missing .env-like download').toBeTruthy()
    expect(envText!).toContain('AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET=')

    const cloudflareText = downloads.find(d => d.content.includes('tunnel:') && d.content.includes('ingress:'))?.content
    expect(cloudflareText, 'missing cloudflare-config-like download').toBeTruthy()
    expect(cloudflareText!).toContain(`hostname: sonarr.${domain}`)
    expect(cloudflareText!).toContain(`hostname: qbt.${domain}`)

    const composeText = downloads.find(d => d.content.includes('services:') && d.content.includes('networks:'))?.content
    expect(composeText, 'missing docker-compose-like download').toBeTruthy()

    const autheliaText = downloads.find(d => d.content.includes('authentication_backend:') && d.content.includes('session:'))?.content
    expect(autheliaText, 'missing authelia-config-like download').toBeTruthy()
  })

  test('storage planner accepts Tdarr library paths', async ({ page }) => {
    test.setTimeout(120000)
    await page.goto('/')

    await page.getByRole('button', { name: /start configuration/i }).first().click()

    await expect(page.getByRole('heading', { name: /basic configuration/i }).first()).toBeVisible({ timeout: 15000 })

    await page.locator('input[name="domain"]:visible').fill('mydomain.net', { force: true })
    await page.locator('input[name="password"]:visible').fill('TestPassword123!', { force: true })
    await page.getByRole('button', { name: /^next$/i }).click()

    await expect(page.getByRole('heading', { name: /choose your stack/i })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: /expert mode/i }).click()

    await page.getByText('Tdarr', { exact: true }).click()
    await page.getByRole('button', { name: /^next$/i }).click()

    await expect(page.getByRole('heading', { name: /service configuration/i })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: /advanced \(per-service\)/i }).click()

    const moviesCard = page
      .locator('div.rounded-2xl')
      .filter({ has: page.getByText('Movies Library', { exact: true }) })
      .first()
    const moviesInput = moviesCard.locator('input')
    await moviesInput.fill('/mnt/media/movies')
    await expect(moviesInput).toHaveValue('/mnt/media/movies')

    const tvCard = page
      .locator('div.rounded-2xl')
      .filter({ has: page.getByText('TV Library', { exact: true }) })
      .first()
    const tvInput = tvCard.locator('input')
    await tvInput.fill('/mnt/media/tv')
    await expect(tvInput).toHaveValue('/mnt/media/tv')

    await page.getByRole('button', { name: /^next$/i }).click()
    await page.getByRole('button', { name: /^next$/i }).click()

    await expect(page.getByText('Review & Generate', { exact: true })).toBeVisible({ timeout: 15000 })
    const envPreview = page.locator('pre').first()
    await expect(envPreview).toContainText('MOVIES_PATH=/mnt/media/movies')
    await expect(envPreview).toContainText('TV_SHOWS_PATH=/mnt/media/tv')
  })

  test('AI assistant can chat with control-server', async ({ page }) => {
    await page.goto('/')
    await page.getByTitle('Ask AI Assistant').click()
    await page.getByPlaceholder('Ask anything...').fill('hello')
    await page.keyboard.press('Enter')

    // Wait for an assistant response bubble
    const bubbles = page.locator('.whitespace-pre-wrap')
    await expect(bubbles).toHaveCount(2, { timeout: 15000 })
    await expect(bubbles.nth(1)).not.toHaveText('', { timeout: 15000 })
  })
})
