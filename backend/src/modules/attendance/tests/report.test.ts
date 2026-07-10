// attendance/tests/report.test.ts — getReport y list sobre un repo que SÍ filtra.
//
// Regresión: getReport/list armaban el WHERE con `date: { $gte, $lte }`. El ORM no tiene operadores,
// así que el objeto llegaba crudo al bind y `GET /api/attendance/report` devolvía 500 SIEMPRE.
//
// El bug sobrevivió porque los tests viejos mockean `findMany: async () => []`, que ignora los
// filtros. Acá el mock los aplica de verdad Y falla si recibe un objeto como valor de filtro —
// exactamente lo que el ORM real rechaza.

import { describe, it, expect } from 'bun:test'
import { ClockUseCase } from '../usecases/clock'

const silentLog = { info() {}, warn() {}, error() {}, debug() {} } as any

type Rec = { employeeId: string; hotelId: string; date: string; clockIn?: string; totalHours?: number; overtimeHours: number; status: string }

// Repo que imita al ORM real: sólo igualdad. Si un filtro trae un objeto, tira igual que el driver.
function recordRepo(rows: Rec[]) {
  return {
    async findMany(filters: Record<string, any> = {}) {
      for (const [k, v] of Object.entries(filters)) {
        if (v !== null && typeof v === 'object') {
          throw new TypeError(`Binding expected string... (filtro "${k}" es un objeto)`)
        }
      }
      return rows.filter((r) => Object.entries(filters).every(([k, v]) => (r as any)[k] === v))
    },
    findOne: async () => null, findById: async () => null,
    create: async (d: any) => d, update: async (_id: string, d: any) => d, delete: async () => true,
    count: async () => 0, paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
  } as any
}
const emptyRepo = () => recordRepo([])

const ROWS: Rec[] = [
  { employeeId: 'e1', hotelId: 'h1', date: '2026-07-05', clockIn: '08:00', totalHours: 8, overtimeHours: 0, status: 'present' },
  { employeeId: 'e1', hotelId: 'h1', date: '2026-07-10', clockIn: '08:00', totalHours: 8, overtimeHours: 2, status: 'late' },
  { employeeId: 'e1', hotelId: 'h1', date: '2026-07-20', clockIn: '08:00', totalHours: 8, overtimeHours: 0, status: 'present' }, // fuera de rango
  { employeeId: 'e2', hotelId: 'h1', date: '2026-07-08', overtimeHours: 0, status: 'absent' },
  { employeeId: 'e3', hotelId: 'h2', date: '2026-07-08', clockIn: '08:00', totalHours: 8, overtimeHours: 0, status: 'present' }, // otro hotel
]

const build = (rows: Rec[]) => new ClockUseCase(recordRepo(rows), emptyRepo(), emptyRepo(), silentLog)

describe('ClockUseCase.getReport', () => {
  it('no explota con un rango de fechas (antes: 500)', async () => {
    const report = await build(ROWS).getReport('h1', '2026-07-01', '2026-07-15')
    expect(Array.isArray(report)).toBe(true)
  })

  it('agrega por empleado dentro del rango y del hotel', async () => {
    const report = await build(ROWS).getReport('h1', '2026-07-01', '2026-07-15')
    const e1 = report.find((r) => r.employeeId === 'e1')!
    expect(e1.daysWorked).toBe(2)          // 07-05 y 07-10; el 07-20 queda fuera
    expect(e1.hoursWorked).toBe(16)
    expect(e1.overtimeHours).toBe(2)
    expect(e1.lateArrivals).toBe(1)
    const e2 = report.find((r) => r.employeeId === 'e2')!
    expect(e2.absences).toBe(1)
    expect(report.find((r) => r.employeeId === 'e3')).toBeUndefined()   // hotel h2
  })

  it('sin registros en el rango devuelve []', async () => {
    expect(await build(ROWS).getReport('h1', '2020-01-01', '2020-01-31')).toEqual([])
  })
})

describe('ClockUseCase.list', () => {
  it('filtra por rango sin mandarle un objeto al repo', async () => {
    const out = await build(ROWS).list('h1', '2026-07-01', '2026-07-15')
    expect(out.map((r) => r.date).sort()).toEqual(['2026-07-05', '2026-07-08', '2026-07-10'])
  })

  it('sin from/to trae todos los del hotel', async () => {
    expect(await build(ROWS).list('h1')).toHaveLength(4)   // e1×3 + e2×1; el de h2 queda fuera
  })

  it('filtra por empleado (sin rango: incluye el del 07-20)', async () => {
    const out = await build(ROWS).list('h1', undefined, undefined, 'e1')
    expect(out).toHaveLength(3)
  })
})
