// scripts/fix-landing-cancellation-badge.ts
//
// Saca de las landings YA PUBLICADAS el sello "Cancelación flexible" que el seeder plantaba
// como default fijo, en los hoteles cuya política real NO es flexible.
//
// POR QUÉ EXISTE
//   `landing/usecases/defaults.ts` sembraba `{icon:'refund', text:'Cancelación flexible'}` en el
//   bloque `trust-badges` de TODO hotel nuevo, sin mirar `hotels.cancellationType` ni
//   `cancellation_policies`. El texto queda GUARDADO en `landing_blocks.config`, así que arreglar
//   el seeder (hecho: el sello ya no se siembra) NO arregla a los hoteles que ya lo tienen
//   persistido — entre ellos el de producción `hotel-boutique-palma`, con política `strict`
//   (sin cargo hasta 7 días antes, después hasta 100% de penalización) anunciando "flexible".
//
// QUÉ TOCA — y qué NO
//   Solo borra items que cumplen LAS DOS condiciones:
//     1. Son TEXTUALMENTE el default que sembramos nosotros: icon='refund' y
//        text='Cancelación flexible' (comparación exacta tras trim). Si el hotelero editó el
//        texto, es contenido SUYO: no lo tocamos (se loguea un warning y sigue).
//     2. El hotel NO puede sostener la afirmación: o su política penaliza alguna cancelación
//        (al menos un tier con `penaltyPercent > 0`), o directamente NO configuró ninguna
//        política (`source: 'default'` — el flexible que devuelve el backend ahí es su fallback
//        defensivo para no bloquear cancelaciones legítimas, no una condición que el hotel
//        ofrezca). Si el hotel ELIGIÓ una política que cancela gratis siempre, el sello es
//        cierto y se conserva — este script borra afirmaciones que el hotel no respalda, no
//        sellos útiles.
//
//   Nunca agrega, reordena ni reescribe otros items, ni toca otros types de bloque.
//
// FUENTE DE VERDAD DE LA POLÍTICA
//   La misma precedencia que `shared/usecases/cancellation-math.ts:resolvePolicy` para el canal
//   directo: política base custom (`cancellation_policies.scope='base'` activa, con tiers) →
//   preset de `hotels.cancellationType` (`PRESET_TIERS`, importado de ahí, no re-tipeado acá) →
//   default flexible. Los overrides por canal no aplican: la landing ES el canal directo.
//
// IDEMPOTENTE
//   La segunda corrida no encuentra ningún item que matchee (ya se borró) → 0 cambios. Se puede
//   correr N veces sin efecto acumulado.
//
// MULTI-MOTOR (SQLite + Postgres)
//   Adapter condicional por `DATABASE_URL` (mismo criterio que `migrate-db.ts` y
//   `migrate-public-bookings.ts`). Placeholders `?` (el `PostgresAdapter` los convierte a $N).
//   Los SELECT aliasean las columnas camelCase con comillas dobles (`hotelId AS "hotelId"`)
//   porque PG pliega los identificadores no entrecomillados a minúscula y devolvería `hotelid`:
//   el remap camelCase del framework vive en el ORM, y acá vamos por `DbAdapter` crudo.
//   SQL crudo en `scripts/` está permitido (la regla "NUNCA SQL crudo" aplica a services/usecases).
//
// USO
//   bun run scripts/fix-landing-cancellation-badge.ts                                 # SQLite dev
//   DATABASE_URL=postgres://... bun run scripts/fix-landing-cancellation-badge.ts     # Postgres prod
//   DB_PATH=/tmp/test.db bun run scripts/fix-landing-cancellation-badge.ts            # SQLite custom
import { SqliteAdapter } from 'arckode-framework/adapters/sqlite'
import { PostgresAdapter } from 'arckode-framework/adapters/postgres'
import type { DbAdapter } from 'arckode-framework'
import { presetFromEnum } from '../src/shared/usecases/cancellation-math'
import type { Tier } from '../src/modules/cancellation/types'

/** El item EXACTO que sembraba `defaults.ts` (el único que este script se permite borrar). */
const SEEDED_BADGE = { icon: 'refund', text: 'Cancelación flexible' } as const

/** Palabras que delatan una promesa de cancelación en un sello editado a mano (solo warning). */
const CANCELLATION_HINT = /cancel|reembols|refund/i

export interface FixLogger {
  info(msg: string, meta?: unknown): void
  warn(msg: string, meta?: unknown): void
  error(msg: string, meta?: unknown): void
}

export interface FixResult {
  /** Bloques `trust-badges` leídos. */
  scanned: number
  /** Bloques que traían el sello sembrado. */
  withSeededBadge: number
  /** Bloques efectivamente reescritos (sello borrado). */
  fixed: number
  /** Bloques con el sello sembrado que se conservaron porque el hotel SÍ cancela gratis siempre. */
  keptTruthful: number
  /** Sellos editados a mano que hablan de cancelación en hoteles no-flexibles: se avisan, no se tocan. */
  flaggedCustom: number
  /** Bloques salteados por config ilegible (JSON roto / sin items). */
  skippedUnreadable: number
  /** Ids de los bloques modificados (para verificación posterior). */
  fixedBlockIds: string[]
}

interface BadgeItem { icon?: unknown; text?: unknown }

interface TrustBadgeRow { id: string; hotelId: string; config: unknown }

export const CONSOLE_LOGGER: FixLogger = {
  info: (m) => console.log(m),
  warn: (m) => console.warn(`⚠️  ${m}`),
  error: (m) => console.error(`❌ ${m}`),
}

/** Parsea `landing_blocks.config` (TEXT con JSON en ambos motores). null si no es objeto. */
function parseConfig(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function asText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** ¿Es el item que sembramos nosotros? Comparación exacta (icon + text), tras trim. */
function isSeededBadge(item: BadgeItem): boolean {
  return asText(item?.icon) === SEEDED_BADGE.icon && asText(item?.text) === SEEDED_BADGE.text
}

/** Política resuelta del hotel. `source` distingue "elegida por el hotel" de "fallback del sistema". */
interface ResolvedForHotel {
  tiers: Tier[]
  /** 'custom' = filas propias · 'preset' = `hotels.cancellationType` · 'default' = NADA configurado. */
  source: 'custom' | 'preset' | 'default'
}

/**
 * Política vigente del hotel para el canal directo. Misma precedencia que `resolvePolicy`:
 * base custom activa (con tiers) → preset de `hotels.cancellationType` → default flexible.
 *
 * El `source` importa tanto como los tiers: cuando es `'default'` el hotel no eligió NADA y el
 * flexible es un fallback defensivo del sistema (para no bloquear una cancelación legítima), no
 * una condición que el hotel ofrezca. Un sello no puede afirmar una política que el hotel nunca
 * configuró — que es justamente el bug de origen.
 */
async function resolveTiersFor(db: DbAdapter, hotelId: string): Promise<ResolvedForHotel> {
  const custom = (await db.query(
    `SELECT tiers AS "tiers", active AS "active", scopeId AS "scopeId"
       FROM cancellation_policies
      WHERE hotelId = ? AND scope = ?`,
    [hotelId, 'base'],
  )) as Array<{ tiers: unknown; active: unknown; scopeId: unknown }>
  for (const row of custom) {
    // `active` llega 0/1 (INTEGER) o true/false según motor; sólo excluimos el false explícito
    // (mismo criterio que resolvePolicy: undefined = activa por el default:true del modelo).
    const inactive = row.active === 0 || row.active === false || row.active === '0'
    const scopeId = asText(row.scopeId)
    if (inactive || scopeId !== '') continue
    const tiers = parseTiers(row.tiers)
    if (tiers.length > 0) return { tiers, source: 'custom' }
  }

  const hotels = (await db.query(
    `SELECT cancellationType AS "cancellationType" FROM hotels WHERE id = ?`,
    [hotelId],
  )) as Array<{ cancellationType: unknown }>
  const type = asText(hotels[0]?.cancellationType)
  if (type) return { tiers: presetFromEnum(type), source: 'preset' }
  // Sin fila de hotel o sin tipo declarado: nivel 4 de `resolvePolicy` (flexible defensivo).
  // No inventamos una penalidad — pero tampoco es una promesa que el hotel haya hecho.
  return { tiers: presetFromEnum(null), source: 'default' }
}

function parseTiers(raw: unknown): Tier[] {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? (parsed as Tier[]) : []
  } catch {
    return []
  }
}

/**
 * ¿La política castiga alguna cancelación? Es EXACTAMENTE el criterio que usa
 * `buildCancellationSummary` para decir "Cancelación gratuita en cualquier momento"
 * (`tiers.filter(t => t.penaltyPercent > 0).length === 0`). Si castiga, el sello miente.
 */
function hasPenalty(tiers: Tier[]): boolean {
  return tiers.some((t) => Number(t?.penaltyPercent) > 0)
}

export async function fixLandingCancellationBadge(
  db: DbAdapter,
  logger: FixLogger = CONSOLE_LOGGER,
): Promise<FixResult> {
  const result: FixResult = {
    scanned: 0, withSeededBadge: 0, fixed: 0, keptTruthful: 0,
    flaggedCustom: 0, skippedUnreadable: 0, fixedBlockIds: [],
  }

  const blocks = (await db.query(
    `SELECT id AS "id", hotelId AS "hotelId", config AS "config"
       FROM landing_blocks
      WHERE type = ?`,
    ['trust-badges'],
  )) as TrustBadgeRow[]
  result.scanned = blocks.length

  // Cache por hotel: varios bloques pueden compartir hotelId y la política no cambia en la corrida.
  const policyByHotel = new Map<string, ResolvedForHotel>()
  const policyOf = async (hotelId: string): Promise<ResolvedForHotel> => {
    const cached = policyByHotel.get(hotelId)
    if (cached) return cached
    const resolved = await resolveTiersFor(db, hotelId)
    policyByHotel.set(hotelId, resolved)
    return resolved
  }

  /**
   * ¿El sello "Cancelación flexible" es una afirmación SOSTENIBLE para este hotel?
   * Solo si el hotel eligió una política (source != 'default') Y esa política no penaliza
   * ninguna cancelación. El fallback flexible del sistema no habilita a prometer nada.
   */
  const badgeIsTruthful = (p: ResolvedForHotel): boolean => p.source !== 'default' && !hasPenalty(p.tiers)

  for (const block of blocks) {
    const config = parseConfig(block.config)
    const items = config?.items
    if (!config || !Array.isArray(items)) {
      result.skippedUnreadable++
      continue
    }

    const seeded = (items as BadgeItem[]).filter((it) => it && typeof it === 'object' && isSeededBadge(it))
    const custom = (items as BadgeItem[]).filter(
      (it) => it && typeof it === 'object' && !isSeededBadge(it) && CANCELLATION_HINT.test(asText(it.text)),
    )

    if (seeded.length === 0 && custom.length === 0) continue

    const policy = await policyOf(block.hotelId)
    const truthful = badgeIsTruthful(policy)

    if (custom.length > 0 && !truthful) {
      result.flaggedCustom += custom.length
      logger.warn(
        `Hotel ${block.hotelId}: sello editado a mano que habla de cancelación en un hotel que no la ofrece ` +
        `(política: ${policy.source}${hasPenalty(policy.tiers) ? ', con penalidad' : ', sin configurar'}) ` +
        `(${custom.map((c) => `"${asText(c.text)}"`).join(', ')}). NO se toca — es contenido del hotelero. ` +
        `Revisar en el builder: /panel/pagina-publica/landing`,
      )
    }

    if (seeded.length === 0) continue
    result.withSeededBadge++

    if (truthful) {
      // El hotel ELIGIÓ una política que cancela gratis siempre: el sello es CIERTO. Borrarlo
      // sería sacarle un argumento de venta legítimo sin que nadie lo pidiera.
      result.keptTruthful++
      continue
    }

    const nextItems = (items as BadgeItem[]).filter((it) => !(it && typeof it === 'object' && isSeededBadge(it)))
    const nextConfig = { ...config, items: nextItems }
    try {
      await db.run(
        `UPDATE landing_blocks SET config = ?, updatedAt = ? WHERE id = ?`,
        [JSON.stringify(nextConfig), new Date().toISOString(), block.id],
      )
      result.fixed++
      result.fixedBlockIds.push(block.id)
      logger.info(
        `✅ Hotel ${block.hotelId}: sello "${SEEDED_BADGE.text}" removido ` +
        `(${hasPenalty(policy.tiers) ? 'la política real penaliza cancelaciones' : 'el hotel no configuró ninguna política'}).`,
      )
    } catch (e) {
      logger.error(`No se pudo actualizar el bloque ${block.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return result
}

// ─── Entry point ───────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL
// `DbAdapter` expone query/run/close pero NO connect(); los adapters concretos sí y hay que
// conectar antes del primer query → intersección (mismo patrón que migrate-db.ts).
const defaultDb: DbAdapter & { connect(): Promise<void> } = DATABASE_URL
  ? new PostgresAdapter({ connectionString: DATABASE_URL })
  : new SqliteAdapter({
      path: process.env.DB_PATH || './data/managerhotel.db',
      wal: true,
      foreignKeys: true,
    })

async function main(): Promise<void> {
  await defaultDb.connect()
  const r = await fixLandingCancellationBadge(defaultDb, CONSOLE_LOGGER)
  console.log(
    `\n✅ Listo: ${r.fixed} landing(s) corregida(s) de ${r.scanned} escaneada(s). ` +
    `${r.keptTruthful} sello(s) conservado(s) por ser ciertos, ` +
    `${r.flaggedCustom} sello(s) editado(s) a mano señalado(s), ` +
    `${r.skippedUnreadable} bloque(s) con config ilegible.`,
  )
  if (r.fixedBlockIds.length > 0) {
    console.log(`Bloques modificados: ${r.fixedBlockIds.join(', ')}`)
  }
}

if (import.meta.main) {
  main()
    .catch((err: unknown) => {
      console.error('❌ fix-landing-cancellation-badge falló:', err)
      process.exit(1)
    })
    .finally(async () => {
      await defaultDb.close()
    })
}
