import { defineConfig } from '@playwright/test'

const uiPort = Number(process.env.PLAYWRIGHT_UI_PORT || process.env.PW_PORT || 5175)
const uiBaseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${uiPort}`

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: uiBaseURL,
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command:
        'cd .. && npm -w control-server run build && PORT=3001 CONTROL_SERVER_HOST=127.0.0.1 LOG_LEVEL=warn node control-server/dist/index.js',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: `npm run dev -- --port ${uiPort} --strictPort`,
      url: uiBaseURL,
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
})
