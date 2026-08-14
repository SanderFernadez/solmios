import { expect, type Page } from '@playwright/test'

// Helpers reutilizables para specs E2E de reservas. Mismo patrón que
// e2e/reservations/create-reservation.spec.ts (login real, datos únicos por corrida, E2E contra
// el backend de dev). Extraído acá para que checkout/checkin/cancel armen su estado inicial sin
// duplicar el wizard de 5 pasos.

/** Fecha local en YYYY-MM-DD (no UTC) — coincide con `todayStr` que usa el frontend para
 *  filtrar "Llegadas Hoy" / "Salidas Hoy". toISOString() es UTC y desfasa un día si se corre
 *  de madrugada, rompiendo el match contra la columna de Recepción Digital. */
export function localISO(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function uniqueGuestName(prefix = 'E2E'): string {
  return `${prefix} ${Date.now()}`
}

/**
 * Cancela las reservas E2E propias (guestName con prefix "E2E") cuyo checkIn cae en `day` y que
 * todavía se pueden cancelar (pending/confirmed), para liberar habitaciones antes de crear una
 * nueva. Setup de test: aísla el estado entre corridas. Ignora errores por reserva (ej. 409 si
 * ya no es cancelable) — es best-effort.
 */
/**
 * Libera habitaciones para la ventana [checkIn, checkOut) borrando (DELETE) toda reserva del
 * hotel que solape esa ventana y no esté ya cancelada.
 *
 * Necesario porque el hotel demo es chico (8 hab) y los specs dejan reservas en estados finales
 * (checked_in / checked_out) sobre "hoy" entre corridas. Esas reservas NO se pueden cancelar pero
 * SÍ borrar (verificado: DELETE devuelve 204 hasta para checked_out), y el endpoint de
 * disponibilidad las sigue contando como bloqueantes mientras existan. Cancelar solo las
 * pending/confirmed no alcanza: las checked_in acumuladas saturan las 8 habitaciones.
 *
 * En dev destruye reservas del seed (el listado no trae guestName, no hay forma de distinguirlas)
 * — aceptable: el seed se regenera con `bun run migrate`. Best-effort: ignora errores por reserva.
 */
export async function freeRoomForStay(page: Page, checkIn: string, checkOut: string): Promise<void> {
  const token = await page.evaluate(() => localStorage.getItem('token'))
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const res = await apiGet<any>(page, '/api/reservas?limit=500')
  const list: any[] = res.data ?? res
  const blocking = list.filter((r) => {
    const ci = String(r.checkIn || '').slice(0, 10)
    const co = String(r.checkOut || '').slice(0, 10)
    // Solapamiento de rangos [ci, co) ∩ [checkIn, checkOut). Strings YYYY-MM-DD ordenan cronológico.
    return ci < checkOut && co > checkIn && r.status !== 'cancelled'
  })
  await Promise.all(
    blocking.map((r) => page.request.delete(`/api/reservas/${r.id}`, { headers }).catch(() => {})),
  )
}

export interface CreatedReservation {
  reservationId: string
  guestName: string
  guestEmail: string
}

/**
 * Crea una reserva nueva desde el wizard (/panel/reservas) con checkIn = HOY (y checkOut dentro
 * de `nights` noches), para que el huésped caiga en "Llegadas Hoy" de la Recepción Digital y se
 * pueda check-in/check-outear por UI.
 *
 * Captura la respuesta del POST /api/reservas para devolver el reservationId (el controller
 * `store` devuelve la reserva creada como body directo: `{ id, status, ... }`, sin envolver).
 * Solo completa campos obligatorios (Detalles y Emergencia se saltean).
 */
export async function createReservationToday(
  page: Page,
  opts: { nights?: number; prefix?: string; roomNumber?: string } = {},
): Promise<CreatedReservation> {
  const nights = opts.nights ?? 1
  const guestName = uniqueGuestName(opts.prefix ?? 'E2E')
  const guestEmail = `e2e.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`
  const checkIn = localISO(0)
  const checkOut = localISO(nights)

  await page.goto('/panel/reservas')
  // Esperar a que la lista terminó de cargar (evita clickear "Nueva Reserva" en medio de la
  // navegación post-login + goto, que en CI se vio perder el click).
  await expect(page.getByRole('heading', { name: 'Listado de reservas' })).toBeVisible()

  // Setup determinístico: el hotel demo tiene ~8 habitaciones y suele estar saturado para "hoy"
  // (el seed deja reservas checked_in de varios días que bloquean la ventana hoy→mañana).
  // Cancelamos las reservas cancelables que solapan nuestra ventana para garantizar una habitación
  // libre. Va después del goto: localStorage no es accesible mientras el page esté en about:blank.
  await freeRoomForStay(page, checkIn, checkOut)

  await page.getByTestId('reservations-new-button').click()
  await expect(page.getByTestId('wizard-title')).toHaveText('Nueva Reserva')

  // El POST de creación vuela al confirmar el paso 5. Lo armamos antes del click para no perderlo.
  const createResponse = page.waitForResponse(
    (r) =>
      r.url().includes('/api/reservas') &&
      r.request().method() === 'POST' &&
      r.status() >= 200 &&
      r.status() < 300,
    { timeout: 30_000 },
  )

  // — Paso 1: Huésped —
  await page.locator('#wiz-name').fill(guestName)
  await page.locator('#wiz-email').fill(guestEmail)
  await page.getByRole('button', { name: 'Siguiente' }).click()

  // — Paso 2: Detalles — sin obligatorios.
  await expect(page.getByText('Paso 2 de 5')).toBeVisible()
  await page.getByRole('button', { name: 'Siguiente' }).click()

  // — Paso 3: Emergencia — sin obligatorios.
  await expect(page.getByText('Paso 3 de 5')).toBeVisible()
  await page.getByRole('button', { name: 'Siguiente' }).click()

  // — Paso 4: Alojamiento —
  await expect(page.getByText('Paso 4 de 5')).toBeVisible()
  // Debounce de 300ms en el componente antes de pedir disponibilidad real por fecha — sin esperar
  // la respuesta el selector todavía muestra TODAS las habitaciones y se puede elegir una que el
  // backend rechaza con 409 (verificado en create-reservation.spec.ts).
  const availabilityLoaded = page.waitForResponse((r) =>
    r.url().includes('/api/habitaciones') && r.url().includes(`checkIn=${checkIn}`),
  )
  await page.locator('#wiz-checkin').fill(checkIn)
  await page.locator('#wiz-checkout').fill(checkOut)
  await availabilityLoaded

  // Elegir una habitación REALMENTE disponible para la ventana (available===true). El dropdown del
  // SearchSelect NO marca con aria-disabled las habitaciones en avail:false, así que el filtro
  // :not([aria-disabled]) elegía una "unavailable" y dejaba el wizard trabado en paso 4
  // (isStep4Valid → selectedRoomUnavailable). Resolver por API es determinístico.
  const roomsRes = await apiGet<any>(page, `/api/habitaciones?checkIn=${checkIn}&checkOut=${checkOut}`)
  const roomsList: any[] = roomsRes.data ?? roomsRes
  // roomNumber explícito: para specs que necesitan UNA habitación puntual (ej: la 103, la única
  // con cerradura en dev). Si viene, tiene que estar libre (el cleanup de arriba la liberó).
  const free = opts.roomNumber
    ? roomsList.find((r) => String(r.number) === opts.roomNumber && r.available)
    : roomsList.find((r) => r.available)
  expect(
    free,
    `debe existir una habitación libre para ${checkIn}→${checkOut}${opts.roomNumber ? ` (pedida: hab ${opts.roomNumber})` : ''}`,
  ).toBeTruthy()

  const roomSelect = page.getByTestId('wiz-room-select')
  await roomSelect.locator('input').click()
  // El option del SearchSelect muestra "NN — tipo ($precio/n)"; lo matcheamos por su número.
  const roomOption = page.locator('body > ul li').filter({ hasText: String(free.number) }).first()
  await expect(roomOption).toBeVisible()
  await roomOption.click()
  await expect(roomSelect.locator('input')).not.toHaveValue('')
  await page.getByRole('button', { name: 'Siguiente' }).click()

  // — Paso 5: Pago — valores por defecto.
  await expect(page.getByText('Paso 5 de 5')).toBeVisible()
  await page.getByRole('button', { name: 'Crear Reserva' }).click()

  // Sin error y el modal se cierra solo (@saved en pages/reservations/index.vue).
  await expect(page.getByTestId('wizard-error')).not.toBeAttached()
  await expect(page.getByTestId('wizard-title')).not.toBeAttached({ timeout: 15_000 })

  const resp = await createResponse
  const body = await resp.json()
  const reservationId = body?.id ?? body?.data?.id
  expect(reservationId, 'el POST /api/reservas debió devolver el id de la reserva').toBeTruthy()

  return { reservationId, guestName, guestEmail }
}

/**
 * Llama al backend con el token de la sesión del page (loginAsUI ya dejó `token` en localStorage).
 * `page.request` comparte el origen/contexto del navegador, así que '/api/...' pasa por el proxy
 * de Vite → :3001. Devuelve el body JSON tal cual (algunos endpoints envuelven en `{ data }`,
 * otros devuelven el item directo — el caller decide cómo leerlo).
 */
export async function apiGet<T = any>(page: Page, path: string): Promise<T> {
  const token = await page.evaluate(() => localStorage.getItem('token'))
  const res = await page.request.get(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  expect(res.ok(), `GET ${path} debería responder 2xx (vió ${res.status()})`).toBeTruthy()
  return res.json() as Promise<T>
}

/** POST autenticado (mismo contexto/token que apiGet). Devuelve status + body parseado. */
export async function apiPost<T = any>(
  page: Page,
  path: string,
  body: unknown = {},
): Promise<{ status: number; body: T }> {
  const token = await page.evaluate(() => localStorage.getItem('token'))
  const res = await page.request.post(path, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: body,
  })
  return { status: res.status(), body: (await res.json().catch(() => ({}))) as T }
}

/**
 * Crea una factura pendiente con saldo, lista para cobrar (FAC-01) o anular (FAC-02). Flujo real
 * de backend: alta de reserva → check-in (abre folio con el cargo de la noche) → POST
 * /folios/:id/invoice (cierra el folio y emite la factura SIN pagar → queda `pending`).
 */
export async function createPendingInvoice(
  page: Page,
): Promise<{ invoiceId: string; folioId: string; reservationId: string }> {
  const { reservationId } = await createReservationToday(page, { prefix: 'E2E Fac' })
  const token = await page.evaluate(() => localStorage.getItem('token'))
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const ci = await page.request.post(`/api/reservas/${reservationId}/checkin`, { headers, data: {} })
  expect(ci.ok(), 'el check-in del setup debió funcionar').toBeTruthy()
  const ciBody = await ci.json()
  const folioId = ciBody.folioId ?? ciBody.data?.folioId
  expect(folioId, 'el check-in debió abrir un folio').toBeTruthy()

  const inv = await page.request.post(`/api/folios/${folioId}/invoice`, { headers, data: {} })
  expect(inv.ok(), 'POST /folios/:id/invoice debió emitir la factura').toBeTruthy()
  const invBody = await inv.json()
  const invoice = invBody.invoice ?? invBody.data?.invoice ?? invBody
  const invoiceId = invoice.id ?? invoice.invoiceId
  expect(invoiceId, 'folio→factura debió devolver el invoiceId').toBeTruthy()

  return { invoiceId, folioId, reservationId }
}

/**
 * Crea un folio ABIERTO con el cargo de la noche (check-in), SIN cerrarlo — para specs que
 * prueban el cierre por UI (FAC-03). Devuelve folioId + reservationId + guestName.
 */
export async function createOpenFolio(
  page: Page,
): Promise<{ folioId: string; reservationId: string; guestName: string }> {
  const { reservationId, guestName } = await createReservationToday(page, { prefix: 'E2E Folio' })
  const token = await page.evaluate(() => localStorage.getItem('token'))
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const ci = await page.request.post(`/api/reservas/${reservationId}/checkin`, { headers, data: {} })
  expect(ci.ok(), 'el check-in del setup debió funcionar').toBeTruthy()
  const ciBody = await ci.json()
  const folioId = ciBody.folioId ?? ciBody.data?.folioId
  expect(folioId, 'el check-in debió abrir un folio').toBeTruthy()
  return { folioId, reservationId, guestName }
}

/** Lee una factura por id desde GET /api/facturas (no existe endpoint :id, se filtra del list). */
export async function getInvoice(page: Page, invoiceId: string): Promise<any> {
  const res = await apiGet<any>(page, '/api/facturas?type=invoice&limit=200')
  const list: any[] = res.data ?? res
  return list.find((i: any) => i.id === invoiceId)
}
