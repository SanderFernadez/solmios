# Tasks — Compras + Inventario

Dos módulos arckode nuevos (`inventario`, `compras`) + conectores. Cada sprint: implementar → gates
(`arckode analyze` 0 violaciones · `bun test` · typecheck) → QA adversarial → commit quirúrgico → openspec.

## INV — Inventario

### INV-0 — Schema + módulo base  ⟵ infra
- [x] 0.1 `make:module Inventario` (estructura canónica)
- [x] 0.2 Modelos ORM: `InventoryItems` (sku, name, category food|beverage|supply, unit, currentStock, minStock, avgCost, active, hotelId) · `StockMovements` (itemId, type in|out|adjust, quantity, unitCost, reason, source, sourceId, balanceAfter, hotelId, createdAt)
- [x] 0.3 Wiring en `composition-root.ts` (surgical) + permisos módulo `inventory`
- [x] 0.4 GATE: `arckode analyze` ✅ · migración RUN_MIGRATE local

### INV-1 — CRUD ítems + ajuste manual  ⟵ INV-0
- [x] 1.1 CRUD `inventory_items` (ownership + validación cantidad/costo ≥ 0)
- [x] 1.2 Ajuste manual de stock (`type='adjust'`) → crea movimiento + actualiza `currentStock`
- [x] 1.3 Listado con filtro por categoría (comida/bebida/bar/suministro) + bajo-mínimo
- [x] 1.4 Tests + QA

### INV-2 — Ledger de movimientos + valuación  ⟵ INV-1
- [x] 2.1 `applyMovement()` idempotente (dedup por `source`+`sourceId`): entrada suma, salida resta, ajuste fija
- [x] 2.2 Costo promedio ponderado: recalcular `avgCost` en cada entrada con `unitCost`
- [x] 2.3 `balanceAfter` por movimiento (auditable) + endpoint historial por ítem + valuación total
- [x] 2.4 Tests (suma/resta/ajuste, dedup, costo promedio) + QA

## COM — Compras

### COM-0 — Schema + módulo base  ⟵ infra
- [x] 3.1 `make:module Compras`
- [x] 3.2 Modelos: `PurchaseRequisitions`(+`RequisitionItems`) · `PurchaseOrders`(+`PurchaseOrderItems`) · `GoodsReceipts`(+`ReceiptItems`)
- [x] 3.3 Wiring + permisos módulo `purchasing`. Proveedores por connector a `treasury` (NO importar)
- [x] 3.4 GATE: `arckode analyze` ✅ · RUN_MIGRATE local

### COM-1 — Requisiciones  ⟵ COM-0
- [x] 4.1 Crear requisición con líneas (itemId opcional + descripción libre, cantidad, notas). Estado `draft`
- [x] 4.2 Ciclo: `draft → submitted → approved | rejected` (aprobación con permiso `purchasing:edit`)
- [x] 4.3 Número correlativo `REQ-YYYY-NNNN` (contador atómico en configuration)
- [x] 4.4 Tests + QA

### COM-2 — Órdenes de compra  ⟵ COM-1
- [x] 5.1 OC desde requisición aprobada (o directa): supplierId (valida vía connector treasury), líneas con precio unitario, subtotal/impuesto/total
- [x] 5.2 Ciclo: `draft → sent → received | closed | cancelled`. Número `OC-YYYY-NNNN`
- [x] 5.3 Impuesto desde configuration (NO hardcodear); moneda del hotel
- [x] 5.4 Tests + QA

### COM-3 — Recepción → suma stock  ⟵ COM-2 + INV-2
- [x] 6.1 Goods receipt (total o parcial) contra una OC: líneas recibidas (cantidad ≤ pendiente)
- [x] 6.2 Connector `compras→inventario`: por cada línea recibida con itemId → `applyMovement(in, qty, unitCost)` (dedup por receiptItemId)
- [x] 6.3 OC pasa a `received` (o parcial) según lo recibido
- [x] 6.4 Tests (recepción total/parcial, suma stock, costo promedio, dedup) + QA

### COM-4 — OC facturada → genera Gasto  ⟵ COM-3
- [x] 7.1 Marcar OC facturada (invoiceNumber del proveedor) → connector `compras→gastos`: crea `Expense` (`source='purchase_order'`, `sourceId=poId`, `supplierId`, amount=total, category) — dedup por source+sourceId
- [x] 7.2 El Gasto ya pega en caja + contabilidad (connectors existentes). Verificar cuenta de gasto correcta (`expenseAccountForSource` → agregar `purchase_order`)
- [x] 7.3 Tests (genera 1 gasto, no duplica, monto correcto) + QA

## INT — Integración con el POS

### INT-1 — Recetas → venta descuenta stock  ⟵ INV-2
- [x] 8.1 Modelo `MenuItemRecipes` (menuItemId, inventoryItemId, quantity) — BOM por ítem de menú. En `inventario` o `restaurant`? → en `inventario` (dueño del stock), el restaurant no lo importa
- [ ] 8.2 UI en la carta (restaurante): asignar receta a un ítem (opcional)
- [x] 8.3 Connector `restaurant→inventario`: al cobrar/servir una comanda, por cada línea con receta → `applyMovement(out, qty*recipeQty)` (dedup por orderLineId). Best-effort (no rompe la venta)
- [x] 8.4 Tests (venta descuenta, sin receta no descuenta, dedup) + QA

### INT-2 — Stock mínimo → requisición  ⟵ INT-1 + COM-1
- [ ] 9.1 Al bajar de `minStock`, marcar el ítem y exponer "sugeridos para requisición"
- [ ] 9.2 Acción "generar requisición" desde los bajo-mínimo (junta líneas → requisición `draft`)
- [ ] 9.3 Tests + QA

## FE + GATE

### FE — Frontend
- [ ] 10.1 `Inventario.service.ts` + `Compras.service.ts`
- [ ] 10.2 Páginas: inventario (lista + ajuste), requisiciones, órdenes de compra, recepción, recetas (en carta)
- [ ] 10.3 Rutas + module-map (`inventory`, `purchasing`) + menú
- [ ] 10.4 typecheck (vue-tsc -b) + build

### G — Gate + deploy
- [ ] 11.1 Permisos: `inventory:*`, `purchasing:*` en MODULES + DEFAULT_ROLE_PERMISSIONS + catálogo admin
- [ ] 11.2 Entitlement: `inventory`/`purchasing` en plans.modules
- [ ] 11.3 Gate final: analyze 0 · bun test · typecheck+build
- [ ] 11.4 Deploy prod: RUN_MIGRATE + roles.permissions + plans.modules + verificación en vivo
- [ ] 11.5 mapa-modulos.html (nodos inventario/compras + edges) + memoria
