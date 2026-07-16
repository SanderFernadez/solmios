import { defineConfig, devices } from '@playwright/test'

// Infra E2E (Playwright). Los specs viven en e2e/.
// Requiere descargar el browser una vez: `bunx playwright install chromium`.
// El webServer levanta Vite automáticamente si no hay uno corriendo en :5173.
const PORT = Number(process.env.E2E_PORT || 5173)
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `bun run dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
