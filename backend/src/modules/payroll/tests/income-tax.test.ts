// El ISR se aplicaba anualizando el sueldo (×12) contra tramos MENSUALES: un
// salario de 50.000 caía en el tramo del 25% y pagaba 11.548,58 en vez de
// 1.536,75. Al empleado le faltaban más de 10.000 por mes en el bolsillo.
import { describe, it, expect } from 'bun:test'
import { PayrollCalculatorUseCase } from '../usecases/calculator'
import type { RepositoryAdapter, Logger } from 'arckode-framework'

const log = { info() {}, warn() {}, error() {}, child: () => log } as unknown as Logger

/** Escala mensual dominicana, tal como la seedea el sistema. */
const BRACKETS = JSON.stringify([
  { from: 0, to: 34685, rate: 0 },
  { from: 34685, to: 52027, rate: 15 },
  { from: 52027, to: 72260, rate: 20 },
  { from: 72260, rate: 25 },
])

const CONCEPTS = [
  { id: 'c1', hotelId: 'h1', code: 'BASE', name: 'Sueldo', type: 'earning', calculationMethod: 'formula', formula: 'base', active: 1, priority: 1 },
  { id: 'c2', hotelId: 'h1', code: 'HEALTH', name: 'Salud', type: 'deduction', calculationMethod: 'percentage', value: 3.04, active: 1, priority: 20 },
  { id: 'c3', hotelId: 'h1', code: 'SS', name: 'Seguridad Social', type: 'deduction', calculationMethod: 'percentage', value: 7.1, active: 1, priority: 21 },
  { id: 'c4', hotelId: 'h1', code: 'TAX', name: 'ISR', type: 'tax', calculationMethod: 'percentage', value: 0, active: 1, priority: 30 },
]

const CONFIG: any = {
  hotelId: 'h1', paymentFrequency: 'monthly', overtimeMultiplier: 1.5, incomeTaxRates: BRACKETS,
}

function calc() {
  const conceptRepo = { findMany: async () => CONCEPTS } as unknown as RepositoryAdapter<any>
  const configRepo = { findMany: async () => [CONFIG] } as unknown as RepositoryAdapter<any>
  return new PayrollCalculatorUseCase(conceptRepo, configRepo, log)
}

const emp = (baseSalary: number) => ([{
  employeeId: 'e1', baseSalary, daysWorked: 30, hoursWorked: 240,
  overtimeHours: 0, absences: 0, lateArrivals: 0,
}]) as any

describe('Nómina — ISR sobre la escala mensual', () => {
  it('50.000: descuenta 6.606,75 y paga 43.393,25', async () => {
    const r = await calc().calculate('h1', '2026-07', CONFIG, emp(50000))
    // AFP 3.550 + SFS 1.520 = 5.070 · base ISR 44.930 → 15% del excedente = 1.536,75
    expect(r.totalGross).toBe(50000)
    expect(r.totalDeductions).toBeCloseTo(6606.75, 2)
    expect(r.totalNet).toBeCloseTo(43393.25, 2)
  })

  it('un sueldo bajo no paga ISR (queda en el tramo exento)', async () => {
    const r = await calc().calculate('h1', '2026-07', CONFIG, emp(30000))
    // 30.000 − 2.130 AFP − 912 SFS = 26.958 → por debajo de 34.685, exento.
    expect(r.totalDeductions).toBeCloseTo(3042, 2)
  })

  it('el ISR se calcula sobre el sueldo MENOS la seguridad social, no sobre el bruto', async () => {
    const r = await calc().calculate('h1', '2026-07', CONFIG, emp(40000))
    // Base ISR = 40.000 − 2.840 − 1.216 = 35.944 → 15% de (35.944 − 34.685) = 188,85
    // Sobre el bruto daría 15% de (40.000 − 34.685) = 797,25: más del cuádruple.
    expect(r.totalDeductions).toBeCloseTo(2840 + 1216 + 188.85, 2)
  })

  it('un sueldo alto usa los tramos progresivos, no la tasa máxima sobre todo', async () => {
    const r = await calc().calculate('h1', '2026-07', CONFIG, emp(100000))
    // Base = 100.000 − 7.100 − 3.040 = 89.860
    // 15% de (52.027−34.685) + 20% de (72.260−52.027) + 25% de (89.860−72.260)
    const isr = 0.15 * (52027 - 34685) + 0.20 * (72260 - 52027) + 0.25 * (89860 - 72260)
    expect(r.totalDeductions).toBeCloseTo(7100 + 3040 + isr, 1)
  })
})
