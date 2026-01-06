import { test, expect } from '@playwright/test'

test.describe('Backup Wizard Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear persisted backup wizard state to ensure fresh start
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.removeItem('backup-store')
    })

    // Mock control-server API endpoints
    // Mock backup discovery endpoint
    await page.route('**/api/backup/discover', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          targets: [
            {
              type: 'config',
              name: 'sonarr-config',
              path: '/config',
              service: 'sonarr',
              estimatedSize: 1048576, // 1MB
            },
            {
              type: 'database',
              name: 'sonarr-db',
              path: '/config/sonarr.db',
              service: 'sonarr',
              estimatedSize: 5242880, // 5MB
            },
            {
              type: 'volume',
              name: 'media-volume',
              path: '/media',
              estimatedSize: 1073741824, // 1GB
            },
          ],
          totalSize: 1079033856,
          count: 3,
        }),
      })
    })

    // Mock test connection endpoint
    await page.route('**/api/backup/test-connection', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Connection successful',
        }),
      })
    })

    // Mock backup create endpoint
    await page.route('**/api/backup/create', async (route) => {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          backupId: 'test-backup-123',
        }),
      })
    })

    // Mock backup progress endpoint
    await page.route('**/api/backup/status/*', async (route) => {
      const url = route.request().url()
      const backupId = url.split('/').pop()

      // Simulate completed backup
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: backupId,
          status: 'completed',
          currentOperation: 'Backup completed',
          itemsProcessed: 3,
          itemsTotal: 3,
          bytesProcessed: 1079033856,
          bytesTotal: 1079033856,
          startedAt: new Date().toISOString(),
          transferSpeed: 10485760, // 10MB/s
        }),
      })
    })
  })

  test('navigates to backup wizard and completes full flow', async ({ page }) => {
    test.setTimeout(120000)

    // Navigate to backup wizard
    await page.goto('/backup/new')
    await expect(page.getByRole('heading', { name: /backup wizard/i })).toBeVisible({ timeout: 15000 })

    // Step 0: Destination Configuration
    await expect(page.getByText('Destination', { exact: true })).toBeVisible()

    // Select Local destination tab
    await page.getByRole('button', { name: /local/i }).click()

    // Fill in local path
    const pathInput = page.locator('input[placeholder*="path"], input[placeholder*="/backup"]').first()
    await pathInput.fill('/opt/backups')
    await expect(pathInput).toHaveValue('/opt/backups')

    // Test connection (optional)
    const testButton = page.getByRole('button', { name: /test connection/i })
    if (await testButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await testButton.click()
      await expect(page.getByText(/connection successful/i)).toBeVisible({ timeout: 5000 })
    }

    // Proceed to next step
    await page.getByRole('button', { name: /^next$/i }).click()

    // Step 1: Item Selection
    await expect(page.getByText('Selection', { exact: true })).toBeVisible({ timeout: 10000 })

    // Wait for items to load
    await expect(page.getByText(/sonarr-config/i)).toBeVisible({ timeout: 10000 })

    // Select all items by clicking "Select All" button
    const selectAllButton = page.getByRole('button', { name: /select all/i })
    if (await selectAllButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await selectAllButton.click()
    } else {
      // Fallback: click individual checkboxes
      const checkboxes = page.locator('input[type="checkbox"]')
      const count = await checkboxes.count()
      for (let i = 0; i < count; i++) {
        const checkbox = checkboxes.nth(i)
        if (!(await checkbox.isChecked())) {
          await checkbox.click()
        }
      }
    }

    // Verify at least one item is selected
    await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(3, { timeout: 5000 })

    // Proceed to next step
    await page.getByRole('button', { name: /^next$/i }).click()

    // Step 2: Encryption Configuration
    await expect(page.getByText('Encryption', { exact: true })).toBeVisible({ timeout: 10000 })

    // Enable encryption
    const encryptionToggle = page.locator('button[role="switch"]').first()
    await encryptionToggle.click()

    // Fill in password
    const passwordInputs = page.locator('input[type="password"]')
    const passwordInput = passwordInputs.first()
    await passwordInput.fill('MySecurePassword123!')
    await expect(passwordInput).toHaveValue('MySecurePassword123!')

    // Fill in confirm password
    const confirmPasswordInput = passwordInputs.nth(1)
    await confirmPasswordInput.fill('MySecurePassword123!')
    await expect(confirmPasswordInput).toHaveValue('MySecurePassword123!')

    // Wait for password strength indicator
    await page.waitForTimeout(500)

    // Proceed to next step
    await page.getByRole('button', { name: /^next$/i }).click()

    // Step 3: Schedule Configuration
    await expect(page.getByText('Schedule', { exact: true })).toBeVisible({ timeout: 10000 })

    // Enable scheduling
    const scheduleToggle = page.locator('button[role="switch"]').first()
    if (await scheduleToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      const isEnabled = await scheduleToggle.getAttribute('data-state')
      if (isEnabled !== 'checked') {
        await scheduleToggle.click()
      }

      // Select daily frequency
      await page.getByText(/daily/i).click()

      // Set time
      const timeInput = page.locator('input[type="time"]')
      if (await timeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await timeInput.fill('02:00')
      }

      // Set retention count
      const retentionInput = page.locator('input[type="number"]')
      if (await retentionInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await retentionInput.fill('7')
      }
    }

    // Proceed to next step
    await page.getByRole('button', { name: /^next$/i }).click()

    // Step 4: Review and Execute
    await expect(page.getByText('Review', { exact: true })).toBeVisible({ timeout: 10000 })

    // Verify summary information is displayed
    await expect(page.getByText(/destination/i)).toBeVisible()
    await expect(page.getByText(/local/i)).toBeVisible()

    // Start backup
    const startButton = page.getByRole('button', { name: /start backup/i })
    await expect(startButton).toBeVisible({ timeout: 10000 })
    await startButton.click()

    // Wait for backup to initiate
    await page.waitForTimeout(1000)

    // Verify progress display appears
    await expect(page.getByText(/progress|status/i)).toBeVisible({ timeout: 10000 })

    // Wait for completion (mocked to return completed immediately)
    await expect(page.getByText(/completed|success/i)).toBeVisible({ timeout: 15000 })

    console.log('✅ Backup wizard flow completed successfully')
  })

  test('validates required fields at each step', async ({ page }) => {
    await page.goto('/backup/new')
    await expect(page.getByRole('heading', { name: /backup wizard/i })).toBeVisible({ timeout: 15000 })

    // Step 0: Try to proceed without configuring destination
    const nextButton = page.getByRole('button', { name: /^next$/i })
    await nextButton.click()

    // Should show error toast
    await expect(page.getByText(/configure.*destination/i)).toBeVisible({ timeout: 5000 })

    // Configure destination
    await page.getByRole('button', { name: /local/i }).click()
    const pathInput = page.locator('input[placeholder*="path"], input[placeholder*="/backup"]').first()
    await pathInput.fill('/opt/backups')

    // Now proceed
    await nextButton.click()

    // Step 1: Try to proceed without selecting items
    await expect(page.getByText('Selection', { exact: true })).toBeVisible({ timeout: 10000 })

    // Wait for items to load
    await page.waitForTimeout(1000)

    await nextButton.click()

    // Should show error toast
    await expect(page.getByText(/select.*item/i)).toBeVisible({ timeout: 5000 })

    // Select an item
    const firstCheckbox = page.locator('input[type="checkbox"]').first()
    await firstCheckbox.click()

    // Now proceed
    await nextButton.click()

    // Step 2: Try to proceed with encryption enabled but no password
    await expect(page.getByText('Encryption', { exact: true })).toBeVisible({ timeout: 10000 })

    // Enable encryption
    const encryptionToggle = page.locator('button[role="switch"]').first()
    await encryptionToggle.click()

    // Try to proceed without password
    await nextButton.click()

    // Should show error toast
    await expect(page.getByText(/password/i)).toBeVisible({ timeout: 5000 })

    console.log('✅ Field validation working correctly')
  })

  test('supports S3 destination configuration', async ({ page }) => {
    await page.goto('/backup/new')
    await expect(page.getByRole('heading', { name: /backup wizard/i })).toBeVisible({ timeout: 15000 })

    // Select S3 destination tab
    await page.getByRole('button', { name: /s3/i }).click()

    // Fill in S3 configuration
    const inputs = {
      endpoint: page.locator('input[placeholder*="endpoint"], input[placeholder*="s3."]').first(),
      bucket: page.locator('input[placeholder*="bucket"]').first(),
      accessKeyId: page.locator('input[placeholder*="access"], input[placeholder*="key"]').first(),
      secretAccessKey: page.locator('input[type="password"], input[placeholder*="secret"]').first(),
    }

    await inputs.endpoint.fill('https://s3.amazonaws.com')
    await inputs.bucket.fill('my-backup-bucket')
    await inputs.accessKeyId.fill('AKIAIOSFODNN7EXAMPLE')
    await inputs.secretAccessKey.fill('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')

    // Verify values are set
    await expect(inputs.endpoint).toHaveValue('https://s3.amazonaws.com')
    await expect(inputs.bucket).toHaveValue('my-backup-bucket')
    await expect(inputs.accessKeyId).toHaveValue('AKIAIOSFODNN7EXAMPLE')

    console.log('✅ S3 destination configuration successful')
  })

  test('supports rclone destination configuration', async ({ page }) => {
    await page.goto('/backup/new')
    await expect(page.getByRole('heading', { name: /backup wizard/i })).toBeVisible({ timeout: 15000 })

    // Select Rclone destination tab
    await page.getByRole('button', { name: /rclone/i }).click()

    // Fill in Rclone configuration
    const remoteNameInput = page.locator('input[placeholder*="remote"], input[placeholder*="name"]').first()
    const remotePathInput = page.locator('input[placeholder*="path"]').first()

    await remoteNameInput.fill('google-drive')
    await remotePathInput.fill('/backups')

    // Verify values are set
    await expect(remoteNameInput).toHaveValue('google-drive')
    await expect(remotePathInput).toHaveValue('/backups')

    console.log('✅ Rclone destination configuration successful')
  })

  test('allows skipping optional encryption and schedule steps', async ({ page }) => {
    await page.goto('/backup/new')
    await expect(page.getByRole('heading', { name: /backup wizard/i })).toBeVisible({ timeout: 15000 })

    // Configure destination
    await page.getByRole('button', { name: /local/i }).click()
    const pathInput = page.locator('input[placeholder*="path"], input[placeholder*="/backup"]').first()
    await pathInput.fill('/opt/backups')
    await page.getByRole('button', { name: /^next$/i }).click()

    // Select items
    await expect(page.getByText('Selection', { exact: true })).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(1000)
    const selectAllButton = page.getByRole('button', { name: /select all/i })
    if (await selectAllButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await selectAllButton.click()
    }
    await page.getByRole('button', { name: /^next$/i }).click()

    // Skip encryption (don't enable toggle)
    await expect(page.getByText('Encryption', { exact: true })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /^next$/i }).click()

    // Skip schedule (don't enable toggle)
    await expect(page.getByText('Schedule', { exact: true })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /^next$/i }).click()

    // Should reach review step
    await expect(page.getByText('Review', { exact: true })).toBeVisible({ timeout: 10000 })

    console.log('✅ Optional steps can be skipped')
  })

  test('back navigation preserves form state', async ({ page }) => {
    await page.goto('/backup/new')
    await expect(page.getByRole('heading', { name: /backup wizard/i })).toBeVisible({ timeout: 15000 })

    // Configure destination
    await page.getByRole('button', { name: /local/i }).click()
    const pathInput = page.locator('input[placeholder*="path"], input[placeholder*="/backup"]').first()
    await pathInput.fill('/opt/backups')
    await page.getByRole('button', { name: /^next$/i }).click()

    // Select items
    await expect(page.getByText('Selection', { exact: true })).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(1000)
    const selectAllButton = page.getByRole('button', { name: /select all/i })
    if (await selectAllButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await selectAllButton.click()
    }
    await page.getByRole('button', { name: /^next$/i }).click()

    // Go to encryption step
    await expect(page.getByText('Encryption', { exact: true })).toBeVisible({ timeout: 10000 })

    // Go back to selection
    await page.getByRole('button', { name: /^back$/i }).click()
    await expect(page.getByText('Selection', { exact: true })).toBeVisible({ timeout: 10000 })

    // Verify selections are preserved
    await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(3, { timeout: 5000 })

    // Go back to destination
    await page.getByRole('button', { name: /^back$/i }).click()
    await expect(page.getByText('Destination', { exact: true })).toBeVisible({ timeout: 10000 })

    // Verify destination is preserved
    const preservedPathInput = page.locator('input[placeholder*="path"], input[placeholder*="/backup"]').first()
    await expect(preservedPathInput).toHaveValue('/opt/backups')

    console.log('✅ Back navigation preserves form state')
  })

  test('displays password strength indicator', async ({ page }) => {
    await page.goto('/backup/new')
    await expect(page.getByRole('heading', { name: /backup wizard/i })).toBeVisible({ timeout: 15000 })

    // Navigate to encryption step
    await page.getByRole('button', { name: /local/i }).click()
    const pathInput = page.locator('input[placeholder*="path"], input[placeholder*="/backup"]').first()
    await pathInput.fill('/opt/backups')
    await page.getByRole('button', { name: /^next$/i }).click()

    await expect(page.getByText('Selection', { exact: true })).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(1000)
    const selectAllButton = page.getByRole('button', { name: /select all/i })
    if (await selectAllButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await selectAllButton.click()
    }
    await page.getByRole('button', { name: /^next$/i }).click()

    await expect(page.getByText('Encryption', { exact: true })).toBeVisible({ timeout: 10000 })

    // Enable encryption
    const encryptionToggle = page.locator('button[role="switch"]').first()
    await encryptionToggle.click()

    // Test weak password
    const passwordInput = page.locator('input[type="password"]').first()
    await passwordInput.fill('weak')
    await page.waitForTimeout(300)

    // Should show strength indicator
    const strengthText = page.getByText(/weak|fair|good|strong|excellent/i)
    await expect(strengthText).toBeVisible({ timeout: 5000 })

    // Test stronger password
    await passwordInput.fill('StrongPassword123!')
    await page.waitForTimeout(300)

    // Should show better strength
    await expect(page.getByText(/good|excellent/i)).toBeVisible({ timeout: 5000 })

    console.log('✅ Password strength indicator working')
  })
})
