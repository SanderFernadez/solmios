import { test as base, expect, type Page } from '@playwright/test'

// Fixtures E2E reutilizables.
// - `loginAs`: inyecta una sesión FALSA en localStorage para saltar la pantalla de auth cuando
//   el test solo necesita llegar a una vista interna y el login en sí no es lo que se prueba.
// - `loginAsUI`: hace un login REAL contra el backend, tipeando el form (`/login`). Usar cuando
//   el flujo bajo prueba empieza en la sesión de un usuario de verdad (ver e2e/reservations/).
// Ajustar las credenciales/endpoint reales al integrar contra un backend de test.
type Fixtures = {
  loginAs: (page: Page, opts?: { role?: string; token?: string }) => Promise<void>
  loginAsUI: (page: Page, opts: { email: string; password: string }) => Promise<void>
}

export const test = base.extend<Fixtures>({
  loginAs: async ({}, use) => {
    await use(async (page, opts = {}) => {
      const role = opts.role || 'hotel_admin'
      const token = opts.token || 'e2e-fake-token'
      await page.addInitScript(
        ([t, r]) => {
          localStorage.setItem('token', t)
          localStorage.setItem('refreshToken', t)
          localStorage.setItem(
            'user',
            JSON.stringify({ id: 'e2e', name: 'E2E', email: 'e2e@test.com', role: r, hotelName: 'Hotel E2E' }),
          )
        },
        [token, role] as const,
      )
    })
  },

  loginAsUI: async ({}, use) => {
    await use(async (page, opts) => {
      await page.goto('/login')
      await page.getByTestId('login-email').fill(opts.email)
      await page.getByTestId('login-password').fill(opts.password)
      await page.getByTestId('login-submit').click()
      // super_admin cae en /admin, cualquier otro rol en /panel — ver handleLogin() en login.vue.
      await expect(page).toHaveURL(/\/(panel|admin)/, { timeout: 15_000 })
    })
  },
})

export { expect }
