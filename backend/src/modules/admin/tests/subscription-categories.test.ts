// subscription-categories.test.ts — exclusión de fase genérica por sequenceGroup/opensAfter
// (PLAN-SUSCRIPCIONES.md §9: Fundador Uno y Dos no pueden estar 'open' a la vez).
import { describe, it, expect } from 'bun:test'
import { SubscriptionCategoriesUseCase } from '../usecases/subscription-categories'

function makeOrm(tables: Record<string, any[]>) {
  const store: Record<string, any[]> = { ...tables }
  function matches(row: any, filters: Record<string, unknown>): boolean {
    return Object.entries(filters).every(([k, v]) => row[k] === v)
  }
  return {
    store,
    findMany: async (table: string, filters: Record<string, unknown> = {}) =>
      (store[table] ?? []).filter((r) => matches(r, filters)),
    update: async (table: string, id: string, patch: any) => {
      const row = (store[table] ?? []).find((r) => r.id === id)
      if (row) Object.assign(row, patch)
      return row ?? null
    },
  }
}

const FOUNDER_ONE = { id: 'cfg1', key: 'founder_one', totalSlots: 10, occupiedCount: 0, discountPct: 40, sequenceGroup: 'founder-sequence', opensAfter: null, status: 'open' }
const FOUNDER_TWO = { id: 'cfg2', key: 'founder_two', totalSlots: 15, occupiedCount: 0, discountPct: 30, sequenceGroup: 'founder-sequence', opensAfter: 'founder_one', status: 'closed' }
const PIONEER = { id: 'cfg3', key: 'pioneer', totalSlots: 75, occupiedCount: 0, discountPct: 20, sequenceGroup: null, opensAfter: null, status: 'open' }

describe('SubscriptionCategoriesUseCase.update', () => {
  it('rechaza abrir Fundador Dos mientras Fundador Uno sigue open', async () => {
    const orm = makeOrm({ SpecialCategoryConfig: [{ ...FOUNDER_ONE }, { ...FOUNDER_TWO }] })
    const uc = new SubscriptionCategoriesUseCase(orm)

    await expect(uc.update('founder_two', { status: 'open' })).rejects.toThrow('sigue abierta')
  })

  it('permite abrir Fundador Dos una vez que Fundador Uno está full', async () => {
    const orm = makeOrm({ SpecialCategoryConfig: [{ ...FOUNDER_ONE, status: 'full' }, { ...FOUNDER_TWO }] })
    const uc = new SubscriptionCategoriesUseCase(orm)

    const result = await uc.update('founder_two', { status: 'open' })
    expect(result.status).toBe('open')
  })

  it('permite abrir Fundador Dos una vez que Fundador Uno está closed', async () => {
    const orm = makeOrm({ SpecialCategoryConfig: [{ ...FOUNDER_ONE, status: 'closed' }, { ...FOUNDER_TWO }] })
    const uc = new SubscriptionCategoriesUseCase(orm)

    const result = await uc.update('founder_two', { status: 'open' })
    expect(result.status).toBe('open')
  })

  it('rechaza abrir Fundador Dos si Fundador Uno ni está full ni closed (ej. sigue open a medias)', async () => {
    const orm = makeOrm({ SpecialCategoryConfig: [{ ...FOUNDER_ONE, status: 'open' }, { ...FOUNDER_TWO }] })
    const uc = new SubscriptionCategoriesUseCase(orm)
    await expect(uc.update('founder_two', { status: 'open' })).rejects.toThrow()
  })

  it('Pionero (sin sequenceGroup) puede abrir sin depender de nadie', async () => {
    const orm = makeOrm({ SpecialCategoryConfig: [{ ...FOUNDER_ONE }, { ...PIONEER, status: 'closed' }] })
    const uc = new SubscriptionCategoriesUseCase(orm)

    const result = await uc.update('pioneer', { status: 'open' })
    expect(result.status).toBe('open')
  })

  it('rechaza bajar totalSlots por debajo de lo ya ocupado', async () => {
    const orm = makeOrm({ SpecialCategoryConfig: [{ ...FOUNDER_ONE, occupiedCount: 5 }] })
    const uc = new SubscriptionCategoriesUseCase(orm)

    await expect(uc.update('founder_one', { totalSlots: 3 })).rejects.toThrow('ya hay 5 ocupados')
  })

  it('404 si la categoría no existe', async () => {
    const orm = makeOrm({ SpecialCategoryConfig: [] })
    const uc = new SubscriptionCategoriesUseCase(orm)
    await expect(uc.update('inexistente', { status: 'open' })).rejects.toThrow('no encontrada')
  })

  it('editar discountPct sin tocar status no dispara la validación de secuencia', async () => {
    const orm = makeOrm({ SpecialCategoryConfig: [{ ...FOUNDER_ONE, status: 'closed' }] })
    const uc = new SubscriptionCategoriesUseCase(orm)
    const result = await uc.update('founder_one', { discountPct: 45 })
    expect(result.discountPct).toBe(45)
  })
})
