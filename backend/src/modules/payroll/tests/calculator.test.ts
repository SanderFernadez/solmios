// payroll/tests/calculator.test.ts — El motor de cálculo de nómina.
//
// Fija los dos bugs de plata: (1) el sueldo se prorrateaba forzado /30 (bug muerto: ahora la base
// depende de la FRECUENCIA, no de days/30); (2) las horas extra pagaban $0 por defecto (ahora el
// concepto OT es fórmula 'overtimeAmount' y cobra).

import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { PayrollCalculatorUseCase, periodBaseFor } from '../usecases/calculator'
import type { PayrollConceptDTO, PayrollConfigDTO, PayrollEmployeeInput } from '../types'

const log = silentLogger()

// Conceptos como los siembra el sistema (post-fix): base 100%, extra por fórmula, salud y SS.
const CONCEPTS: Partial<PayrollConceptDTO>[] = [
  { id: 'c1', code: 'BASIC', name: 'Salario Base', type: 'earning', calculationMethod: 'percentage', value: 100 },
  { id: 'c2', code: 'OT15', name: 'Horas Extra', type: 'earning', calculationMethod: 'formula', formula: 'overtimeAmount' },
  { id: 'c3', code: 'HEALTH', name: 'Salud', type: 'deduction', calculationMethod: 'percentage', value: 3.04 },
  { id: 'c4', code: 'SS', name: 'Seguridad Social', type: 'deduction', calculationMethod: 'percentage', value: 7.1 },
]

function calc() {
  const conceptRepo = { findMany: async () => CONCEPTS } as any
  const configRepo = { findOne: async () => null } as any
  return new PayrollCalculatorUseCase(conceptRepo, configRepo, log)
}

function config(freq: string): PayrollConfigDTO {
  return { paymentFrequency: freq, overtimeMultiplier: 1.5 } as PayrollConfigDTO
}

function emp(over: Partial<PayrollEmployeeInput> = {}): PayrollEmployeeInput {
  return { employeeId: 'e1', baseSalary: 30000, daysWorked: 30, hoursWorked: 240, overtimeHours: 0, absences: 0, lateArrivals: 0, ...over }
}

describe('periodBaseFor', () => {
  it('mensual = sueldo completo', () => expect(periodBaseFor(30000, 'monthly')).toBe(30000))
  it('quincenal = mitad', () => expect(periodBaseFor(30000, 'biweekly')).toBe(15000))
  it('semanal = mensual×12/52', () => expect(periodBaseFor(30000, 'weekly')).toBeCloseTo(6923.08, 1))
  it('default (sin freq) = mensual', () => expect(periodBaseFor(30000)).toBe(30000))
})

describe('PayrollCalculatorUseCase', () => {
  it('mensual fijo: cobra el sueldo completo aunque no trabaje los 30 días', async () => {
    // daysWorked 22 (solo días de semana) NO reduce la base — antes daba 30000×22/30.
    const r = await calc().calculate('h1', '2026-07', config('monthly'), [emp({ daysWorked: 22 })])
    expect(r.employees[0].grossPay).toBe(30000)
  })

  it('las horas extra SUMAN (antes pagaban 0)', async () => {
    // 10h extra: 30000/30/8=125/h × 1.5 = 187.5 → 1875.
    const r = await calc().calculate('h1', '2026-07', config('monthly'), [emp({ overtimeHours: 10 })])
    expect(r.employees[0].grossPay).toBe(31875)
  })

  it('las faltas se descuentan a día de sueldo (mensual/30)', async () => {
    // 2 faltas × 1000/día = 2000 menos.
    const r = await calc().calculate('h1', '2026-07', config('monthly'), [emp({ absences: 2 })])
    expect(r.employees[0].grossPay).toBe(28000)
  })

  it('quincenal paga la mitad del sueldo mensual', async () => {
    const r = await calc().calculate('h1', '2026-07', config('biweekly'), [emp()])
    expect(r.employees[0].grossPay).toBe(15000)
  })

  it('aplica deducciones de salud y SS sobre el bruto', async () => {
    const r = await calc().calculate('h1', '2026-07', config('monthly'), [emp()])
    // 30000 × (3.04% + 7.1%) = 3042
    expect(r.employees[0].totalDeductions).toBeCloseTo(3042, 0)
    expect(r.employees[0].netPay).toBeCloseTo(26958, 0)
  })
})
