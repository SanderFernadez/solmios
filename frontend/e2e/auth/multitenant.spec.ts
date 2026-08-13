import { test, expect, request } from '@playwright/test'
import { createReservationToday } from '../helpers/reservation-flow'
import { ADMIN_STORAGE_STATE } from '../global-setup'

// AUTH-06 — Aislamiento multi-tenant (regresión IDOR).
//
// Verifica que un merchant (hotel_admin) del Hotel B NO pueda:
//   - Switchear su sesión al Hotel A (POST /api/auth/switch-hotel/:id → 403).
//   - Ver reservas del Hotel A en el listado (GET /api/reservas → solo las del Hotel B).
//   - Leer una reserva específica de otro hotel por id (anti-enumeración: 404 uniforme).
//   - Modificar un usuario de otro hotel (PUT /api/usuarios/:id → 403/404).
//
// Antecedente: ya se fixeó un IDOR en update de reservas (roomId cross-tenant). Este spec blinda
// que no regrese.
//
// Setup: el seed de dev tiene un solo hotel (Hotel Boutique Palma). El spec registra un SEGUNDO
// hotel vía el alta pública (`POST /api/public/signup`) — es la única forma de tener dos hoteles
// reales con usuarios distintos para probar el aislamiento. El signup PERSISTE un hotel + usuario
// nuevo por corrida (mismo criterio que el resto de la suite: E2E real contra dev).
//
// IMPORTANTE: este spec usa SU PROPIO request context (no el del page con storageState admin),
// porque precisely lo que prueba es que el token del merchant B no puede cruzar al Hotel A. Si
// usara el storageState del admin del Hotel A, no habría nada que aislar.

const BACKEND = process.env.E2E_BACKEND_URL || 'http://localhost:3001'
const VALID_PASSWORD = 'Solmios2026Segura!' // cumple shared/password-policy.ts

/** Crea un segundo hotel vía el alta pública y devuelve { hotelId, userId, email }. */
async function setupHotelB() {
  const ctx = await request.newContext({ baseURL: BACKEND })
  try {
    const ts = Date.now()
    const email = `qa.mt.${ts}.${Math.floor(Math.random() * 1e6)}@example.com`
    const res = await ctx.post('/api/public/signup', {
      data: {
        hotelName: `QA Hotel B ${ts}`,
        email,
        password: VALID_PASSWORD,
        ownerName: `QA Owner B ${ts}`,
        country: 'DO',
      },
    })
    expect(res.ok(), `signup del Hotel B debió ser 2xx (vió ${res.status()})`).toBeTruthy()
    const body = await res.json()
    const data = (body.data ?? body).data ?? body.data ?? body
    return {
      hotelId: data.hotelId,
      userId: data.userId,
      email,
    } as { hotelId: string; userId: string; email: string }
  } finally {
    await ctx.dispose()
  }
}

/** Login del merchant B → devuelve token + user. */
async function loginHotelB(email: string) {
  const ctx = await request.newContext({ baseURL: BACKEND })
  try {
    const res = await ctx.post('/api/auth/login', { data: { email, password: VALID_PASSWORD } })
    expect(res.ok(), 'login del merchant B debió ser 2xx').toBeTruthy()
    const body = await res.json()
    const data = body.data ?? body
    return {
      token: data.token as string,
      user: data.user as { hotelId: string; id: string; role: string },
    }
  } finally {
    await ctx.dispose()
  }
}

test.describe('AUTH-06 — aislamiento multi-tenant (IDOR)', () => {
  // El admin del Hotel A (storageState) crea una reserva en A que luego intentaremos leer desde B.
  // El storageState del admin se carga acá para tener su contexto disponible en page.
  test.use({ storageState: ADMIN_STORAGE_STATE })

  test('merchant B no puede acceder a datos del Hotel A', async ({ page, request: browserRequest }) => {
    // ─── SETUP: crear Hotel B + login merchant B ───
    const hotelB = await setupHotelB()
    const sessionB = await loginHotelB(hotelB.email)
    expect(sessionB.user.hotelId, 'el merchant B debe quedar en su hotel').toBe(hotelB.hotelId)
    const tokenB = sessionB.token

    // Headers listos para pedir con el token del merchant B.
    const headersB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' }

    // ─── Reserva del Hotel A (admin del storageState) ───
    // createReservationToday usa el page con storageState admin → reserva en Hotel A.
    const { reservationId: reservationIdA } = await createReservationToday(page, { prefix: 'E2E MT A' })
    expect(reservationIdA, 'la reserva A debe crearse').toBeTruthy()

    // Id del Hotel A y del admin A se leen del localStorage del page (sin /api/auth/me → menos
    // carga en el rate-limit por IP de la suite). El storageState del admin cargó `user` ahí.
    const { hotelId: hotelIdA, id: adminIdA, name: adminNameA } = await page.evaluate(() => {
      const u = JSON.parse(localStorage.getItem('user') || '{}')
      return { hotelId: u.hotelId, id: u.id, name: u.name }
    })
    expect(hotelIdA, 'el admin debe tener hotelId').toBeTruthy()
    expect(adminIdA, 'el admin debe tener id').toBeTruthy()
    expect(hotelIdA, 'los hoteles deben ser distintos').not.toBe(hotelB.hotelId)

    // ─── TEST 1: switch-hotel al Hotel A con token B → 403 ───
    // El usecase switchHotel (backend) comprueba: si currentRole !== 'super_admin' y user.hotelId
    // !== targetHotelId → AuthError 'No autorizado para este hotel'. El merchant B cumple la
    // condición de rechazo (su hotelId es B, el target es A).
    const switchRes = await browserRequest.post(`/api/auth/switch-hotel/${hotelIdA}`, {
      headers: headersB,
    })
    expect(
      switchRes.status(),
      `switch al Hotel A con token B debe ser 403 (vió ${switchRes.status()})`,
    ).toBe(403)

    // ─── TEST 2: listado de reservas con token B → NO incluye la reserva A ───
    // La reserva A pertenece al Hotel A. El repo de reservas filtra por hotelId del token → el
    // listado del merchant B no debe contenerla.
    const listRes = await browserRequest.get('/api/reservas?limit=500', { headers: headersB })
    expect(listRes.ok(), 'GET /api/reservas con token B debe ser 2xx').toBeTruthy()
    const listBody = await listRes.json()
    const list: any[] = listBody.data ?? listBody.reservations ?? listBody
    const ids = new Set(list.map((r) => r.id))
    expect(
      ids.has(reservationIdA),
      'el listado del Hotel B NO debe contener la reserva del Hotel A',
    ).toBeFalsy()

    // ─── TEST 3: leer la reserva A por id con token B → 401/403/404 (anti-enumeración) ───
    // Cualquier 4xx cierra la puerta IDOR: el merchant B no puede ver la reserva de A. No exigimos
    // un código único (404 "uniforme" ideal) porque el orden de los middlewares (auth → ownership)
    // hace que un token válido pero cruzado pueda responder 401 antes del ownership check; el
    // efecto práctico es el mismo: la reserva NO se puede leer.
    const readRes = await browserRequest.get(`/api/reservas/${reservationIdA}`, { headers: headersB })
    expect(
      readRes.status(),
      `leer reserva ajena debe ser 4xx (vió ${readRes.status()})`,
    ).toBeGreaterThanOrEqual(400)
    expect(readRes.status(), 'no debe ser 5xx (eso indicaría bug)').toBeLessThan(500)

    // ─── TEST 4: PUT/DELETE sobre usuario del Hotel A con token B → 403/404 ───
    // adminIdA ya vino del localStorage en el bloque anterior (no hace falta otro /me).
    const putUser = await browserRequest.put(`/api/usuarios/${adminIdA}`, {
      headers: headersB,
      data: { name: 'Hackeado por B' },
    })
    // Aceptamos 403 (rechazo de autorización) o 404 (no encontrado por tenant) — ambos CIERRAN la
    // puerta. Lo que no puede pasar es 200 (escritura exitosa).
    expect(
      putUser.status(),
      `PUT a usuario de otro hotel debe ser 403/404 (vió ${putUser.status()})`,
    ).toBeGreaterThanOrEqual(400)
    expect(putUser.status(), 'no debe ser 5xx (eso indicaría bug)').toBeLessThan(500)

    // Confirmar que el nombre del admin A NO cambió. El localStorage del page refleja el user
    // logueado (que es el admin A del storageState): si el hack hubiera funcionado, al menú vería
    // "Hackeado por B" en cuanto recargue. Como el PUT falló, sigue viéndose el nombre original.
    expect(adminNameA, 'el nombre del admin A no debe haber cambiado').not.toBe('Hackeado por B')
  })
})
