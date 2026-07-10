// shared/tests/build-payroll-prefill.test.ts — El join empleados × fichajes.

import { describe, it, expect } from 'bun:test'
import { buildPayrollPrefill } from '../usecases/build-payroll-prefill'

const emp = (employeeId: string, baseSalary: number, employeeName = employeeId) => ({ employeeId, employeeName, baseSalary })
const rep = (employeeId: string, over: Partial<{ daysWorked: number; hoursWorked: number; overtimeHours: number; absences: number; lateArrivals: number }> = {}) =>
  ({ employeeId, daysWorked: 20, hoursWorked: 160, overtimeHours: 4, absences: 0, lateArrivals: 1, ...over })

describe('buildPayrollPrefill', () => {
  it('un empleado con fichajes trae sus horas y hasAttendance=true', () => {
    const { rows } = buildPayrollPrefill([emp('e1', 1500)], [rep('e1')])
    expect(rows[0]).toMatchObject({ employeeId: 'e1', baseSalary: 1500, daysWorked: 20, hoursWorked: 160, hasAttendance: true })
  })

  it('un empleado SIN fichajes aparece en cero con hasAttendance=false (no se lo excluye)', () => {
    const { rows } = buildPayrollPrefill([emp('e1', 1500)], [])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ daysWorked: 0, hoursWorked: 0, absences: 0, hasAttendance: false })
  })

  it('la lista base son los empleados, no los fichajes', () => {
    const { rows } = buildPayrollPrefill([emp('e1', 1000), emp('e2', 2000)], [rep('e1')])
    expect(rows.map((r) => r.employeeId)).toEqual(['e1', 'e2'])
  })

  it('fichajes de un empleado sin legajo se descartan y se reportan como huérfanos', () => {
    const { rows, orphanFichajes } = buildPayrollPrefill([emp('e1', 1000)], [rep('e1'), rep('fantasma')])
    expect(rows.map((r) => r.employeeId)).toEqual(['e1'])
    expect(orphanFichajes).toEqual(['fantasma'])
  })

  it('salario nulo/0 pasa como 0 (la UI lo pide)', () => {
    const { rows } = buildPayrollPrefill([emp('e1', 0)], [rep('e1')])
    expect(rows[0].baseSalary).toBe(0)
  })

  it('sin empleados devuelve vacío', () => {
    expect(buildPayrollPrefill([], [rep('e1')]).rows).toEqual([])
  })
})
