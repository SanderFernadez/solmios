// restaurant/usecases/items-crud.ts — CRUD de la carta: ítems (RES-1).
// Reglas: ownership (IDOR); categoryId REQUERIDO y del MISMO hotel; stationId (override) del mismo hotel o null;
// price ≥ 0 (rechaza negativos/NaN); taxRate opcional (si null, se resuelve al facturar desde config, NO acá).
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { MenuItemDTO, CategoryDTO, StationDTO, ItemTranslation, CurrentUser, AllergenTag } from '../types'
import { ALLERGEN_TAGS } from '../types'
import { assertNoBaseLangKey, resolveForLang } from '../../../shared/i18n'
import { isWithinAvailabilityWindow } from './order-totals'

export interface ItemsCrudDeps {
  items: RepositoryAdapter<MenuItemDTO>
  categories: RepositoryAdapter<CategoryDTO>
  stations: RepositoryAdapter<StationDTO>
  userRepo: RepositoryAdapter<any>
  auth: Auth
}

// F4 — campos traducibles de un ítem: nombre + descripción.
const ITEM_TRANSLATABLE_FIELDS = ['name', 'description'] as const

export interface CreateItemInput {
  categoryId: string
  name: string
  description?: string
  price: number
  taxRate?: number | null
  stationId?: string | null
  available?: number
  imageUrl?: string
  sortOrder?: number
  translations?: Record<string, ItemTranslation> | null
  allergens?: AllergenTag[] | null
  // F6 — "plato del día"/recomendado (sin regla de negocio) + franja horaria "HH:mm" (todo-o-nada,
  // ver assertTimeWindow). '' se trata como "sin valor" (mismo criterio que stationId).
  featured?: number
  availableFrom?: string | null
  availableTo?: string | null
}
export interface UpdateItemInput extends Partial<CreateItemInput> {}

function hotelFor(user: CurrentUser): string {
  const h = user.hotelId || ''
  if (!h) throw new ValidationError('Sin hotel asignado')
  return h
}

/** El precio debe ser un número finito ≥ 0. Rechaza NaN, Infinity y negativos. */
function assertPrice(price: unknown): number {
  const n = Number(price)
  if (!Number.isFinite(n) || n < 0) throw new ValidationError('El precio debe ser un número mayor o igual a 0')
  return n
}

/** taxRate (si viene) debe ser una tasa finita ≥ 0. `undefined` = usar la del hotel al facturar. */
function assertTaxRate(taxRate: number | null | undefined): void {
  if (taxRate === null || taxRate === undefined) return
  if (!Number.isFinite(Number(taxRate)) || Number(taxRate) < 0) throw new ValidationError('La tasa de impuesto debe ser ≥ 0')
}

/** categoryId REQUERIDO: debe existir y ser del MISMO hotel. findOne evita el falso IDOR. */
async function assertCategory(deps: ItemsCrudDeps, categoryId: string | undefined, hotelId: string): Promise<void> {
  if (!categoryId) throw new ValidationError('La categoría es obligatoria')
  const cat = await deps.categories.findOne({ id: categoryId })
  if (!cat || cat.hotelId !== hotelId) throw new ValidationError('La categoría no existe o es de otro hotel')
}

/** stationId (override opcional) debe existir y ser del MISMO hotel, o null. */
async function assertStation(deps: ItemsCrudDeps, stationId: string | null | undefined, hotelId: string): Promise<void> {
  if (stationId === null || stationId === undefined || stationId === '') return
  const st = await deps.stations.findOne({ id: stationId })
  if (!st || st.hotelId !== hotelId) throw new ValidationError('La estación no existe o es de otro hotel')
}

/** F5 — cada tag (si vienen) debe pertenecer al catálogo fijo ALLERGEN_TAGS. `undefined`/`null` = sin
 * tags declarados. Nunca bloquea addLine (informativo, no una regla de negocio, ver order-lines.ts). */
function assertAllergens(allergens: AllergenTag[] | null | undefined): void {
  if (allergens === null || allergens === undefined) return
  if (!Array.isArray(allergens)) throw new ValidationError('Los alérgenos deben ser un array')
  for (const tag of allergens) {
    if (!(ALLERGEN_TAGS as readonly string[]).includes(tag)) {
      throw new ValidationError(`"${tag}" no es un alérgeno/tag válido`)
    }
  }
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** F6 — franja horaria "HH:mm", todo-o-nada: ninguno de los dos (sin restricción) o AMBOS con
 * formato válido. `''`/`null`/`undefined` cuentan como "sin valor" (mismo criterio que stationId). */
function assertTimeWindow(from: string | null | undefined, to: string | null | undefined): void {
  const hasFrom = !!from
  const hasTo = !!to
  if (!hasFrom && !hasTo) return
  if (hasFrom !== hasTo) throw new ValidationError('availableFrom y availableTo deben venir juntos (franja horaria todo-o-nada)')
  if (!TIME_RE.test(from as string) || !TIME_RE.test(to as string)) {
    throw new ValidationError('El horario debe tener formato HH:mm')
  }
}

// F6 — `availableNow` es DERIVADO (`available=1 AND dentro de franja`), nunca se persiste. El
// frontend SOLO lee este booleano — la lógica de franja vive en un solo lugar (order-totals.ts).
function withAvailableNow(item: MenuItemDTO, now: Date): MenuItemDTO {
  return { ...item, availableNow: (item.available ?? 1) === 1 && isWithinAvailabilityWindow(item, now) }
}

export async function listItems(deps: ItemsCrudDeps, categoryId: string | undefined, user: CurrentUser, lang?: string): Promise<{ data: MenuItemDTO[]; total: number }> {
  const filters: Record<string, unknown> = { hotelId: hotelFor(user) }
  if (categoryId) filters.categoryId = categoryId
  const data = await deps.items.findMany(filters)
  data.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const now = new Date()
  const resolved = data.map((i) => withAvailableNow(resolveForLang(i, lang, ITEM_TRANSLATABLE_FIELDS), now))
  return { data: resolved, total: resolved.length }
}

export async function getItem(deps: ItemsCrudDeps, id: string, user: CurrentUser, lang?: string): Promise<MenuItemDTO> {
  const item = await deps.items.findById(id)
  if (!item) throw new NotFoundError('Ítem no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(item.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  return withAvailableNow(resolveForLang(item, lang, ITEM_TRANSLATABLE_FIELDS), new Date())
}

export async function createItem(deps: ItemsCrudDeps, dto: CreateItemInput, user: CurrentUser): Promise<MenuItemDTO> {
  const hotelId = hotelFor(user)
  if (!dto.name?.trim()) throw new ValidationError('El nombre del ítem es obligatorio')
  const price = assertPrice(dto.price)
  assertTaxRate(dto.taxRate)
  await assertCategory(deps, dto.categoryId, hotelId)
  await assertStation(deps, dto.stationId, hotelId)
  assertNoBaseLangKey(dto.translations, 'name/description')
  assertAllergens(dto.allergens)
  assertTimeWindow(dto.availableFrom, dto.availableTo)
  return deps.items.create({
    hotelId,
    categoryId: dto.categoryId,
    name: dto.name.trim(),
    description: dto.description,
    price,
    taxRate: dto.taxRate ?? undefined,
    stationId: dto.stationId || undefined,   // '' → undefined (no referencia colgante)
    available: dto.available ?? 1,
    imageUrl: dto.imageUrl,
    sortOrder: dto.sortOrder ?? 0,
    translations: dto.translations ?? undefined,
    allergens: dto.allergens ?? undefined,
    featured: dto.featured ?? 0,
    availableFrom: dto.availableFrom || undefined,   // '' → undefined (sin restricción, compat retro)
    availableTo: dto.availableTo || undefined,
  } as Omit<MenuItemDTO, 'id'>)
}

export async function updateItem(deps: ItemsCrudDeps, id: string, dto: UpdateItemInput, user: CurrentUser): Promise<MenuItemDTO> {
  const existing = await deps.items.findById(id)
  if (!existing) throw new NotFoundError('Ítem no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  if (dto.translations !== undefined) assertNoBaseLangKey(dto.translations, 'name/description')
  if (dto.allergens !== undefined) assertAllergens(dto.allergens)
  const patch: Record<string, unknown> = { ...dto }
  if (dto.price !== undefined) patch.price = assertPrice(dto.price)
  if (dto.taxRate !== undefined) assertTaxRate(dto.taxRate)
  if (dto.categoryId !== undefined) await assertCategory(deps, dto.categoryId, existing.hotelId)
  // stationId: '' del front = "sin estación" (des-rutear) → guardamos null; un id se valida.
  if (dto.stationId !== undefined) {
    const sid = dto.stationId || null
    if (sid) await assertStation(deps, sid, existing.hotelId)
    patch.stationId = sid
  }
  // F6 — franja horaria: solo se valida/toca si el body trajo AL MENOS uno de los dos campos.
  // '' del front = "sin restricción" (Sin restricción) → guardamos null; ambos con formato → se persisten.
  if (dto.availableFrom !== undefined || dto.availableTo !== undefined) {
    assertTimeWindow(dto.availableFrom, dto.availableTo)
    patch.availableFrom = dto.availableFrom || null
    patch.availableTo = dto.availableTo || null
  }
  const item = await deps.items.update(id, patch as Partial<Omit<MenuItemDTO, 'id'>>)
  if (!item) throw new NotFoundError('Ítem no encontrado')
  return item
}

/** Toggle rápido de disponibilidad ("86'" del día). Si `available` viene, lo fija; si no, invierte el actual. */
export async function setAvailability(deps: ItemsCrudDeps, id: string, available: number | undefined, user: CurrentUser): Promise<MenuItemDTO> {
  const existing = await deps.items.findById(id)
  if (!existing) throw new NotFoundError('Ítem no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  const next = available !== undefined ? (available ? 1 : 0) : (existing.available ? 0 : 1)
  const item = await deps.items.update(id, { available: next } as Partial<Omit<MenuItemDTO, 'id'>>)
  if (!item) throw new NotFoundError('Ítem no encontrado')
  return item
}

export async function deleteItem(deps: ItemsCrudDeps, id: string, user: CurrentUser): Promise<void> {
  const existing = await deps.items.findById(id)
  if (!existing) throw new NotFoundError('Ítem no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  // Las líneas de comandas históricas guardan snapshot de name/price → la comanda sobrevive al borrado.
  const deleted = await deps.items.delete(id)
  if (!deleted) throw new NotFoundError('Ítem no encontrado')
}
