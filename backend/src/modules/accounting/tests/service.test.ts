// accounting/tests/service.test.ts — Tests del servicio de contabilidad (plan de cuentas).
// Usa RepositoryAdapter mock — sin dependencia de SQLite ni Postgres.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { AccountingService } from '../service'
import type { AccountDTO, CurrentUser } from '../types'
import { recordPaymentCompleted, recordRefund, recordFolioCharge, recordExpense } from '../usecases/auto-from-events'

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
  orm: any = makeOrm().orm, periods: RepositoryAdapter<any> = makeLines(),
) {
  return new AccountingService(repo, makeUserRepo(), log, silentCache, auth, lines, entries, orm, periods)
}
// Repo respaldado por el store del orm: en la DB real, tx.create y el repo ven la MISMA tabla.
function makeBacked(store: Record<string, any[]>, table: string): RepositoryAdapter<any> {
  const match = (r: any, q: any) => Object.keys(q || {}).every((k) => r[k] === q[k])
  return {
    ...makeRepo() as any,
    findOne: async (q: any) => (store[table] ?? []).find((r) => match(r, q)) ?? null,
    findMany: async (q: any = {}) => (store[table] ?? []).filter((r) => match(r, q)),
    update: async (id: string, d: any) => { const r = (store[table] ??= []).find((x) => x.id === id); if (r) Object.assign(r, d); return r },
  }
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

describe('AccountingService — períodos contables (CTB-3)', () => {
  const caja = { id: 'caja', hotelId: 'h1', code: '1.1.01', name: 'Caja', type: 'asset', isPostable: 1 } as AccountDTO
  const cli = { id: 'cli', hotelId: 'h1', code: '1.1.03', name: 'Clientes', type: 'asset', isPostable: 1 } as AccountDTO
  const accountsRepo = () => makeRepo({ findOne: async (q: any) => ({ caja, cli } as any)[q.id] ?? null })

  it('crear un asiento en un período CERRADO se rechaza', async () => {
    const periods = makeLines([{ id: 'p1', hotelId: 'h1', period: '2026-07', status: 'closed' }])
    const service = svc(accountsRepo(), passAuth, makeLines(), makeLines(), makeOrm().orm, periods)
    await expect(service.createEntry({
      entryDate: '2026-07-15',
      lines: [{ accountId: 'caja', debit: 100 }, { accountId: 'cli', credit: 100 }],
    }, currentUser)).rejects.toThrow(/está closed/i)
  })

  it('lockPeriod rechaza un período que no está cerrado (lifecycle closed→locked)', async () => {
    const period = { id: 'p1', hotelId: 'h1', period: '2026-07', status: 'open' }
    const periods = makeLines([period]) as any
    periods.findOne = async () => period
    const service = svc(makeRepo(), passAuth, makeLines(), makeLines(), makeOrm().orm, periods)
    await expect(service.lockPeriod('p1', currentUser)).rejects.toThrow(/cerrado/i)
  })

  it('closePeriod cuadrado pasa; descuadrado falla', async () => {
    const period = { id: 'p1', hotelId: 'h1', period: '2026-07', status: 'open' }
    const periods = makeLines([period]) as any
    periods.findOne = async () => period
    periods.update = async (_id: string, d: any) => { Object.assign(period, d); return period }
    // Un asiento posteado balanceado en el período (débitos = créditos)
    const entries = makeLines([{ id: 'e1', hotelId: 'h1', period: '2026-07', status: 'posted' }])
    const linesRepo = makeLines([{ id: 'l1', entryId: 'e1', debit: 100, credit: 0 }, { id: 'l2', entryId: 'e1', debit: 0, credit: 100 }])
    const service = svc(makeRepo(), passAuth, linesRepo, entries, makeOrm().orm, periods)
    await service.closePeriod('p1', currentUser)
    expect(period.status).toBe('closed')
  })
})

describe('AccountingService — recordAuto (CTB-4, conectores)', () => {
  const caja = { id: 'caja', hotelId: 'h1', code: '1.1.01', isPostable: 1 } as AccountDTO
  const cli = { id: 'cli', hotelId: 'h1', code: '1.1.03', isPostable: 1 } as AccountDTO

  it('resuelve códigos → ids, crea y postea el asiento', async () => {
    const byCode: Record<string, AccountDTO> = { '1.1.01': caja, '1.1.03': cli }
    const { store, orm } = makeOrm()
    const repo = makeRepo({ findOne: async (q: any) => ({ caja, cli } as any)[q.id] ?? null, findMany: async (q: any) => byCode[q.code] ? [byCode[q.code]] : [] })
    // entries respaldado por el store del orm → tx.create + postEntry.update ven la misma tabla.
    const entries = makeBacked(store, 'JournalEntries')
    const service = svc(repo, passAuth, makeLines(), entries, orm)
    const res = await service.recordAuto('h1', {
      entryDate: '2026-07-15', reference: 'pay-1', referenceType: 'payment',
      lines: [{ code: '1.1.01', debit: 100 }, { code: '1.1.03', credit: 100 }],
    })
    expect(res.skipped).toBeUndefined()
    expect(store.JournalEntries).toHaveLength(1)
    expect(store.JournalEntries[0].status).toBe('posted')   // automático se postea directo
    expect(store.JournalEntries[0].source).toBe('connector')
  })

  it('self-gating: si falta el plan de cuentas (código no resuelve) → no-op (skipped)', async () => {
    const repo = makeRepo({ findMany: async () => [] })   // ningún código resuelve
    const service = svc(repo)
    const res = await service.recordAuto('h1', {
      entryDate: '2026-07-15', reference: 'pay-1', referenceType: 'payment',
      lines: [{ code: '1.1.01', debit: 100 }, { code: '1.1.03', credit: 100 }],
    })
    expect(res.skipped).toBe(true)
  })
})

describe('AccountingService — reportes (CTB-5 comprobación/mayor, CTB-6 P&L/balance)', () => {
  // Ciclo completo posteado: cargo de folio (ingreso), su cobro, y un gasto.
  const accounts = [
    { id: 'cli', hotelId: 'h1', code: '1.1.03', name: 'Clientes', type: 'asset' },
    { id: 'caja', hotelId: 'h1', code: '1.1.01', name: 'Caja', type: 'asset' },
    { id: 'ing', hotelId: 'h1', code: '4.1.01', name: 'Ingresos Hab.', type: 'income' },
    { id: 'itbis', hotelId: 'h1', code: '2.1.02', name: 'ITBIS por Pagar', type: 'liability' },
    { id: 'gasto', hotelId: 'h1', code: '5.3.01', name: 'Gastos', type: 'expense' },
  ] as any[]
  const entries = [
    { id: 'e1', hotelId: 'h1', period: '2026-07', entryDate: '2026-07-15', status: 'posted' },
    { id: 'e2', hotelId: 'h1', period: '2026-07', entryDate: '2026-07-15', status: 'posted' },
    { id: 'e3', hotelId: 'h1', period: '2026-07', entryDate: '2026-07-16', status: 'posted' },
    { id: 'd1', hotelId: 'h1', period: '2026-07', entryDate: '2026-07-17', status: 'draft' }, // NO cuenta
  ]
  const linesByEntry: Record<string, any[]> = {
    e1: [{ accountId: 'cli', debit: 118, credit: 0 }, { accountId: 'ing', debit: 0, credit: 100 }, { accountId: 'itbis', debit: 0, credit: 18 }],
    e2: [{ accountId: 'caja', debit: 118, credit: 0 }, { accountId: 'cli', debit: 0, credit: 118 }],
    e3: [{ accountId: 'gasto', debit: 50, credit: 0 }, { accountId: 'caja', debit: 0, credit: 50 }],
    d1: [{ accountId: 'gasto', debit: 999, credit: 0 }, { accountId: 'caja', debit: 0, credit: 999 }],
  }
  function reportSvc() {
    const accountsRepo = makeRepo({ findMany: async () => accounts })
    const entriesRepo = makeLines(entries)
    const linesRepo = makeRepo({ findMany: async (q: any) => linesByEntry[q.entryId] ?? [] })
    return new AccountingService(accountsRepo, makeUserRepo(), log, silentCache, passAuth, linesRepo, entriesRepo, makeOrm().orm, makeLines())
  }

  it('balance de comprobación cuadra (débitos = créditos)', async () => {
    const tb = await reportSvc().trialBalance('2026-07', currentUser)
    expect(tb.balanced).toBe(true)
    expect(tb.totalDebit).toBe(286)   // 118+118+50 (draft excluido)
    expect(tb.totalCredit).toBe(286)  // 118+100+18+50
  })

  it('estado de resultados: Ingresos − Gastos = Resultado (draft excluido)', async () => {
    const pnl = await reportSvc().profitLoss(undefined, undefined, currentUser)
    expect(pnl.revenue).toBe(100)
    expect(pnl.expense).toBe(50)     // el gasto en draft (999) NO cuenta
    expect(pnl.result).toBe(50)
  })

  it('balance general: Activo = Pasivo + Patrimonio (incluye resultado)', async () => {
    const bs = await reportSvc().balanceSheet('2026-07', currentUser)
    expect(bs.assets).toBe(68)         // Clientes 0 + Caja 68
    expect(bs.liabilities).toBe(18)    // ITBIS
    expect(bs.equity).toBe(50)         // 0 + resultado 50
    expect(bs.balanced).toBe(true)
  })

  it('libro mayor de Caja: saldo corriente correcto', async () => {
    const led = await reportSvc().generalLedger('caja', currentUser)
    expect(led.account?.code).toBe('1.1.01')
    expect(led.balance).toBe(68)       // +118 −50
    expect(led.movements).toHaveLength(2)
  })
})

describe('auto-from-events — mapeo evento → asiento (CTB-4)', () => {
  // Port falso que captura la última llamada a recordAuto.
  function fakePort() {
    const calls: any[] = []
    return { calls, port: { recordAuto: async (hotelId: string, input: any) => { calls.push({ hotelId, input }); return {} } } }
  }

  it('cobro en efectivo: DR Caja / CR Clientes', async () => {
    const { calls, port } = fakePort()
    await recordPaymentCompleted(port, { id: 'p1', hotelId: 'h1', type: 'charge', method: 'cash', amount: 100, processedAt: '2026-07-15' })
    const l = calls[0].input.lines
    expect(l).toEqual([{ code: '1.1.01', debit: 100 }, { code: '1.1.03', credit: 100 }])
  })

  it('cobro con tarjeta va a Bancos, no a Caja', async () => {
    const { calls, port } = fakePort()
    await recordPaymentCompleted(port, { id: 'p1', hotelId: 'h1', type: 'charge', method: 'card', amount: 50 })
    expect(calls[0].input.lines[0].code).toBe('1.1.02')  // Bancos
  })

  it('un pago que no es charge (deposit) no genera asiento por este evento', async () => {
    const { calls, port } = fakePort()
    await recordPaymentCompleted(port, { id: 'p1', hotelId: 'h1', type: 'deposit', amount: 100 })
    expect(calls).toHaveLength(0)
  })

  it('reembolso: DR Clientes / CR Caja (inverso del cobro), reference único', async () => {
    const { calls, port } = fakePort()
    await recordRefund(port, { id: 'p1', hotelId: 'h1', method: 'cash', amount: 40, processedAt: '2026-07-15' })
    expect(calls[0].input.lines).toEqual([{ code: '1.1.03', debit: 40 }, { code: '1.1.01', credit: 40 }])
    expect(calls[0].input.reference).toBe('p1-ref')   // no choca con el cobro original 'p1'
    expect(calls[0].input.referenceType).toBe('refund')
  })

  it('cargo de folio con impuesto: DR Clientes(total) / CR Ingresos(neto) / CR ITBIS(impuesto)', async () => {
    const { calls, port } = fakePort()
    await recordFolioCharge(port, { hotelId: 'h1' }, { id: 'c1', hotelId: 'h1', kind: 'charge', category: 'room', amount: 100, taxes: 18, total: 118 })
    const l = calls[0].input.lines
    expect(l).toEqual([
      { code: '1.1.03', debit: 118 },
      { code: '4.1.01', credit: 100 },
      { code: '2.1.02', credit: 18 },
    ])
  })

  it('cargo de folio con descuento (total < neto+impuesto): el neto se deriva del total y CUADRA', async () => {
    const { calls, port } = fakePort()
    // amount 100, taxes 18, pero total 100 (descuento): net = total-tax = 82
    await recordFolioCharge(port, {}, { id: 'c1', hotelId: 'h1', kind: 'charge', category: 'room', amount: 100, taxes: 18, total: 100 })
    const l = calls[0].input.lines
    const debe = l.reduce((s: number, x: any) => s + (x.debit || 0), 0)
    const haber = l.reduce((s: number, x: any) => s + (x.credit || 0), 0)
    expect(debe).toBe(haber)   // 100 = 82 + 18
    expect(l[1].credit).toBe(82)
  })

  it('cargo de folio sin impuesto: solo 2 líneas', async () => {
    const { calls, port } = fakePort()
    await recordFolioCharge(port, {}, { id: 'c1', hotelId: 'h1', kind: 'charge', category: 'extra', amount: 40, taxes: 0, total: 40 })
    expect(calls[0].input.lines).toHaveLength(2)
    expect(calls[0].input.lines[1].code).toBe('4.2.01')  // servicios
  })

  it('línea de folio kind=payment NO genera ingreso', async () => {
    const { calls, port } = fakePort()
    await recordFolioCharge(port, {}, { id: 'c1', hotelId: 'h1', kind: 'payment', amount: 100 })
    expect(calls).toHaveLength(0)
  })

  it('gasto pagado en efectivo: DR Gasto / CR Caja', async () => {
    const { calls, port } = fakePort()
    await recordExpense(port, { id: 'g1', hotelId: 'h1', amount: 30, paid: 1, paymentMethod: 'cash', source: 'manual' })
    expect(calls[0].input.lines).toEqual([{ code: '5.3.01', debit: 30 }, { code: '1.1.01', credit: 30 }])
  })

  it('gasto a crédito (impago): CR Cuentas por Pagar', async () => {
    const { calls, port } = fakePort()
    await recordExpense(port, { id: 'g1', hotelId: 'h1', amount: 30, paid: 0, source: 'manual' })
    expect(calls[0].input.lines[1].code).toBe('2.1.01')  // AP
  })

  it('gasto de nómina va a su cuenta 5.2.01', async () => {
    const { calls, port } = fakePort()
    await recordExpense(port, { id: 'g1', hotelId: 'h1', amount: 500, paid: 1, paymentMethod: 'transfer', source: 'payroll' })
    expect(calls[0].input.lines[0].code).toBe('5.2.01')
  })
})
