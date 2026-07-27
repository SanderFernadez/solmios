// restaurant/usecases/modifiers-crud.ts — CRUD de grupos de modificadores y sus opciones (F1).
// Reglas: ownership (IDOR); menuItemId/groupId referenciados se validan findOne+hotelId (mismo patrón
// que items-crud.ts:assertCategory); borrar un grupo borra sus opciones en la misma operación.
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { ModifierGroupDTO, ModifierDTO, MenuItemDTO, CurrentUser } from '../types'

export interface ModifiersCrudDeps {
  modifierGroups: RepositoryAdapter<ModifierGroupDTO>
  modifiers: RepositoryAdapter<ModifierDTO>
  items: RepositoryAdapter<MenuItemDTO>
  userRepo: RepositoryAdapter<any>
  auth: Auth
}

export interface CreateModifierGroupInput {
  name: string
  selectionType?: 'single' | 'multiple'
  required?: number
  minSelect?: number
  maxSelect?: number | null
  sortOrder?: number
}
export interface UpdateModifierGroupInput extends Partial<CreateModifierGroupInput> {}

export interface CreateModifierInput {
  name: string
  priceDelta: number
  inventoryItemId?: string | null
  inventoryQuantity?: number | null
  active?: number
  sortOrder?: number
}
export interface UpdateModifierInput extends Partial<CreateModifierInput> {}

function hotelFor(user: CurrentUser): string {
  const h = user.hotelId || ''
  if (!h) throw new ValidationError('Sin hotel asignado')
  return h
}

/** menuItemId REQUERIDO: debe existir y ser del MISMO hotel. findOne evita el falso IDOR. */
async function assertMenuItem(deps: ModifiersCrudDeps, menuItemId: string, hotelId: string): Promise<void> {
  const item = await deps.items.findOne({ id: menuItemId })
  if (!item || item.hotelId !== hotelId) throw new ValidationError('El ítem no existe o es de otro hotel')
}

/** groupId REQUERIDO: debe existir y ser del MISMO hotel. Devuelve el grupo para reusar su menuItemId. */
async function assertGroup(deps: ModifiersCrudDeps, groupId: string, hotelId: string): Promise<ModifierGroupDTO> {
  const group = await deps.modifierGroups.findOne({ id: groupId })
  if (!group || group.hotelId !== hotelId) throw new ValidationError('El grupo no existe o es de otro hotel')
  return group
}

function assertSelectionType(t: string | undefined): 'single' | 'multiple' {
  if (t === undefined) return 'single'
  if (t !== 'single' && t !== 'multiple') throw new ValidationError('selectionType debe ser "single" o "multiple"')
  return t
}

// ─── Grupos ───
// El listado enriquece cada grupo con sus opciones (`modifiers`, campo derivado — no hay tabla propia
// ni columna: mismo patrón que `MenuItemDTO.hasRecipe` en items-crud.ts). No existe una ruta propia
// "listar opciones de un grupo"; la carta necesita ver todo lo ya persistido de un ítem en una sola
// llamada (acceptance de la task 1.11: verlo reflejado tras recargar).
export async function listGroups(deps: ModifiersCrudDeps, menuItemId: string, user: CurrentUser): Promise<{ data: ModifierGroupDTO[]; total: number }> {
  const hotelId = hotelFor(user)
  const data = (await deps.modifierGroups.findMany({ hotelId, menuItemId })) as ModifierGroupDTO[]
  data.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  for (const group of data) {
    const options = (await deps.modifiers.findMany({ hotelId, groupId: group.id })) as ModifierDTO[]
    options.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    ;(group as ModifierGroupDTO & { modifiers?: ModifierDTO[] }).modifiers = options
  }
  return { data, total: data.length }
}

export async function createGroup(deps: ModifiersCrudDeps, menuItemId: string, dto: CreateModifierGroupInput, user: CurrentUser): Promise<ModifierGroupDTO> {
  const hotelId = hotelFor(user)
  if (!dto.name?.trim()) throw new ValidationError('El nombre del grupo es obligatorio')
  await assertMenuItem(deps, menuItemId, hotelId)
  const selectionType = assertSelectionType(dto.selectionType)
  return deps.modifierGroups.create({
    hotelId,
    menuItemId,
    name: dto.name.trim(),
    selectionType,
    required: dto.required ?? 0,
    minSelect: dto.minSelect ?? 1,
    maxSelect: dto.maxSelect ?? undefined,
    sortOrder: dto.sortOrder ?? 0,
  } as Omit<ModifierGroupDTO, 'id'>)
}

export async function updateGroup(deps: ModifiersCrudDeps, id: string, dto: UpdateModifierGroupInput, user: CurrentUser): Promise<ModifierGroupDTO> {
  const existing = await deps.modifierGroups.findOne({ id })
  if (!existing) throw new NotFoundError('Grupo no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  const patch: Record<string, unknown> = { ...dto }
  if (dto.selectionType !== undefined) patch.selectionType = assertSelectionType(dto.selectionType)
  const item = await deps.modifierGroups.update(id, patch as Partial<Omit<ModifierGroupDTO, 'id'>>)
  if (!item) throw new NotFoundError('Grupo no encontrado')
  return item
}

/** Borra el grupo Y sus opciones en la misma operación (cascada). */
export async function deleteGroup(deps: ModifiersCrudDeps, id: string, user: CurrentUser): Promise<void> {
  const existing = await deps.modifierGroups.findOne({ id })
  if (!existing) throw new NotFoundError('Grupo no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  const options = (await deps.modifiers.findMany({ groupId: id })) as ModifierDTO[]
  for (const o of options) await deps.modifiers.delete(o.id)
  const deleted = await deps.modifierGroups.delete(id)
  if (!deleted) throw new NotFoundError('Grupo no encontrado')
}

// ─── Opciones ───
export async function createModifier(deps: ModifiersCrudDeps, groupId: string, dto: CreateModifierInput, user: CurrentUser): Promise<ModifierDTO> {
  const hotelId = hotelFor(user)
  if (!dto.name?.trim()) throw new ValidationError('El nombre de la opción es obligatorio')
  const priceDelta = Number(dto.priceDelta)
  if (!Number.isFinite(priceDelta)) throw new ValidationError('priceDelta debe ser un número')
  await assertGroup(deps, groupId, hotelId)
  return deps.modifiers.create({
    hotelId,
    groupId,
    name: dto.name.trim(),
    priceDelta,
    inventoryItemId: dto.inventoryItemId || undefined,
    inventoryQuantity: dto.inventoryQuantity ?? undefined,
    active: dto.active ?? 1,
    sortOrder: dto.sortOrder ?? 0,
  } as Omit<ModifierDTO, 'id'>)
}

export async function updateModifier(deps: ModifiersCrudDeps, id: string, dto: UpdateModifierInput, user: CurrentUser): Promise<ModifierDTO> {
  const existing = await deps.modifiers.findOne({ id })
  if (!existing) throw new NotFoundError('Opción no encontrada')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  const patch: Record<string, unknown> = { ...dto }
  if (dto.priceDelta !== undefined) {
    const priceDelta = Number(dto.priceDelta)
    if (!Number.isFinite(priceDelta)) throw new ValidationError('priceDelta debe ser un número')
    patch.priceDelta = priceDelta
  }
  const item = await deps.modifiers.update(id, patch as Partial<Omit<ModifierDTO, 'id'>>)
  if (!item) throw new NotFoundError('Opción no encontrada')
  return item
}

export async function deleteModifier(deps: ModifiersCrudDeps, id: string, user: CurrentUser): Promise<void> {
  const existing = await deps.modifiers.findOne({ id })
  if (!existing) throw new NotFoundError('Opción no encontrada')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  const deleted = await deps.modifiers.delete(id)
  if (!deleted) throw new NotFoundError('Opción no encontrada')
}
