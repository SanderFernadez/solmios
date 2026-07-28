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

### QA compras (adversarial) — hallazgos
- ✅ **H1 (ALTO)** fixeado: líneas duplicadas en recepción inflaban stock 2× → agregación por orderItemId.
- ✅ **H2 (ALTO)** fixeado: doble-click en Facturar creaba 2 gastos → UNIQUE INDEX expenses(hotelId,source,sourceId) + gastos.upsertBySource + re-lectura.
- ⏳ **M1 (deuda aceptada)**: dos `receive` concurrentes sobre la misma OC hacen read-modify-write de `receivedQty` (last-write-wins) → posible over-receipt. Fix real = incremento atómico a nivel repo (`SET receivedQty = receivedQty + ?`), no expuesto por RepositoryAdapter. Mismo clase que la no-atomicidad de settlement (RES-5 M1).
- ⏳ **M2 (política)**: `markInvoiced` permite facturar una OC `sent` (nada recibido) → pago contra factura antes de recibir. Es un caso de negocio válido; se deja habilitado a propósito.
- ⏳ **M3 (política contable)**: el gasto se asienta por el TOTAL BRUTO (con ITBIS). En RD el ITBIS de compras suele ser crédito fiscal, no gasto. Consistente con cómo el sistema ya maneja `gastos` (bruto); separar el crédito fiscal es un cambio de contabilidad fuera de este módulo.
- ✅ **M4 mitigado**: `inventoryItemId` de otro hotel en la OC → al recibir, `applyMovement` hace assertOwnership y el conector es best-effort (no suma stock cross-tenant, sin fuga).

### COM-4 — OC facturada → genera Gasto  ⟵ COM-3
- [x] 7.1 Marcar OC facturada (invoiceNumber del proveedor) → connector `compras→gastos`: crea `Expense` (`source='purchase_order'`, `sourceId=poId`, `supplierId`, amount=total, category) — dedup por source+sourceId
- [x] 7.2 El Gasto ya pega en caja + contabilidad (connectors existentes). Verificar cuenta de gasto correcta (`expenseAccountForSource` → agregar `purchase_order`)
- [x] 7.3 Tests (genera 1 gasto, no duplica, monto correcto) + QA

## INT — Integración con el POS

### INT-1 — Recetas → venta descuenta stock  ⟵ INV-2
- [x] 8.1 Modelo `MenuItemRecipes` (menuItemId, inventoryItemId, quantity) — BOM por ítem de menú. En `inventario` o `restaurant`? → en `inventario` (dueño del stock), el restaurant no lo importa
- [x] 8.2 UI en la carta (restaurante): asignar receta a un ítem (modal "Receta" por ítem en `carta.vue`; add/remove línea vía setRecipe, qty 0 elimina)
- [x] 8.3 Connector `restaurant→inventario`: al cobrar/servir una comanda, por cada línea con receta → `applyMovement(out, qty*recipeQty)` (dedup por orderLineId). Best-effort (no rompe la venta)
- [x] 8.4 Tests (venta descuenta, sin receta no descuenta, dedup) + QA

### INT-2 — Stock mínimo → requisición  ⟵ INT-1 + COM-1
- [x] 9.1 Al bajar de `minStock`, marcar el ítem (rojo + KPI "bajo mínimo" + filtro) en `inventario/index.vue`
- [x] 9.2 Acción "Requisición de reposición" desde el inventario: junta los bajo-mínimo en una requisición `draft` (cantidad sugerida = faltante para el mínimo). Reusa `ComprasService.createRequisition` — sin backend nuevo
- [~] 9.3 Tests: cubierto por el flujo de requisiciones (COM-1). La acción FE es un wrapper de create; sin test dedicado (deuda menor).

## FE + GATE

### FE — Frontend
- [x] 10.1 `Inventario.service.ts` + `Compras.service.ts` (tipos espejo, labels ES, estilos de estado)
- [x] 10.2 Páginas: `inventario/index.vue` (lista + KPIs + valuación + ajuste + historial), `compras/requisiciones.vue` (multi-línea + ciclo aprobación), `compras/ordenes.vue` (crear + recibir + facturar), recetas en `restaurante/carta.vue`. Todas con EmptyState.
- [x] 10.3 Rutas (`/panel/inventario`, `/panel/compras/*`) + module-map (`inventory`, `purchasing` en 3 mapas) + menú (Inventario + grupo Compras con iconos box/cart)
- [x] 10.4 typecheck (vue-tsc -b --force) ✅ 0 errores + build ✅ (chunks inventario/requisiciones/ordenes generados)

### QA frontend (adversarial) — hallazgos
- ✅ **ALTO** fixeado: insumo `active:0` (desactivado) no se filtraba en ningún lado (KPIs, dropdowns de línea) — toggle "Activo" era cosmético. Fix: `activeItems`/`activeInventory` computed en las 4 vistas + badge "Inactivo" visible.
- ✅ **ALTO** fixeado: requisición en `draft` creada por un usuario con solo `purchasing:create` no tenía forma de enviarse a aprobación (el botón estaba gateado por `edit`, y la ruta genérica de transición también). Fix real (no cosmético): endpoint dedicado `POST /compras/requisitions/:id/submit` gateado por `purchasing:create`, restringido en el usecase (`submitOwn`) a que solo el creador (`requestedBy`) pueda enviar la propia — segregación de funciones (quien pide ≠ quien aprueba). Tests agregados.
- ✅ **ALTO** fixeado: una misma requisición aprobada podía generar N órdenes de compra duplicadas (el dropdown "Desde requisición" no se refrescaba tras crear una OC ni excluía las ya usadas). Fix: `availableReqs` computed que excluye requisiciones con una OC no cancelada asociada + `reload()` ahora refresca también `approvedReqs`.
- ✅ **MEDIO** fixeado: `AppModal` compartido — un solo listener global de Escape cerraba TODOS los modales apilados a la vez (ej. detalle de OC + modal de recepción abiertos juntos). Fix: pila de módulo (`modalStack`) — solo el modal en el tope reacciona a Escape; el overflow del body solo se libera cuando no queda ninguno abierto (bug latente aparte que también arregla).
- ✅ **MEDIO** fixeado: hint de "Ajuste (conteo físico)" no aclaraba si la cantidad es delta o valor absoluto (backend: `adjust` FIJA el stock, no lo suma). Fix: labels y hint explícitos.
- ✅ **BAJO** fixeado: botones Quitar/Agregar del modal de Receta no gateados individualmente por `editPerm` (solo el punto de entrada lo estaba).

### G — Gate + deploy
- [x] 11.1 Verificado (2026-07-28): `inventory`/`purchasing` YA estaban en `MODULES` +
      `DEFAULT_ROLE_PERMISSIONS` (`backend/src/shared/permissions.ts:40,42,94,95,149,150`) y en el
      catálogo admin (`backend/src/modules/admin/usecases/modules.ts:103,106,109`) — no hizo falta
      código nuevo, solo confirmar.
- [x] 11.2 Verificado: `plan-professional` y `plan-starter` ya incluyen `"inventory"` y
      `"purchasing"` en `plans.modules` (consultado en prod).
- [x] 11.3 Gate: `arckode analyze` ✅ VÁLIDO (0 violaciones) · `bun test src/modules/inventario/
      src/modules/compras/` 42/42 verdes.
- [x] 11.4 Deploy prod: sin RUN_MIGRATE pendiente (tablas ya existían). `roles.permissions` del
      `hotel_admin` de los 4 hoteles reales ya tenía `inventory:view`/`purchasing:view` (verificado
      por consulta directa a la DB). Verificación en vivo: `GET /api/inventario/items` → 200,
      `GET /api/compras/orders` → 200, `GET /api/compras/requisitions` → 200 (Hotel Boutique Palma).
- [x] 11.5 Memoria guardada (MemoryOne + memoria local). `mapa-modulos.html` — **NO tocado**: es un
      bundle HTML de ~700KB con JS de terceros minificado, no una estructura de datos editable a
      mano; agregar nodos ahí sin el proceso de build que lo generó arriesga corromper el archivo
      para un beneficio puramente cosmético (el diagrama, no funcionalidad). Queda pendiente si se
      decide priorizar, con la herramienta correcta.
