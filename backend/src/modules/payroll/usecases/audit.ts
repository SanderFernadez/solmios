// payroll/usecases/audit.ts — Puerto de auditoría de la nómina (SC-05).
//
// El módulo NO importa auditlog: declara el puerto y el connector `payroll-auditlog` inyecta la
// implementación (regla del framework, sin imports cross-módulo).
//
// Se audita el ciclo de vida del dinero de los sueldos: aprobar una liquidación (la vuelve pagable),
// pagarla (saca plata del hotel, el conector `payroll-gastos` asienta el egreso), cancelarla, y el
// borrado de un concepto (cambia lo que se le descuenta o suma a TODOS los empleados en la próxima
// liquidación). Auditar nunca puede tumbar la operación (`auditSafely`).

import type { AuditEntry, AuditPort } from '../../../shared/usecases/audit'
import type { PayrollRunDTO, PayrollConceptDTO, PayrollCurrentUser } from '../types'

export type { AuditEntry, AuditPort }
export { auditSafely } from '../../../shared/usecases/audit'

export type RunAction = 'payroll.run_approve' | 'payroll.run_pay' | 'payroll.run_cancel'

const LABEL: Record<RunAction, string> = {
  'payroll.run_approve': 'Liquidación de nómina aprobada',
  'payroll.run_pay': 'Liquidación de nómina PAGADA',
  'payroll.run_cancel': 'Liquidación de nómina cancelada',
}

export function runEntry(run: PayrollRunDTO, action: RunAction, actor?: PayrollCurrentUser): AuditEntry {
  const net = Number(run.totalNet || 0).toFixed(2)
  const method = action === 'payroll.run_pay' && run.paymentMethod ? ` · vía ${run.paymentMethod}` : ''
  return {
    hotelId: run.hotelId,
    userId: actor?.id,
    action,
    entity: 'payroll_run',
    entityId: run.id,
    detail: `${LABEL[action]} · período ${run.period} · ${run.employeeCount} empleados` +
      ` · neto ${net}${method}`,
  }
}

export function conceptDeleteEntry(concept: PayrollConceptDTO, actor?: PayrollCurrentUser): AuditEntry {
  return {
    hotelId: concept.hotelId,
    userId: actor?.id,
    action: 'payroll.concept_delete',
    entity: 'payroll_concept',
    entityId: concept.id,
    detail: `Concepto de nómina borrado · ${concept.code} "${concept.name}" (${concept.type})` +
      `${concept.value !== null ? ` · valor ${concept.value}` : ''}`,
  }
}
