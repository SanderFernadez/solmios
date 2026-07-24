// inventario/usecases/recipes.ts — Recetas (BOM) por ítem de menú (INT-1). Define cuánto insumo consume
// cada unidad vendida. `consumeForSale` descuenta stock al vender/servir una comanda, reusando el ledger
// idempotente (source='pos_sale', sourceId=`${lineId}:${inventoryItemId}` → cada insumo dedup por su cuenta).
import type { RepositoryAdapter, Auth, Logger } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { MenuItemRecipeDTO, InventoryItemDTO, StockMovementDTO, CurrentUser } from '../types'
import { applyMovement, type MovementDeps } from './movements'

export interface RecipeDeps {
  recipes: RepositoryAdapter<MenuItemRecipeDTO>
  items: RepositoryAdapter<InventoryItemDTO>
  movements: RepositoryAdapter<StockMovementDTO>
  userRepo: RepositoryAdapter<any>
  auth: Auth
  logger: Logger
}

function hotelOf(u: CurrentUser): string { const h = u.hotelId || ''; if (!h) throw new ValidationError('Sin hotel asignado'); return h }
function movDeps(d: RecipeDeps): MovementDeps { return { items: d.items, movements: d.movements, userRepo: d.userRepo, auth: d.auth } }

/** Recetas de un ítem de menú (los insumos que consume). */
export async function listRecipes(deps: RecipeDeps, menuItemId: string, user: CurrentUser): Promise<{ data: MenuItemRecipeDTO[]; total: number }> {
  const hotelId = hotelOf(user)
  const data = (await deps.recipes.findMany({ hotelId, menuItemId })) as MenuItemRecipeDTO[]
  return { data, total: data.length }
}

/** Define/actualiza (upsert) el consumo de un insumo para un ítem de menú. quantity 0 elimina la línea. */
export async function setRecipe(deps: RecipeDeps, dto: { menuItemId: string; inventoryItemId: string; quantity: number }, user: CurrentUser): Promise<MenuItemRecipeDTO | null> {
  const hotelId = hotelOf(user)
  if (!dto.menuItemId || !dto.inventoryItemId) throw new ValidationError('menuItemId e inventoryItemId requeridos')
  const qty = Number(dto.quantity)
  if (!Number.isFinite(qty) || qty < 0) throw new ValidationError('La cantidad debe ser ≥ 0')
  // El insumo debe existir y ser del hotel (ownership).
  const item = await deps.items.findById(dto.inventoryItemId)
  if (!item) throw new NotFoundError('Insumo no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(item.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')

  const existing = await deps.recipes.findOne({ hotelId, menuItemId: dto.menuItemId, inventoryItemId: dto.inventoryItemId })
  if (qty === 0) {
    if (existing) await deps.recipes.delete(existing.id)
    return null
  }
  if (existing) return (await deps.recipes.update(existing.id, { quantity: qty } as any)) as MenuItemRecipeDTO
  return deps.recipes.create({ hotelId, menuItemId: dto.menuItemId, inventoryItemId: dto.inventoryItemId, quantity: qty } as Omit<MenuItemRecipeDTO, 'id'>)
}

/**
 * Descuenta stock por la venta de `soldQty` unidades de un ítem de menú (INT-1). Best-effort por insumo:
 * si un descuento falla, no rompe la venta. Idempotente por línea de comanda (sourceId incluye el lineId).
 * `user` suele ser el super_admin sintético del conector (bypasa ownership; el hotelId viene de la comanda).
 */
export async function consumeForSale(deps: RecipeDeps, input: { hotelId: string; menuItemId: string; soldQty: number; lineId: string }, user: CurrentUser): Promise<void> {
  if (!input.menuItemId || !input.lineId) return
  const soldQty = Number(input.soldQty)
  if (!Number.isFinite(soldQty) || soldQty <= 0) return
  const recipes = (await deps.recipes.findMany({ hotelId: input.hotelId, menuItemId: input.menuItemId })) as MenuItemRecipeDTO[]
  // Stock fantasma: el plato vendido no tiene receta → no hay insumos modelados que descontar. Antes esto
  // era silencioso y el admin no se enteraba de qué platos faltaba recetar (vendía y el stock no bajaba).
  // Lo avisamos para que se sepa qué cargar. NO descuenta por acá (correcto): sin receta no hay consumo
  // modelado; inventario real se descuenta cuando el admin dé de alta la receta y se vuelva a vender.
  if (recipes.length === 0) {
    deps.logger.warn('stock fantasma: plato vendido sin receta, descuento de inventario omitido', {
      hotelId: input.hotelId, menuItemId: input.menuItemId, lineId: input.lineId, soldQty,
    })
    return
  }
  for (const r of recipes) {
    const qty = Number(r.quantity) * soldQty
    if (!Number.isFinite(qty) || qty <= 0) continue
    try {
      await applyMovement(movDeps(deps), {
        itemId: r.inventoryItemId, type: 'out', quantity: qty,
        reason: 'Venta POS', source: 'pos_sale', sourceId: `${input.lineId}:${r.inventoryItemId}`,
      }, user)
    } catch { /* best-effort: un descuento de stock no debe romper el cobro de la comanda */ }
  }
}
