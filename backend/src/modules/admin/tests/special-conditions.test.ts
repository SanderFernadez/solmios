// special-conditions.test.ts — botón "Condiciones especiales" del Super Admin
// (PLAN-SUSCRIPCIONES.md §6). Fake ORM en memoria con exact-match por campo, mismo criterio
// que shared/usecases/tests/subscription-suspension-cron.test.ts.
import { describe, it, expect } from 'bun:test'
import { SpecialConditionsUseCase } from '../usecases/special-conditions'

function makeOrm(tables: Record<string, any[]>) {
  const store: Record<string, any[]> = { ...tables }

  function matches(row: any, filters: Record<string, unknown>): boolean {
    return Object.entries(filters).every(([k, v]) => row[k] === v)
  }

  return {
    store,
    findMany: async (table: string, filters: Record<string, unknown> = {}) =>
      (store[table] ?? []).filter((r) => matches(r, filters)),
    findById: async (table: string, id: string) => (store[table] ?? []).find((r) => r.id === id) ?? null,
    update: async (table: string, id: string, patch: any) => {
      const row = (store[table] ?? []).find((r) => r.id === id)
      if (row) Object.assign(row, patch)
      return row ?? null
    },
    updateMany: async (table: string, filters: Record<string, unknown>, changes: any) => {
      const rows = (store[table] ?? []).filter((r) => matches(r, filters))
      for (const row of rows) Object.assign(row, changes)
      return rows.length
    },
    create: async (table: string, data: any) => {
      const row = { id: data.id ?? `${table}-${(store[table]?.length ?? 0) + 1}`, ...data }
      store[table] = [...(store[table] ?? []), row]
      return row
    },
  }
}

const HOTEL = { id: 'h1', name: 'Hotel Sol', email: 'dueno@hotel.com' }
const PLAN_STARTER = { id: 'p1', name: 'Starter', sortOrder: 0 }
const PLAN_PRO = { id: 'p2', name: 'Professional', sortOrder: 1 }
const FOUNDER_ONE = { id: 'cfg1', key: 'founder_one', totalSlots: 10, occupiedCount: 3, discountPct: 40, minPlanSortOrder: 1, status: 'open' }
const PIONEER = { id: 'cfg3', key: 'pioneer', totalSlots: 75, occupiedCount: 5, discountPct: 20, minPlanSortOrder: null, status: 'open' }

describe('SpecialConditionsUseCase.apply — categoría', () => {
  it('asigna Fundador Uno: incrementa cupo, crea discount y setea specialCategory', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', planId: 'p2', status: 'active' }
    const orm = makeOrm({ Subscriptions: [sub], Plans: [PLAN_PRO], SpecialCategoryConfig: [{ ...FOUNDER_ONE }], FounderHistory: [] })
    const uc = new SpecialConditionsUseCase(orm)

    const result = await uc.apply('h1', { type: 'category', category: 'founder_one' }, { id: 'admin1' })

    expect(result.specialCategory).toBe('founder_one')
    expect(orm.store.SpecialCategoryConfig[0].occupiedCount).toBe(4)
    expect(orm.store.SubscriptionDiscounts).toHaveLength(1)
    expect(orm.store.SubscriptionDiscounts[0].type).toBe('category_bonus')
    expect(orm.store.SubscriptionDiscounts[0].discountPct).toBe(40)
  })

  it('rechaza si la categoría está cerrada', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', planId: 'p2', status: 'active' }
    const orm = makeOrm({ Subscriptions: [sub], Plans: [PLAN_PRO], SpecialCategoryConfig: [{ ...FOUNDER_ONE, status: 'closed' }], FounderHistory: [] })
    const uc = new SpecialConditionsUseCase(orm)

    await expect(uc.apply('h1', { type: 'category', category: 'founder_one' }, {})).rejects.toThrow('no está abierta')
  })

  it('rechaza si no hay cupo disponible', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', planId: 'p2', status: 'active' }
    const orm = makeOrm({ Subscriptions: [sub], Plans: [PLAN_PRO], SpecialCategoryConfig: [{ ...FOUNDER_ONE, occupiedCount: 10 }], FounderHistory: [] })
    const uc = new SpecialConditionsUseCase(orm)

    await expect(uc.apply('h1', { type: 'category', category: 'founder_one' }, {})).rejects.toThrow('Sin cupo disponible')
  })

  it('rechaza Fundador si el plan está por debajo de minPlanSortOrder (Starter no califica)', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', planId: 'p1', status: 'active' }
    const orm = makeOrm({ Subscriptions: [sub], Plans: [PLAN_STARTER], SpecialCategoryConfig: [{ ...FOUNDER_ONE }], FounderHistory: [] })
    const uc = new SpecialConditionsUseCase(orm)

    await expect(uc.apply('h1', { type: 'category', category: 'founder_one' }, {})).rejects.toThrow('sortOrder >=')
  })

  it('Pionero no exige plan mínimo: Starter califica', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', planId: 'p1', status: 'active' }
    const orm = makeOrm({ Subscriptions: [sub], Plans: [PLAN_STARTER], SpecialCategoryConfig: [{ ...PIONEER }], FounderHistory: [] })
    const uc = new SpecialConditionsUseCase(orm)

    const result = await uc.apply('h1', { type: 'category', category: 'pioneer' }, {})
    expect(result.specialCategory).toBe('pioneer')
  })

  it('anti-recuperación: rechaza si el hotel ya tuvo y perdió esta categoría', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', planId: 'p2', status: 'active' }
    const history = [{ id: 'fh1', hotelId: 'h1', category: 'founder_one', lostAt: '2026-01-01', reason: 'delinquent' }]
    const orm = makeOrm({ Subscriptions: [sub], Plans: [PLAN_PRO], SpecialCategoryConfig: [{ ...FOUNDER_ONE }], FounderHistory: history })
    const uc = new SpecialConditionsUseCase(orm)

    await expect(uc.apply('h1', { type: 'category', category: 'founder_one' }, {})).rejects.toThrow('no puede volver a calificar')
  })

  it('CAS: si otro admin ya tomó el último cupo entre el read y el write, rechaza (no decrementa dos veces)', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', planId: 'p2', status: 'active' }
    const orm = makeOrm({ Subscriptions: [sub], Plans: [PLAN_PRO], SpecialCategoryConfig: [{ ...FOUNDER_ONE }], FounderHistory: [] })
    // Simula la carrera: entre el read y el write, occupiedCount ya cambió — el CAS real
    // (updateMany con WHERE occupiedCount=expected) no encuentra filas y devuelve 0.
    const realUpdateMany = orm.updateMany
    let first = true
    orm.updateMany = async (table: string, filters: any, changes: any) => {
      if (table === 'SpecialCategoryConfig' && first) { first = false; return 0 }
      return realUpdateMany(table, filters, changes)
    }
    const uc = new SpecialConditionsUseCase(orm)

    await expect(uc.apply('h1', { type: 'category', category: 'founder_one' }, {})).rejects.toThrow('lo tomó otro admin')
  })

  it('category: null desasigna y libera el cupo', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', planId: 'p2', status: 'active', specialCategory: 'founder_one' }
    const orm = makeOrm({ Subscriptions: [sub], Plans: [PLAN_PRO], SpecialCategoryConfig: [{ ...FOUNDER_ONE }], FounderHistory: [] })
    const uc = new SpecialConditionsUseCase(orm)

    await uc.apply('h1', { type: 'category', category: null }, {})

    expect(orm.store.Subscriptions[0].specialCategory).toBeNull()
    expect(orm.store.SpecialCategoryConfig[0].occupiedCount).toBe(2)
  })

  it('QA manual: desasignar revoca el discount category_bonus vigente (si no, activeDiscountPct queda mintiendo)', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', planId: 'p2', status: 'active', specialCategory: 'founder_one' }
    const oldDiscount = { id: 'd1', hotelId: 'h1', subscriptionId: 'sub1', type: 'category_bonus', discountPct: 40, status: 'active', endsAt: null }
    const orm = makeOrm({ Subscriptions: [sub], Plans: [PLAN_PRO], SpecialCategoryConfig: [{ ...FOUNDER_ONE }], FounderHistory: [], SubscriptionDiscounts: [oldDiscount] })
    const uc = new SpecialConditionsUseCase(orm)

    await uc.apply('h1', { type: 'category', category: null }, {})

    expect(orm.store.SubscriptionDiscounts[0].status).toBe('revoked')
    expect(orm.store.SubscriptionDiscounts[0].endsAt).toBeTruthy()
  })

  it('cambiar de categoría libera la anterior, toma la nueva y revoca el discount viejo', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', planId: 'p2', status: 'active', specialCategory: 'founder_one' }
    const oldDiscount = { id: 'd1', hotelId: 'h1', subscriptionId: 'sub1', type: 'category_bonus', discountPct: 40, status: 'active', endsAt: null }
    const orm = makeOrm({
      Subscriptions: [sub], Plans: [PLAN_PRO],
      SpecialCategoryConfig: [{ ...FOUNDER_ONE }, { ...PIONEER }], FounderHistory: [], SubscriptionDiscounts: [oldDiscount],
    })
    const uc = new SpecialConditionsUseCase(orm)

    await uc.apply('h1', { type: 'category', category: 'pioneer' }, {})

    expect(orm.store.SpecialCategoryConfig.find((c: any) => c.key === 'founder_one').occupiedCount).toBe(2)
    expect(orm.store.SpecialCategoryConfig.find((c: any) => c.key === 'pioneer').occupiedCount).toBe(6)
    expect(orm.store.Subscriptions[0].specialCategory).toBe('pioneer')
    // El discount de founder_one queda revocado; el de pioneer se crea nuevo y activo.
    expect(orm.store.SubscriptionDiscounts.find((d: any) => d.id === 'd1').status).toBe('revoked')
    const newDiscount = orm.store.SubscriptionDiscounts.find((d: any) => d.id !== 'd1')
    expect(newDiscount.status).toBe('active')
    expect(newDiscount.discountPct).toBe(20)
  })
})

describe('SpecialConditionsUseCase.apply — descuento manual / mes gratis', () => {
  it('descuento manual crea SubscriptionDiscounts con el % pedido', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', status: 'active' }
    const orm = makeOrm({ Subscriptions: [sub], Configuration: [] })
    const uc = new SpecialConditionsUseCase(orm)

    const result = await uc.apply('h1', { type: 'percentage', discountPct: 25, durationMonths: 3, reason: 'promo' }, { id: 'admin1' })

    expect(result.discountPct).toBe(25)
    expect(result.type).toBe('percentage')
    expect(result.appliedByUserId).toBe('admin1')
  })

  it('mes gratis es un atajo: discountPct 100, durationMonths 1', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', status: 'active' }
    const orm = makeOrm({ Subscriptions: [sub], Configuration: [] })
    const uc = new SpecialConditionsUseCase(orm)

    const result = await uc.apply('h1', { type: 'free_month' }, {})

    expect(result.type).toBe('free_month')
    expect(result.discountPct).toBe(100)
    const start = new Date(result.startAt)
    const end = new Date(result.endsAt)
    expect(end.getMonth()).toBe((start.getMonth() + 1) % 12)
  })

  it('rechaza un descuento por encima de maxManualDiscountPct configurado', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', status: 'active' }
    const settings = { id: 'cfg', hotelId: 'platform', key: 'subscription_settings', value: { maxManualDiscountPct: 50 } }
    const orm = makeOrm({ Subscriptions: [sub], Configuration: [settings] })
    const uc = new SpecialConditionsUseCase(orm)

    await expect(uc.apply('h1', { type: 'percentage', discountPct: 80 }, {})).rejects.toThrow('máximo permitido es 50%')
  })

  it('rechaza discountPct fuera de rango', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', status: 'active' }
    const orm = makeOrm({ Subscriptions: [sub], Configuration: [] })
    const uc = new SpecialConditionsUseCase(orm)

    await expect(uc.apply('h1', { type: 'percentage', discountPct: 150 }, {})).rejects.toThrow('fuera de rango')
  })

  it('404 si el hotel no tiene suscripción registrada', async () => {
    const orm = makeOrm({ Subscriptions: [], Configuration: [] })
    const uc = new SpecialConditionsUseCase(orm)

    await expect(uc.apply('h-inexistente', { type: 'free_month' }, {})).rejects.toThrow('no tiene una suscripción')
  })
})

describe('SpecialConditionsUseCase — búsqueda y suspensión manual', () => {
  it('searchByEmail resuelve email → user → hotel → subscription', async () => {
    const user = { id: 'u1', email: 'dueno@hotel.com', hotelId: 'h1' }
    const sub = { id: 'sub1', hotelId: 'h1', planId: 'p2', status: 'active', specialCategory: 'founder_one' }
    const orm = makeOrm({ Users: [user], Hotels: [HOTEL], Subscriptions: [sub], Plans: [PLAN_PRO] })
    const uc = new SpecialConditionsUseCase(orm)

    const result = await uc.searchByEmail('dueno@hotel.com')
    expect(result.hotelId).toBe('h1')
    expect(result.planSortOrder).toBe(1)
    expect(result.specialCategory).toBe('founder_one')
  })

  it('searchByEmail: 404 si no hay cuenta con ese email', async () => {
    const orm = makeOrm({ Users: [], Hotels: [], Subscriptions: [] })
    const uc = new SpecialConditionsUseCase(orm)
    await expect(uc.searchByEmail('nadie@nada.com')).rejects.toThrow('No se encontró')
  })

  it('suspendManual marca suspendedReason=manual y NO afecta founder_history', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', status: 'active', specialCategory: 'founder_one' }
    const orm = makeOrm({ Subscriptions: [sub], FounderHistory: [] })
    const uc = new SpecialConditionsUseCase(orm)

    await uc.suspendManual('h1')

    expect(orm.store.Subscriptions[0].status).toBe('suspended')
    expect(orm.store.Subscriptions[0].suspendedReason).toBe('manual')
    expect(orm.store.FounderHistory).toHaveLength(0)
    expect(orm.store.Subscriptions[0].specialCategory).toBe('founder_one') // no se toca la categoría
  })

  it('reactivateManual limpia gracia/suspensión y vuelve a active', async () => {
    const sub = { id: 'sub1', hotelId: 'h1', status: 'suspended', graceEndsAt: '2026-01-01', suspendedAt: '2026-01-05', suspendedReason: 'manual' }
    const orm = makeOrm({ Subscriptions: [sub] })
    const uc = new SpecialConditionsUseCase(orm)

    await uc.reactivateManual('h1')

    expect(orm.store.Subscriptions[0]).toMatchObject({ status: 'active', graceEndsAt: null, suspendedAt: null, suspendedReason: null })
  })
})
