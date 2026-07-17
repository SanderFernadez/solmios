// pricing/tests/date-restrictions.test.ts — Estadía mínima por fecha (fila "Días Mínimos" del planning).
// Invariante: default = 1 noche (sin fila); solo se persisten overrides (minStay > 1); poner una fecha
// de vuelta en 1 BORRA su fila (no ensucia la tabla con defaults). listDateRestrictions filtra por rango.

import { describe, it, expect } from 'bun:test'
import { listDateRestrictions, upsertDateRestrictions, minStayForDate, normalizeMinStay } from '../usecases/date-restrictions'

/** Repo en memoria con filtro por igualdad de campos. */
function memRepo() {
  const rows: any[] = []
  let seq = 0
  return {
    rows,
    findMany: async (filter: any = {}) => rows.filter(r => Object.entries(filter).every(([k, v]) => r[k] === v)),
    findById: async (id: string) => rows.find(r => r.id === id) ?? null,
    findOne: async (filter: any = {}) => rows.filter(r => Object.entries(filter).every(([k, v]) => r[k] === v))[0] ?? null,
    create: async (data: any) => { rows.push({ ...data }); return data },
    update: async (id: string, data: any) => { const r = rows.find(x => x.id === id); if (r) Object.assign(r, data); return r },
    delete: async (id: string) => { const i = rows.findIndex(x => x.id === id); if (i >= 0) rows.splice(i, 1); return true },
    count: async () => rows.length,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
  } as any
}

describe('date-restrictions — normalizeMinStay', () => {
  it('fuerza entero >= 1 y descarta basura', () => {
    expect(normalizeMinStay(3)).toBe(3)
    expect(normalizeMinStay('4')).toBe(4)
    expect(normalizeMinStay(1)).toBe(1)
    expect(normalizeMinStay(0)).toBe(1)
    expect(normalizeMinStay(-5)).toBe(1)
    expect(normalizeMinStay(2.9)).toBe(2)
    expect(normalizeMinStay(undefined)).toBe(1)
    expect(normalizeMinStay('abc')).toBe(1)
  })
})

describe('date-restrictions — upsert', () => {
  it('crea override solo para minStay > 1', async () => {
    const repo = memRepo()
    const saved = await upsertDateRestrictions(repo, 'h1', [{ date: '2026-07-20', minStay: 3 }])
    expect(saved).toBe(1)
    expect(repo.rows).toHaveLength(1)
    expect(repo.rows[0]).toMatchObject({ hotelId: 'h1', date: '2026-07-20', minStay: 3 })
  })

  it('minStay = 1 no crea fila (es el default)', async () => {
    const repo = memRepo()
    const saved = await upsertDateRestrictions(repo, 'h1', [{ date: '2026-07-20', minStay: 1 }])
    expect(saved).toBe(0)
    expect(repo.rows).toHaveLength(0)
  })

  it('bajar un override a 1 BORRA la fila', async () => {
    const repo = memRepo()
    await upsertDateRestrictions(repo, 'h1', [{ date: '2026-07-20', minStay: 3 }])
    expect(repo.rows).toHaveLength(1)
    const saved = await upsertDateRestrictions(repo, 'h1', [{ date: '2026-07-20', minStay: 1 }])
    expect(saved).toBe(1)
    expect(repo.rows).toHaveLength(0)
  })

  it('re-upsert de la misma fecha ACTUALIZA, no duplica', async () => {
    const repo = memRepo()
    await upsertDateRestrictions(repo, 'h1', [{ date: '2026-07-20', minStay: 3 }])
    await upsertDateRestrictions(repo, 'h1', [{ date: '2026-07-20', minStay: 5 }])
    expect(repo.rows).toHaveLength(1)
    expect(repo.rows[0].minStay).toBe(5)
  })

  it('descarta fechas con formato inválido', async () => {
    const repo = memRepo()
    const saved = await upsertDateRestrictions(repo, 'h1', [{ date: '20-07-2026', minStay: 3 } as any])
    expect(saved).toBe(0)
    expect(repo.rows).toHaveLength(0)
  })
})

describe('date-restrictions — list + minStayForDate', () => {
  it('list filtra por rango [from, to] y ordena por fecha', async () => {
    const repo = memRepo()
    await upsertDateRestrictions(repo, 'h1', [
      { date: '2026-07-25', minStay: 2 },
      { date: '2026-07-10', minStay: 4 },
      { date: '2026-08-05', minStay: 3 },
    ])
    const rows = await listDateRestrictions(repo, 'h1', '2026-07-01', '2026-07-31')
    expect(rows.map(r => r.date)).toEqual(['2026-07-10', '2026-07-25'])
  })

  it('minStayForDate devuelve el override o 1 por default', async () => {
    const repo = memRepo()
    await upsertDateRestrictions(repo, 'h1', [{ date: '2026-07-20', minStay: 3 }])
    expect(await minStayForDate(repo, 'h1', '2026-07-20')).toBe(3)
    expect(await minStayForDate(repo, 'h1', '2026-07-21')).toBe(1)
  })

  it('aísla por hotel (multi-tenancy)', async () => {
    const repo = memRepo()
    await upsertDateRestrictions(repo, 'h1', [{ date: '2026-07-20', minStay: 3 }])
    expect(await minStayForDate(repo, 'h2', '2026-07-20')).toBe(1)
  })
})
