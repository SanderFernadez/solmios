import { test as base, expect, type Page } from '@playwright/test'

// Fixtures E2E reutilizables. `login` inyecta una sesión falsa en localStorage para
// saltar la pantalla de auth cuando el test cubre vistas internas.
// Ajustar las credenciales/endpoint reales al integrar contra un backend de test.
type Fixtures = {
  loginAs: (page: Page, opts?: { role?: string; token?: string }) => Promise<void>
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
})

export { expect }
