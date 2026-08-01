// admin/tests/module-overrides.test.ts — 3ra capa de entitlement: overrides por hotel.
// Estado efectivo = global ∩ plan.modules ∩ override-hotel.
// Semántica: enabled=fuerza ON aunque el plan no lo incluya; disabled=fuerza OFF aunque sí;
// startsAt futuro → no aplica; endsAt pasado → se ignora (respeta el plan).

import { describe, it, expect } from 'bun:test'
import { MODULE_CATALOG, getModuleStateForPlan } from '../usecases/modules'

// --- Mocks en memoria (mismo estilo que modules.test.ts) ---
function configRepo(initial: Record<string, boolean> | null = null) {
  const rows: any[] = initial ? [{ id: 'c1', hotelId: 'platform', key: 'modules', value: { ...initial } }] : []
  return {
    findMany: async (f: any) => rows.filter(r => Object.entries(f).every(([k, v]) => r[k] === v)),
  } as any
}

function plansRepo(modules: string[] | undefined) {
  return {
    findMany: async (_f: any) => (modules === undefined ? [] : [{ id: 'p1', slug: 'basico', modules }]),
  } as any
}

function overridesRepo(rows: any[]) {
  // findMany filtra por igualdad exacta de las props del filtro (hotelId, etc.)
  return {
    findMany: async (f: any) => rows.filter(r => Object.entries(f).every(([k, v]) => r[k] === v)),
  } as any
}

describe('modules — 3ra capa: overrides por hotel (global ∩ plan ∩ override)', () => {
  const HOTEL = 'hotel-1'
  const PLAN_SLUG = 'basico'

  it('override enabled en módulo NO incluido en el plan → queda ON', async () => {
    // Plan solo incluye 'reservations'. Override habilita 'crm' para este hotel.
    const state = await getModuleStateForPlan(
      configRepo(null),
      plansRepo(['reservations']),
      PLAN_SLUG,
      overridesRepo([{ hotelId: HOTEL, moduleKey: 'crm', status: 'enabled' }]),
      HOTEL,
    )
    expect(state.reservations).toBe(true) // venía del plan
    expect(state.crm).toBe(true)         // forzado ON por override aunque no estaba en el plan
    expect(state.ai).toBe(false)         // fuera del plan y sin override → OFF
  })

  it('override disabled en módulo SÍ incluido en el plan → queda OFF', async () => {
    // Plan incluye 'finance' y 'reservations', pero el override apaga 'finance' para este hotel.
    const state = await getModuleStateForPlan(
      configRepo(null),
      plansRepo(['finance', 'reservations']),
      PLAN_SLUG,
      overridesRepo([{ hotelId: HOTEL, moduleKey: 'finance', status: 'disabled' }]),
      HOTEL,
    )
    expect(state.reservations).toBe(true)
    expect(state.finance).toBe(false)    // forzado OFF por override aunque sí estaba en el plan
  })

  it('override con endsAt ya vencido → NO aplica (respeta el plan)', async () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    // 'crm' no está en el plan y el override está vencido → debe quedar OFF (como el plan).
    const state = await getModuleStateForPlan(
      configRepo(null),
      plansRepo(['reservations']),
      PLAN_SLUG,
      overridesRepo([{ hotelId: HOTEL, moduleKey: 'crm', status: 'enabled', endsAt: past }]),
      HOTEL,
    )
    expect(state.crm).toBe(false) // override expirado ignorado
    expect(state.reservations).toBe(true)
  })

  it('override con startsAt futuro → NO aplica aún', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    // 'ai' no está en el plan; override 'enabled' pero arranca mañana → aún OFF.
    const state = await getModuleStateForPlan(
      configRepo(null),
      plansRepo(['reservations']),
      PLAN_SLUG,
      overridesRepo([{ hotelId: HOTEL, moduleKey: 'ai', status: 'enabled', startsAt: future }]),
      HOTEL,
    )
    expect(state.ai).toBe(false) // override no iniciado, se respeta el plan
  })

  it('llamada sin overridesRepo (3 args) → idéntica al comportamiento previo', async () => {
    // Mismo escenario que el test "plan con módulos" en modules.test.ts, sin overrides.
    const state = await getModuleStateForPlan(
      configRepo(null),
      plansRepo(['reservations', 'finance']),
      PLAN_SLUG,
    )
    expect(state.reservations).toBe(true)
    expect(state.finance).toBe(true)
    expect(state.crm).toBe(false)  // no está en el plan, sin override
    expect(state.ai).toBe(false)
  })
})
