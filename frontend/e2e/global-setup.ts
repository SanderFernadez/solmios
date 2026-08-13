import { request } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

// globalSetup: autentica UNA sola vez por corrida de Playwright y persiste la sesión en un
// storageState. Los specs de operaciones (reservas, facturación, …) lo cargan vía
// `test.use({ storageState })` y así arrancan ya logueados, sin pasar por el form de login.
//
// Motivo: el endpoint de login tiene rate-limit por IP. Si cada spec loguea por UI, correr todos
// juntos topa el límite y los logins fallan ("se queda en /login"). Una sola autenticación
// compartida elimina el problema y además acelera la suite.
//
// Credenciales del seed de dev (migrate-db.ts). Para otro entorno, override con env vars.
const EMAIL = process.env.E2E_USER_EMAIL || 'admin@caribeparadise.com'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'demo123'
const BACKEND = process.env.E2E_BACKEND_URL || 'http://localhost:3001'
const FRONTEND_ORIGIN = `http://localhost:${process.env.E2E_PORT || '5173'}`
export const ADMIN_STORAGE_STATE = 'e2e/.auth/admin.json'

export default async function globalSetup() {
  const ctx = await request.newContext({ baseURL: BACKEND })
  try {
    const res = await ctx.post('/api/auth/login', { data: { email: EMAIL, password: PASSWORD } })
    if (!res.ok()) {
      throw new Error(
        `globalSetup: login dev falló (${res.status()}). ¿Backend corriendo en ${BACKEND} con el seed demo?`,
      )
    }
    const body = await res.json()
    const data = body.data ?? body

    // Formato storageState de Playwright: el localStorage debe estar bajo el origin del FRONTEND
    // (el navegador corre en :5173), aunque el login haya ido directo al backend (:3001).
    const storageState = {
      cookies: [],
      origins: [
        {
          origin: FRONTEND_ORIGIN,
          localStorage: [
            { name: 'token', value: data.token },
            { name: 'refreshToken', value: data.refreshToken },
            { name: 'user', value: JSON.stringify(data.user) },
          ],
        },
      ],
    }

    mkdirSync('e2e/.auth', { recursive: true })
    writeFileSync(ADMIN_STORAGE_STATE, JSON.stringify(storageState))
  } finally {
    await ctx.dispose()
  }
}
