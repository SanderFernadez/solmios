// scripts/migrate-public-bookings.ts — F0 0.17
// spec: openspec/changes/solmi-direct-booking/specs/booking-unification/spec.md
//
// Job idempotente que migra bookings del flujo plural viejo (tabla huérfana `public_bookings`)
// a la tabla operacional `Reservations` (única fuente de verdad — spec booking-unification).
//
// Por qué existe (spec "Job de migración copia public_bookings huérfanas"):
//   El flujo plural `/api/public/bookings` (deprecated en F0 0.12/0.18) escribe a `public_bookings`,
//   tabla que NINGÚN query operacional del dashboard lee. Sus filas son huérfanas: el hotel las ve
//   como "reservas que no existen" en el panel. F0 0.17 las migra a `Reservations` para que
//   aparezcan en `/api/panel/reservas` (listado operacional normal) con `source='direct'`.
//
// Idempotencia:
//   - Trackea los IDs ya migrados en `configuration(hotelId='platform', key='migrated_public_booking_ids')`
//     como array JSON (mismo convenio `hotelId='platform'` que `hoteles/usecases/config-kv.ts:5`).
//   - Antes de migrar un booking, si su ID ya está en ese array → skip.
//   - Tras migrar los nuevos, persiste la clave con el array extendido.
//   - Segunda corrida: todos los IDs ya están → 0 migraciones nuevas.
//
// Mapeo de campos public_bookings → Reservations (spec booking-unification + mem 1805):
//   La tabla `reservations` NO expone `paymentStatus` físicamente (ver `usecases/stripe.ts:21,174`).
//   Los equivalentes operacionales son `depositStatus` + `paymentMethod` + `pendingAmount`. Por eso:
//     · public_bookings.paymentStatus='paid' → Reservations.{depositStatus:'paid', paymentMethod:'card', pendingAmount:0}
//     · public_bookings.paymentStatus!='paid' → defaults del modelo (depositStatus='unpaid').
//   Si el status original era 'pending' y el pago estaba confirmado, se promueve a 'confirmed'
//   (coherente con haber pagado). Status 'cancelled' se respeta sin importar paymentStatus.
//
//   public_bookings.roomType no tiene campo en `reservations` → va a `notes`.
//   public_bookings.paymentRef no tiene campo → va a `notes`.
//   public_bookings.guestName/Email/Phone → se crea un Guest (patrón de `usecases/public-booking.ts:149`)
//     y se asigna su id a `reservations.guestId`.
//
//   Nuevos campos por fila migrada:
//     · id = crypto.randomUUID()
//     · source = 'direct', channel = 'direct'
//     · accessToken = crypto.randomUUID() (accesibles vía `/api/public/reservations/:id?token=`)
//
// Multi-motor (SQLite + Postgres): placeholders `?` (adapter PG convierte a $N). Sin SQL SQLite-only.
// NO destructivo: no dropea `public_bookings` (F4 lo hará cuando telemetría confirme 0 uso del plural).
//
// Uso:
//   bun run scripts/migrate-public-bookings.ts                                  # SQLite dev
//   DATABASE_URL=postgres://... bun run scripts/migrate-public-bookings.ts      # Postgres prod
//   DB_PATH=/tmp/test.db bun run scripts/migrate-public-bookings.ts             # SQLite custom
import { SqliteAdapter } from 'arckode-framework/adapters/sqlite'
import { PostgresAdapter } from 'arckode-framework/adapters/postgres'
import type { DbAdapter } from 'arckode-framework'

const PLATFORM_HOTEL_ID = 'platform'
const MIGRATED_IDS_KEY = 'migrated_public_booking_ids'

export interface MigrationLogger {
  info(msg: string, meta?: any): void
  warn(msg: string, meta?: any): void
  error(msg: string, meta?: any): void
}

export interface MigrationResult {
  scanned: number            // total de filas en public_bookings
  alreadyMigrated: number    // salteadas por idempotencia (ya en configuration)
  migrated: number           // nuevas filas creadas en Reservations
  skippedNoRoom: number      // salteadas por roomId null (Reservations.roomId es required)
  failed: number             // migraciones que fallaron (sin abortar el job entero)
  newReservationIds: string[]
}

// DbAdapter del framework expone query/run/close pero NO connect(). Ambos adapters concretos
// (SqliteAdapter/PostgresAdapter) implementan connect() y requieren conexión antes del primer
// query → tipamos como intersección (mismo patrón que migrate-db.ts y seed-hotel-slugs.ts).
const DATABASE_URL = process.env.DATABASE_URL
const defaultDb: DbAdapter & { connect(): Promise<void> } = DATABASE_URL
  ? new PostgresAdapter({ connectionString: DATABASE_URL })
  : new SqliteAdapter({
      path: process.env.DB_PATH || './data/managerhotel.db',
      wal: true,
      foreignKeys: true,
    })

interface PublicBookingRow {
  id: string
  hotelId: string
  roomType: string | null
  roomId: string | null
  guestName: string | null
  guestEmail: string | null
  guestPhone: string | null
  checkIn: string | null
  checkOut: string | null
  adults: number | null
  children: number | null
  totalAmount: number | null
  currency: string | null
  status: string | null
  paymentStatus: string | null
  paymentRef: string | null
  promoCode: string | null
}

interface ConfigurationRow {
  id: string
  value: string | null
}

const CONSOLE_LOGGER: MigrationLogger = {
  info: (msg, meta) => console.log(meta ? `${msg} ${JSON.stringify(meta)}` : msg),
  warn: (msg, meta) => console.warn(meta ? `${msg} ${JSON.stringify(meta)}` : msg),
  error: (msg, meta) => console.error(meta ? `${msg} ${JSON.stringify(meta)}` : msg),
}

async function readMigratedIds(db: DbAdapter): Promise<Set<string>> {
  const rows = (await db.query(
    `SELECT id, value FROM configuration WHERE hotelId = ? AND key = ?`,
    [PLATFORM_HOTEL_ID, MIGRATED_IDS_KEY],
  )) as ConfigurationRow[]
  const raw = rows[0]?.value
  if (!raw) return new Set()
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

async function writeMigratedIds(db: DbAdapter, ids: string[]): Promise<void> {
  const value = JSON.stringify(ids)
  const existing = (await db.query(
    `SELECT id FROM configuration WHERE hotelId = ? AND key = ?`,
    [PLATFORM_HOTEL_ID, MIGRATED_IDS_KEY],
  )) as ConfigurationRow[]
  if (existing[0]) {
    await db.run(
      `UPDATE configuration SET value = ? WHERE id = ?`,
      [value, existing[0].id],
    )
  } else {
    await db.run(
      `INSERT INTO configuration (id, hotelId, key, value) VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), PLATFORM_HOTEL_ID, MIGRATED_IDS_KEY, value],
    )
  }
}

/**
 * Job idempotente de migración. Lee `public_bookings`, crea filas en `Reservations` (+ `Guests`)
 * por cada booking no migrado, y trackea los IDs procesados en `configuration`.
 *
 * Exportado (no solo side-effect) para que el test in-memory llame esta función con su propio
 * adapter sin tocar el `defaultDb` global (que lee env vars).
 *
 * @param db     Adapter ya conectado (SqliteAdapter o PostgresAdapter).
 * @param logger Logger opcional para seguimiento (default: console).
 * @returns Resumen { scanned, alreadyMigrated, migrated, skippedNoRoom, failed, newReservationIds }.
 */
export async function migratePublicBookings(
  db: DbAdapter,
  logger: MigrationLogger = CONSOLE_LOGGER,
): Promise<MigrationResult> {
  const migratedIds = await readMigratedIds(db)
  const bookings = (await db.query(
    `SELECT id, hotelId, roomType, roomId, guestName, guestEmail, guestPhone,
            checkIn, checkOut, adults, children, totalAmount, currency,
            status, paymentStatus, paymentRef, promoCode
     FROM public_bookings ORDER BY createdAt ASC`,
  )) as PublicBookingRow[]

  const result: MigrationResult = {
    scanned: bookings.length,
    alreadyMigrated: 0,
    migrated: 0,
    skippedNoRoom: 0,
    failed: 0,
    newReservationIds: [],
  }

  for (const b of bookings) {
    if (migratedIds.has(b.id)) {
      result.alreadyMigrated++
      continue
    }

    // Sin roomId no se puede crear una Reservation válida (ReservationsModel.roomId es required).
    // Skip + log, NO aborta el job. Lo marcamos como migrado para no reintentar en cada corrida.
    if (!b.roomId) {
      result.skippedNoRoom++
      logger.warn(`public_booking ${b.id} sin roomId → skip (no se puede crear Reservation válido)`, { id: b.id })
      migratedIds.add(b.id)
      continue
    }

    try {
      // Crear Guest (mismo patrón que usecases/public-booking.ts:149-152). Solo campos seguros
      // del modelo HuespedesModel; el resto queda en defaults.
      const guestId = crypto.randomUUID()
      await db.run(
        `INSERT INTO guests (id, hotelId, name, email, phone)
         VALUES (?, ?, ?, ?, ?)`,
        [guestId, b.hotelId, b.guestName || 'Guest (migrado)', b.guestEmail || '', b.guestPhone || ''],
      )

      // Equivalencia operacional paymentStatus → depositStatus/paymentMethod/pendingAmount.
      const wasPaid = (b.paymentStatus || '').toLowerCase() === 'paid'
      const originalStatus = (b.status || 'pending').toLowerCase()
      const finalStatus = wasPaid && originalStatus === 'pending' ? 'confirmed' : originalStatus
      const depositStatus = wasPaid ? 'paid' : 'unpaid'
      const paymentMethod = wasPaid ? 'card' : null
      const pendingAmount = wasPaid ? 0 : (b.totalAmount || 0)

      // Notes: preservar roomType (sin campo en Reservations) + paymentRef + marca de migración.
      const notesParts: string[] = ['Migrado desde public_bookings']
      if (b.roomType) notesParts.push(`roomType: ${b.roomType}`)
      if (b.paymentRef) notesParts.push(`paymentRef: ${b.paymentRef}`)

      const reservationId = crypto.randomUUID()
      const accessToken = crypto.randomUUID()
      await db.run(
        `INSERT INTO reservations
           (id, hotelId, roomId, guestId, checkIn, checkOut, status, channel, source,
            totalAmount, deposit, currency, adults, children, notes,
            depositStatus, paymentMethod, pendingAmount, promoCode, accessToken)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reservationId, b.hotelId, b.roomId, guestId,
          b.checkIn || '', b.checkOut || '',
          finalStatus, 'direct', 'direct',
          b.totalAmount || 0, 0, b.currency || 'USD',
          b.adults ?? 1, b.children ?? 0,
          notesParts.join(' | '),
          depositStatus, paymentMethod, pendingAmount,
          b.promoCode || null, accessToken,
        ],
      )
      migratedIds.add(b.id)
      result.migrated++
      result.newReservationIds.push(reservationId)
    } catch (e: any) {
      result.failed++
      logger.error(`Falló migrar public_booking ${b.id}: ${e?.message || e}`, { id: b.id })
      // No abortamos el resto; seguimos con el siguiente booking.
    }
  }

  // Persistir el set extendido (átomico a esta operación; el job entero no es transaccional
  // porque cada INSERT es independiente y queremos parcial-progress seguro).
  await writeMigratedIds(db, Array.from(migratedIds))

  return result
}

async function main(): Promise<void> {
  await defaultDb.connect()
  const result = await migratePublicBookings(defaultDb, CONSOLE_LOGGER)
  console.log(
    `\n✅ Migración completada: ${result.migrated} nueva(s), ` +
    `${result.alreadyMigrated} ya migrada(s), ` +
    `${result.skippedNoRoom} skip sin roomId, ` +
    `${result.failed} fallo(s) — total ${result.scanned} escaneada(s).`,
  )
  if (result.newReservationIds.length > 0) {
    console.log(`Nuevas Reservations: ${result.newReservationIds.join(', ')}`)
  }
}

// Entry point: solo corre main() cuando se ejecuta como script (Bun: import.meta.main).
// Cuando el test lo importa, no side-effect.
if (import.meta.main) {
  main()
    .catch((err: unknown) => {
      console.error('❌ Migración falló:', err)
      process.exit(1)
    })
    .finally(async () => {
      await defaultDb.close()
    })
}
