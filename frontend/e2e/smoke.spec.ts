import { test, expect } from './fixtures'

// Smoke test E2E: la app carga y la pantalla de login se renderiza.
// Correr: `bunx playwright install chromium` (una vez) y luego `bun run test:e2e`.
test.describe('smoke', () => {
  test('la app monta y muestra el login', async ({ page }) => {
    await page.goto('/')
    // La SPA redirige a /auth cuando no hay sesión; el <div id="app"> debe existir.
    await expect(page.locator('#app')).toBeVisible()
    await expect(page).toHaveTitle(/.+/)
  })

  test('una vista interna carga con sesión inyectada', async ({ page, loginAs }) => {
    await loginAs(page, { role: 'hotel_admin' })
    await page.goto('/panel/dashboard')
    await expect(page.locator('#app')).toBeVisible()
  })
})
