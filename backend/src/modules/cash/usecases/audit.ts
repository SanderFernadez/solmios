// cash/usecases/audit.ts — Puerto de auditoría de la caja (SC-05).
//
// El módulo NO importa auditlog: declara el puerto y el connector `cash-auditlog` inyecta la
// implementación (regla del framework, sin imports cross-módulo).
//
// Acá se audita EFECTIVO REAL: borrar un movimiento, abrir un turno, cerrarlo con un conteo que
// puede no cuadrar, y el arqueo. Todas mueven (o justifican) plata del cajón físico y hasta ahora
// no dejaban rastro de QUIÉN las ejecutó. Auditar nunca puede tumbar la operación: si el registro
// falla, se loguea y sigue (`auditSafely`).

import type { AuditEntry, AuditPort } from '../../../shared/usecases/audit'
import type { CashMovementDTO, CashShiftDTO, ReconcileResult, CurrentUser } from '../types'

export type { AuditEntry, AuditPort }
export { auditSafely } from '../../../shared/usecases/audit'

const money = (amount: number): string => `${Number(amount || 0).toFixed(2)}`

export function movementDeleteEntry(mov: CashMovementDTO, actor: CurrentUser): AuditEntry {
  return {
    hotelId: mov.hotelId,
    userId: actor?.id,
    action: 'cash.movement_delete',
    entity: 'cash_movement',
    entityId: mov.id,
    detail: `Movimiento de caja borrado · ${mov.type} ${money(mov.amount)}` +
      `${mov.concept ? ` · ${mov.concept}` : ''}${mov.method ? ` · ${mov.method}` : ''}`,
  }
}

export function shiftOpenEntry(shift: CashShiftDTO, actor: CurrentUser): AuditEntry {
  return {
    hotelId: shift.hotelId,
    userId: actor?.id,
    action: 'cash.shift_open',
    entity: 'cash_shift',
    entityId: shift.id,
    detail: `Turno de caja abierto · fondo inicial ${money(shift.openingAmount)}`,
  }
}

/** El cierre es el momento en que una diferencia de caja se vuelve definitiva: se audita el delta. */
export function shiftCloseEntry(shift: CashShiftDTO, actor: CurrentUser): AuditEntry {
  const diff = Number(shift.difference || 0)
  const label = diff === 0 ? 'sin diferencia' : `diferencia ${diff > 0 ? '+' : ''}${money(diff)}`
  return {
    hotelId: shift.hotelId,
    userId: actor?.id,
    action: 'cash.shift_close',
    entity: 'cash_shift',
    entityId: shift.id,
    detail: `Turno de caja cerrado · esperado ${money(shift.expectedAmount ?? 0)}` +
      ` · contado ${money(shift.countedAmount ?? 0)} · ${label}`,
  }
}

export function shiftReconcileEntry(result: ReconcileResult, actor: CurrentUser): AuditEntry {
  return {
    hotelId: result.shift.hotelId,
    userId: actor?.id,
    action: 'cash.shift_reconcile',
    entity: 'cash_shift',
    entityId: result.shift.id,
    detail: `Arqueo de turno · esperado ${money(result.expected)} · contado ${money(result.counted)}` +
      ` · diferencia ${money(result.difference)}`,
  }
}
