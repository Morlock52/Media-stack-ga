import { test, expect } from '@playwright/test'

test.describe('UI Review Screenshots (manual)', () => {
  test.skip(!process.env.UI_REVIEW, 'Set UI_REVIEW=1 to generate screenshots')

  const shots = async (page: any, name: string) => {
    await page.waitForTimeout(250)
    // Use viewport screenshots (not full page) for README-friendly framing.
    await page.screenshot({ path: `test-results/ui-review/${name}.png`, fullPage: false })
  }

  test('capture key screens', async ({ page }) => {
    test.setTimeout(180000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 })
    await shots(page, '01-home-desktop')

    // Wizard: jump into step 1 and step 2 and final review
    await page.getByRole('button', { name: /start configuration/i }).click()
    await expect(page.getByRole('heading', { name: /basic configuration/i })).toBeVisible({ timeout: 15000 })
    await shots(page, '02-wizard-step1-desktop')

    // Tools dialog (import/export/templates)
    await page.getByRole('button', { name: /^tools$/i }).click()
    await expect(page.getByText('Wizard Tools', { exact: true })).toBeVisible({ timeout: 15000 })
    await shots(page, '03-wizard-tools-desktop')
    await page.keyboard.press('Escape')

    await page.locator('input[name="domain"]:visible').fill('mydomain.net')
    await page.locator('input[name="password"]:visible').fill('TestPassword123!')
    await page.getByRole('button', { name: /^next$/i }).click()
    await expect(page.getByRole('heading', { name: /choose your stack/i })).toBeVisible({ timeout: 15000 })
    await shots(page, '04-wizard-step2-desktop')

    // Voice companion (newbie mode)
    await page.getByRole('button', { name: /newbie mode/i }).click()
    // The voice companion overlay may render multiple headings; key on the header text.
    await expect(page.getByText(/newbie onboarding/i)).toBeVisible({ timeout: 15000 })
    await shots(page, '05-voice-companion-desktop')
    await page.getByRole('button', { name: /^cancel$/i }).click()

    // Newbie mode disables selection; switch to customize/expert mode.
    await page.getByRole('button', { name: /customize/i }).click()
    await expect(page.getByText('Torrent Client', { exact: true })).toBeVisible({ timeout: 15000 })
    await page.getByText('*Arr Stack', { exact: true }).click()
    await page.getByText('Plex', { exact: true }).click()
    await page.getByText('Torrent Client', { exact: true }).click()
    await page.getByText('Gluetun VPN', { exact: true }).click()
    await page.getByRole('button', { name: /^next$/i }).click()

    // Service config (includes Storage Planner + SVG export controls)
    await expect(page.getByRole('heading', { name: /service configuration/i })).toBeVisible({ timeout: 15000 })
    await shots(page, '06-service-config-desktop')

    await page.getByRole('button', { name: /^next$/i }).click()
    await page.getByRole('button', { name: /^next$/i }).click()
    await expect(page.getByText('Review & Generate', { exact: true })).toBeVisible({ timeout: 15000 })
    await shots(page, '07-wizard-review-desktop')

    // AI assistant open (floating chat)
    await page.getByTitle('Ask AI Assistant').click()
    await expect(page.getByRole('heading', { name: /AI Stack Guide/i })).toBeVisible({ timeout: 15000 })
    await shots(page, '08-ai-assistant-desktop')
    await page.getByTitle('Close').click()

    // Remote deploy modal (only available on late steps)
    await page.getByRole('button', { name: /deploy to server/i }).click()
    await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 15000 })
    await shots(page, '09-remote-deploy-desktop')
    await page.getByRole('button', { name: /close modal/i }).click()

    // Docs page
    await page.goto('/docs')
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 })
    await shots(page, '10-docs-desktop')

    // Docs guide modal open
    await page.getByText('Plex', { exact: true }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 })
    await shots(page, '11-docs-modal-desktop')
    await page.keyboard.press('Escape')

    // Settings page
    await page.goto('/settings')
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 })
    await shots(page, '12-settings-desktop')
  })

  test('capture mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 })
    await shots(page, '13-home-mobile')
  })
})
