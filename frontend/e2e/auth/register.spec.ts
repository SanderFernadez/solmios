import { test, expect } from '../fixtures'

// Alta pública (`/registro`, pages/auth/register.vue) — flujo de 2 pasos:
//   1) datos de la persona (nombre, email, contraseña) → "Continuar"
//   2) datos del hotel (nombre obligatorio) + aceptar términos → crea la cuenta y entra al panel
//
// Corre contra el backend real de dev (proxy /api → :3001, ver vite.config.ts) y el signup
// PERSISTE un hotel nuevo en la SQLite local en cada corrida — es intencional (es un E2E real,
// no mockeado), no correr esto contra producción. El endpoint tiene rate-limit por IP
// (20 intentos / 5 min, ver shared/middlewares/rate-limit.ts): correr el archivo muchas veces
// seguidas en poco tiempo puede toparlo.
//
// Email único por corrida (timestamp + random) para no chocar con "ya existe una cuenta con
// ese email" de una corrida anterior.
function uniqueEmail(): string {
  return `e2e.registro.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`
}

// Cumple shared/password-policy.ts: 10+ caracteres, mayúscula, minúscula, número,
// no está en el diccionario de comunes, no es un solo carácter repetido.
const VALID_PASSWORD = 'Solmios2026Segura!'

test.describe('registro público', () => {
  test('completa los 2 pasos y entra al panel', async ({ page }) => {
    const email = uniqueEmail()

    await page.goto('/registro')

    // — Paso 1: la persona —
    await expect(page.getByTestId('register-step1-submit')).toBeDisabled()
    await page.getByTestId('register-owner-name').fill('QA Automatizada')
    await page.getByTestId('register-email').fill(email)
    await page.getByTestId('register-password').fill(VALID_PASSWORD)
    await expect(page.getByTestId('register-step1-submit')).toBeEnabled()
    await page.getByTestId('register-step1-submit').click()

    // — Paso 2: el hotel —
    await expect(page.getByTestId('register-hotel-name')).toBeVisible()
    await page.getByTestId('register-hotel-name').fill(`Hotel E2E ${Date.now()}`)
    await expect(page.getByTestId('register-submit')).toBeDisabled() // falta aceptar términos
    await page.getByTestId('register-terms-checkbox').check()
    await expect(page.getByTestId('register-submit')).toBeEnabled()
    await page.getByTestId('register-submit').click()

    // El alta loguea automáticamente y redirige al panel (ver submit() en register.vue).
    await expect(page).toHaveURL(/\/panel\/dashboard/, { timeout: 15_000 })
    await expect(page.getByTestId('register-error')).not.toBeAttached()
  })

  test('paso 1 no avanza con contraseña débil', async ({ page }) => {
    await page.goto('/registro')
    await page.getByTestId('register-owner-name').fill('QA Automatizada')
    await page.getByTestId('register-email').fill(uniqueEmail())
    await page.getByTestId('register-password').fill('123')
    await expect(page.getByTestId('register-step1-submit')).toBeDisabled()
    // Sigue en paso 1: el campo del hotel (paso 2) todavía no existe en el DOM.
    await expect(page.getByTestId('register-hotel-name')).toHaveCount(0)
  })
})
