// restaurant/usecases/categories-crud.ts — CRUD de la carta: categorías (RES-1).
// Extraído del service para mantenerlo bajo el límite de líneas (God Object). Reglas:
// ownership (IDOR), stationId del MISMO hotel o null, y NO borrar categoría con ítems (ConflictError).
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError, ConflictError } from 'arckode-framework'
import type { CategoryDTO, MenuItemDTO, StationDTO, CategoryTranslation, CurrentUser } from '../types'
import { assertNoBaseLangKey, resolveForLang } from '../../../shared/i18n'

export interface CategoriesCrudDeps {
  categories: RepositoryAdapter<CategoryDTO>
  items: RepositoryAdapter<MenuItemDTO>
  stations: RepositoryAdapter<StationDTO>
  userRepo: RepositoryAdapter<any>
  auth: Auth
}

// F4 — campos traducibles de una categoría: solo `name` (el modelo no tiene `description`).
const CATEGORY_TRANSLATABLE_FIELDS = ['name'] as const

export interface CreateCategoryInput {
  name: string; stationId?: string | null; sortOrder?: number; active?: number
  translations?: Record<string, CategoryTranslation> | null
}
export interface UpdateCategoryInput {
  name?: string; stationId?: string | null; sortOrder?: number; active?: number
  translations?: Record<string, CategoryTranslation> | null
}

function hotelFor(user: CurrentUser): string {
  const h = user.hotelId || ''
  if (!h) throw new ValidationError('Sin hotel asignado')
  return h
}

/** stationId (si viene) debe existir y ser del MISMO hotel. findOne (no findById) evita el falso IDOR. */
async function assertStation(deps: { stations: RepositoryAdapter<StationDTO> }, stationId: string | null | undefined, hotelId: string): Promise<void> {
  if (stationId === null || stationId === undefined || stationId === '') return
  const st = await deps.stations.findOne({ id: stationId })
  if (!st || st.hotelId !== hotelId) throw new ValidationError('La estación no existe o es de otro hotel')
}

export async function listCategories(deps: CategoriesCrudDeps, user: CurrentUser, lang?: string): Promise<{ data: CategoryDTO[]; total: number }> {
  const data = await deps.categories.findMany({ hotelId: hotelFor(user) })
  data.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const resolved = data.map((c) => resolveForLang(c, lang, CATEGORY_TRANSLATABLE_FIELDS))
  return { data: resolved, total: resolved.length }
}

export async function getCategory(deps: CategoriesCrudDeps, id: string, user: CurrentUser, lang?: string): Promise<CategoryDTO> {
  const item = await deps.categories.findById(id)
  if (!item) throw new NotFoundError('Categoría no encontrada')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(item.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  return resolveForLang(item, lang, CATEGORY_TRANSLATABLE_FIELDS)
}

export async function createCategory(deps: CategoriesCrudDeps, dto: CreateCategoryInput, user: CurrentUser): Promise<CategoryDTO> {
  const hotelId = hotelFor(user)
  if (!dto.name?.trim()) throw new ValidationError('El nombre de la categoría es obligatorio')
  await assertStation(deps, dto.stationId, hotelId)
  assertNoBaseLangKey(dto.translations, 'name')
  return deps.categories.create({
    hotelId,
    name: dto.name.trim(),
    stationId: dto.stationId || undefined,   // '' → undefined (no referencia colgante)
    sortOrder: dto.sortOrder ?? 0,
    active: dto.active ?? 1,
    translations: dto.translations ?? undefined,
  } as Omit<CategoryDTO, 'id'>)
}

export async function updateCategory(deps: CategoriesCrudDeps, id: string, dto: UpdateCategoryInput, user: CurrentUser): Promise<CategoryDTO> {
  const existing = await deps.categories.findById(id)
  if (!existing) throw new NotFoundError('Categoría no encontrada')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  if (dto.translations !== undefined) assertNoBaseLangKey(dto.translations, 'name')
  const patch: Record<string, unknown> = { ...dto }
  // stationId: el front manda '' para "sin estación" ('' sobrevive validateSchema; null no) → guardamos null.
  if (dto.stationId !== undefined) {
    const sid = dto.stationId || null
    if (sid) await assertStation(deps, sid, existing.hotelId)
    patch.stationId = sid
  }
  const item = await deps.categories.update(id, patch as Partial<Omit<CategoryDTO, 'id'>>)
  if (!item) throw new NotFoundError('Categoría no encontrada')
  return item
}

export async function deleteCategory(deps: CategoriesCrudDeps, id: string, user: CurrentUser): Promise<void> {
  const existing = await deps.categories.findById(id)
  if (!existing) throw new NotFoundError('Categoría no encontrada')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  // No borrar una categoría con ítems asociados: primero reasignar/borrar los ítems (ConflictError 409).
  const items = await deps.items.findMany({ categoryId: id })
  if (items.length > 0) throw new ConflictError('La categoría tiene ítems; reasignalos o borralos antes de eliminarla')
  const deleted = await deps.categories.delete(id)
  if (!deleted) throw new NotFoundError('Categoría no encontrada')
}
