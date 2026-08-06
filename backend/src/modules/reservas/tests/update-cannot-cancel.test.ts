// update-cannot-cancel.test.ts — Cancelar NO se logra editando la reserva.
//
// El PUT genérico dejaba pasar `status:'cancelled'`: pisaba el estado y listo. Nada de lo que
// hace una cancelación de verdad ocurría — sin política del hotel (penalidad/reembolso), sin
// motivo, y sobre todo SIN emitir `onReservationCancelled`, que es lo único que libera el
// depósito retenido (connectors/reservas-deposits.ts). El depósito quedaba en 'held' para siempre.
//
// En producción se ve el rastro: 14 reservas canceladas, 0 con `cancelledAt`, 0 con motivo,
// 0 con `cancellationFee`. Ninguna pasó por el camino correcto.
//
// El candado va en el SERVIDOR, no en la pantalla: había TRES vistas cancelando por PUT y
// alcanzaba con que quedara una (o un cliente cualquiera pegándole a la API) para reabrir el
// agujero. Mismo criterio que checked_in/checked_out, que ya estaban bloqueados acá.
import { describe, it, expect } from 'bun:test'
import { assertUpdateValidations } from '../usecases/validate-update'

const EXISTING = {
  id: 'res-1', hotelId: 'h1', roomId: 'room-1',
  checkIn: '2026-09-01', checkOut: '2026-09-04', status: 'confirmed',
} as any

const repo = { findMany: async () => [] } as any
const STAFF = { role: 'hotel_admin' }

describe('assertUpdateValidations — cancelar no es un cambio de estado más', () => {
  it('rechaza status:"cancelled" por el PUT y explica dónde se cancela', async () => {
    const promise = assertUpdateValidations(repo, EXISTING, { status: 'cancelled' } as any, STAFF, 'res-1')

    await expect(promise).rejects.toThrow(/POST \/reservas\/:id\/cancel/)
    // El mensaje nombra la consecuencia, no solo la regla: quien lo lea tiene que entender
    // por qué no alcanza con pisar el estado.
    await expect(promise).rejects.toThrow(/política|depósito/)
  })

  it('el bloqueo es por estado, no por la palabra: "confirmed" sigue pasando', async () => {
    await assertUpdateValidations(repo, { ...EXISTING, status: 'pending' }, { status: 'confirmed' } as any, STAFF, 'res-1')
  })

  it('editar una reserva sin tocar el estado no se ve afectado', async () => {
    await assertUpdateValidations(repo, EXISTING, { adults: 3 } as any, STAFF, 'res-1')
  })

  it('checked_in/checked_out siguen bloqueados (no se rompió el candado previo)', async () => {
    // Los dos comparten mensaje: "se logra con POST /checkin o /checkout".
    await expect(assertUpdateValidations(repo, EXISTING, { status: 'checked_in' } as any, STAFF, 'res-1'))
      .rejects.toThrow(/POST \/checkin o \/checkout/)
    await expect(assertUpdateValidations(repo, EXISTING, { status: 'checked_out' } as any, STAFF, 'res-1'))
      .rejects.toThrow(/POST \/checkin o \/checkout/)
  })

  // super_admin conserva la llave maestra que ya tenía para TODOS los estados (mismo `if` que
  // envuelve checked_in/checked_out). Es soporte arreglando datos, no el flujo del hotel.
  it('super_admin puede forzar el estado (escotilla de soporte, sin cambios)', async () => {
    await assertUpdateValidations(repo, EXISTING, { status: 'cancelled' } as any, { role: 'super_admin' }, 'res-1')
  })

  // Lo que se prohíbe es la TRANSICIÓN, no el valor. Los formularios de edición mandan `status`
  // siempre, lo haya tocado el usuario o no: si el guard mirara solo el valor, editarle las notas
  // a una reserva ya cancelada tiraría 409 con un mensaje que no viene al caso. Es la regresión
  // que introdujo la primera versión de este candado.
  it('editar una reserva YA cancelada (mismo status en el payload) no se bloquea', async () => {
    const cancelled = { ...EXISTING, status: 'cancelled' }
    await assertUpdateValidations(repo, cancelled, { status: 'cancelled', notes: 'reembolso hecho' } as any, STAFF, 'res-1')
  })

  it('editar una reserva YA con check-in tampoco se bloquea (mismo caso)', async () => {
    const checkedIn = { ...EXISTING, status: 'checked_in' }
    await assertUpdateValidations(repo, checkedIn, { status: 'checked_in', adults: 3 } as any, STAFF, 'res-1')
  })
})
