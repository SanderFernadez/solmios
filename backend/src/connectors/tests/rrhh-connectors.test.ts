// connectors/tests/rrhh-connectors.test.ts — TC-04: conectores de RRHH.
//
// attendance-dashboard (empleados lee el resumen de asistencia) y payroll-gastos (una nómina
// pagada se asienta como gasto). Clave: si gastos está caído, la nómina NO se rompe.

import { describe, it, expect } from 'bun:test'
import type { ConnectorContext } from 'arckode-framework'
import { attendanceDashboardConnector } from '../attendance-dashboard'
import { payrollGastosConnector } from '../payroll-gastos'

function makeCtx(hosts: string[], modules: Record<string, any> = {}) {
  const captured: any = { sockets: {}, attendancePort: null }
  const hostStub = {
    setSockets: (s: any) => Object.assign(captured.sockets, s),
    setAttendancePort: (p: any) => { captured.attendancePort = p },
  }
  const ctx = {
    resolveModule: (name: string) => {
      if (hosts.includes(name)) return { ...hostStub, ...(modules[name] ?? {}) }
      if (name in modules) return modules[name]
      throw new Error(`módulo desconocido: ${name}`)
    },
  } as unknown as ConnectorContext
  return { ctx, captured }
}

describe('attendanceDashboardConnector', () => {
  it('empleados obtiene el resumen de asistencia delegando en attendance', async () => {
    const { ctx, captured } = makeCtx(['empleados'], {
      attendance: { getTodaySummary: async (hotelId: string) => ({ present: 7, late: 2, hotelId }) },
    })
    attendanceDashboardConnector(ctx)

    const summary: any = await captured.attendancePort.getTodaySummary('h1')
    expect(summary.present).toBe(7)
    expect(summary.late).toBe(2)
    expect(summary.hotelId).toBe('h1') // pasa el hotel tal cual
  })
})

describe('payrollGastosConnector', () => {
  it('una nómina pagada se asienta como gasto', async () => {
    const created: any[] = []
    const { ctx, captured } = makeCtx(['payroll'], {
      gastos: {
        findBySource: async () => null, // sin gasto previo → no hay dedup
        create: async (dto: any) => { created.push(dto); return { id: 'g1', ...dto } },
      },
    })
    payrollGastosConnector(ctx)
    await captured.sockets.onRunPaid({
      id: 'run1', hotelId: 'h1', period: '2026-07', totalNet: 5000, status: 'paid',
      paidAt: '2026-07-31T00:00:00Z', employeeCount: 3, totalGross: 6000, totalDeductions: 1000,
    } as any)

    expect(created).toHaveLength(1)
    expect(created[0].hotelId).toBe('h1')
  })

  it('si gastos está caído, el pago de la nómina NO se rompe', async () => {
    const { ctx, captured } = makeCtx(['payroll'], {
      gastos: { findBySource: async () => { throw new Error('gastos caído') }, create: async () => ({}) },
    })
    payrollGastosConnector(ctx)
    await expect(
      captured.sockets.onRunPaid({ id: 'run1', hotelId: 'h1', totalNet: 5000, status: 'paid' } as any),
    ).resolves.toBeUndefined()
  })
})
