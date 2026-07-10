// payroll/usecases/validate-employees.ts — Estrecha el body de calculate a PayrollEmployeeInput[].
//
// `validateSchema` no soporta el tipo `array` (declararlo hacía que el campo NO se copiara al output
// y el controller leyera `undefined` → 500). Por eso la validación del array va acá, a mano.
//
// Antes el controller sólo comprobaba "es un array no vacío" y casteaba `as PayrollEmployeeInput[]`:
// un `baseSalary: "abc"` o negativo entraba tal cual al motor de cálculo. Un salario NaN envenena
// todo el total de la liquidación.

import { ValidationError } from 'arckode-framework'
import type { PayrollEmployeeInput } from '../types'

function nonNegative(value: unknown, field: string, index: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) {
    throw new ValidationError(`empleado ${index + 1}: "${field}" debe ser un número >= 0`)
  }
  return n
}

/** Valida y normaliza el array de empleados del cálculo de nómina. Lanza en la primera fila inválida. */
export function parseEmployeeInputs(raw: unknown): PayrollEmployeeInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ValidationError('employees debe ser un array con al menos un empleado')
  }

  const seen = new Set<string>()
  return raw.map((row, i) => {
    if (!row || typeof row !== 'object') throw new ValidationError(`empleado ${i + 1}: formato inválido`)
    const r = row as Record<string, unknown>

    const employeeId = String(r.employeeId ?? '').trim()
    if (!employeeId) throw new ValidationError(`empleado ${i + 1}: "employeeId" requerido`)
    // Un empleado repetido en el mismo run se liquida (y se paga) dos veces.
    if (seen.has(employeeId)) throw new ValidationError(`empleado ${i + 1}: "${employeeId}" está duplicado`)
    seen.add(employeeId)

    return {
      employeeId,
      baseSalary: nonNegative(r.baseSalary, 'baseSalary', i),
      daysWorked: nonNegative(r.daysWorked, 'daysWorked', i),
      hoursWorked: nonNegative(r.hoursWorked, 'hoursWorked', i),
      overtimeHours: nonNegative(r.overtimeHours, 'overtimeHours', i),
      absences: nonNegative(r.absences, 'absences', i),
      lateArrivals: nonNegative(r.lateArrivals, 'lateArrivals', i),
    }
  })
}
