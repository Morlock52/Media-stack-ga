import { defineConfig } from '@playwright/test'

const uiBaseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002'

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: uiBaseURL,
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: [],
})
