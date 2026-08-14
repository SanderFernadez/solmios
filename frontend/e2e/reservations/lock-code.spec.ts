import { test, expect } from '../fixtures'
import { createReservationToday, apiPost } from '../helpers/reservation-flow'
import { ADMIN_STORAGE_STATE } from '../global-setup'

// Sesión admin pre-autenticada por globalSetup — ver checkout.spec.ts para el detalle del patrón.
test.use({ storageState: ADMIN_STORAGE_STATE })

// DEV-01 (extensión) — Código de acceso desde la reserva: validación del PIN manual.
//
// El modal de reserva ahora permite crear el código con un PIN elegido por el staff. El guard de
// formato (4-9 dígitos) vive en el CONTROLLER, así que este test lo ejerce por API — es la misma
// validación que aplica sin importar quién llame. No requiere cerradura TTLock real (el guard
// corta ANTES de tocar hardware): en dev sin TTLock conectado, un PIN válido fallaría más
// adelante con "TTLock no conectado", pero un PIN MAL formado debe caer en el 400 de formato.

test.describe('código de cerradura manual', () => {
  test('rechaza PIN manual fuera de rango (400, sin tocar hardware)', async ({ page }) => {
    const { reservationId } = await createReservationToday(page, { prefix: 'E2E LockPin' })

    // OJO: '' no va — un code vacío significa "sin customCode" (generación normal), no error.
    for (const bad of ['12', '1234567890', 'abcd1']) {
      const res = await apiPost(page, `/api/ttlock/generate-code/${reservationId}`, { code: bad })
      expect(res.status, `PIN "${bad}" debía ser rechazado por formato`).toBe(400)
    }
  })
})
