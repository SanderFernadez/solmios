// connectors/tests/attendance-payroll.test.ts — Cableado payroll ← attendance + empleados.
//
// Verifica que el puerto inyectado mapee salario del legajo → baseSalary, pase el reporte tal cual,
// y pagine hasta agotar el total (un `limit` fijo dejaría empleados afuera de la nómina).

import { describe, it, expect } from 'bun:test'
import type { ConnectorContext } from 'arckode-framework'
import { attendancePayrollConnector } from '../attendance-payroll'

/** Monta el conector y captura el puerto que le pasó a payroll.setPrefillPort. */
function mount(opts: { profiles?: any[]; report?: any[] } = {}) {
  const profiles = opts.profiles ?? []
  let port: any = null

  const ctx = {
    resolveModule: (name: string) => {
      if (name === 'payroll') return { setPrefillPort: (p: any) => { port = p } }
      if (name === 'attendance') return { getReport: async () => opts.report ?? [] }
      if (name === 'empleados') return {
        listProfiles: async ({ page, limit }: { page: number; limit: number }) => {
          const start = (page - 1) * limit
          return { data: profiles.slice(start, start + limit), total: profiles.length, page, limit }
        },
      }
      throw new Error(`módulo desconocido: ${name}`)
    },
  } as unknown as ConnectorContext

  attendancePayrollConnector(ctx)
  return port
}

describe('attendancePayrollConnector', () => {
  it('mapea salary → baseSalary y userName → employeeName', async () => {
    const port = mount({ profiles: [{ id: 'e1', salary: 1500, userName: 'Ana' }] })
    expect(await port.listEmployees('h1')).toEqual([{ employeeId: 'e1', employeeName: 'Ana', baseSalary: 1500 }])
  })

  it('salario nulo → 0; sin userName cae al id', async () => {
    const port = mount({ profiles: [{ id: 'e1', salary: null }] })
    expect(await port.listEmployees('h1')).toEqual([{ employeeId: 'e1', employeeName: 'e1', baseSalary: 0 }])
  })

  it('pagina hasta traer TODOS los empleados (no se queda en la primera página)', async () => {
    // 450 empleados con PAGE_SIZE=200 → 3 páginas. Un limit fijo perdería los últimos 50.
    const profiles = Array.from({ length: 450 }, (_, i) => ({ id: `e${i}`, salary: 1000 }))
    const port = mount({ profiles })
    expect(await port.listEmployees('h1')).toHaveLength(450)
  })

  it('getReport es passthrough', async () => {
    const report = [{ employeeId: 'e1', daysWorked: 20, hoursWorked: 160, overtimeHours: 0, absences: 0, lateArrivals: 0 }]
    const port = mount({ report })
    expect(await port.getReport('h1', '2026-07-01', '2026-07-31')).toEqual(report)
  })
})
