// inventario/usecases/items-crud.ts — CRUD de insumos (INV-1). El stock inicial y los ajustes van por el
// ledger (applyMovement), NUNCA seteando currentStock a mano (así el balance siempre cuadra con el ledger).
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { InventoryItemDTO, CurrentUser } from '../types'

export interface ItemsCrudDeps {
  items: RepositoryAdapter<InventoryItemDTO>
  userRepo: RepositoryAdapter<any>
  auth: Auth
}

export interface CreateItemInput {
  sku?: string; name: string; category?: string; unit?: string; minStock?: number
}
export interface UpdateItemInput {
  sku?: string; name?: string; category?: string; unit?: string; minStock?: number; active?: number
}

const CATEGORIES = ['food', 'beverage', 'supply']

function hotelOf(user: CurrentUser): string {
  const h = user.hotelId || ''
  if (!h) throw new ValidationError('Sin hotel asignado')
  return h
}

async function loadOwned(deps: ItemsCrudDeps, id: string, user: CurrentUser): Promise<InventoryItemDTO> {
  const item = await deps.items.findById(id)
  if (!item) throw new NotFoundError('Insumo no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(item.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  return item
}

export async function listItems(deps: ItemsCrudDeps, query: { category?: string; belowMin?: boolean } | undefined, user: CurrentUser): Promise<{ data: InventoryItemDTO[]; total: number }> {
  const hotelId = hotelOf(user)
  let data = (await deps.items.findMany({ hotelId })) as InventoryItemDTO[]
  if (query?.category) data = data.filter((i) => i.category === query.category)
  if (query?.belowMin) data = data.filter((i) => Number(i.currentStock) < Number(i.minStock))
  data.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return { data, total: data.length }
}

export async function getItem(deps: ItemsCrudDeps, id: string, user: CurrentUser): Promise<InventoryItemDTO> {
  return loadOwned(deps, id, user)
}

export async function createItem(deps: ItemsCrudDeps, dto: CreateItemInput, user: CurrentUser): Promise<InventoryItemDTO> {
  const hotelId = hotelOf(user)
  if (!dto.name?.trim()) throw new ValidationError('El nombre del insumo es obligatorio')
  const category = dto.category && CATEGORIES.includes(dto.category) ? dto.category : 'supply'
  const minStock = Number(dto.minStock) || 0
  if (minStock < 0) throw new ValidationError('El stock mínimo debe ser ≥ 0')
  return deps.items.create({
    hotelId,
    sku: dto.sku?.trim() || undefined,
    name: dto.name.trim(),
    category,
    unit: dto.unit?.trim() || 'unit',
    currentStock: 0,   // el stock arranca en 0; se sube por ajuste/recepción (ledger)
    minStock,
    avgCost: 0,
    active: 1,
  } as Omit<InventoryItemDTO, 'id'>)
}

export async function updateItem(deps: ItemsCrudDeps, id: string, dto: UpdateItemInput, user: CurrentUser): Promise<InventoryItemDTO> {
  await loadOwned(deps, id, user)
  const patch: Partial<Omit<InventoryItemDTO, 'id'>> = {}
  if (dto.name !== undefined) {
    if (!dto.name.trim()) throw new ValidationError('El nombre no puede quedar vacío')
    patch.name = dto.name.trim()
  }
  if (dto.sku !== undefined) patch.sku = dto.sku.trim() || undefined
  if (dto.category !== undefined) {
    if (!CATEGORIES.includes(dto.category)) throw new ValidationError('Categoría inválida')
    patch.category = dto.category
  }
  if (dto.unit !== undefined) patch.unit = dto.unit.trim() || 'unit'
  if (dto.minStock !== undefined) {
    if (Number(dto.minStock) < 0) throw new ValidationError('El stock mínimo debe ser ≥ 0')
    patch.minStock = Number(dto.minStock)
  }
  if (dto.active !== undefined) patch.active = dto.active ? 1 : 0
  const updated = await deps.items.update(id, patch)
  if (!updated) throw new NotFoundError('Insumo no encontrado')
  return updated
}

export async function deleteItem(deps: ItemsCrudDeps, id: string, user: CurrentUser): Promise<void> {
  await loadOwned(deps, id, user)
  const ok = await deps.items.delete(id)
  if (!ok) throw new NotFoundError('Insumo no encontrado')
}
