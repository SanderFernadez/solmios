// promo-codes/usecases/promo-crud.ts — Admin CRUD de códigos promocionales (F2 2.2).
//
// Reglas de negocio:
//  - Ownership IDOR: toda operación admin valida que el code pertenezca al hotel del
//    JWT. `findOne({id})` + `auth.assertOwnership(record.hotelId, user.hotelId, ...)`.
//    (Mismo patrón textual que landing/usecases/blocks-crud.ts.)
//  - Multi-tenant: TODO filtrado por hotelId. NUNCA exponer codes de otros hoteles.
//  - Unique (hotelId, code): el service captura la violación del UNIQUE index físico
//    (`promo_codes_hotel_code`, migrate-db.ts) y la traduce a ValidationError en vez
//    de dejar pasar el error crudo del motor (SQLite/PG mensajes distintos).
//  - `code` se normaliza UPPERCASE al crear/editar (case-insensitive desde el lado del
//    huésped: "welcome10" ≡ "WELCOME10"). El UNIQUE index es case-sensitive a nivel
//    físico → la normalización a uppercase acá garantiza que no haya dos codes que
//    colisionen por casing distinto.
//  - Validación de `kind` (enum cerrado) y `value` (0-100 si percent, >=0 si fixed)
//    vive acá: depende del `kind`, el validador no soporta unión discriminada.
//  - NO incrementa `uses` (eso ocurre en task 2.5 al crear la reserva con éxito).
//
// Anti-patrón ORM (mem 1805): TODO campo persistido está declarado en model.ts. Si lo
// agregás acá, declaralo allá también (case-sensitive) o se descarta silenciosamente.
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type {
  PromoCodeDTO, CreatePromoCodeDTO, UpdatePromoCodeDTO, PromoCodeKind, CurrentUser,
} from '../types'

export interface PromoCrudDeps {
  promoCodes: RepositoryAdapter<PromoCodeDTO>
  userRepo: RepositoryAdapter<any>
  auth: Auth
}

// ─── helpers ───────────────────────────────────────────────────────────────

/** Hotel efectivo del JWT; rechaza si el usuario no tiene hotel asignado. */
function hotelFor(user: CurrentUser): string {
  const h = user.hotelId || ''
  if (!h) throw new ValidationError('Sin hotel asignado')
  return h
}

/** Valida que `t` esté en el enum cerrado. */
function assertKind(t: unknown): PromoCodeKind {
  if (t !== 'percent' && t !== 'fixed') {
    throw new ValidationError("kind debe ser 'percent' o 'fixed'")
  }
  return t
}

/** Valida el value según kind: porcentaje en [0,100], fijo >=0. */
function assertValueForKind(kind: PromoCodeKind, value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) {
    throw new ValidationError('value debe ser un número >= 0')
  }
  if (kind === 'percent' && n > 100) {
    throw new ValidationError('value para kind=percent debe estar en [0, 100]')
  }
  return n
}

/**
 * Detecta la violación de UNIQUE/PK en SQLite y Postgres (el mensaje difiere por motor).
 * Mismo criterio que folio-entries.isDuplicateError — replicado acá (no importado) para
 * mantener el módulo aislado (no cruza a folios solo por una función de 4 líneas).
 */
function isDuplicateError(e: unknown): boolean {
  const msg = String((e as any)?.message ?? e).toLowerCase()
  return (
    msg.includes('unique constraint') ||     // SQLite: "UNIQUE constraint failed"
    msg.includes('duplicate key') ||          // Postgres: "duplicate key value violates unique constraint"
    msg.includes('constraint failed') ||
    msg.includes('promo_codes_hotel_code')    // nombre físico del index (defensivo)
  )
}

/** Normaliza el code a UPPERCASE y trimea espacios. */
function normalizeCode(raw: string): string {
  return String(raw ?? '').trim().toUpperCase()
}

/**
 * Resuelve el hotelId efectivo del usuario (vía userRepo, no del JWT directo) y lo
 * compara contra `resourceHotelId` con `auth.assertOwnership`. Patrón landing/blocks-crud.
 */
async function assertOwnershipOf(deps: PromoCrudDeps, resourceHotelId: string, user: CurrentUser): Promise<void> {
  const me = await deps.userRepo.findOne({ id: user.id })
  deps.auth.assertOwnership(resourceHotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
}

// ─── list ──────────────────────────────────────────────────────────────────
/**
 * Lista los códigos del hotel del admin. Orden: `createdAt` DESC (más recientes primero),
 * que es lo que el admin espera ver al abrir la pantalla de promo codes.
 */
export async function list(
  deps: PromoCrudDeps,
  user: CurrentUser,
): Promise<{ data: PromoCodeDTO[]; total: number }> {
  const hotelId = hotelFor(user)
  await assertOwnershipOf(deps, hotelId, user)
  const all = await deps.promoCodes.findMany({ hotelId })
  all.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  return { data: all, total: all.length }
}

// ─── create ────────────────────────────────────────────────────────────────
/**
 * Crea un código. Normaliza code a UPPERCASE y valida kind/value. Si el código ya
 * existe para el hotel, captura el duplicate error del UNIQUE index físico y lo
 * traduce a ValidationError (escenario acceptance: 2 codes iguales → error).
 */
export async function create(
  deps: PromoCrudDeps,
  dto: CreatePromoCodeDTO,
  user: CurrentUser,
): Promise<PromoCodeDTO> {
  const hotelId = hotelFor(user)
  await assertOwnershipOf(deps, hotelId, user)
  if (!dto.code || !String(dto.code).trim()) throw new ValidationError('code es requerido')
  const kind = assertKind(dto.kind)
  const value = assertValueForKind(kind, dto.value)

  const record: Omit<PromoCodeDTO, 'id'> = {
    hotelId,
    code: normalizeCode(dto.code),
    kind,
    value,
    minAmount: dto.minAmount ?? null,
    maxUses: dto.maxUses ?? null,
    uses: 0,
    validFrom: dto.validFrom ?? null,
    validTo: dto.validTo ?? null,
    active: typeof dto.active === 'boolean' ? dto.active : true,
  } as any

  try {
    return await deps.promoCodes.create(record as any) as PromoCodeDTO
  } catch (e) {
    if (isDuplicateError(e)) {
      throw new ValidationError(`Ya existe un código "${record.code}" para este hotel`)
    }
    throw e
  }
}

// ─── update ────────────────────────────────────────────────────────────────
/**
 * Edita un código existente. Ownership post-findById (analyzer lo exige). Validación
 * de kind/value y captura del duplicate error si cambia `code` a uno existente.
 */
export async function update(
  deps: PromoCrudDeps,
  id: string,
  dto: UpdatePromoCodeDTO,
  user: CurrentUser,
): Promise<PromoCodeDTO> {
  const existing = await deps.promoCodes.findOne({ id })
  if (!existing) throw new NotFoundError('Código promocional no encontrado')
  await assertOwnershipOf(deps, existing.hotelId, user)

  const patch: Record<string, unknown> = {}
  if (dto.code !== undefined) patch.code = normalizeCode(dto.code)
  if (dto.kind !== undefined) patch.kind = assertKind(dto.kind)
  if (dto.value !== undefined) {
    // Resolvemos el kind final (dto.kind si viene, si no el existente) para validar value.
    const finalKind = (patch.kind as PromoCodeKind | undefined) ?? existing.kind
    patch.value = assertValueForKind(finalKind, dto.value)
  }
  if (dto.minAmount !== undefined) patch.minAmount = dto.minAmount
  if (dto.maxUses !== undefined) patch.maxUses = dto.maxUses
  if (dto.uses !== undefined) {
    const u = Number(dto.uses)
    if (!Number.isFinite(u) || u < 0) throw new ValidationError('uses debe ser >= 0')
    patch.uses = u
  }
  if (dto.validFrom !== undefined) patch.validFrom = dto.validFrom
  if (dto.validTo !== undefined) patch.validTo = dto.validTo
  if (dto.active !== undefined) patch.active = dto.active

  try {
    const updated = await deps.promoCodes.update(id, patch as Partial<Omit<PromoCodeDTO, 'id'>>)
    if (!updated) throw new NotFoundError('Código promocional no encontrado')
    return updated
  } catch (e) {
    if (isDuplicateError(e) && patch.code) {
      throw new ValidationError(`Ya existe un código "${patch.code}" para este hotel`)
    }
    throw e
  }
}

// ─── delete ────────────────────────────────────────────────────────────────
/**
 * Borra un código (hard delete). Ownership post-findById. Preferimos borrar sobre
 * desactivar porque el admin ya tiene toggle `active` para desactivar sin perder
 * histórico (la operación inversa de `active=false` es trivial).
 */
export async function remove(
  deps: PromoCrudDeps,
  id: string,
  user: CurrentUser,
): Promise<{ id: string; deleted: true }> {
  const existing = await deps.promoCodes.findOne({ id })
  if (!existing) throw new NotFoundError('Código promocional no encontrado')
  await assertOwnershipOf(deps, existing.hotelId, user)
  const ok = await deps.promoCodes.delete(id)
  if (!ok) throw new NotFoundError('Código promocional no encontrado')
  return { id, deleted: true }
}
