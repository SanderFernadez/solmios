import { test, expect } from '../fixtures'
import { apiGet, apiPost } from '../helpers/reservation-flow'
import { ADMIN_STORAGE_STATE } from '../global-setup'

// Sesión admin pre-autenticada por globalSetup — ver checkout.spec.ts para el detalle del patrón.
test.use({ storageState: ADMIN_STORAGE_STATE })

// OPS-03 — Resolución de nombres de staff (regresión bug histórico).
//
// Bug: en team-chat, housekeeping (camarera + supervisor + stats) y mantenimiento (técnicos) los
// nombres aparecían "Sin asignar" / "Usuario" / UUID crudo porque se resolvían contra
// `employee-profiles` (módulo de RRHH con otros ids) en vez de contra `/api/usuarios`
// (`TeamService.list()` → `id → name`). Los `staffId`/`assignedTo` guardan `users.id`.
// Ver CLAUDE.md, sección "Resolver nombres de personal/participantes".
//
// Este spec crea un usuario housekeeper + una tarea asignada y verifica que la columna
// "Asignado" de /panel/operaciones/limpieza muestra el nombre correcto. Idem para mantenimiento.
// El setup va por API (POST /api/usuarios + POST /api/housekeeping | /api/mantenimiento) para no
// reescribir modales que no son lo que se prueba. La verificación SÍ es por UI: localiza la fila y
// afirma el contenido del span `hk-list-assigned` / `mt-list-assigned`.
//
// El span puede contener "Sin asignar" (sin staffId), el UUID crudo (staffId sin resolver) o el
// nombre real. Solo el nombre real pasa. Los UUID tienen forma 8-4-4-4-12 hex → regex propio.

// Regex de UUID v4-ish (8-4-4-4-12 hex). Case-insensitive porque los ids del seed vienen en minúscula
// y los que creamos acá pueden venir en cualquier case.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Valores que indican que la resolución falló: vacío, el placeholder o el id crudo sin resolver.
const UNRESOLVED_RE = /^(Sin asignar|Usuario|)$/i

test.describe('OPS-03 — resolución de nombres de staff', () => {
  test('housekeeping muestra el nombre de la camarera, no UUID ni "Sin asignar"', async ({ page }) => {
    // Cargar una página del panel PRIMERO: apiGet lee el token de localStorage, y about:blank no
    // expone localStorage (SecurityError). Cualquier ruta interna del panel deja el document en un
    // origin válido y el token queda accesible para el helper.
    await page.goto('/panel/dashboard')
    const ts = Date.now()
    const housekeeperName = `QA Camarera ${ts}`
    const housekeeperEmail = `qa.hk.${ts}.${Math.floor(Math.random() * 1e6)}@example.com`
    // HotelId se lee del localStorage del page (evita una llamada /api/auth/me que contribuye al
    // rate-limit por IP en suite larga).
    const hotelId = await page.evaluate(() => JSON.parse(localStorage.getItem('user') || '{}').hotelId)
    expect(hotelId, 'el admin debe tener hotelId en localStorage').toBeTruthy()

    // 1. Crear housekeeper (rol camarera). staffId se guardará contra users.id.
    const hkBody = await apiPost<any>(page, '/api/usuarios', {
      name: housekeeperName, email: housekeeperEmail, password: 'Solmios2026Segura!',
      role: 'housekeeper', hotelId,
    })
    expect(hkBody.status, 'POST /api/usuarios debió crear el housekeeper').toBeLessThan(300)
    const housekeeperId = hkBody.body?.data?.id ?? hkBody.body?.id
    expect(housekeeperId, 'el housekeeper debió recibir un id').toBeTruthy()

    // 2. Habitación cualquiera del hotel (la tarea necesita roomId).
    const roomsRes = await apiGet<any>(page, '/api/habitaciones?limit=20')
    const roomsList: any[] = roomsRes.data ?? roomsRes
    expect(roomsList.length, 'debe haber al menos una habitación en el hotel').toBeGreaterThan(0)
    const roomId = roomsList[0].id

    // 3. Crear la tarea de limpieza asignada a la camarera.
    const taskBody = await apiPost<any>(page, '/api/housekeeping', {
      roomId, staffId: housekeeperId, status: 'pending', type: 'full_cleaning',
      priority: 'medium', hotelId,
    })
    expect(taskBody.status, 'POST /api/housekeeping debió crear la tarea').toBeLessThan(300)
    const taskId = taskBody.body?.data?.id ?? taskBody.body?.id
    expect(taskId, 'la tarea debió recibir un id').toBeTruthy()

    // 4. Abrir la vista y localizar la fila por taskId.
    await page.goto('/panel/operaciones/limpieza')
    // El default es la vista Tablero (Kanban). La lista con data-task-id vive en la vista "Lista".
    await page.getByRole('button', { name: 'Lista', exact: true }).click()
    // Filtrar por pendientes reduce el set y acerca la tarea nueva (recién creada = pending).
    await page.getByRole('button', { name: 'Pendientes', exact: true }).click()

    // Localizar la fila. La lista pagina del lado del servidor (20 por página); si la tarea nueva no
    // aparece en la primera página, navegar a la última (los ordenamientos del backend mandan las
    // nuevas al final del listado completo).
    let row = page.locator(`[data-task-id="${taskId}"]`)
    await expect(row).toBeVisible({ timeout: 15_000 }).catch(async () => {
      const lastBtn = page.getByRole('button', { name: '»', exact: true })
      if (await lastBtn.isVisible().catch(() => false)) await lastBtn.click()
      await expect(row).toBeVisible({ timeout: 15_000 })
    })

    // 5. Aserción NÚCLEO del bug: el span de asignado contiene el nombre, no UUID ni placeholder.
    const assignedSpan = row.getByTestId('hk-list-assigned')
    await expect(assignedSpan).toBeVisible()
    const assignedText = (await assignedSpan.textContent())?.trim() ?? ''
    // No es "Sin asignar" / "Usuario" / vacío.
    expect(assignedText, 'no debe mostrar el placeholder de sin-asignar').not.toMatch(UNRESOLVED_RE)
    // No es el UUID crudo.
    expect(assignedText, 'no debe mostrar el UUID sin resolver').not.toMatch(UUID_RE)
    // Contiene el nombre del housekeeper que creamos (aceptamos recortes por truncate, pero el
    // texto debe incluir el inicio del nombre).
    expect(assignedText, 'debe mostrar el nombre del housekeeper').toContain(housekeeperName.slice(0, 10))
  })

  test('mantenimiento muestra el nombre del técnico, no UUID ni "Sin asignar"', async ({ page }) => {
    // Ver housekeeping test: apiGet necesita un document con localStorage accesible.
    await page.goto('/panel/dashboard')
    const ts = Date.now()
    const techName = `QA Técnico ${ts}`
    const techEmail = `qa.mt.${ts}.${Math.floor(Math.random() * 1e6)}@example.com`
    // hotelId del localStorage (ver housekeeping test).
    const hotelId = await page.evaluate(() => JSON.parse(localStorage.getItem('user') || '{}').hotelId)
    expect(hotelId, 'el admin debe tener hotelId en localStorage').toBeTruthy()

    // 1. Crear técnico (rol maintenance). Los tickets guardan assignedTo = users.id.
    const mtBody = await apiPost<any>(page, '/api/usuarios', {
      name: techName, email: techEmail, password: 'Solmios2026Segura!',
      role: 'maintenance', hotelId,
    })
    expect(mtBody.status, 'POST /api/usuarios debió crear el técnico').toBeLessThan(300)
    const techId = mtBody.body?.data?.id ?? mtBody.body?.id
    expect(techId, 'el técnico debió recibir un id').toBeTruthy()

    // Habitación para el roomId/roomNumber del ticket.
    const roomsRes = await apiGet<any>(page, '/api/habitaciones?limit=20')
    const roomsList: any[] = roomsRes.data ?? roomsRes
    const roomId = roomsList[0]?.id
    const roomNumber = roomsList[0]?.number || '101'

    // 2. Crear el ticket asignado al técnico.
    const ticketBody = await apiPost<any>(page, '/api/mantenimiento', {
      title: `QA Foco ${ts}`, assignedTo: techId, status: 'open', hotelId,
      category: 'electrical', priority: 'medium',
      roomId, roomNumber, description: 'Foco fundido — verificación de nombre',
    })
    expect(ticketBody.status, 'POST /api/mantenimiento debió crear el ticket').toBeLessThan(300)
    const orderId = ticketBody.body?.data?.id ?? ticketBody.body?.id
    expect(orderId, 'el ticket debió recibir un id').toBeTruthy()

    // 3. Abrir mantenimiento y localizar la fila por orderId.
    await page.goto('/panel/operaciones/mantenimiento')
    // La vista default de mantenimiento es "Lista" — filtra las visibles por estado 'open' para
    // que el ticket nuevo (open) aparezca sin tener que scrollear toda la historia del hotel.
    await page.getByRole('combobox').selectOption('open')

    const row = page.locator(`[data-order-id="${orderId}"]`)
    await expect(row).toBeVisible({ timeout: 15_000 })

    // 4. Aserción NÚCLEO del bug.
    const assignedSpan = row.getByTestId('mt-list-assigned')
    await expect(assignedSpan).toBeVisible()
    const assignedText = (await assignedSpan.textContent())?.trim() ?? ''
    expect(assignedText, 'no debe mostrar "Sin asignar"').not.toMatch(UNRESOLVED_RE)
    expect(assignedText, 'no debe mostrar el UUID sin resolver').not.toMatch(UUID_RE)
    expect(assignedText, 'debe mostrar el nombre del técnico').toContain(techName.slice(0, 10))
  })
})
