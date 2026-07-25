// caja-chica/tests/service.test.ts — Tests del módulo de caja chica (fondos + reposición).
// Cubre: saldo inicial 0, creación de fondo, reposición completed bumpa currentBalance,
// idempotencia del complete (no doble-acreditación) y ownership/IDOR multi-tenant.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { ForbiddenError, NotFoundError } from 'arckode-framework'
import { CajaChicaService } from '../service'
import type { CurrentUser, PettyCashFundDTO, PettyCashReplenishmentDTO } from '../types'

const log = silentLogger()
const passAuth: Auth = { assertOwnership: () => {}, authenticate: (() => []) as any } as unknown as Auth

/** Auth que SÍ enforce ownership: lanza si el resourceHotelId ≠ userHotelId y no es super_admin. */
function strictAuth(): Auth {
  const assert = (resourceHotelId: string, userHotelId: string, role?: string, superRole = 'super_admin') => {
    if (role === superRole) return
    if (resourceHotelId !== userHotelId) throw new Error('Forbidden: sin ownership')
  }
  return { assertOwnership: assert, authenticate: (() => []) as any } as unknown as Auth
}

const user: CurrentUser = { id: 'u1', hotelId: 'h1', role: 'hotel_admin' }
const userOther: CurrentUser = { id: 'u2', hotelId: 'h2', role: 'hotel_admin' }

/** Repo en memoria. `store` guarda filas; los métodos mutan/copian para no filtrar referencias. */
function repoOf<T extends { id: string; hotelId?: string }>(rows: T[] = []): RepositoryAdapter<T> {
  const store = new Map<string, T>(rows.map((r) => [r.id, { ...r }]))
  return {
    findMany: async (f?: Record<string, unknown>) => {
      const out = [...store.values()]
      if (!f) return out
      return out.filter((r) => Object.entries(f).every(([k, v]) => (r as any)[k] === v))
    },
    findById: async (id: string) => store.get(id) ?? null,
    findOne: async (f?: Record<string, unknown>) => {
      const out = [...store.values()]
      if (!f) return out[0] ?? null
      return out.find((r) => Object.entries(f).every(([k, v]) => (r as any)[k] === v)) ?? null
    },
    create: async (d: any) => {
      const row = { id: crypto.randomUUID(), ...d } as T
      store.set(row.id, row)
      return row
    },
    update: async (id: string, d: any) => {
      const cur = store.get(id)
      if (!cur) return null
      const next = { ...cur, ...d } as T
      store.set(id, next)
      return next
    },
    delete: async (id: string) => {
      if (!store.has(id)) return false
      store.delete(id)
      return true
    },
    count: async (f?: Record<string, unknown>) => {
      const out = [...store.values()]
      if (!f) return out.length
      return out.filter((r) => Object.entries(f).every(([k, v]) => (r as any)[k] === v)).length
    },
    paginate: async (f?: Record<string, unknown>) => {
      const out = [...store.values()]
      const data = !f ? out : out.filter((r) => Object.entries(f).every(([k, v]) => (r as any)[k] === v))
      return { data, total: data.length, limit: 20, offset: 0 }
    },
  } as any
}

const userRepo = {
  findById: async (id: string) => ({ id, hotelId: id === 'u1' ? 'h1' : 'h2' }),
} as any

function svc(funds = repoOf<PettyCashFundDTO>(), reps = repoOf<PettyCashReplenishmentDTO>(), auth: Auth = passAuth) {
  return new CajaChicaService(funds, reps, userRepo, auth, log)
}

describe('caja-chica — fondos (PETTY-1)', () => {
  it('un fondo arranca con currentBalance = 0 aunque el body traiga otro valor', async () => {
    const funds = repoOf<PettyCashFundDTO>()
    const s = svc(funds)
    const f = await s.createFund({
      name: 'Caja recepción', custodianId: 'u1', targetAmount: 5000,
      // El body NO puede forzar el saldo inicial (anti mass-assignment / descuadre).
      currentBalance: 9999,
    } as any, user)
    expect(f.currentBalance).toBe(0)
  })

  it('crea el fondo forzando hotelId del JWT, ignora el del body (IDOR)', async () => {
    const funds = repoOf<PettyCashFundDTO>()
    const s = svc(funds)
    const f = await s.createFund({
      name: 'Fondo', custodianId: 'u1', targetAmount: 100,
      hotelId: 'h-OTRO',   // intento de inyección — debe ignorarse
    } as any, user)
    expect(f.hotelId).toBe('h1')
  })

  it('updateFund NO permite sobrescribir currentBalance desde el body', async () => {
    const funds = repoOf<PettyCashFundDTO>([{ id: 'f1', hotelId: 'h1', name: 'F', custodianId: 'u1', targetAmount: 100, currentBalance: 50, createdAt: '', updatedAt: '' }])
    const s = svc(funds)
    await s.updateFund('f1', { currentBalance: 9999, name: 'F2' } as any, user)
    const f = await s.getFund('f1', user)
    expect(f.currentBalance).toBe(50)   // no cambió
    expect(f.name).toBe('F2')
  })

  it('getFund de otro hotel → error (IDOR)', async () => {
    const funds = repoOf<PettyCashFundDTO>([{ id: 'f1', hotelId: 'h2', name: 'F', custodianId: 'u2', targetAmount: 100, currentBalance: 0, createdAt: '', updatedAt: '' }])
    const s = svc(funds, repoOf<PettyCashReplenishmentDTO>(), strictAuth())
    await expect(s.getFund('f1', user)).rejects.toThrow()
  })

  it('deleteFund inexistente → NotFound', async () => {
    await expect(svc().deleteFund('no-existe', user)).rejects.toThrow(/no encontrado/i)
  })
})

describe('caja-chica — reposición (PETTY-1.5)', () => {
  it('complete: requested → completed y currentBalance += amount', async () => {
    const funds = repoOf<PettyCashFundDTO>([{
      id: 'f1', hotelId: 'h1', name: 'F', custodianId: 'u1', targetAmount: 1000,
      currentBalance: 0, createdAt: '', updatedAt: '',
    }])
    const reps = repoOf<PettyCashReplenishmentDTO>()
    const s = svc(funds, reps)
    const rep = await s.requestReplenishment({ fundId: 'f1', amount: 300 }, user)
    expect(rep.status).toBe('requested')
    expect(rep.requestedBy).toBe('u1')

    const completed = await s.completeReplenishment(rep.id!, user)
    expect(completed.status).toBe('completed')
    expect(completed.approvedBy).toBe('u1')

    const f = await s.getFund('f1', user)
    expect(f.currentBalance).toBe(300)
  })

  it('complete dos veces → Forbidden (anti doble-acreditación del saldo)', async () => {
    const funds = repoOf<PettyCashFundDTO>([{
      id: 'f1', hotelId: 'h1', name: 'F', custodianId: 'u1', targetAmount: 1000,
      currentBalance: 0, createdAt: '', updatedAt: '',
    }])
    const reps = repoOf<PettyCashReplenishmentDTO>()
    const s = svc(funds, reps)
    const rep = await s.requestReplenishment({ fundId: 'f1', amount: 200 }, user)
    await s.completeReplenishment(rep.id!, user)
    // Segundo intento: debe bloquear, NO sumar 200 otra vez.
    await expect(s.completeReplenishment(rep.id!, user)).rejects.toThrow(ForbiddenError)
    const f = await s.getFund('f1', user)
    expect(f.currentBalance).toBe(200)
  })

  it('reposición de otro hotel → error (IDOR)', async () => {
    const funds = repoOf<PettyCashFundDTO>([{
      id: 'f1', hotelId: 'h1', name: 'F', custodianId: 'u1', targetAmount: 1000,
      currentBalance: 0, createdAt: '', updatedAt: '',
    }])
    const reps = repoOf<PettyCashReplenishmentDTO>()
    const s = svc(funds, reps, strictAuth())
    const rep = await s.requestReplenishment({ fundId: 'f1', amount: 100 }, user)
    // userOther (h2) no puede completar la reposición del hotel h1.
    await expect(s.completeReplenishment(rep.id!, userOther)).rejects.toThrow()
  })

  it('listReplenishments de un fondo inexistente → NotFound', async () => {
    await expect(svc().listReplenishments('no-existe', user)).rejects.toThrow(NotFoundError)
  })

  it('requestReplenishment con fondo de otro hotel → error (IDOR)', async () => {
    const funds = repoOf<PettyCashFundDTO>([{
      id: 'f1', hotelId: 'h2', name: 'F', custodianId: 'u2', targetAmount: 1000,
      currentBalance: 0, createdAt: '', updatedAt: '',
    }])
    const s = svc(funds, repoOf<PettyCashReplenishmentDTO>(), strictAuth())
    await expect(s.requestReplenishment({ fundId: 'f1', amount: 100 }, user)).rejects.toThrow()
  })
})

describe('caja-chica — conector (applyExpenseOutflow / revertExpenseOutflow)', () => {
  it('apply: descuenta amount del currentBalance', async () => {
    const funds = repoOf<PettyCashFundDTO>([{
      id: 'f1', hotelId: 'h1', name: 'F', custodianId: 'u1', targetAmount: 1000,
      currentBalance: 500, createdAt: '', updatedAt: '',
    }])
    const s = svc(funds)
    await s.applyExpenseOutflow({ expenseId: 'e1', fundId: 'f1', amount: 120 })
    const f = await s.getFund('f1', user)
    expect(f.currentBalance).toBe(380)
  })

  it('apply dos veces el mismo gasto → idempotente (no descuenta 2×)', async () => {
    const funds = repoOf<PettyCashFundDTO>([{
      id: 'f1', hotelId: 'h1', name: 'F', custodianId: 'u1', targetAmount: 1000,
      currentBalance: 500, createdAt: '', updatedAt: '',
    }])
    const s = svc(funds)
    await s.applyExpenseOutflow({ expenseId: 'e1', fundId: 'f1', amount: 120 })
    await s.applyExpenseOutflow({ expenseId: 'e1', fundId: 'f1', amount: 120 })   // idéntico → no-op
    const f = await s.getFund('f1', user)
    expect(f.currentBalance).toBe(380)
  })

  it('revert: suma amount de vuelta (simétrico)', async () => {
    const funds = repoOf<PettyCashFundDTO>([{
      id: 'f1', hotelId: 'h1', name: 'F', custodianId: 'u1', targetAmount: 1000,
      currentBalance: 500, createdAt: '', updatedAt: '',
    }])
    const s = svc(funds)
    await s.applyExpenseOutflow({ expenseId: 'e1', fundId: 'f1', amount: 120 })
    await s.revertExpenseOutflow('e1')
    const f = await s.getFund('f1', user)
    expect(f.currentBalance).toBe(500)
  })

  it('revert sin haber aplicado → no-op (no falla)', async () => {
    const funds = repoOf<PettyCashFundDTO>([{
      id: 'f1', hotelId: 'h1', name: 'F', custodianId: 'u1', targetAmount: 1000,
      currentBalance: 500, createdAt: '', updatedAt: '',
    }])
    const s = svc(funds)
    await s.revertExpenseOutflow('e-inexistente')
    expect((await s.getFund('f1', user)).currentBalance).toBe(500)
  })

  it('apply con fundId vacío revierte lo aplicado antes (gasto cambió de fondo)', async () => {
    const funds = repoOf<PettyCashFundDTO>([{
      id: 'f1', hotelId: 'h1', name: 'F', custodianId: 'u1', targetAmount: 1000,
      currentBalance: 500, createdAt: '', updatedAt: '',
    }])
    const s = svc(funds)
    await s.applyExpenseOutflow({ expenseId: 'e1', fundId: 'f1', amount: 120 })
    // update: el gasto perdió pettyCashFundId → debe revertir los 120.
    await s.applyExpenseOutflow({ expenseId: 'e1', fundId: undefined, amount: 0 })
    expect((await s.getFund('f1', user)).currentBalance).toBe(500)
  })

  it('apply con fondo inexistente → no falla (best-effort)', async () => {
    const s = svc()
    await expect(s.applyExpenseOutflow({ expenseId: 'e1', fundId: 'no', amount: 10 })).resolves.toBeUndefined()
  })

  it('revert con fondo borrado → no falla (best-effort)', async () => {
    const funds = repoOf<PettyCashFundDTO>([{
      id: 'f1', hotelId: 'h1', name: 'F', custodianId: 'u1', targetAmount: 1000,
      currentBalance: 500, createdAt: '', updatedAt: '',
    }])
    const s = svc(funds)
    await s.applyExpenseOutflow({ expenseId: 'e1', fundId: 'f1', amount: 120 })
    // Simular fondo borrado: vaciamos el repo. revert no debe fallar.
    ;(funds as any).delete('f1')
    await expect(s.revertExpenseOutflow('e1')).resolves.toBeUndefined()
  })
})

describe('caja-chica — flujo completo (e2e unit)', () => {
  it('crear fondo → gasto del fondo (saldo baja) → reposición (saldo sube)', async () => {
    const funds = repoOf<PettyCashFundDTO>()
    const reps = repoOf<PettyCashReplenishmentDTO>()
    const s = svc(funds, reps)

    // 1. Crear fondo (saldo 0)
    const fund = await s.createFund({ name: 'Caja', custodianId: 'u1', targetAmount: 1000 }, user)
    expect(fund.currentBalance).toBe(0)

    // 2. Reposición inicial lo fondea al tope
    const rep1 = await s.requestReplenishment({ fundId: fund.id, amount: 1000 }, user)
    await s.completeReplenishment(rep1.id!, user)
    expect((await s.getFund(fund.id, user)).currentBalance).toBe(1000)

    // 3. Gasto del fondo: el conector llama applyExpenseOutflow
    await s.applyExpenseOutflow({ expenseId: 'e1', fundId: fund.id, amount: 250 })
    expect((await s.getFund(fund.id, user)).currentBalance).toBe(750)

    // 4. Otro gasto
    await s.applyExpenseOutflow({ expenseId: 'e2', fundId: fund.id, amount: 80 })
    expect((await s.getFund(fund.id, user)).currentBalance).toBe(670)

    // 5. Borrar un gasto: el conector llama revertExpenseOutflow (simétrico)
    await s.revertExpenseOutflow('e1')
    expect((await s.getFund(fund.id, user)).currentBalance).toBe(920)

    // 6. Reposición para llevar de vuelta al tope (1000 - 920 = 80)
    const rep2 = await s.requestReplenishment({ fundId: fund.id, amount: 80 }, user)
    await s.completeReplenishment(rep2.id!, user)
    expect((await s.getFund(fund.id, user)).currentBalance).toBe(1000)
  })
})
