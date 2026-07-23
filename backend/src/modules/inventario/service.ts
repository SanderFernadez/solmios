// inventario/service.ts — Facade del módulo de inventario. Orquesta; la lógica vive en usecases/.
// Depende de RepositoryAdapter (NO del ORM directo). NO importa de otros módulos (eso va por conectores).
// El stock se mueve SOLO por el ledger (applyMovement); currentStock es el balance materializado.
import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'
import type { InventoryItemDTO, StockMovementDTO, MovementType, CurrentUser } from './types'
import type { InventarioSockets } from './sockets'
import * as itemsCrud from './usecases/items-crud'
import * as ledger from './usecases/movements'

export class InventarioService {
  private sockets: InventarioSockets = {}

  constructor(
    private readonly items: RepositoryAdapter<InventoryItemDTO>,
    private readonly movements: RepositoryAdapter<StockMovementDTO>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly auth: Auth,
  ) {}

  /** Acumula handlers, nunca pisa el anterior (composición de sockets). */
  setSockets(s: Partial<InventarioSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  private itemDeps(): itemsCrud.ItemsCrudDeps {
    return { items: this.items, userRepo: this.userRepo, auth: this.auth }
  }
  private ledgerDeps(): ledger.MovementDeps {
    return { items: this.items, movements: this.movements, userRepo: this.userRepo, auth: this.auth }
  }

  // ─── Ítems (INV-1) ───
  listItems(query: { category?: string; belowMin?: boolean } | undefined, user: CurrentUser) { return itemsCrud.listItems(this.itemDeps(), query, user) }
  getItem(id: string, user: CurrentUser) { return itemsCrud.getItem(this.itemDeps(), id, user) }
  createItem(dto: itemsCrud.CreateItemInput, user: CurrentUser) { return itemsCrud.createItem(this.itemDeps(), dto, user) }
  updateItem(id: string, dto: itemsCrud.UpdateItemInput, user: CurrentUser) { return itemsCrud.updateItem(this.itemDeps(), id, dto, user) }
  deleteItem(id: string, user: CurrentUser) { return itemsCrud.deleteItem(this.itemDeps(), id, user) }

  // ─── Ledger de stock (INV-2) ───
  /** Movimiento manual (entrada/salida/ajuste) desde la UI. Los conectores usan applyMovement directo. */
  async moveStock(itemId: string, dto: { type: MovementType; quantity: number; unitCost?: number; reason?: string }, user: CurrentUser): Promise<InventoryItemDTO> {
    if (!dto?.type) throw new ValidationError('Tipo de movimiento requerido')
    const item = await ledger.applyMovement(this.ledgerDeps(), {
      itemId, type: dto.type, quantity: dto.quantity, unitCost: dto.unitCost, reason: dto.reason, source: 'manual',
    }, user)
    await this.sockets.onStockChanged?.(item)
    return item
  }

  /** Aplica un movimiento desde un conector (recepción de compra / venta del POS). Idempotente por source+sourceId. */
  async applyExternalMovement(input: ledger.ApplyMovementInput, user: CurrentUser): Promise<InventoryItemDTO> {
    const item = await ledger.applyMovement(this.ledgerDeps(), input, user)
    await this.sockets.onStockChanged?.(item)
    return item
  }

  listMovements(itemId: string, user: CurrentUser) { return ledger.listMovements(this.ledgerDeps(), itemId, user) }

  async valuation(user: CurrentUser): Promise<{ total: number; items: number }> {
    const { data } = await itemsCrud.listItems(this.itemDeps(), undefined, user)
    return { total: ledger.valuation(data), items: data.length }
  }
}
