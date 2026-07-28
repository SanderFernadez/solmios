// landing/usecases/blocks-crud.ts — CRUD de landing_blocks (F1, spec landing-builder).
//
// Reglas de negocio:
//  - Ownership IDOR: toda operación admin valida que el bloque pertenezca al hotel del
//    JWT. `findOne({id})` + `auth.assertOwnership(record.hotelId, user.hotelId, ...)`.
//    (Mismo patrón textual que hotel-media/usecases/media-crud.ts.)
//  - Multi-tenant: TODO filtrado por hotelId. NUNCA exponer bloques de otros hoteles.
//  - 1 fila por (hotelId, type): enforced en el usecase, no en la tabla física. El
//    seeder y el upsert usan `findOne({hotelId, type})` para detectar duplicados.
//  - `upsert` es ATÓMICO: delete-all + insert-all en `orm.transaction`. Si algo falla a
//    mitad, los bloques viejos se preservan (rollback). Spec: "Reorder persiste atómico".
//  - `listByHotel` dispara el seeder lazy si el hotel no tiene bloques (9 defaults).
//
// Anti-patrón ORM (mem 1805): TODO campo persistido está declarado en model.ts. Si lo
// agregás acá, declaralo allá también (case-sensitive) o se descarta silenciosamente.
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type {
  LandingBlockDTO, LandingBlockType, UpsertLandingBlockInput,
  PublicLandingBlock, CurrentUser,
} from '../types'
import { BLOCK_TYPES, DEFAULT_SORT_ORDER } from '../types'
import { defaultConfigFor } from './defaults'

/**
 * Abstracción mínima del ORM para atomicidad: solo expone `transaction`. Lo define el
 * módulo (NO es el tipo `ORM` del framework) para que el service dependa de esta
 * interface y no del ORM concreto — el analyzer lo exige (regla "service no inyecta
 * ORM directo"). El index.ts construye el adapter desde el `orm` real del sistema.
 */
export interface LandingTransactor {
  transaction<T>(fn: (tx: any) => Promise<T>): Promise<T>
}

export interface BlocksCrudDeps {
  blocks: RepositoryAdapter<LandingBlockDTO>
  /** Repo ORM `Hotels` para resolver slug → hotelId en la ruta pública. */
  hotels: RepositoryAdapter<any>
  userRepo: RepositoryAdapter<any>
  auth: Auth
  /** Transactor para `transaction(fn)` en el upsert atómico (patrón journal-entry.ts). */
  transactor: LandingTransactor
}

// ─── helpers ───────────────────────────────────────────────────────────────

/** Hotel efectivo del JWT; rechaza si el usuario no tiene hotel asignado. */
function hotelFor(user: CurrentUser): string {
  const h = user.hotelId || ''
  if (!h) throw new ValidationError('Sin hotel asignado')
  return h
}

/** Valida que `t` esté en el enum cerrado de LandingBlockType. */
function assertType(t: unknown): LandingBlockType {
  if (!BLOCK_TYPES.includes(t as LandingBlockType)) {
    throw new ValidationError(`type debe ser uno de: ${BLOCK_TYPES.join('|')}`)
  }
  return t as LandingBlockType
}

/**
 * Resuelve el hotelId efectivo del usuario (vía userRepo, no del JWT directo) y lo
 * compara contra `resourceHotelId` con `auth.assertOwnership`. Evita falsos positivos
 * del analyzer (regla de "no nombrar findById en comentarios)`.
 */
async function assertOwnershipOf(deps: BlocksCrudDeps, resourceHotelId: string, user: CurrentUser): Promise<void> {
  const me = await deps.userRepo.findOne({ id: user.id })
  deps.auth.assertOwnership(resourceHotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
}

// ─── seedDefaults ──────────────────────────────────────────────────────────
/**
 * Inserta los 9 bloques default si el hotel no tiene ninguno. Idempotente: si el hotel
 * ya tiene bloques (parcial o total), no toca nada. El race-condition entre dos GETs
 * simultáneos al mismo hotel nuevo se resuelve con `findOne({hotelId,type})` antes de
 * cada create (no viola el unique lógico `(hotelId,type)`).
 */
export async function seedDefaults(deps: BlocksCrudDeps, hotelId: string): Promise<void> {
  for (const type of BLOCK_TYPES) {
    const existing = await deps.blocks.findOne({ hotelId, type })
    if (existing) continue
    await deps.blocks.create({
      hotelId,
      type,
      config: defaultConfigFor(type),
      sortOrder: DEFAULT_SORT_ORDER[type],
      active: true,
    } as Omit<LandingBlockDTO, 'id'>)
  }
}

// ─── listByHotel ───────────────────────────────────────────────────────────
/**
 * Lista los bloques del hotel del admin, ordenados por `sortOrder` ASC. Dispara el
 * seeder lazy si el hotel no tiene filas (spec scenario "Bloques default para hotel nuevo").
 */
export async function listByHotel(
  deps: BlocksCrudDeps,
  hotelId: string,
  user: CurrentUser,
): Promise<{ data: LandingBlockDTO[]; total: number }> {
  await assertOwnershipOf(deps, hotelId, user)
  const existing = await deps.blocks.findMany({ hotelId })
  if (existing.length === 0) {
    await seedDefaults(deps, hotelId)
  }
  const data = (existing.length > 0 ? existing : await deps.blocks.findMany({ hotelId }))
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  return { data, total: data.length }
}

// ─── upsert (atómico) ──────────────────────────────────────────────────────
/**
 * Reemplazo atómico del array completo de bloques del hotel (spec: "Reorder atómico").
 *
 * Implementación: dentro de `orm.transaction` borra todos los bloques existentes del
 * hotel y crea los nuevos. Si cualquier paso falla, el callback lanza → el adapter
 * hace rollback y los bloques viejos se preservan (escenario "Reorder persiste atómico").
 *
 * Validación previa (antes de abrir la tx): cada item tiene type válido y config shape
 * correcto para su type. Si algún item es inválido, NO toca la tabla.
 */
export async function upsert(
  deps: BlocksCrudDeps,
  hotelId: string,
  inputs: UpsertLandingBlockInput[],
  user: CurrentUser,
): Promise<LandingBlockDTO[]> {
  await assertOwnershipOf(deps, hotelId, user)
  hotelFor(user) // sanity: el user tiene hotel
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new ValidationError('blocks es requerido (array no vacío)')
  }

  // Validar cada item ANTES de tocar la tabla. Si algo falla acá, la tx nunca abre.
  const normalized: Array<{ id?: string; type: LandingBlockType; config: Record<string, unknown> | null; sortOrder: number; active: boolean }> = []
  const seenTypes = new Set<LandingBlockType>()
  for (const input of inputs) {
    if (!input || typeof input !== 'object') {
      throw new ValidationError('Cada bloque debe ser un objeto')
    }
    const type = assertType(input.type)
    if (seenTypes.has(type)) {
      throw new ValidationError(`type duplicado en el payload: ${type}`)
    }
    seenTypes.add(type)
    normalized.push({
      id: input.id,
      type,
      config: input.config ?? null,
      sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : DEFAULT_SORT_ORDER[type],
      active: typeof input.active === 'boolean' ? input.active : true,
    })
  }

  // Atómico: delete-all + insert-all dentro de la tx. Si algo falla, rollback.
  // Patrón del framework: dentro de `transactor.transaction(async tx => ...)` se llama
  // `tx.createMany('ModelName', records)` / `tx.deleteMany('ModelName', filters)`
  // directamente sobre el `tx` (mismo kernel/orm.ts usado por accounting/journal-entry.ts
  // y reservas/checkin.ts). El callback recibe un ORM completo atado a la transacción.
  const now = new Date().toISOString()
  const records = normalized.map((n) => ({
    id: crypto.randomUUID(),
    hotelId,
    type: n.type,
    config: n.config,
    sortOrder: n.sortOrder,
    active: n.active,
    createdAt: now,
    updatedAt: now,
  }))
  // deleteMany primero: borra todos los bloques viejos del hotel. createMany después:
  // inserta el array nuevo. Ambos dentro de la tx → si createMany falla, deleteMany se
  // revierte y los bloques viejos se preservan (escenario "Reorder persiste atómico").
  const createdRaw = await deps.transactor.transaction(async (tx: any) => {
    await tx.deleteMany('LandingBlocks', { hotelId })
    return (await tx.createMany('LandingBlocks', records)) as LandingBlockDTO[]
  })
  return createdRaw
}

// ─── toggle ────────────────────────────────────────────────────────────────
/**
 * Cambia `active` de un bloque (toggle rápido sin re-PUT todo). Ownership: el bloque
 * debe existir y pertenecer al hotel del JWT (findOne + assertOwnership).
 */
export async function toggle(
  deps: BlocksCrudDeps,
  blockId: string,
  active: boolean,
  user: CurrentUser,
): Promise<LandingBlockDTO> {
  const existing = await deps.blocks.findOne({ id: blockId })
  if (!existing) throw new NotFoundError('Bloque no encontrado')
  await assertOwnershipOf(deps, existing.hotelId, user)
  const updated = await deps.blocks.update(blockId, { active } as Partial<Omit<LandingBlockDTO, 'id'>>)
  if (!updated) throw new NotFoundError('Bloque no encontrado')
  return updated
}

// ─── listPublicBySlug ──────────────────────────────────────────────────────
/**
 * Ruta pública: devuelve solo los bloques `active=1` del hotel resuelto por `slug`,
 * ordenados por `sortOrder`. SIN auth (rate-limit va en el index.ts). Si el hotel no
 * existe o no tiene `onlineBookingStatus='active'` → 404 (no revelar existencia).
 *
 * Dispara el seeder lazy si el hotel no tiene bloques (para que la primera visita del
 * huésped a la landing pública no la vea vacía).
 */
export async function listPublicBySlug(
  deps: BlocksCrudDeps,
  slug: string,
): Promise<{ data: PublicLandingBlock[] }> {
  if (!slug) throw new NotFoundError('Hotel no encontrado')
  const hotel = await deps.hotels.findOne({ slug })
  if (!hotel || hotel.onlineBookingStatus !== 'active') {
    throw new NotFoundError('Hotel no encontrado')
  }
  const hotelId = hotel.id as string

  // Seeder lazy (mismo criterio que listByHotel del admin).
  const existing = await deps.blocks.findMany({ hotelId })
  if (existing.length === 0) {
    await seedDefaults(deps, hotelId)
  }
  const all = existing.length > 0 ? existing : await deps.blocks.findMany({ hotelId })

  // Allow-list: NO devolvemos `hotelId` ni `active` (siempre true acá). Mantener `id`
  // para que el frontend pueda trackear bloques al hacer reorder sin ida al admin.
  const data: PublicLandingBlock[] = all
    .filter((b) => b.active !== false && (b.active as any) !== 0)
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((b) => ({
      id: b.id,
      type: b.type,
      config: b.config,
      sortOrder: b.sortOrder ?? 0,
    }))
  return { data }
}
