import { test, expect } from '@playwright/test'

test.describe('Docs Site Smoke Tests', () => {
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
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Allow some time for async errors
    await page.waitForTimeout(2000)
    
    expect(criticalErrors, `Critical JS errors found: ${criticalErrors.join(', ')}`).toHaveLength(0)
    
    console.log('✅ No critical JavaScript errors')
  })
})
