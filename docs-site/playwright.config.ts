import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5175',
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
      command: 'npm run dev -- --port 5175 --strictPort',
      url: 'http://localhost:5175',
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
})
