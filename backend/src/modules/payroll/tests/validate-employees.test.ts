// payroll/tests/validate-employees.test.ts — Contrato del body de calculate.

import { describe, it, expect } from 'bun:test'
import { parseEmployeeInputs } from '../usecases/validate-employees'

const ok = { employeeId: 'e1', baseSalary: 1500, daysWorked: 30, hoursWorked: 240, overtimeHours: 0, absences: 0, lateArrivals: 0 }

describe('parseEmployeeInputs', () => {
  it('acepta el caso feliz', () => {
    const out = parseEmployeeInputs([ok])
    expect(out).toHaveLength(1)
    expect(out[0].baseSalary).toBe(1500)
  })

  it('normaliza numéricos que vienen como string', () => {
    const out = parseEmployeeInputs([{ ...ok, baseSalary: '1500', daysWorked: '30' }])
    expect(out[0].baseSalary).toBe(1500)
    expect(out[0].daysWorked).toBe(30)
  })

  it('rechaza un array vacío', () => {
    expect(() => parseEmployeeInputs([])).toThrow(/al menos un empleado/)
  })

  it('rechaza algo que no es array', () => {
    expect(() => parseEmployeeInputs({ employeeId: 'e1' })).toThrow(/array/)
    expect(() => parseEmployeeInputs(undefined)).toThrow(/array/)
  })

  it('rechaza baseSalary no numérico', () => {
    expect(() => parseEmployeeInputs([{ ...ok, baseSalary: 'abc' }])).toThrow(/baseSalary/)
  })

  it('rechaza baseSalary negativo', () => {
    expect(() => parseEmployeeInputs([{ ...ok, baseSalary: -100 }])).toThrow(/baseSalary/)
  })

  it('rechaza NaN', () => {
    expect(() => parseEmployeeInputs([{ ...ok, hoursWorked: NaN }])).toThrow(/hoursWorked/)
  })

  it('rechaza employeeId vacío', () => {
    expect(() => parseEmployeeInputs([{ ...ok, employeeId: '  ' }])).toThrow(/employeeId/)
  })

  it('rechaza un employeeId duplicado (se pagaría dos veces)', () => {
    expect(() => parseEmployeeInputs([ok, { ...ok, baseSalary: 2000 }])).toThrow(/duplicado/)
  })

  it('reporta el índice de la fila culpable (base 1)', () => {
    expect(() => parseEmployeeInputs([ok, { ...ok, employeeId: 'e2', absences: -1 }])).toThrow(/empleado 2/)
  })
})
