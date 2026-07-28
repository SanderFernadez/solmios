// restaurant/usecases/combos-crud.ts — CRUD de combos/paquetes (F2).
// Reglas: ownership (IDOR); cada menuItemId de `items` se valida findOne+hotelId (mismo patrón que
// items-crud.ts:assertCategory / modifiers-crud.ts:assertMenuItem); updateCombo reemplaza `items`
// COMPLETO si viene (borra los componentes viejos, crea los nuevos) — ver specs/menu-combos/spec.md.
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { ComboDTO, ComboItemDTO, MenuItemDTO, ItemTranslation, CurrentUser, AllergenTag } from '../types'
import { assertNoBaseLangKey, resolveForLang } from '../../../shared/i18n'

export interface CombosCrudDeps {
  combos: RepositoryAdapter<ComboDTO>
  comboItems: RepositoryAdapter<ComboItemDTO>
  items: RepositoryAdapter<MenuItemDTO>
  userRepo: RepositoryAdapter<any>
  auth: Auth
}

// F4 — campos traducibles de un combo: nombre + descripción (mismo criterio que un ítem).
const COMBO_TRANSLATABLE_FIELDS = ['name', 'description'] as const

export interface ComboItemInput {
  menuItemId: string
  quantity: number
  sortOrder?: number
}

export interface CreateComboInput {
  name: string
  description?: string
  price: number
  taxRate?: number | null
  imageUrl?: string
  available?: number
  sortOrder?: number
  items: ComboItemInput[]
  translations?: Record<string, ItemTranslation> | null
}
export interface UpdateComboInput extends Partial<CreateComboInput> {}

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

/** taxRate (si viene) debe ser una tasa finita ≥ 0. `undefined`/`null` = usar la del hotel al facturar. */
function assertTaxRate(taxRate: number | null | undefined): void {
  if (taxRate === null || taxRate === undefined) return
  if (!Number.isFinite(Number(taxRate)) || Number(taxRate) < 0) throw new ValidationError('La tasa de impuesto debe ser ≥ 0')
}

/** menuItemId de un componente: REQUERIDO, debe existir y ser del MISMO hotel. findOne evita el falso IDOR. */
async function assertComponent(deps: CombosCrudDeps, menuItemId: string, hotelId: string): Promise<void> {
  const item = await deps.items.findOne({ id: menuItemId })
  if (!item || item.hotelId !== hotelId) throw new ValidationError('El ítem no existe o es de otro hotel')
}

/** Valida la forma de `items`: array no vacío, cada componente con menuItemId y quantity > 0. */
function assertItemsInput(items: ComboItemInput[] | undefined): ComboItemInput[] {
  if (!Array.isArray(items) || items.length === 0) throw new ValidationError('El combo debe tener al menos un componente')
  for (const it of items) {
    if (!it.menuItemId) throw new ValidationError('Cada componente requiere menuItemId')
    const qty = Number(it.quantity)
    if (!Number.isFinite(qty) || qty <= 0) throw new ValidationError('La cantidad del componente debe ser mayor a 0')
  }
  return items
}

/** Enriquece cada combo con sus componentes (`items`, campo derivado — no hay columna propia en
 * menu_combos, mismo patrón que ModifierGroupDTO.modifiers en modifiers-crud.ts). */
async function attachItems(deps: CombosCrudDeps, combos: ComboDTO[], hotelId: string): Promise<void> {
  for (const combo of combos) {
    const items = (await deps.comboItems.findMany({ hotelId, comboId: combo.id })) as ComboItemDTO[]
    items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    ;(combo as ComboDTO & { items?: ComboItemDTO[] }).items = items
  }
}

/** F5 — enriquece cada combo con `allergens` DERIVADO: la unión de los allergens de todos sus
 * componentes (menu_combo_items.menuItemId), calculada al leer, nunca persistida. Requiere que
 * `items` ya esté adjuntado (attachItems se llama siempre antes). Un componente sin allergens
 * declarado (null/ausente) simplemente no aporta tags — no es un falso "sin alérgenos". */
async function attachAllergens(deps: CombosCrudDeps, combos: ComboDTO[], hotelId: string): Promise<void> {
  for (const combo of combos) {
    const componentItems = combo.items ?? []
    const tags = new Set<string>()
    for (const ci of componentItems) {
      const item = await deps.items.findOne({ id: ci.menuItemId, hotelId })
      const itemAllergens = (item as MenuItemDTO | null)?.allergens
      if (Array.isArray(itemAllergens)) for (const tag of itemAllergens) tags.add(tag)
    }
    combo.allergens = Array.from(tags) as AllergenTag[]
  }
}

export async function listCombos(deps: CombosCrudDeps, user: CurrentUser, lang?: string): Promise<{ data: ComboDTO[]; total: number }> {
  const hotelId = hotelFor(user)
  const data = (await deps.combos.findMany({ hotelId })) as ComboDTO[]
  data.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  await attachItems(deps, data, hotelId)
  await attachAllergens(deps, data, hotelId)
  const resolved = data.map((c) => resolveForLang(c, lang, COMBO_TRANSLATABLE_FIELDS))
  return { data: resolved, total: resolved.length }
}

export async function getCombo(deps: CombosCrudDeps, id: string, user: CurrentUser, lang?: string): Promise<ComboDTO> {
  const combo = await deps.combos.findOne({ id })
  if (!combo) throw new NotFoundError('Combo no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(combo.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  await attachItems(deps, [combo], combo.hotelId)
  await attachAllergens(deps, [combo], combo.hotelId)
  return resolveForLang(combo, lang, COMBO_TRANSLATABLE_FIELDS)
}

export async function createCombo(deps: CombosCrudDeps, dto: CreateComboInput, user: CurrentUser): Promise<ComboDTO> {
  const hotelId = hotelFor(user)
  if (!dto.name?.trim()) throw new ValidationError('El nombre del combo es obligatorio')
  const price = assertPrice(dto.price)
  assertTaxRate(dto.taxRate)
  const items = assertItemsInput(dto.items)
  for (const it of items) await assertComponent(deps, it.menuItemId, hotelId)
  assertNoBaseLangKey(dto.translations, 'name/description')

  const combo = await deps.combos.create({
    hotelId,
    name: dto.name.trim(),
    description: dto.description,
    price,
    taxRate: dto.taxRate ?? undefined,
    imageUrl: dto.imageUrl,
    available: dto.available ?? 1,
    sortOrder: dto.sortOrder ?? 0,
    translations: dto.translations ?? undefined,
  } as Omit<ComboDTO, 'id'>)

  for (const it of items) {
    await deps.comboItems.create({
      hotelId,
      comboId: combo.id,
      menuItemId: it.menuItemId,
      quantity: Number(it.quantity),
      sortOrder: it.sortOrder ?? 0,
    } as Omit<ComboItemDTO, 'id'>)
  }

  await attachItems(deps, [combo], hotelId)
  return combo
}

/** Reemplaza `items` completo si viene en el body: borra los componentes viejos, crea los nuevos. */
export async function updateCombo(deps: CombosCrudDeps, id: string, dto: UpdateComboInput, user: CurrentUser): Promise<ComboDTO> {
  const existing = await deps.combos.findOne({ id })
  if (!existing) throw new NotFoundError('Combo no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')

  const patch: Record<string, unknown> = {}
  if (dto.name !== undefined) {
    if (!dto.name.trim()) throw new ValidationError('El nombre del combo es obligatorio')
    patch.name = dto.name.trim()
  }
  if (dto.description !== undefined) patch.description = dto.description
  if (dto.price !== undefined) patch.price = assertPrice(dto.price)
  if (dto.taxRate !== undefined) {
    assertTaxRate(dto.taxRate)
    patch.taxRate = dto.taxRate
  }
  if (dto.imageUrl !== undefined) patch.imageUrl = dto.imageUrl
  if (dto.available !== undefined) patch.available = dto.available
  if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder
  if (dto.translations !== undefined) {
    assertNoBaseLangKey(dto.translations, 'name/description')
    patch.translations = dto.translations
  }

  let items: ComboItemInput[] | undefined
  if (dto.items !== undefined) {
    items = assertItemsInput(dto.items)
    for (const it of items) await assertComponent(deps, it.menuItemId, existing.hotelId)
  }

  const updated = await deps.combos.update(id, patch as Partial<Omit<ComboDTO, 'id'>>)
  if (!updated) throw new NotFoundError('Combo no encontrado')

  if (items) {
    const old = (await deps.comboItems.findMany({ hotelId: existing.hotelId, comboId: id })) as ComboItemDTO[]
    for (const o of old) await deps.comboItems.delete(o.id)
    for (const it of items) {
      await deps.comboItems.create({
        hotelId: existing.hotelId,
        comboId: id,
        menuItemId: it.menuItemId,
        quantity: Number(it.quantity),
        sortOrder: it.sortOrder ?? 0,
      } as Omit<ComboItemDTO, 'id'>)
    }
  }

  await attachItems(deps, [updated], existing.hotelId)
  return updated
}

export async function deleteCombo(deps: CombosCrudDeps, id: string, user: CurrentUser): Promise<void> {
  const existing = await deps.combos.findOne({ id })
  if (!existing) throw new NotFoundError('Combo no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  const items = (await deps.comboItems.findMany({ hotelId: existing.hotelId, comboId: id })) as ComboItemDTO[]
  for (const it of items) await deps.comboItems.delete(it.id)
  const deleted = await deps.combos.delete(id)
  if (!deleted) throw new NotFoundError('Combo no encontrado')
}
