// attendance/tests/shift-assignments.test.ts — Calendario de turnos: asignar, reemplazar, listar, borrar.

import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { ShiftAssignmentUseCase } from '../usecases/shift-assignments'

const log = silentLogger()

function make(opts: { assignments?: any[]; scheduleOk?: boolean; employeeOk?: boolean } = {}) {
  const rows: any[] = opts.assignments ? [...opts.assignments] : []
  const repo = {
    findMany: async (f: any) => rows.filter((r) => Object.entries(f).every(([k, v]) => r[k] === v)),
    findOne: async (f: any) => rows.find((r) => Object.entries(f).every(([k, v]) => r[k] === v)) ?? null,
    findById: async (id: string) => rows.find((r) => r.id === id) ?? null,
    create: async (d: any) => { const row = { id: 'new', ...d }; rows.push(row); return row },
    update: async (id: string, d: any) => { const r = rows.find((x) => x.id === id); Object.assign(r, d); return r },
    delete: async (id: string) => { const i = rows.findIndex((x) => x.id === id); if (i >= 0) rows.splice(i, 1); return true },
  } as any
  const scheduleRepo = { findOne: async () => (opts.scheduleOk === false ? null : { id: 's1', hotelId: 'h1' }) } as any
  const profileRepo = { findOne: async () => (opts.employeeOk === false ? null : { id: 'e1', hotelId: 'h1' }) } as any
  return { uc: new ShiftAssignmentUseCase(repo, scheduleRepo, profileRepo, log), rows }
}

const dto = { hotelId: 'h1', employeeId: 'e1', scheduleId: 's1', date: '2026-07-15' }

describe('ShiftAssignmentUseCase', () => {
  it('asigna un turno nuevo', async () => {
    const { uc, rows } = make()
    await uc.assign(dto)
    expect(rows).toHaveLength(1)
    expect(rows[0].scheduleId).toBe('s1')
  })

  it('reemplaza el turno si el empleado ya tiene uno ese día (no duplica)', async () => {
    const { uc, rows } = make({ assignments: [{ id: 'a1', ...dto, scheduleId: 's-old' }] })
    await uc.assign({ ...dto, scheduleId: 's1' })
    expect(rows).toHaveLength(1)
    expect(rows[0].scheduleId).toBe('s1')
  })

  it('rechaza un turno de otro hotel', async () => {
    const { uc } = make({ scheduleOk: false })
    await expect(uc.assign(dto)).rejects.toThrow(/turno no pertenece/i)
  })

  it('rechaza un empleado de otro hotel', async () => {
    const { uc } = make({ employeeOk: false })
    await expect(uc.assign(dto)).rejects.toThrow(/empleado no pertenece/i)
  })

  it('lista filtrando por rango de fechas', async () => {
    const { uc } = make({ assignments: [
      { id: 'a1', ...dto, date: '2026-07-10' },
      { id: 'a2', ...dto, date: '2026-07-20' },
      { id: 'a3', ...dto, date: '2026-08-01' },
    ] })
    const r = await uc.list('h1', '2026-07-01', '2026-07-31')
    expect(r.map((x) => x.id).sort()).toEqual(['a1', 'a2'])
  })

  it('no borra el roster de otro hotel', async () => {
    const { uc } = make({ assignments: [{ id: 'a1', ...dto, hotelId: 'otro' }] })
    await expect(uc.remove('a1', 'h1')).rejects.toThrow(/no encontrada/i)
  })
})
