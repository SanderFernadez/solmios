# Compras + Inventario (procurement + stock)

## Por qué
El hotel tiene restaurante **y bar**: necesita controlar existencias de insumos (comida, bebida, botellas) y
un flujo de compras formal. Hoy solo existe `gastos` (el gasto suelto ya pega en caja + contabilidad) y el
catálogo `treasury.suppliers`. Falta toda la cadena por delante del gasto y el control de stock.

Equivalente MisterPlan: módulo de Almacén/Compras (inventario de insumos + requisición → orden de compra →
recepción → factura de proveedor).

## Qué se construye
Dos módulos nuevos, aislados (arckode), + conectores. Reusa lo que ya existe (NO reinventa):
- **`inventario`** — ítems de insumo (comida/bebida/bar/suministro), stock actual, costo promedio, movimientos
  (entrada/salida/ajuste) como ledger, stock mínimo.
- **`compras`** — requisición de compra (interna, se aprueba) → orden de compra (al proveedor) → recepción
  (total/parcial). Reusa `treasury.suppliers` (proveedores) y genera `Expense` al facturar.

## Integración (lo que lo hace "preciso")
- Recepción de OC → **SUMA stock** al inventario (con costo → recalcula costo promedio).
- OC facturada → genera **Gasto** (`source='purchase_order'`) → pega en **caja + contabilidad** (ya funciona).
- Venta del **POS restaurante/bar** → **DESCUENTA stock** según la **receta** del ítem de menú (BOM).
- Stock **por debajo del mínimo** → sugiere/crea requisición automática.

## Alcance
- SÍ: inventario de insumos + valuación por costo promedio; requisición/OC/recepción; receta por ítem de menú;
  descuento de stock en la venta; generación de gasto desde OC; permisos + entitlement + deploy.
- NO (futuro): múltiples almacenes/ubicaciones, lotes/vencimientos, transferencias entre almacenes,
  producción/mermas complejas, valuación FIFO/LIFO (usamos costo promedio ponderado).

## Anti-doble-conteo / precisión de plata
- El **gasto** es el único que mueve plata (caja/contabilidad). La OC y la recepción NO mueven plata: son
  documentos + stock. El gasto se genera UNA vez por OC facturada (dedup por `source`+`sourceId`).
- El **stock** se mueve por movimientos idempotentes (dedup por `source`+`sourceId`): una recepción suma una
  vez, una venta descuenta una vez.
- Valuación = costo promedio ponderado, recalculado en cada entrada con costo.

## Rollback
Módulos aditivos y aislados: desregistrar `InventarioModule`/`ComprasModule` + conectores y dropear las tablas
nuevas no toca ninguna tabla financiera existente. Conectores best-effort (un movimiento de stock que falla no
rompe la venta ni el gasto). Se apaga por entitlement de plan sin desplegar.
