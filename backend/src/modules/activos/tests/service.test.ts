// activos/tests/service.test.ts — Inventario de activos + asignación a empleados.
// Verifica multi-tenancy (scoped por hotelId) y el ciclo asignar/devolver.

import { describe, it, expect } from 'bun:test'
import type { CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { ActivosService } from '../service'

const log = silentLogger()
const cache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }

function make(opts: { rows?: any[]; employeeOk?: boolean } = {}) {
  const rows: any[] = opts.rows ? [...opts.rows] : []
  const repo = {
    findMany: async (f: any) => rows.filter((r) => Object.entries(f).every(([k, v]) => r[k] === v)),
    findOne: async (f: any) => rows.find((r) => Object.entries(f).every(([k, v]) => r[k] === v)) ?? null,
    create: async (d: any) => { const row = { id: 'a-new', ...d }; rows.push(row); return row },
    update: async (id: string, d: any) => { const r = rows.find((x) => x.id === id); Object.assign(r, d); return r },
    delete: async (id: string) => { const i = rows.findIndex((x) => x.id === id); if (i >= 0) rows.splice(i, 1); return true },
  } as any
  const profileRepo = { findOne: async () => (opts.employeeOk === false ? null : { id: 'e1', hotelId: 'h1' }) } as any
  return { svc: new ActivosService(repo, log, cache, profileRepo), rows }
}

describe('ActivosService', () => {
  it('crea un activo disponible', async () => {
    const { svc } = make()
    const a = await svc.create({ hotelId: 'h1', name: 'Radio Motorola' })
    expect(a.status).toBe('available')
    expect(a.assignedTo).toBeNull()
  })

  it('lista solo los activos del hotel', async () => {
    const { svc } = make({ rows: [
      { id: 'a1', hotelId: 'h1', name: 'X', status: 'available' },
      { id: 'a2', hotelId: 'h2', name: 'Y', status: 'available' },
    ] })
    const r = await svc.list({ hotelId: 'h1' })
    expect(r.total).toBe(1)
    expect(r.data[0].id).toBe('a1')
  })

  it('getById no devuelve un activo de otro hotel (sin IDOR)', async () => {
    const { svc } = make({ rows: [{ id: 'a1', hotelId: 'h2', name: 'X' }] })
    await expect(svc.getById('a1', 'h1')).rejects.toThrow(/no encontrado/i)
  })

  it('asigna a un empleado y marca assigned', async () => {
    const { svc, rows } = make({ rows: [{ id: 'a1', hotelId: 'h1', name: 'X', status: 'available', assignedTo: null }] })
    const a = await svc.assign('a1', 'h1', 'e1')
    expect(a.status).toBe('assigned')
    expect(a.assignedTo).toBe('e1')
    expect(rows[0].assignedAt).toBeTruthy()
  })

  it('rechaza asignar a un empleado de otro hotel', async () => {
    const { svc } = make({ rows: [{ id: 'a1', hotelId: 'h1', name: 'X', status: 'available' }], employeeOk: false })
    await expect(svc.assign('a1', 'h1', 'e99')).rejects.toThrow(/no pertenece/i)
  })

  it('no asigna un activo retirado', async () => {
    const { svc } = make({ rows: [{ id: 'a1', hotelId: 'h1', name: 'X', status: 'retired' }] })
    await expect(svc.assign('a1', 'h1', 'e1')).rejects.toThrow(/retirado/i)
  })

  it('devuelve el activo al inventario', async () => {
    const { svc } = make({ rows: [{ id: 'a1', hotelId: 'h1', name: 'X', status: 'assigned', assignedTo: 'e1' }] })
    const a = await svc.returnAsset('a1', 'h1')
    expect(a.status).toBe('available')
    expect(a.assignedTo).toBeNull()
  })
})
