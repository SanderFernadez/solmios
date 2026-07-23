// accounting/tests/service.test.ts — Tests del servicio de contabilidad (plan de cuentas).
// Usa RepositoryAdapter mock — sin dependencia de SQLite ni Postgres.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { AccountingService } from '../service'
import type { AccountDTO, CurrentUser } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
const passAuth: Auth = { assertOwnership: () => {}, authenticate: (() => []) as any } as unknown as Auth
const currentUser: CurrentUser = { id: 'u1', hotelId: 'h1', role: 'hotel_admin' }

function makeRepo(overrides: Partial<RepositoryAdapter<AccountDTO>> = {}): RepositoryAdapter<AccountDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'acc-id', ...data } as AccountDTO),
    update: async (id, data) => ({ id, ...data } as AccountDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 100, offset: 0, pages: 0 }),
    ...overrides,
  }
}
function makeUserRepo(hotelId = 'h1'): RepositoryAdapter<any> {
  return { ...makeRepo() as any, findById: async () => ({ id: 'u1', hotelId }) }
}
// Repo de journal_lines: por defecto sin líneas (permite borrar). Override para simular asientos.
function makeLines(rows: any[] = []): RepositoryAdapter<any> {
  return { ...makeRepo() as any, findMany: async () => rows }
}
function svc(repo: RepositoryAdapter<AccountDTO>, auth: Auth = passAuth, lines: RepositoryAdapter<any> = makeLines()) {
  return new AccountingService(repo, makeUserRepo(), log, silentCache, auth, lines)
}

describe('AccountingService — plan de cuentas', () => {
  it('crea una cuenta forzando el hotelId del JWT', async () => {
    let created: any = null
    const repo = makeRepo({ create: async (d) => { created = d; return { id: 'a1', ...d } as AccountDTO } })
    const service = svc(repo)
    const acc = await service.createAccount({ code: '1.1.01', name: 'Caja', type: 'asset' }, currentUser)
    expect(acc.id).toBe('a1')
    expect(created.hotelId).toBe('h1')       // forzado desde el user, no del body
    expect(created.isPostable).toBe(1)        // default
  })

  it('rechaza código duplicado por hotel (ConflictError)', async () => {
    const repo = makeRepo({ findMany: async () => [{ id: 'x', hotelId: 'h1', code: '1.1.01' } as AccountDTO] })
    const service = svc(repo)
    await expect(service.createAccount({ code: '1.1.01', name: 'Dup', type: 'asset' }, currentUser))
      .rejects.toThrow(/código 1\.1\.01/)
  })

  it('getAccount lanza NotFound si no existe', async () => {
    const service = svc(makeRepo())
    await expect(service.getAccount('no', currentUser)).rejects.toThrow('Cuenta no encontrada')
  })

  it('getAccount rechaza IDOR si la cuenta es de otro hotel', async () => {
    const denyAuth: Auth = { assertOwnership: () => { throw new Error('Forbidden') }, authenticate: (() => []) as any } as unknown as Auth
    const repo = makeRepo({ findById: async () => ({ id: 'a1', hotelId: 'h2', code: '1', name: 'x', type: 'asset' } as AccountDTO) })
    const service = svc(repo, denyAuth)
    await expect(service.getAccount('a1', currentUser)).rejects.toThrow('Forbidden')
  })

  it('lista el plan de cuentas del hotel', async () => {
    const rows = [{ id: 'a1', hotelId: 'h1', code: '1', name: 'Activo', type: 'asset' } as AccountDTO]
    const repo = makeRepo({ paginate: async () => ({ data: rows, total: 1, limit: 100, offset: 0, pages: 1 }) })
    const service = svc(repo)
    const res = await service.listAccounts({}, currentUser)
    expect(res.total).toBe(1)
    expect(res.data[0].code).toBe('1')
  })

  it('create sin hotel asignado lanza ValidationError', async () => {
    const service = svc(makeRepo())
    const noHotel: CurrentUser = { id: 'u1', hotelId: null, role: 'hotel_admin' }
    await expect(service.createAccount({ code: '1', name: 'x', type: 'asset' }, noHotel))
      .rejects.toThrow('Sin hotel asignado')
  })

  it('create con parentId de otro hotel lo rechaza', async () => {
    const repo = makeRepo({ findOne: async () => ({ id: 'p1', hotelId: 'OTRO', code: '1', name: 'x', type: 'asset' } as AccountDTO) })
    const service = svc(repo)
    await expect(service.createAccount({ code: '1.1', name: 'x', type: 'asset', parentId: 'p1' }, currentUser))
      .rejects.toThrow(/cuenta padre/i)
  })

  it('updateAccount aplica el cambio si es del hotel', async () => {
    const existing = { id: 'a1', hotelId: 'h1', code: '1', name: 'Viejo', type: 'asset' } as AccountDTO
    const repo = makeRepo({ findById: async () => existing, update: async (id, d) => ({ ...existing, id, ...d }) })
    const service = svc(repo)
    const out = await service.updateAccount('a1', { name: 'Nuevo' }, currentUser)
    expect(out.name).toBe('Nuevo')
  })

  it('deleteAccount rechaza si la cuenta tiene subcuentas', async () => {
    const existing = { id: 'a1', hotelId: 'h1', code: '1', name: 'Padre', type: 'asset' } as AccountDTO
    // findMany devuelve un hijo → no se puede borrar
    const repo = makeRepo({ findById: async () => existing, findMany: async () => [{ id: 'child', parentId: 'a1' } as AccountDTO] })
    const service = svc(repo)
    await expect(service.deleteAccount('a1', currentUser)).rejects.toThrow(/subcuentas/i)
  })

  it('deleteAccount rechaza si la cuenta tiene asientos', async () => {
    const existing = { id: 'a1', hotelId: 'h1', code: '1', name: 'Con mov', type: 'asset' } as AccountDTO
    const repo = makeRepo({ findById: async () => existing, findMany: async () => [] }) // sin hijos
    const linesWith = makeLines([{ id: 'l1', accountId: 'a1' }])                          // con líneas
    const service = svc(repo, passAuth, linesWith)
    await expect(service.deleteAccount('a1', currentUser)).rejects.toThrow(/asientos/i)
  })

  it('deleteAccount borra si no tiene hijos ni asientos', async () => {
    const existing = { id: 'a1', hotelId: 'h1', code: '1', name: 'Libre', type: 'asset' } as AccountDTO
    const repo = makeRepo({ findById: async () => existing, findMany: async () => [], delete: async () => true })
    const service = svc(repo)
    await expect(service.deleteAccount('a1', currentUser)).resolves.toBeUndefined()
  })
})
