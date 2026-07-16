// scripts/migrate-payments-out-of-invoices.ts
//
// Migra los `invoices` con `type='payment'` (rastro histórico de cobros, creados por
// el viejo `payment-record.ts` ya eliminado) a la tabla `payments`, que es la ÚNICA
// fuente de verdad del dinero (ver CLAUDE.md sección billing).
//
// - Idempotente: dedup por (invoiceId, reference, amount); reejecutar no duplica.
// - `metadata.migratedFrom = 'invoices'` en cada fila insertada → permite rollback.
// - Guard de conservación: aborta si el delta de SUM(payments) != suma de lo migrado.
// - NO borra los invoices origen (la limpieza de `type='payment'` es un paso posterior
//   y verificado por separado — BM-4).
// - Multi-motor: SqliteAdapter (DB_PATH) / PostgresAdapter (DATABASE_URL), igual criterio
//   que migrate-db.ts y composition-root.ts.
//
// Uso:
//   DB_PATH=data/managerhotel.db bun run scripts/migrate-payments-out-of-invoices.ts --dry-run
//   DB_PATH=data/managerhotel.db bun run scripts/migrate-payments-out-of-invoices.ts
//   DATABASE_URL=postgres://... bun run scripts/migrate-payments-out-of-invoices.ts --dry-run   # dry-run prod (BM-3.6)

import { SqliteAdapter } from 'arckode-framework/adapters/sqlite'
import { PostgresAdapter } from 'arckode-framework/adapters/postgres'
import type { DbAdapter } from 'arckode-framework'

const DRY_RUN = process.argv.includes('--dry-run')
const DATABASE_URL = process.env.DATABASE_URL

const db: DbAdapter & { connect(): Promise<void> } = DATABASE_URL
  ? new PostgresAdapter({ connectionString: DATABASE_URL })
  : new SqliteAdapter({
      path: process.env.DB_PATH || './data/managerhotel.db',
      wal: true,
      foreignKeys: true,
    })

const uuid = () => crypto.randomUUID()
const now = () => new Date().toISOString()
const EPS = 0.001

// invoices.paymentMethod (libre) → payments.method (card|cash|transfer|link|deposit|other)
function mapMethod(pm: string | null | undefined): string {
  const v = (pm || '').toLowerCase().trim()
  if (['card', 'cash', 'transfer', 'link', 'deposit'].includes(v)) return v
  if (v === 'credit' || v === 'debit' || v === 'tarjeta') return 'card'
  if (v === 'efectivo') return 'cash'
  if (v === 'transferencia') return 'transfer'
  return 'other'
}

interface PaymentInvoiceRow {
  id: string
  hotelId: string
  invoiceNumber: string
  amount: number
  currency: string | null
  paymentMethod: string | null
  guestId: string | null
  notes: string | null
  issueDate: string | null
}
interface RefRow { invoiceId: string | null; reference: string | null; amount: number }
interface NumRow { id: string; invoiceNumber: string }
interface SumRow { s: number }

const num = (v: unknown) => Number(v ?? 0)

async function main(): Promise<void> {
  await db.connect()

  // 1. Fuentes: invoices type='payment'
  const src = (await db.query(
    "SELECT id, hotelId, invoiceNumber, amount, currency, paymentMethod, guestId, notes, issueDate FROM invoices WHERE type = ?",
    ['payment'],
  )) as PaymentInvoiceRow[]

  const sumSrc = src.reduce((s, r) => s + num(r.amount), 0)

  // 2. Mapa invoiceNumber → id (solo facturas reales) para resolver el link desde notes.
  const realInvoices = (await db.query(
    "SELECT id, invoiceNumber FROM invoices WHERE type = ?",
    ['invoice'],
  )) as NumRow[]
  const numToId = new Map(realInvoices.map((i) => [i.invoiceNumber, i.id]))

  // 3. Payments existentes → claves de dedup (invoiceId|reference|amount).
  const existing = (await db.query('SELECT invoiceId, reference, amount FROM payments')) as RefRow[]
  const existingKeys = new Set(existing.map((p) => `${p.invoiceId || ''}|${p.reference || ''}|${num(p.amount)}`))

  const plan: Array<{ r: PaymentInvoiceRow; invoiceId: string; reference: string }> = []
  let skipped = 0
  for (const r of src) {
    const m = (r.notes || '').match(/\b(INV-[0-9A-Za-z-]+)\b/)
    const invoiceId = m ? numToId.get(m[1]) || '' : ''
    const reference = r.invoiceNumber // "PAY-...", único por cobro histórico
    const key = `${invoiceId}|${reference}|${num(r.amount)}`
    if (existingKeys.has(key)) {
      skipped++
      continue
    }
    plan.push({ r, invoiceId, reference })
  }

  const sumToMigrate = plan.reduce((s, x) => s + num(x.r.amount), 0)

  console.log(`\n💸 migrate-payments-out-of-invoices ${DRY_RUN ? '(DRY-RUN)' : ''}`)
  console.log(`   motor: ${DATABASE_URL ? 'PostgreSQL' : 'SQLite'}`)
  console.log(`   invoices type='payment': ${src.length}  (suma ${sumSrc})`)
  console.log(`   ya migrados (dedup):     ${skipped}`)
  console.log(`   a migrar ahora:          ${plan.length}  (suma ${sumToMigrate})`)

  if (plan.length === 0) {
    console.log('\n✅ Nada por migrar. Idempotente: la tabla payments ya está al día.\n')
    await db.close?.()
    return
  }

  if (DRY_RUN) {
    console.log('\n   Plan (sin escribir):')
    for (const x of plan) {
      console.log(`     • ${x.reference} → payment ${x.r.amount} ${x.r.currency || 'USD'} [${mapMethod(x.r.paymentMethod)}] invoiceId=${x.invoiceId || '(sin match)'}`)
    }
    console.log('\n   (dry-run) No se insertó nada.\n')
    await db.close?.()
    return
  }

  // 4. Inserción + guard de conservación de dinero.
  const before = num(((await db.query('SELECT COALESCE(SUM(amount),0) AS s FROM payments')) as SumRow[])[0]?.s)

  let migrated = 0
  for (const x of plan) {
    const metadata = JSON.stringify({
      migratedFrom: 'invoices',
      sourceInvoiceId: x.r.id,
      sourceInvoiceNumber: x.reference,
    })
    await db.run(
      `INSERT INTO payments
        (id, hotelId, folioId, invoiceId, guestId, type, method, status, amount, currency,
         description, reference, stripePaymentId, stripeSessionId, metadata, processedAt, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuid(), x.r.hotelId, '', x.invoiceId, x.r.guestId || '', 'charge', mapMethod(x.r.paymentMethod),
        'completed', x.r.amount, x.r.currency || 'USD', x.r.notes || '', x.reference, '', '',
        metadata, x.r.issueDate || now(), now(), now(),
      ],
    )
    migrated++
  }

  const after = num(((await db.query('SELECT COALESCE(SUM(amount),0) AS s FROM payments')) as SumRow[])[0]?.s)
  const delta = after - before

  // Guard BM-3.3: el dinero no se crea ni se destruye — el delta de payments DEBE igualar
  // exactamente lo migrado. Si no, algo se duplicó o se perdió → error (revisar antes de commitear en prod).
  if (Math.abs(delta - sumToMigrate) > EPS) {
    throw new Error(
      `❌ GUARD DE SUMAS: delta payments=${delta} != suma migrada=${sumToMigrate} (before=${before}, after=${after}). ` +
        'La migración NO conservó el dinero — revisar manualmente.',
    )
  }

  console.log(`\n✅ Migrados ${migrated} cobros. payments: ${before} → ${after} (delta ${delta} == ${sumToMigrate}). Guard OK.`)
  console.log(`   Rollback: DELETE FROM payments WHERE metadata LIKE '%"migratedFrom":"invoices"%'\n`)
  await db.close?.()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
