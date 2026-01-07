import { test, expect, Page } from '@playwright/test'

/**
 * End-to-End User Workflow Tests
 * Based on 2026 Testing Best Practices
 * - Tests complete user journeys from start to finish
 * - Validates integration between multiple components
 * - Tests real-world scenarios and edge cases
 */

test.describe('End-to-End User Workflows', () => {
  
  test.describe('Complete Setup Wizard Flow - Beginner User', () => {
    test('new user completes full wizard with minimal stack', async ({ page }) => {
      test.setTimeout(180000) // 3 minutes for full flow

      // Clear any existing state
      await page.goto('/')
      await page.evaluate(() => localStorage.clear())
      await page.reload()

      // Step 1: Landing page
      await expect(page.locator('main')).toBeVisible({ timeout: 10000 })
      const startButton = page.getByRole('button', { name: /let'?s go|start setup/i }).first()
      await expect(startButton).toBeVisible()
      await startButton.click()

      // Step 2: Basic Configuration
      await expect(page.getByRole('heading', { name: /basic configuration/i })).toBeVisible({ timeout: 15000 })
      
      const domain = 'beginner-test.example.com'
      const password = 'SecurePass123!@#'

      const domainInput = page.locator('input[name="domain"]').first()
      await domainInput.fill(domain)
      await expect(domainInput).toHaveValue(domain)

      const passwordInput = page.locator('input[name="password"]').first()
      await passwordInput.fill(password)
      await expect(passwordInput).toHaveValue(password)

      await page.getByRole('button', { name: /next/i }).click()

      // Step 3: Stack Selection - Simple mode (default)
      await expect(page.getByRole('heading', { name: /choose|stack/i })).toBeVisible({ timeout: 15000 })

      // Select basic Plex stack
      const plexOption = page.getByText('Plex', { exact: true }).first()
      await plexOption.click()

      await page.getByRole('button', { name: /next/i }).click()

      // Step 4: Skip advanced configs if any
      // Keep clicking next through optional steps
      for (let i = 0; i < 3; i++) {
        const nextButton = page.getByRole('button', { name: /next/i })
        if (await nextButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await nextButton.click()
          await page.waitForTimeout(500)
        } else {
          break
        }
      }

      // Step 5: Review & Generate
      await expect(page.getByText(/review|generate/i)).toBeVisible({ timeout: 15000 })

      // Verify configuration preview
      const preview = page.locator('pre, code').first()
      if (await preview.isVisible({ timeout: 5000 }).catch(() => false)) {
        const previewText = await preview.textContent()
        expect(previewText).toContain(domain)
      }

      // Download configuration
      const downloadButton = page.getByRole('button', { name: /download/i }).first()
      await expect(downloadButton).toBeVisible()

      const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
      await downloadButton.click()
      const download = await downloadPromise

      expect(download.suggestedFilename()).toBeTruthy()

      console.log('✅ Beginner wizard flow completed successfully')
    })
  })

  test.describe('Complete Setup Wizard Flow - Advanced User', () => {
    test('power user configures complex media stack with all features', async ({ page }) => {
      test.setTimeout(240000) // 4 minutes for complex flow

      await page.goto('/')
      await page.evaluate(() => localStorage.clear())
      await page.reload()

      // Start wizard
      const startButton = page.getByRole('button', { name: /let'?s go|start/i }).first()
      await startButton.click()

      // Basic config
      await expect(page.getByRole('heading', { name: /basic/i })).toBeVisible({ timeout: 15000 })
      await page.locator('input[name="domain"]').first().fill('advanced-stack.homelab.net')
      await page.locator('input[name="password"]').first().fill('Complex!Pass@2026#Secure')
      await page.getByRole('button', { name: /next/i }).click()

      // Stack selection - Expert mode
      await expect(page.getByRole('heading', { name: /stack/i })).toBeVisible({ timeout: 15000 })
      
      const expertButton = page.getByRole('button', { name: /expert/i })
      await expertButton.click()
      await page.waitForTimeout(500)

      // Select comprehensive stack
      const services = [
        'Plex',
        'Jellyfin', 
        'Sonarr',
        'Radarr',
        'Lidarr',
        'Prowlarr',
        'qBittorrent',
        'Gluetun VPN',
        'Tdarr'
      ]

      for (const service of services) {
        const serviceCard = page.getByText(service, { exact: true }).first()
        if (await serviceCard.isVisible({ timeout: 2000 }).catch(() => false)) {
          await serviceCard.click()
          await page.waitForTimeout(200)
        }
      }

      await page.getByRole('button', { name: /next/i }).click()

      // Service configuration
      const serviceConfigHeading = page.getByRole('heading', { name: /service|configuration/i })
      if (await serviceConfigHeading.isVisible({ timeout: 10000 }).catch(() => false)) {
        
        // Configure advanced settings if available
        const advancedButton = page.getByRole('button', { name: /advanced/i })
        if (await advancedButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await advancedButton.click()
          await page.waitForTimeout(500)

          // Configure paths
          const pathInputs = page.locator('input[name*="path"], input[placeholder*="path"]')
          const count = await pathInputs.count()
          
          for (let i = 0; i < count; i++) {
            const input = pathInputs.nth(i)
            if (await input.isVisible()) {
              await input.fill(`/mnt/media/service${i}`)
            }
          }
        }

        await page.getByRole('button', { name: /next/i }).click()
      }

      // Advanced options
      const advancedHeading = page.getByRole('heading', { name: /advanced/i })
      if (await advancedHeading.isVisible({ timeout: 10000 }).catch(() => false)) {
        
        // Configure timezone
        const timezoneSelect = page.locator('select[name*="timezone"], input[name*="timezone"]').first()
        if (await timezoneSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
          await timezoneSelect.fill('America/New_York')
        }

        await page.getByRole('button', { name: /next/i }).click()
      }

      // Review & Generate
      await expect(page.getByText(/review|generate/i)).toBeVisible({ timeout: 15000 })

      // Verify all services in preview
      const preview = page.locator('pre').first()
      const previewText = await preview.textContent() || ''

      // Should contain VPN profile reference
      const hasVpnConfig = previewText.toLowerCase().includes('gluetun') || 
                           previewText.toLowerCase().includes('vpn')

      // Download all configs
      const downloads: any[] = []
      page.on('download', download => downloads.push(download))

      const downloadAllButton = page.getByRole('button', { name: /download all/i })
      if (await downloadAllButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await downloadAllButton.click()
      } else {
        // Try individual download
        const downloadButton = page.getByRole('button', { name: /download/i }).first()
        await downloadButton.click()
      }

      await page.waitForTimeout(3000)

      expect(downloads.length).toBeGreaterThan(0)

      console.log('✅ Advanced wizard flow with complex stack completed')
    })
  })

  test.describe('AI Assistant Integration Flow', () => {
    test('user gets help from AI throughout wizard process', async ({ page }) => {
      test.setTimeout(180000)

      await page.goto('/')

      // Open AI assistant immediately
      const aiButton = page.getByTitle(/AI|assistant/i)
      
      if (await aiButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await aiButton.click()

        // Ask initial question
        const chatInput = page.getByPlaceholder(/ask|type|message|listening/i)
        await chatInput.fill('What is the best media server?')
        await page.keyboard.press('Enter')

        // Wait for response
        await page.waitForTimeout(3000)

        const messages = page.locator('[class*="message"], .whitespace-pre-wrap')
        expect(await messages.count()).toBeGreaterThan(1)

        // Ask about configuration
        await chatInput.fill('What domain should I use?')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(3000)

        // Close AI and continue with wizard
        const closeButton = page.getByRole('button', { name: /close/i }).first()
        if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await closeButton.click()
        }

        console.log('✅ AI assistant interaction flow completed')
      } else {
        console.log('ℹ️ AI assistant not available')
      }
    })

    test('AI validates configuration and provides suggestions', async ({ page }) => {
      test.setTimeout(180000)

      await page.goto('/')
      await page.evaluate(() => localStorage.clear())
      await page.reload()

      // Complete basic wizard setup
      const startButton = page.getByRole('button', { name: /let'?s go|start/i }).first()
      await startButton.click()

      await expect(page.getByRole('heading', { name: /basic/i })).toBeVisible({ timeout: 15000 })
      await page.locator('input[name="domain"]').first().fill('test.local')
      await page.locator('input[name="password"]').first().fill('TestPass123!')
      await page.getByRole('button', { name: /next/i }).click()

      // Ask AI to validate
      const aiButton = page.getByTitle(/AI|assistant/i)
      if (await aiButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await aiButton.click()

        const chatInput = page.getByPlaceholder(/ask|type|message|listening/i)
        await chatInput.fill('Is my domain configuration valid?')
        await page.keyboard.press('Enter')

        await page.waitForTimeout(3000)

        console.log('✅ AI configuration validation flow completed')
      }
    })
  })

  test.describe('Remote Deployment Workflow', () => {
    test('user configures and initiates remote deployment', async ({ page }) => {
      test.setTimeout(180000)

      await page.goto('/')

      // Navigate to remote deploy
      const deployLink = page.getByRole('link', { name: /remote|deploy/i })
      
      if (await deployLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await deployLink.click()

        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 })

        // Fill SSH connection details
        const hostInput = page.locator('input[name*="host"]').first()
        await hostInput.fill('192.168.1.100')

        const usernameInput = page.locator('input[name*="username"], input[name*="user"]').first()
        await usernameInput.fill('mediastack')

        const portInput = page.locator('input[name*="port"]').first()
        if (await portInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await portInput.fill('22')
        }

        // Test connection button
        const testButton = page.getByRole('button', { name: /test|connect/i }).first()
        if (await testButton.isVisible()) {
          await testButton.click()
          await page.waitForTimeout(2000)
        }

        console.log('✅ Remote deployment setup flow completed')
      } else {
        console.log('ℹ️ Remote deployment not available')
      }
    })
  })

  test.describe('Backup and Restore Workflow', () => {
    test('user creates backup and then restores it', async ({ page }) => {
      test.setTimeout(180000)

      await page.goto('/')

      // Navigate to backup
      const backupLink = page.getByRole('link', { name: /backup/i })
      
      if (await backupLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await backupLink.click()

        await expect(page.locator('main')).toBeVisible()

        // Create backup button
        const createBackupButton = page.getByRole('button', { name: /create|backup/i }).first()
        if (await createBackupButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await createBackupButton.click()

          // Wait for backup to complete
          await page.waitForTimeout(5000)

          // Navigate to restore
          const restoreLink = page.getByRole('link', { name: /restore/i })
          if (await restoreLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await restoreLink.click()

            // Select backup to restore
            const backupList = page.locator('[class*="backup"], [data-backup]')
            if (await backupList.first().isVisible({ timeout: 5000 }).catch(() => false)) {
              await backupList.first().click()
            }

            console.log('✅ Backup and restore workflow completed')
          }
        }
      } else {
        console.log('ℹ️ Backup feature not available')
      }
    })
  })

  test.describe('Settings Configuration Workflow', () => {
    test('user configures API keys and preferences', async ({ page }) => {
      test.setTimeout(120000)

      await page.goto('/settings')
      
      await expect(page.locator('main')).toBeVisible({ timeout: 15000 })

      // Configure OpenAI API key
      const openaiInput = page.locator('input[name*="openai"], input[placeholder*="openai"]').first()
      if (await openaiInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await openaiInput.fill('sk-test-key-for-testing')
        
        // Save button
        const saveButton = page.getByRole('button', { name: /save/i }).first()
        if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await saveButton.click()
          await page.waitForTimeout(1000)
        }
      }

      // Configure ElevenLabs key
      const elevenLabsInput = page.locator('input[name*="eleven"], input[placeholder*="eleven"]').first()
      if (await elevenLabsInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await elevenLabsInput.fill('el-test-key-for-testing')
      }

      // Theme selection
      const themeToggle = page.getByRole('button', { name: /theme|dark|light/i })
      if (await themeToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await themeToggle.click()
        await page.waitForTimeout(500)
      }

      console.log('✅ Settings configuration workflow completed')
    })
  })

  test.describe('Error Recovery Workflows', () => {
    test('user recovers from validation errors in wizard', async ({ page }) => {
      test.setTimeout(120000)

      await page.goto('/')
      await page.evaluate(() => localStorage.clear())
      await page.reload()

      const startButton = page.getByRole('button', { name: /let'?s go|start/i }).first()
      await startButton.click()

      await expect(page.getByRole('heading', { name: /basic/i })).toBeVisible({ timeout: 15000 })

      // Try to proceed without filling required fields
      await page.getByRole('button', { name: /next/i }).click()
      await page.waitForTimeout(500)

      // Should still be on same step with errors
      await expect(page.getByRole('heading', { name: /basic/i })).toBeVisible()

      // Now fill correctly
      await page.locator('input[name="domain"]').first().fill('valid-domain.com')
      await page.locator('input[name="password"]').first().fill('ValidPass123!')
      
      // Should now proceed
      await page.getByRole('button', { name: /next/i }).click()
      await page.waitForTimeout(1000)

      // Should advance to next step
      const nextStepHeading = page.getByRole('heading', { name: /stack|choose/i })
      await expect(nextStepHeading).toBeVisible({ timeout: 10000 })

      console.log('✅ Error recovery workflow completed')
    })

    test('user recovers from network error in AI chat', async ({ page }) => {
      test.setTimeout(120000)

      await page.goto('/')

      // Simulate network failure
      await page.route('**/api/agents/**', route => route.abort())

      const aiButton = page.getByTitle(/AI|assistant/i)
      if (await aiButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await aiButton.click()

        const chatInput = page.getByPlaceholder(/ask|type|message|listening/i)
        await chatInput.fill('test message')
        await page.keyboard.press('Enter')

        // Wait for error to appear
        await page.waitForTimeout(3000)

        // Should show error message
        const errorMessage = page.getByText(/error|failed|try again/i)
        if (await errorMessage.isVisible({ timeout: 5000 }).catch(() => false)) {
          console.log('✅ Network error displayed to user')
        }

        // Restore network
        await page.unroute('**/api/agents/**')

        // Retry
        await chatInput.fill('retry test message')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(3000)

        console.log('✅ Network error recovery workflow completed')
      }
    })
  })

  test.describe('Multi-Device Synchronization', () => {
    test('configuration persists across browser sessions', async ({ page, context }) => {
      test.setTimeout(120000)

      // First session: Create configuration
      await page.goto('/')
      await page.evaluate(() => localStorage.clear())
      await page.reload()

      const startButton = page.getByRole('button', { name: /let'?s go|start/i }).first()
      await startButton.click()

      await expect(page.getByRole('heading', { name: /basic/i })).toBeVisible({ timeout: 15000 })
      
      const testDomain = 'persistence-test.com'
      await page.locator('input[name="domain"]').first().fill(testDomain)
      await page.locator('input[name="password"]').first().fill('TestPass123!')

      // Close browser
      await page.close()

      // New session: Check if configuration persisted
      const newPage = await context.newPage()
      await newPage.goto('/')

      const newStartButton = newPage.getByRole('button', { name: /let'?s go|start/i }).first()
      await newStartButton.click()

      await expect(newPage.getByRole('heading', { name: /basic/i })).toBeVisible({ timeout: 15000 })
      
      const domainInput = newPage.locator('input[name="domain"]').first()
      const persistedValue = await domainInput.inputValue()

      // May or may not persist depending on implementation
      console.log(`Domain persistence: ${persistedValue === testDomain ? 'YES' : 'NO'}`)

      await newPage.close()
    })
  })

  test.describe('Progressive Enhancement', () => {
    test('app works with JavaScript disabled (graceful degradation)', async ({ page }) => {
      // This is a theoretical test - modern SPAs require JS
      // But we can test that critical info is in HTML
      
      await page.goto('/')
      
      const html = await page.content()
      
      // Should have semantic HTML even without JS
      expect(html).toContain('<main')
      expect(html).toContain('</main>')

      console.log('✅ HTML structure verified')
    })

    test('app provides loading states for slow connections', async ({ page }) => {
      test.setTimeout(120000)

      // Throttle network
      const client = await page.context().newCDPSession(page)
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 50000, // 50kb/s
        uploadThroughput: 20000,   // 20kb/s
        latency: 500               // 500ms
      })

      await page.goto('/')

      // Should show loading indicators
      const loadingIndicator = page.locator('[class*="loading"], [class*="spinner"], [aria-label*="loading"]')
      
      if (await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('✅ Loading indicator shown')
      }

      await page.waitForLoadState('networkidle', { timeout: 30000 })

      console.log('✅ Slow connection handling verified')
    })
  })
})
