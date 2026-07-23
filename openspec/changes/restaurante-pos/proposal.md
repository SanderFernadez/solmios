# Change Proposal: restaurante-pos

## Summary

Agregar un **POS de restaurante completo** al PMS: carta/menú con categorías, **gestión de mesas**,
**comandas** (órdenes por mesa / room service / para llevar), **pantalla de cocina (KDS)**, y **cuenta**
con división, propina y dos vías de cobro — **cargo a la habitación** (folio del huésped) o **cobro
directo** (efectivo/tarjeta). Construido in-house sobre `arckode-framework`, integrado a la
infraestructura financiera existente (`folios`, `payments`, `accounting`, `cash`/caja) **vía conectores**,
sin duplicar la fuente de verdad del dinero ni romper la contabilidad recién desplegada.

> **Decisión de alcance (confirmada con el dueño):** **POS completo** (carta + mesas + comandas + KDS +
> cuenta/split/propina + cargo a habitación o cobro directo + cierre de caja). No es un room-service simple.

## Motivation

Un hotel con restaurante hoy **no tiene forma de operarlo dentro del PMS**: no hay carta, ni mesas, ni
comandas, ni una manera estructurada de que un consumo del huésped caiga en su cuenta de habitación. El
mapeo del código lo confirma — **no existe ningún módulo, tabla, ruta ni página de restaurante/POS**
(las coincidencias `restaurant`/`kitchen` son una amenity del hotel y un área de housekeeping, no un POS).

Lo que sí existe y este cambio **reutiliza** (no reinventa):

| Necesidad | Estado actual | Este cambio |
|-----------|---------------|-------------|
| Cargar un consumo a la habitación del huésped | ✅ `POST /api/folios/:id/charges` + `onFolioCharged` | **Reutiliza** — el POS postea cargos vía `folios.postCharge` |
| Resolver el folio abierto de una reserva | ✅ patrón `settle-folio-at-checkout.ts` (list open → open si no hay) | **Reutiliza** — mismo patrón por `reservationId` |
| Cobrar efectivo/tarjeta | ✅ `POST /api/payments` + `onPaymentCompleted` | **Reutiliza** — cobro directo del POS |
| Asiento contable del cobro / del cargo | ✅ `payments-accounting` + `folios-accounting` (setSockets) | **Reutiliza** — la contabilidad se engancha sola |
| Arqueo de caja por turno | ✅ módulo `cash` / `finance.caja` | **Reutiliza** — el cobro directo del POS entra al turno |
| Impuestos (ITBIS) | ✅ `configuration('taxes')` + `taxRateFor` | **Reutiliza** — el POS NO hardcodea impuesto |
| Carta / mesas / comandas / KDS / cuenta | ❌ no existe | **NUEVO** — módulo `restaurant` |

### Por qué la integración financiera es (casi) gratis

El POS **no reimplementa** dinero ni contabilidad. Tiene exactamente **dos salidas** y ambas ya tienen
su cañería:

1. **Cargo a habitación** → `folios.postCharge({ description, amount, quantity, category:'restaurant', source:'pos' })`.
   El folio se resuelve por `reservationId` (huésped hospedado). El asiento contable lo dispara el evento
   `onFolioCharged` que **ya existe** (`folios-accounting.ts`).
2. **Cobro directo** → `payments.createPayment({ type:'charge', method, status:'completed', amount })`.
   El asiento + el arqueo de caja los disparan `onPaymentCompleted` que **ya existen**
   (`payments-accounting.ts`, `payments-caja`).

Lo único contable **nuevo** es el **reconocimiento del ingreso de una venta pagada al instante sin pasar
por folio** (una comida que se paga en efectivo en el mostrador): ahí el cobro mueve la caja pero el
ingreso de "Ventas Restaurante" hay que reconocerlo. Se resuelve con un connector `restaurante-accounting`
que registra la venta (neto + ITBIS) como ingreso — **cuidando el bug histórico del doble conteo**
(ver design.md, "Reconocimiento de ingreso").

## Principio de integración (no negociable)

> El POS **nunca** mueve plata por su cuenta: delega en `folios` (devengado del huésped) o en `payments`
> (cobrado). **Nunca** suma su propio total al de folios/payments — sería doble conteo. La venta es UNA:
> o es un cargo al folio, o es un pago directo, jamás las dos.

- **Nunca import directo entre módulos** → todo por conectores en `src/connectors/` (patrón `setDeps` para
  puertos, `setSockets` para eventos).
- **Nunca SQL crudo en services** → `OrmRepository<T>`.
- **Nunca controller sin `validateSchema()`** en POST/PUT/PATCH.
- **Nunca `findById` sin `auth.assertOwnership()`** después (multi-tenant por `hotelId`, forzado desde el JWT).
- **Impuesto, moneda y nombre del hotel** salen de `configuration`/`hotels` — **jamás hardcodeados**.
- **Idempotencia**: settle de una orden es **una sola vez**; re-settle rechazado (orden ya `paid`/`charged`).

## Scope

**Incluye:** carta (categorías + ítems con precio/impuesto/disponibilidad/estación), mesas (zonas + estado),
comandas (líneas con notas/modificadores + estados), KDS (líneas por estación en tiempo real), cuenta
(total + split + propina), cobro (cargo a folio | efectivo/tarjeta), integración caja + contabilidad,
frontend POS (carta admin, mapa de mesas, toma de comanda, KDS, pantalla de cobro), permisos + entitlement + menú.

**NO incluye (out of scope):** inventario/receta/costeo de insumos (food cost), compras a proveedores del
restaurante (reusa `gastos`/`treasury` si hace falta), reservas de mesa online del huésped, delivery con
terceros (Uber Eats/PedidosYa), impresión térmica física de comandas (se contempla el endpoint, no el driver
de hardware), y multi-moneda en la cuenta.

## Rollback

Módulo **aditivo y aislado**: desregistrar `RestaurantModule` + sus 2 conectores en `composition-root.ts`
y dropear las tablas nuevas (`menu_categories, menu_items, restaurant_tables, restaurant_orders,
restaurant_order_items`) **no toca ninguna tabla financiera existente**. Los conectores son best-effort
(un asiento que falla no afecta el cobro/cargo real). Se apaga por entitlement de plan sin desplegar.

## MisterPlan

Equivalente MisterPlan: módulo **Restaurante / TPV** (carta, salón/mesas, comandas, cocina, cuenta).
