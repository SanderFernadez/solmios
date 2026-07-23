// scripts/backfill-accounting.ts — CTB-8: genera los asientos contables de lo YA existente
// (pagos completados, cargos de folio, gastos) para poblar el Libro Diario histórico.
//
// Reusa EXACTAMENTE las funciones de asiento automático de los conectores
// (recordPaymentCompleted/recordRefund/recordFolioCharge/recordExpense) → mismo mapeo de cuentas,
// misma idempotencia (dedup por reference+referenceType dentro de createJournalEntry). Re-correrlo
// NO duplica. Self-gating: un hotel sin plan de cuentas se saltea (los códigos no resuelven).
//
// Uso:
//   DATABASE_URL=postgres://... bun run scripts/backfill-accounting.ts --all --dry     # solo cuenta
//   DATABASE_URL=postgres://... bun run scripts/backfill-accounting.ts --hotel <id>    # un hotel
//   DB_PATH=data/managerhotel.db bun run scripts/backfill-accounting.ts --all          # SQLite local
//
// Rollback: en modo real escribe scripts/backfill-<ISO>.ids.json con los IDs de asiento creados.
// Revertir = borrar esos journal_entries + sus journal_lines (o revertirlos con /journal/:id/reverse).
import { ORM, OrmRepository } from 'arckode-framework'
import { SqliteAdapter } from 'arckode-framework/adapters/sqlite'
import { PostgresAdapter } from 'arckode-framework/adapters/postgres'
import { registerSharedModels } from '../src/shared/models'
import { registerHotelesModels } from '../src/modules/hoteles/model'
import { registerAccountingModels } from '../src/modules/accounting/model'
import { registerPaymentsModels } from '../src/modules/payments/model'
import { registerFoliosModels } from '../src/modules/folios/model'
import { registerGastosModels } from '../src/modules/gastos/model'
import {
  recordPaymentCompleted, recordRefund, recordFolioCharge, recordExpense, type AccountingPort,
} from '../src/modules/accounting/usecases/auto-from-events'
import { recordAutoEntry, type RecordAutoInput } from '../src/modules/accounting/usecases/record-auto'
import type { JournalDeps } from '../src/modules/accounting/usecases/journal-entry'

// ─── Args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const DRY = argv.includes('--dry')
const ALL = argv.includes('--all')
const hi = argv.indexOf('--hotel')
const HOTEL = hi >= 0 ? argv[hi + 1] : undefined
if (!ALL && !HOTEL) {
  console.error('Uso: backfill-accounting.ts (--all | --hotel <id>) [--dry]')
  process.exit(1)
}

// ─── Bootstrap ORM (mismo criterio que composition-root: DATABASE_URL→PG, sino SQLite) ──────────
const DATABASE_URL = process.env.DATABASE_URL
const db = DATABASE_URL
  ? new PostgresAdapter({ connectionString: DATABASE_URL })
  : new SqliteAdapter({ path: process.env.DB_PATH || './data/managerhotel.db', wal: true, foreignKeys: true })
await db.connect()
const orm = new ORM(db)
registerSharedModels(orm)
registerHotelesModels(orm)
registerAccountingModels(orm)
registerPaymentsModels(orm)
registerFoliosModels(orm)
registerGastosModels(orm)

const accounts = new OrmRepository<any>(orm, 'Accounts')
const entries = new OrmRepository<any>(orm, 'JournalEntries')
const lines = new OrmRepository<any>(orm, 'JournalLines')
const periods = new OrmRepository<any>(orm, 'AccountingPeriods')
const deps: JournalDeps = { orm, accounts, entries, lines, periods }

const hotels = new OrmRepository<any>(orm, 'Hotels')
const payments = new OrmRepository<any>(orm, 'Payment')
const folioCharges = new OrmRepository<any>(orm, 'FolioCharges')
const expenses = new OrmRepository<any>(orm, 'Expenses')

// Guard: las tablas de contabilidad tienen que existir. Si no (DB sin migrar), avisar y salir limpio
// en vez de reventar con un stacktrace de "no such table: accounts".
try {
  await accounts.findMany({})
} catch {
  console.error('❌ No existen las tablas de contabilidad en esta DB. Correr primero:')
  console.error('   RUN_MIGRATE=1 bun run src/composition-root.ts   (crea accounts, journal_entries, ...)')
  process.exit(1)
}

// ─── Stats + port ─────────────────────────────────────────────────────────────
interface Stats { created: number; deduped: number; skipped: number; errors: number }
const newStats = (): Stats => ({ created: 0, deduped: 0, skipped: 0, errors: 0 })
const createdIds: string[] = []

/** Chequeo read-only que espeja recordAutoEntry, para el dry-run (no escribe nada). */
async function wouldCreate(hotelId: string, input: RecordAutoInput): Promise<'create' | 'deduped' | 'skipped'> {
  if (!hotelId || !Array.isArray(input.lines) || input.lines.length < 2) return 'skipped'
  for (const l of input.lines) {
    const acc = (await accounts.findMany({ hotelId, code: l.code }))[0]
    if (!acc) return 'skipped'   // hotel sin plan de cuentas → self-gating
  }
  if (input.reference && input.referenceType) {
    const dup = await entries.findMany({ hotelId, reference: input.reference, referenceType: input.referenceType })
    if ((dup as any[]).some((e) => e.status !== 'reversed')) return 'deduped'
  }
  return 'create'
}

/** Port que cuenta resultados. Nunca lanza (best-effort): un asiento que falla no aborta el resto. */
function makePort(stats: Stats): AccountingPort {
  return {
    recordAuto: async (hotelId, input) => {
      try {
        if (DRY) {
          const r = await wouldCreate(hotelId, input)
          if (r === 'create') stats.created++
          else if (r === 'deduped') stats.deduped++
          else stats.skipped++
          return { skipped: r !== 'create' }
        }
        const res = await recordAutoEntry(deps, hotelId, input)
        if (res.deduped) stats.deduped++
        else if (res.skipped) stats.skipped++
        else { stats.created++; if (res.id) createdIds.push(res.id) }
        return res
      } catch {
        stats.errors++
        return { skipped: true }
      }
    },
  }
}

// ─── Backfill por hotel ─────────────────────────────────────────────────────────
async function backfillHotel(hotelId: string, name: string): Promise<Stats | null> {
  const chart = await accounts.findMany({ hotelId })
  if (!chart.length) {
    console.log(`  ⊘ ${name} — sin plan de cuentas, saltado (correr el seed primero)`)
    return null
  }
  const stats = newStats()
  const port = makePort(stats)

  // 1) Pagos completados: type 'charge' → cobro; 'refund' → reembolso. Depósitos/withdrawals se
  //    excluyen a propósito (igual que el wiring en vivo: payments-accounting no asienta depósitos).
  const pays = (await payments.findMany({ hotelId, status: 'completed' })) as any[]
  for (const p of pays) {
    if (p.type === 'refund') await recordRefund(port, p)
    else await recordPaymentCompleted(port, p)
  }
  // 2) Cargos de folio (devengado): DR Clientes / CR Ingresos [+ ITBIS]. Las líneas de pago se ignoran.
  const charges = (await folioCharges.findMany({ hotelId })) as any[]
  for (const c of charges) await recordFolioCharge(port, null, c)
  // 3) Gastos: DR Gasto / CR Caja|Bancos (pagado) o Cuentas por Pagar (a crédito).
  const exps = (await expenses.findMany({ hotelId })) as any[]
  for (const e of exps) await recordExpense(port, e)

  console.log(
    `  ✓ ${name}: creados ${stats.created} · dedup ${stats.deduped} · saltados ${stats.skipped} · ` +
    `errores ${stats.errors}  (fuentes: ${pays.length} pagos, ${charges.length} cargos, ${exps.length} gastos)`,
  )
  return stats
}

// ─── Main ────────────────────────────────────────────────────────────────────
const targets: any[] = ALL
  ? ((await hotels.findMany({})) as any[])
  : (await hotels.findOne({ id: HOTEL }) ? [await hotels.findOne({ id: HOTEL })] : [])

if (!targets.length) {
  console.error(HOTEL ? `Hotel ${HOTEL} no encontrado` : 'No hay hoteles')
  process.exit(1)
}

console.log(`\n${DRY ? '🔍 DRY-RUN (no escribe)' : '✍️  BACKFILL'} — ${targets.length} hotel(es)\n`)
const totals = newStats()
for (const h of targets) {
  const s = await backfillHotel(h.id, h.name || h.id)
  if (s) { totals.created += s.created; totals.deduped += s.deduped; totals.skipped += s.skipped; totals.errors += s.errors }
}

console.log(
  `\n${DRY ? 'Se crearían' : 'Creados'}: ${totals.created} · dedup ${totals.deduped} · ` +
  `saltados ${totals.skipped} · errores ${totals.errors}`,
)

if (!DRY && createdIds.length) {
  const path = `scripts/backfill-${new Date().toISOString().replace(/[:.]/g, '-')}.ids.json`
  await Bun.write(path, JSON.stringify({ createdAt: new Date().toISOString(), count: createdIds.length, entryIds: createdIds }, null, 2))
  console.log(`📄 IDs de asiento creados guardados en ${path} (para rollback)`)
}
if (DRY) console.log('(dry-run: no se escribió nada)')
process.exit(0)
