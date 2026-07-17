// admin/tests/modules.test.ts — Activar/desactivar módulos del producto (global, platform).
// Invariantes: default ON (módulo sin entrada = activo); el patch solo toca claves del catálogo;
// persiste como upsert en configuration(platform,'modules').

import { describe, it, expect } from 'bun:test'
import { MODULE_CATALOG, getModuleState, setModuleState } from '../usecases/modules'

function configRepo(initial: Record<string, boolean> | null = null) {
  const rows: any[] = initial ? [{ id: 'c1', hotelId: 'platform', key: 'modules', value: { ...initial } }] : []
  return {
    rows,
    findMany: async (f: any) => rows.filter(r => Object.entries(f).every(([k, v]) => r[k] === v)),
    update: async (id: string, data: any) => { const r = rows.find(x => x.id === id); if (r) Object.assign(r, data); return r },
    create: async (data: any) => { rows.push({ ...data }); return data },
  } as any
}

describe('modules — estado', () => {
  it('sin config, todos los módulos vienen activados por default', async () => {
    const state = await getModuleState(configRepo(null))
    for (const m of MODULE_CATALOG) expect(state[m.key]).toBe(true)
  })

  it('un módulo seteado en false queda desactivado; el resto ON', async () => {
    const state = await getModuleState(configRepo({ crm: false }))
    expect(state.crm).toBe(false)
    expect(state.finance).toBe(true)
  })

  it('setModuleState aplica el patch y crea la fila si no existe', async () => {
    const repo = configRepo(null)
    const next = await setModuleState(repo, { hr: false, ai: false })
    expect(next.hr).toBe(false)
    expect(next.ai).toBe(false)
    expect(next.reservations).toBe(true)
    expect(repo.rows).toHaveLength(1)
    expect(repo.rows[0].value.hr).toBe(false)
  })

  it('setModuleState actualiza la fila existente sin duplicar', async () => {
    const repo = configRepo({ crm: false })
    await setModuleState(repo, { crm: true })
    expect(repo.rows).toHaveLength(1)
    expect((await getModuleState(repo)).crm).toBe(true)
  })

  it('ignora claves fuera del catálogo', async () => {
    const repo = configRepo(null)
    const next = await setModuleState(repo, { hackerModule: false } as any)
    expect((next as any).hackerModule).toBeUndefined()
  })
})
