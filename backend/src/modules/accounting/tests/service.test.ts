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
// ORM fake con transaction: acumula las filas creadas por tabla, para verificar asientos.
function makeOrm(store: Record<string, any[]> = {}) {
  const tx = {
    create: async (table: string, data: any) => { (store[table] ??= []).push(data); return data },
    update: async (table: string, id: string, data: any) => {
      const row = (store[table] ??= []).find((r) => r.id === id); if (row) Object.assign(row, data); return row
    },
  }
  return { store, orm: { transaction: async (fn: any) => fn(tx) } as any }
}
function svc(
  repo: RepositoryAdapter<AccountDTO>, auth: Auth = passAuth,
  lines: RepositoryAdapter<any> = makeLines(), entries: RepositoryAdapter<any> = makeLines(),
  orm: any = makeOrm().orm,
) {
  return new AccountingService(repo, makeUserRepo(), log, silentCache, auth, lines, entries, orm)
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

describe('AccountingService — seed del plan de cuentas', () => {
  it('siembra el catálogo base y es idempotente', async () => {
    const created: AccountDTO[] = []
    const repo = makeRepo({
      findMany: async () => created,   // refleja lo ya creado (idempotencia)
      create: async (d) => { const row = { id: `id-${created.length}`, ...d } as AccountDTO; created.push(row); return row },
    })
    const service = svc(repo)
    const res = await service.seedChart(currentUser)
    expect(res.created).toBe(36)                 // el catálogo base tiene 36 cuentas
    expect(res.created).toBe(res.total)
    // Segunda corrida: nada nuevo (idempotente)
    const res2 = await service.seedChart(currentUser)
    expect(res2.created).toBe(0)
  })
})

describe('AccountingService — asientos de doble entrada', () => {
  // Dos cuentas posteables del hotel h1.
  const caja = { id: 'caja', hotelId: 'h1', code: '1.1.01', name: 'Caja', type: 'asset', isPostable: 1 } as AccountDTO
  const clientes = { id: 'cli', hotelId: 'h1', code: '1.1.03', name: 'Clientes', type: 'asset', isPostable: 1 } as AccountDTO
  const grupo = { id: 'grp', hotelId: 'h1', code: '1', name: 'Activo', type: 'asset', isPostable: 0 } as AccountDTO
  const accountsRepo = (map: Record<string, AccountDTO>) => makeRepo({ findOne: async (q: any) => map[q.id] ?? null })

  it('crea un asiento balanceado (debe = haber) con sus líneas', async () => {
    const { store, orm } = makeOrm()
    const service = svc(accountsRepo({ caja, cli: clientes }), passAuth, makeLines(), makeLines(), orm)
    const out = await service.createEntry({
      entryDate: '2026-07-15', description: 'Cobro',
      lines: [{ accountId: 'caja', debit: 100 }, { accountId: 'cli', credit: 100 }],
    }, currentUser)
    expect(out.deduped).toBe(false)
    expect(store.JournalEntries).toHaveLength(1)
    expect(store.JournalEntries[0].period).toBe('2026-07')
    expect(store.JournalLines).toHaveLength(2)
  })

  it('rechaza un asiento descuadrado', async () => {
    const service = svc(accountsRepo({ caja, cli: clientes }))
    await expect(service.createEntry({
      entryDate: '2026-07-15',
      lines: [{ accountId: 'caja', debit: 100 }, { accountId: 'cli', credit: 90 }],
    }, currentUser)).rejects.toThrow(/no cuadra/i)
  })

  it('rechaza un descuadre de EXACTAMENTE 1 centavo (borde del epsilon)', async () => {
    const service = svc(accountsRepo({ caja, cli: clientes }))
    await expect(service.createEntry({
      entryDate: '2026-07-15',
      lines: [{ accountId: 'caja', debit: 100.00 }, { accountId: 'cli', credit: 100.01 }],
    }, currentUser)).rejects.toThrow(/no cuadra/i)
  })

  it('rechaza una línea con débito no numérico (NaN)', async () => {
    const service = svc(accountsRepo({ caja, cli: clientes }))
    await expect(service.createEntry({
      entryDate: '2026-07-15',
      lines: [{ accountId: 'caja', debit: 'abc' as any }, { accountId: 'cli', credit: 100 }],
    }, currentUser)).rejects.toThrow(/numéric/i)
  })

  it('rechaza entryDate con formato inválido', async () => {
    const service = svc(accountsRepo({ caja, cli: clientes }))
    await expect(service.createEntry({
      entryDate: '2026-7-5',
      lines: [{ accountId: 'caja', debit: 100 }, { accountId: 'cli', credit: 100 }],
    }, currentUser)).rejects.toThrow(/YYYY-MM-DD/)
  })

  it('rechaza un asiento con menos de 2 líneas', async () => {
    const service = svc(accountsRepo({ caja, cli: clientes }))
    await expect(service.createEntry({
      entryDate: '2026-07-15', lines: [{ accountId: 'caja', debit: 100 }],
    }, currentUser)).rejects.toThrow(/2 líneas/i)
  })

  it('rechaza una línea contra una cuenta de agrupación (no posteable)', async () => {
    const service = svc(accountsRepo({ grp: grupo, cli: clientes }))
    await expect(service.createEntry({
      entryDate: '2026-07-15',
      lines: [{ accountId: 'grp', debit: 100 }, { accountId: 'cli', credit: 100 }],
    }, currentUser)).rejects.toThrow(/agrupación/i)
  })

  it('rechaza una línea con débito Y crédito a la vez', async () => {
    const service = svc(accountsRepo({ caja, cli: clientes }))
    await expect(service.createEntry({
      entryDate: '2026-07-15',
      lines: [{ accountId: 'caja', debit: 100, credit: 100 }, { accountId: 'cli', credit: 100 }],
    }, currentUser)).rejects.toThrow(/débito O crédito/i)
  })

  it('dedup: mismo reference+referenceType no duplica', async () => {
    const existing = [{ id: 'e0', hotelId: 'h1', reference: 'pay-1', referenceType: 'payment', status: 'posted' }]
    const service = svc(accountsRepo({ caja, cli: clientes }), passAuth, makeLines(), makeLines(existing))
    const out = await service.createEntry({
      entryDate: '2026-07-15', reference: 'pay-1', referenceType: 'payment',
      lines: [{ accountId: 'caja', debit: 100 }, { accountId: 'cli', credit: 100 }],
    }, currentUser)
    expect(out.deduped).toBe(true)
    expect(out.id).toBe('e0')
  })

  it('postEntry pasa draft → posted; re-postear falla', async () => {
    const entry = { id: 'e1', hotelId: 'h1', status: 'draft' }
    const entriesRepo = makeLines([entry]) as any
    entriesRepo.findOne = async () => entry
    entriesRepo.update = async (_id: string, d: any) => { Object.assign(entry, d); return entry }
    const service = svc(makeRepo(), passAuth, makeLines(), entriesRepo)
    await service.postEntry('e1', currentUser)
    expect(entry.status).toBe('posted')
    await expect(service.postEntry('e1', currentUser)).rejects.toThrow(/posted/)
  })

  it('reverseEntry crea el espejo invertido y marca el original reversed', async () => {
    const entry: any = { id: 'e1', hotelId: 'h1', status: 'posted', description: 'Cobro' }
    const origLines = [{ id: 'l1', entryId: 'e1', accountId: 'caja', debit: 100, credit: 0 }]
    // e1 va en el store para que tx.update('JournalEntries','e1',...) lo encuentre y lo marque reversed.
    const { store, orm } = makeOrm({ JournalEntries: [entry] })
    const entriesRepo = makeLines([entry]) as any
    entriesRepo.findOne = async () => entry
    const linesRepo = makeLines(origLines)
    const service = svc(makeRepo(), passAuth, linesRepo, entriesRepo, orm)
    const res = await service.reverseEntry('e1', currentUser)
    expect(res.reversalId).toBeTruthy()
    // El espejo invierte: la línea que era débito 100 ahora es crédito 100.
    const mirror = store.JournalLines[0]
    expect(mirror.credit).toBe(100)
    expect(mirror.debit).toBe(0)
    // El original quedó marcado reversed.
    expect(store.JournalEntries.find((e: any) => e.id === 'e1')?.status).toBe('reversed')
  })

  it('reverseEntry rechaza un asiento en draft (solo posteados se revierten)', async () => {
    const entry = { id: 'e1', hotelId: 'h1', status: 'draft' }
    const entriesRepo = makeLines([entry]) as any
    entriesRepo.findOne = async () => entry
    const service = svc(makeRepo(), passAuth, makeLines(), entriesRepo)
    await expect(service.reverseEntry('e1', currentUser)).rejects.toThrow(/posteado/i)
  })

  it('postEntry de un asiento de OTRO hotel → NotFound (multi-tenant)', async () => {
    const ajeno = { id: 'e1', hotelId: 'OTRO', status: 'draft' }
    const entriesRepo = makeLines([ajeno]) as any
    entriesRepo.findOne = async () => ajeno
    const service = svc(makeRepo(), passAuth, makeLines(), entriesRepo)
    await expect(service.postEntry('e1', currentUser)).rejects.toThrow(/no encontrado/i)
  })
})
