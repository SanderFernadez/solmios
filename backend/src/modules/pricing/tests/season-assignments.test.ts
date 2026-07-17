// pricing/tests/season-assignments.test.ts — Temporada por fecha (diálogo "Asignación de temporadas").
// Invariantes: asigna en lote sobre un rango filtrado por día de la semana; upsert idempotente por
// fecha; season vacío borra la asignación; datesInRange respeta rango inclusivo + weekdays (0=Dom).

import { describe, it, expect } from 'bun:test'
import { datesInRange, listSeasonAssignments, assignSeason } from '../usecases/season-assignments'

function memRepo() {
  const rows: any[] = []
  return {
    rows,
    findMany: async (filter: any = {}) => rows.filter(r => Object.entries(filter).every(([k, v]) => r[k] === v)),
    create: async (data: any) => { rows.push({ ...data }); return data },
    update: async (id: string, data: any) => { const r = rows.find(x => x.id === id); if (r) Object.assign(r, data); return r },
    delete: async (id: string) => { const i = rows.findIndex(x => x.id === id); if (i >= 0) rows.splice(i, 1); return true },
  } as any
}

describe('datesInRange', () => {
  it('rango inclusivo, todos los días si no hay weekdays', () => {
    expect(datesInRange('2026-07-13', '2026-07-16')).toEqual(['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16'])
  })

  it('filtra por día de la semana (0=Dom..6=Sáb)', () => {
    // 2026-07-13 = lunes(1). Solo lunes(1) y miércoles(3) en la semana.
    const r = datesInRange('2026-07-13', '2026-07-19', [1, 3])
    expect(r).toEqual(['2026-07-13', '2026-07-15'])
  })

  it('devuelve vacío si to < from o fecha inválida', () => {
    expect(datesInRange('2026-07-20', '2026-07-10')).toEqual([])
    expect(datesInRange('bad', '2026-07-10')).toEqual([])
  })
})

describe('assignSeason', () => {
  it('asigna la temporada a cada fecha del rango', async () => {
    const repo = memRepo()
    const n = await assignSeason(repo, 'h1', { from: '2026-07-13', to: '2026-07-15', season: 'alta' })
    expect(n).toBe(3)
    expect(repo.rows.map((r: any) => r.season)).toEqual(['alta', 'alta', 'alta'])
  })

  it('reasignar la misma fecha ACTUALIZA, no duplica', async () => {
    const repo = memRepo()
    await assignSeason(repo, 'h1', { from: '2026-07-13', to: '2026-07-13', season: 'baja' })
    await assignSeason(repo, 'h1', { from: '2026-07-13', to: '2026-07-13', season: 'alta' })
    expect(repo.rows).toHaveLength(1)
    expect(repo.rows[0].season).toBe('alta')
  })

  it('season vacío BORRA las asignaciones del rango', async () => {
    const repo = memRepo()
    await assignSeason(repo, 'h1', { from: '2026-07-13', to: '2026-07-14', season: 'media' })
    expect(repo.rows).toHaveLength(2)
    const n = await assignSeason(repo, 'h1', { from: '2026-07-13', to: '2026-07-14', season: '' })
    expect(n).toBe(2)
    expect(repo.rows).toHaveLength(0)
  })

  it('respeta el filtro de weekdays al asignar', async () => {
    const repo = memRepo()
    // 13=lun,14=mar,15=mié... solo fines de semana: 18=sáb(6), 19=dom(0)
    const n = await assignSeason(repo, 'h1', { from: '2026-07-13', to: '2026-07-19', weekdays: [0, 6], season: 'alta' })
    expect(n).toBe(2)
    expect(repo.rows.map((r: any) => r.date).sort()).toEqual(['2026-07-18', '2026-07-19'])
  })
})

describe('listSeasonAssignments', () => {
  it('filtra por rango y ordena por fecha; aísla por hotel', async () => {
    const repo = memRepo()
    await assignSeason(repo, 'h1', { from: '2026-07-10', to: '2026-07-10', season: 'baja' })
    await assignSeason(repo, 'h1', { from: '2026-08-05', to: '2026-08-05', season: 'alta' })
    await assignSeason(repo, 'h2', { from: '2026-07-10', to: '2026-07-10', season: 'media' })
    const r = await listSeasonAssignments(repo, 'h1', '2026-07-01', '2026-07-31')
    expect(r.map(x => x.date)).toEqual(['2026-07-10'])
    expect(r[0].season).toBe('baja')
  })
})
