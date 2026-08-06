// landing/tests/fix-landing-cancellation-badge.test.ts
//
// Cubre el job `fixLandingCancellationBadge` con SQLite in-memory (no toca la DB dev). El sello
// "Cancelación flexible" quedó PERSISTIDO en `landing_blocks.config` de los hoteles ya sembrados
// (producción incluida): arreglar el seeder no los alcanza, por eso existe el script.
//
// Reglas que se fijan acá:
//   1. Hotel con política que penaliza (strict/moderate/non_refundable/custom) → el sello se borra.
//   2. Hotel realmente flexible → el sello se conserva (es cierto; borrarlo sería un daño gratuito).
//   3. Sello editado a mano → NO se toca (es contenido del hotelero), solo se avisa.
//   4. Segunda corrida → 0 cambios (idempotente).
//
// Mismo patrón que `bookingengine/tests/migrate-public-bookings.test.ts`: DDL mínima a mano
// (el script va por `DbAdapter` crudo, no por el ORM).
import { describe, it, expect, beforeEach } from 'bun:test'
import { SqliteAdapter } from 'arckode-framework/adapters/sqlite'
import type { DbAdapter } from 'arckode-framework'
import {
  fixLandingCancellationBadge,
  type FixLogger,
} from '../../../../scripts/fix-landing-cancellation-badge'

interface TestDb extends DbAdapter { connect(): Promise<void> }

const SILENT_LOGGER: FixLogger = { info: () => {}, warn: () => {}, error: () => {} }

const SEEDED_ITEMS = [
  { icon: 'rate', text: 'Mejor tarifa garantizada' },
  { icon: 'refund', text: 'Cancelación flexible' },
  { icon: 'secure', text: 'Pago 100% seguro' },
]

async function makeDb(): Promise<TestDb> {
  const db = new SqliteAdapter({ path: ':memory:', wal: false, foreignKeys: false }) as TestDb
  await db.connect()
  await db.run(`CREATE TABLE landing_blocks (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, type TEXT NOT NULL,
    config TEXT, sortOrder INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
    createdAt TEXT, updatedAt TEXT)`)
  await db.run(`CREATE TABLE hotels (
    id TEXT PRIMARY KEY, name TEXT, cancellationType TEXT)`)
  await db.run(`CREATE TABLE cancellation_policies (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, scope TEXT NOT NULL, scopeId TEXT DEFAULT '',
    name TEXT, tiers TEXT, priority INTEGER DEFAULT 0, active INTEGER DEFAULT 1)`)
  return db
}

async function addHotel(db: TestDb, id: string, cancellationType: string | null) {
  await db.run(`INSERT INTO hotels (id, name, cancellationType) VALUES (?, ?, ?)`,
    [id, `Hotel ${id}`, cancellationType])
}

async function addBadgesBlock(db: TestDb, id: string, hotelId: string, items: unknown[]) {
  await db.run(
    `INSERT INTO landing_blocks (id, hotelId, type, config, sortOrder, active, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, hotelId, 'trust-badges', JSON.stringify({ title: '', items }), 1, 1,
      '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
  )
}

async function itemsOf(db: TestDb, blockId: string): Promise<Array<{ icon: string; text: string }>> {
  const rows = (await db.query(`SELECT config FROM landing_blocks WHERE id = ?`, [blockId])) as Array<{ config: string }>
  return JSON.parse(rows[0].config).items
}

describe('fixLandingCancellationBadge', () => {
  let db: TestDb

  beforeEach(async () => {
    db = await makeDb()
  })

  it('borra el sello sembrado en un hotel con política estricta', async () => {
    await addHotel(db, 'h-strict', 'strict')
    await addBadgesBlock(db, 'b1', 'h-strict', SEEDED_ITEMS)

    const r = await fixLandingCancellationBadge(db, SILENT_LOGGER)

    expect(r.scanned).toBe(1)
    expect(r.withSeededBadge).toBe(1)
    expect(r.fixed).toBe(1)
    expect(r.fixedBlockIds).toEqual(['b1'])

    const items = await itemsOf(db, 'b1')
    // Los OTROS sellos quedan intactos, en su orden original.
    expect(items.map((i) => i.icon)).toEqual(['rate', 'secure'])
    expect(JSON.stringify(items)).not.toContain('Cancelación flexible')
  })

  it('borra también con política non_refundable y con moderate', async () => {
    await addHotel(db, 'h-nr', 'non_refundable')
    await addHotel(db, 'h-mod', 'moderate')
    await addBadgesBlock(db, 'b-nr', 'h-nr', SEEDED_ITEMS)
    await addBadgesBlock(db, 'b-mod', 'h-mod', SEEDED_ITEMS)

    const r = await fixLandingCancellationBadge(db, SILENT_LOGGER)

    expect(r.fixed).toBe(2)
    expect((await itemsOf(db, 'b-nr')).some((i) => i.icon === 'refund')).toBe(false)
    expect((await itemsOf(db, 'b-mod')).some((i) => i.icon === 'refund')).toBe(false)
  })

  it('borra el sello si el hotel no configuró NINGUNA política', async () => {
    // Sin `cancellationType` ni política propia, el backend cae a un flexible defensivo (para no
    // bloquear cancelaciones legítimas). Ese fallback no es una condición que el hotel ofrezca:
    // el sello estaría prometiendo algo que nadie eligió — el bug de origen.
    await addHotel(db, 'h-sin-config', null)
    await addBadgesBlock(db, 'b-sin', 'h-sin-config', SEEDED_ITEMS)

    const r = await fixLandingCancellationBadge(db, SILENT_LOGGER)

    expect(r.fixed).toBe(1)
    expect(r.keptTruthful).toBe(0)
    expect((await itemsOf(db, 'b-sin')).some((i) => i.icon === 'refund')).toBe(false)
  })

  it('conserva el sello si el hotel ELIGIÓ cancelar gratis siempre', async () => {
    await addHotel(db, 'h-flex', 'flexible')
    await addBadgesBlock(db, 'b2', 'h-flex', SEEDED_ITEMS)

    const r = await fixLandingCancellationBadge(db, SILENT_LOGGER)

    expect(r.fixed).toBe(0)
    expect(r.keptTruthful).toBe(1)
    expect((await itemsOf(db, 'b2')).some((i) => i.text === 'Cancelación flexible')).toBe(true)
  })

  it('una política base custom con penalidad gana sobre el cancellationType del hotel', async () => {
    // El hotel dice `flexible`, pero tiene una política base propia que penaliza: manda la política.
    await addHotel(db, 'h-custom', 'flexible')
    await db.run(
      `INSERT INTO cancellation_policies (id, hotelId, scope, scopeId, name, tiers, priority, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['p1', 'h-custom', 'base', '', 'Propia', JSON.stringify([
        { deadlineHours: 48, penaltyPercent: 0, refundable: true },
        { deadlineHours: 0, penaltyPercent: 80, refundable: true },
      ]), 0, 1],
    )
    await addBadgesBlock(db, 'b3', 'h-custom', SEEDED_ITEMS)

    const r = await fixLandingCancellationBadge(db, SILENT_LOGGER)

    expect(r.fixed).toBe(1)
    expect((await itemsOf(db, 'b3')).some((i) => i.icon === 'refund')).toBe(false)
  })

  it('una política base INACTIVA no cuenta: manda el preset del hotel', async () => {
    await addHotel(db, 'h-inactive', 'flexible')
    await db.run(
      `INSERT INTO cancellation_policies (id, hotelId, scope, scopeId, name, tiers, priority, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['p2', 'h-inactive', 'base', '', 'Vieja', JSON.stringify([
        { deadlineHours: 0, penaltyPercent: 100, refundable: false },
      ]), 0, 0],
    )
    await addBadgesBlock(db, 'b4', 'h-inactive', SEEDED_ITEMS)

    const r = await fixLandingCancellationBadge(db, SILENT_LOGGER)

    expect(r.fixed).toBe(0)
    expect(r.keptTruthful).toBe(1)
  })

  it('NO toca un sello editado a mano, aunque hable de cancelación: solo lo señala', async () => {
    await addHotel(db, 'h-strict2', 'strict')
    await addBadgesBlock(db, 'b5', 'h-strict2', [
      { icon: 'rate', text: 'Mejor tarifa garantizada' },
      { icon: 'refund', text: 'Cancelá gratis cuando quieras' },
    ])

    const warns: string[] = []
    const r = await fixLandingCancellationBadge(db, { ...SILENT_LOGGER, warn: (m) => warns.push(m) })

    expect(r.fixed).toBe(0)
    expect(r.withSeededBadge).toBe(0)
    expect(r.flaggedCustom).toBe(1)
    expect(warns.join(' ')).toContain('Cancelá gratis cuando quieras')
    expect((await itemsOf(db, 'b5'))).toHaveLength(2)
  })

  it('es idempotente: la segunda corrida no cambia nada', async () => {
    await addHotel(db, 'h-strict', 'strict')
    await addBadgesBlock(db, 'b6', 'h-strict', SEEDED_ITEMS)

    const first = await fixLandingCancellationBadge(db, SILENT_LOGGER)
    const before = await itemsOf(db, 'b6')
    const second = await fixLandingCancellationBadge(db, SILENT_LOGGER)

    expect(first.fixed).toBe(1)
    expect(second.fixed).toBe(0)
    expect(second.withSeededBadge).toBe(0)
    expect(await itemsOf(db, 'b6')).toEqual(before)
  })

  it('ignora bloques con config ilegible sin abortar el resto', async () => {
    await addHotel(db, 'h-strict', 'strict')
    await db.run(
      `INSERT INTO landing_blocks (id, hotelId, type, config, sortOrder, active) VALUES (?, ?, ?, ?, ?, ?)`,
      ['b-broken', 'h-strict', 'trust-badges', '{no json', 1, 1],
    )
    await addBadgesBlock(db, 'b7', 'h-strict', SEEDED_ITEMS)

    const r = await fixLandingCancellationBadge(db, SILENT_LOGGER)

    expect(r.skippedUnreadable).toBe(1)
    expect(r.fixed).toBe(1)
  })

  it('no toca bloques de otro type', async () => {
    await addHotel(db, 'h-strict', 'strict')
    await db.run(
      `INSERT INTO landing_blocks (id, hotelId, type, config, sortOrder, active) VALUES (?, ?, ?, ?, ?, ?)`,
      ['b-faq', 'h-strict', 'faq', JSON.stringify({ items: [{ question: '¿Cancelación?', answer: 'Flexible' }] }), 8, 1],
    )

    const r = await fixLandingCancellationBadge(db, SILENT_LOGGER)

    expect(r.scanned).toBe(0)
    const rows = (await db.query(`SELECT config FROM landing_blocks WHERE id = ?`, ['b-faq'])) as Array<{ config: string }>
    expect(rows[0].config).toContain('Flexible')
  })
})
