import { defineConfig } from '@playwright/test'

const uiPort = Number(process.env.PLAYWRIGHT_UI_PORT || process.env.PW_PORT || 5175)
const uiBaseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${uiPort}`

// Production build served by `vite preview`, for tests that measure what users actually
// download (the dev server ships ~8 MB of unbundled modules). Tests read the URL from env.
const previewPort = Number(process.env.PLAYWRIGHT_PREVIEW_PORT || 4175)
const previewURL = process.env.PLAYWRIGHT_PREVIEW_URL || `http://localhost:${previewPort}`
process.env.PLAYWRIGHT_PREVIEW_URL = previewURL

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
    {
      command: `npx vite build && npx vite preview --port ${previewPort} --strictPort`,
      url: previewURL,
      reuseExistingServer: true,
      timeout: 180000,
    },
  ],
})
