// bookingengine/tests/migrate-public-bookings.test.ts — F0 0.17
// spec: openspec/changes/solmi-direct-booking/specs/booking-unification/spec.md
//
// Cubre el job idempotente `migratePublicBookings` con SQLite in-memory (no toca la DB dev):
//   1. 1ª corrida migra N bookings → N filas en `reservations` con source='direct' y accessToken.
//   2. 2ª corrida → 0 nuevas (todos los IDs ya están en configuration/migrated_public_booking_ids).
//   3. paymentStatus='paid' → equivalencia operacional (depositStatus='paid', paymentMethod='card',
//      pendingAmount=0, status='confirmed' si era 'pending').
//   4. public_booking sin roomId → skip sin crear Reservation (Reservations.roomId es required).
//
// El test crea las 4 tablas (public_bookings, reservations, guests, configuration) manualmente en
// el adapter in-memory: no invoca al ORM (el script usa DbAdapter crudo, patrón seed-hotel-slugs.ts).
import { describe, it, expect, beforeEach } from 'bun:test'
import { SqliteAdapter } from 'arckode-framework/adapters/sqlite'
import type { DbAdapter } from 'arckode-framework'
import { migratePublicBookings } from '../../../../scripts/migrate-public-bookings'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface TestDb extends DbAdapter { connect(): Promise<void> }

async function makeInMemoryDb(): Promise<TestDb> {
  const db = new SqliteAdapter({ path: ':memory:', wal: false, foreignKeys: false }) as TestDb
  await db.connect()
  // DDL mínima — solo las columnas que usa el script. Sin FKs (es test de migración, no de schema).
  await db.run(`CREATE TABLE public_bookings (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, roomType TEXT, roomId TEXT,
    guestName TEXT, guestEmail TEXT, guestPhone TEXT,
    checkIn TEXT, checkOut TEXT, adults INTEGER DEFAULT 1, children INTEGER DEFAULT 0,
    totalAmount REAL DEFAULT 0, currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending', paymentStatus TEXT DEFAULT 'unpaid',
    paymentRef TEXT DEFAULT '', promoCode TEXT DEFAULT '',
    createdAt TEXT)`)
  await db.run(`CREATE TABLE guests (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, name TEXT, email TEXT, phone TEXT)`)
  await db.run(`CREATE TABLE reservations (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, roomId TEXT NOT NULL, guestId TEXT,
    checkIn TEXT, checkOut TEXT, status TEXT DEFAULT 'pending', channel TEXT, source TEXT,
    totalAmount REAL DEFAULT 0, deposit REAL DEFAULT 0, currency TEXT DEFAULT 'USD',
    adults INTEGER DEFAULT 1, children INTEGER DEFAULT 0, notes TEXT,
    depositStatus TEXT DEFAULT 'unpaid', paymentMethod TEXT, pendingAmount REAL DEFAULT 0,
    promoCode TEXT, accessToken TEXT)`)
  await db.run(`CREATE TABLE configuration (
    id TEXT PRIMARY KEY, hotelId TEXT NOT NULL, key TEXT NOT NULL, value TEXT,
    UNIQUE(hotelId, key))`)
  return db
}

async function insertPublicBooking(db: TestDb, b: Partial<{
  id: string; hotelId: string; roomId: string | null; roomType: string | null
  guestName: string | null; guestEmail: string | null; guestPhone: string | null
  checkIn: string; checkOut: string; adults: number; children: number
  totalAmount: number; currency: string; status: string; paymentStatus: string
  paymentRef: string | null; promoCode: string | null; createdAt: string
}>) {
  await db.run(
    `INSERT INTO public_bookings
       (id, hotelId, roomId, roomType, guestName, guestEmail, guestPhone,
        checkIn, checkOut, adults, children, totalAmount, currency,
        status, paymentStatus, paymentRef, promoCode, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      b.id ?? crypto.randomUUID(),
      b.hotelId ?? 'h1',
      b.roomId === undefined ? 'r1' : b.roomId,
      b.roomType ?? null,
      b.guestName ?? 'Ana Pérez',
      b.guestEmail ?? 'ana@example.com',
      b.guestPhone ?? '+18095550000',
      b.checkIn ?? '2026-08-10',
      b.checkOut ?? '2026-08-12',
      b.adults ?? 2,
      b.children ?? 0,
      b.totalAmount ?? 200,
      b.currency ?? 'USD',
      b.status ?? 'pending',
      b.paymentStatus ?? 'unpaid',
      b.paymentRef ?? null,
      b.promoCode ?? null,
      b.createdAt ?? '2026-07-01T00:00:00Z',
    ],
  )
}

async function countReservations(db: TestDb): Promise<number> {
  const rows = (await db.query(`SELECT COUNT(*) as c FROM reservations`)) as { c: number }[]
  return rows[0]?.c ?? 0
}

async function getReservationByPublicBookingId(
  db: TestDb,
  publicBookingId: string,
): Promise<any | null> {
  // La reservation migrada tiene `Migrado desde public_bookings` en notes pero NO guarda el
  // id original como campo físico (idem `createPublicBookingDirect`). Para el test, buscamos
  // por los campos estables: guestEmail + checkIn + checkOut + hotelId del booking fuente.
  const bookingRows = (await db.query(`SELECT guestEmail, checkIn, checkOut, hotelId FROM public_bookings WHERE id = ?`, [publicBookingId])) as any[]
  const b = bookingRows[0]
  if (!b) return null
  // Buscar la reservation por huésped (match email único en este test).
  const resRows = (await db.query(
    `SELECT r.* FROM reservations r
     JOIN guests g ON r.guestId = g.id
     WHERE g.email = ? AND r.checkIn = ? AND r.checkOut = ? AND r.hotelId = ?`,
    [b.guestEmail, b.checkIn, b.checkOut, b.hotelId],
  )) as any[]
  return resRows[0] ?? null
}

describe('migratePublicBookings — F0 0.17 (idempotente, multi-motor vía DbAdapter)', () => {
  let db: TestDb

  beforeEach(async () => {
    db = await makeInMemoryDb()
  })

  it('1ª corrida migra N bookings → N reservations con source=direct y accessToken (UUID)', async () => {
    await insertPublicBooking(db, { id: 'pb-1', guestEmail: 'a@x.com', paymentStatus: 'paid' })
    await insertPublicBooking(db, { id: 'pb-2', guestEmail: 'b@x.com', paymentStatus: 'unpaid' })
    await insertPublicBooking(db, { id: 'pb-3', guestEmail: 'c@x.com', paymentStatus: 'paid' })

    const result = await migratePublicBookings(db)
    expect(result.scanned).toBe(3)
    expect(result.migrated).toBe(3)
    expect(result.alreadyMigrated).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.newReservationIds).toHaveLength(3)

    expect(await countReservations(db)).toBe(3)

    for (const pbId of ['pb-1', 'pb-2', 'pb-3']) {
      const r = await getReservationByPublicBookingId(db, pbId)
      expect(r).not.toBeNull()
      expect(r.source).toBe('direct')
      expect(r.channel).toBe('direct')
      expect(r.accessToken).toBeTruthy()
      expect(UUID_RE.test(r.accessToken)).toBe(true)
    }
  })

  it('2ª corrida → 0 nuevas (idempotente por configuration.migrated_public_booking_ids)', async () => {
    await insertPublicBooking(db, { id: 'pb-1', guestEmail: 'a@x.com' })
    await insertPublicBooking(db, { id: 'pb-2', guestEmail: 'b@x.com' })

    const first = await migratePublicBookings(db)
    expect(first.migrated).toBe(2)

    const second = await migratePublicBookings(db)
    expect(second.migrated).toBe(0)
    expect(second.alreadyMigrated).toBe(2)
    expect(second.newReservationIds).toHaveLength(0)

    // No se crearon duplicados.
    expect(await countReservations(db)).toBe(2)

    // La clave configuration trackea los IDs.
    const cfgRows = (await db.query(
      `SELECT value FROM configuration WHERE hotelId = ? AND key = ?`,
      ['platform', 'migrated_public_booking_ids'],
    )) as { value: string | null }[]
    expect(cfgRows[0]?.value).toBeTruthy()
    const tracked = JSON.parse(cfgRows[0]!.value!)
    expect(Array.isArray(tracked)).toBe(true)
    expect(tracked.sort()).toEqual(['pb-1', 'pb-2'])
  })

  it('paymentStatus=paid → equivalencia operacional (depositStatus=paid, paymentMethod=card, pendingAmount=0, status=confirmed)', async () => {
    await insertPublicBooking(db, {
      id: 'pb-paid', guestEmail: 'paid@x.com',
      status: 'pending', paymentStatus: 'paid', totalAmount: 250,
    })

    await migratePublicBookings(db)
    const r = await getReservationByPublicBookingId(db, 'pb-paid')
    expect(r.depositStatus).toBe('paid')
    expect(r.paymentMethod).toBe('card')
    expect(r.pendingAmount).toBe(0)
    expect(r.status).toBe('confirmed')
    expect(r.totalAmount).toBe(250)
  })

  it('paymentStatus=unpaid → defaults (depositStatus=unpaid, pendingAmount=totalAmount, status=pending se respeta)', async () => {
    await insertPublicBooking(db, {
      id: 'pb-unpaid', guestEmail: 'unpaid@x.com',
      status: 'pending', paymentStatus: 'unpaid', totalAmount: 180,
    })

    await migratePublicBookings(db)
    const r = await getReservationByPublicBookingId(db, 'pb-unpaid')
    expect(r.depositStatus).toBe('unpaid')
    expect(r.paymentMethod).toBeNull()
    expect(r.pendingAmount).toBe(180)
    expect(r.status).toBe('pending')
  })

  it('status=cancelled se preserva incluso si paymentStatus=paid', async () => {
    await insertPublicBooking(db, {
      id: 'pb-cancelled', guestEmail: 'canc@x.com',
      status: 'cancelled', paymentStatus: 'paid',
    })

    await migratePublicBookings(db)
    const r = await getReservationByPublicBookingId(db, 'pb-cancelled')
    expect(r.status).toBe('cancelled')
    // La equivalencia paid aplica igual (deposit pagado).
    expect(r.depositStatus).toBe('paid')
    expect(r.paymentMethod).toBe('card')
  })

  it('public_booking sin roomId → skip (Reservations.roomId required) + marca como migrado', async () => {
    await insertPublicBooking(db, { id: 'pb-no-room', roomId: null, guestEmail: 'nr@x.com' })
    await insertPublicBooking(db, { id: 'pb-ok', roomId: 'r1', guestEmail: 'ok@x.com' })

    const result = await migratePublicBookings(db)
    expect(result.migrated).toBe(1)
    expect(result.skippedNoRoom).toBe(1)

    // Segunda corrida: el sin-room ya está marcado → no se reintenta.
    const second = await migratePublicBookings(db)
    expect(second.migrated).toBe(0)
    expect(second.alreadyMigrated).toBe(2)
    expect(second.skippedNoRoom).toBe(0)
  })

  it('promocode + roomType + paymentRef preservados (promoCode en campo, otros en notes)', async () => {
    await insertPublicBooking(db, {
      id: 'pb-extras', guestEmail: 'ex@x.com',
      roomType: 'suite', paymentRef: 'pi_abc123', promoCode: 'VERANO10',
    })

    await migratePublicBookings(db)
    const r = await getReservationByPublicBookingId(db, 'pb-extras')
    expect(r.promoCode).toBe('VERANO10')
    expect(r.notes).toContain('roomType: suite')
    expect(r.notes).toContain('paymentRef: pi_abc123')
    expect(r.notes).toContain('Migrado desde public_bookings')
  })

  it('tabla public_bookings vacía → result.scanned=0, sin side effects', async () => {
    const result = await migratePublicBookings(db)
    expect(result.scanned).toBe(0)
    expect(result.migrated).toBe(0)
    expect(result.newReservationIds).toHaveLength(0)
    expect(await countReservations(db)).toBe(0)
    // Aún así escribe la clave (vacía) — idempotente para próxima corrida.
    const cfgRows = (await db.query(
      `SELECT value FROM configuration WHERE hotelId = ? AND key = ?`,
      ['platform', 'migrated_public_booking_ids'],
    )) as { value: string | null }[]
    expect(cfgRows[0]?.value).toBe('[]')
  })
})
