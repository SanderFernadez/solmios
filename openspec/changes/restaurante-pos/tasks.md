# Tasks: restaurante-pos

> Cada sprint (`## <ID> — título`) se sube a GitLab como un Issue. Los checkboxes son sub-tareas.
> Orden: **infra → carta → mesas/comandas → KDS → cuenta/cobro → contabilidad/caja → frontend → gate**.
> Dependencias con `⟵ dep: <ID>`. In-house, `OrmRepository<T>`, sin SQL crudo en services, impuesto/moneda de config.

---

## RES-0 — Schema ORM + módulo `restaurant` base + wiring  ✅ HECHO (commit 0ad4633) ⟵ infra
- [x] 0.1 Estructura canónica (index/model/service/controller/types/sockets/validators/tests) — calcada de accounting
- [x] 0.2 `model.ts`: 6 modelos ORM `restaurant_stations`, `menu_categories` (con `stationId`), `menu_items`
      (con `stationId?` override), `restaurant_tables`, `restaurant_orders`, `restaurant_order_items`
      (con `stationId`/`stationName` snapshot) — inglés, `hotelId` indexed, booleanos INTEGER
- [x] 0.3 Registrar en `composition-root.ts` (import + array `mods`) — hunks quirúrgicos (evitar sesión paralela)
- [x] 0.4 `RUN_MIGRATE` crea las 6 tablas (verificado SQLite; PG por deploy en RES-8)
- [x] 0.5 Permiso `restaurant:*` en `shared/permissions.ts` (MODULES + hotel_admin completo + receptionist view/create).
      ⚠️ `MODULE_ACTIONS.restaurant` queda sin commitear (bloque de la sesión paralela, ver #520)
- [x] 0.6 Clave `restaurant` en `admin/usecases/modules.ts` (entitlement) + `moduleGuard('restaurant')` en rutas
- [x] 0.7 CRUD de estaciones (primer vertical): pantallas KDS configurables, ownership + hotelId del JWT, 7 tests
- **Aceptación:** ✅ `arckode analyze` sin violaciones · 6 tablas creadas · typecheck limpio · módulo carga · 7 tests verdes.

## RES-1 — Estaciones + Carta / Menú  ✅ HECHO (commit 208c573) ⟵ dep: RES-0
- [x] 1.0 CRUD `restaurant_stations` (pantallas configurables) — hecho en RES-0
- [x] 1.1 CRUD `menu_categories` con `stationId` (ruteo a estación), `sortOrder`, `active` (`usecases/categories-crud.ts`)
- [x] 1.2 CRUD `menu_items` con `price` neto, `taxRate?`, `stationId?` (override), `available` (`usecases/items-crud.ts`)
- [x] 1.3 `PUT /menu-items/:id/availability` (86' rápido; fija o invierte)
- [x] 1.4 Reglas: item sin categoría válida → 400; no borrar categoría con ítems → 409; impuesto de config si taxRate null;
      `stationId` (categoría/ítem) del mismo hotel o null (QA M1/M2: `''` des-rutea → null, no referencia colgante)
- [x] 1.5 Tests + validación taxRate/precio ≥ 0 · IDOR en mutaciones (25 tests totales)
- **Aceptación:** ✅ estaciones configurables + carta editable; ruteo por categoría; impuesto NO hardcodeado; analyze ✅; 25 tests.

## RES-2 — Mesas + salón  ✅ HECHO (commit 208c573) ⟵ dep: RES-0
- [x] 2.1 CRUD `restaurant_tables` (name, zone, capacity ≥ 0, status ∈ free|occupied|reserved) (`usecases/tables-crud.ts`)
- [~] 2.2 Estado free/occupied/reserved: el CRUD lo setea; la sincronía automática mesa↔comanda abierta se aplica en RES-3
- [~] 2.3 Una mesa, una comanda abierta / cancelar libera la mesa → RES-3 (al abrir/cerrar comandas)
- [x] 2.4 Tests: alta/edición, status inválido rechazado, IDOR
- **Aceptación:** ✅ salón operable (CRUD); la consistencia con comandas se cierra en RES-3.

## RES-3 — Comandas (órdenes + líneas)  ✅ HECHO (commit f279cf5) ⟵ dep: RES-1, RES-2
- [x] 3.1 Abrir comanda (dine_in/room_service/takeaway) con validación de `tableId`/`reservationId` por tipo (`usecases/orders.ts`)
- [x] 3.2 Agregar/editar/borrar líneas con snapshot name/unitPrice/**taxRate**/estación; `quantity`≥1; recálculo server subtotal/tax/total (`usecases/order-lines.ts` + `order-totals.ts`)
- [x] 3.3 `number` correlativo por hotel (`usecases/order-number.ts`, counter en `configuration` — misma convención que invoice-number)
- [x] 3.4 `POST /:id/send` (open→sent, emite `onOrderSent`); líneas bloqueadas en `charged/paid/cancelled`; `cancel` libera mesa (`restaurant:delete`)
- [x] 3.5 `waiterId` = users.id (por defecto quien abre); nombre se resuelve por `/usuarios` en el frontend (RES-7)
- [x] 3.6 Tests (38 totales): apertura por tipo, doble-comanda rechazada, snapshot, totales+impuesto, cancel libera mesa, IDOR mutaciones, updateLine/removeLine recompute
- [x] 3.7 Resolución de estación por línea (item→categoría→1ª activa) — snapshot `stationId`/`stationName`
- **Aceptación:** ✅ ciclo hasta `sent`; totales confiables (impuesto de config, no hardcode); multi-tenant con assertOwnership; QA adversarial sin críticos/altos.

## RES-4 — KDS (pantalla de cocina, por estación)  ⟵ dep: RES-3
- [ ] 4.1 `GET /kds?station=<stationId>` — líneas activas de ESA pantalla, FIFO por hotel (cada estación su cola)
- [ ] 4.2 `PUT /kds/lines/:id` — transiciones new→preparing→ready→served (+cancelled); rechazar saltos inválidos
- [ ] 4.3 Estado agregado de la orden recalculado al cambiar línea (ready/served)
- [ ] 4.4 Eventos socket `order.sent`/`line.status_changed`; endpoint resiliente sin socket (polling fallback)
- [ ] 4.5 Ruteo por `line.stationId` (snapshot); fallback "Sin estación" si el hotel no tiene ninguna
- [ ] 4.6 Tests: cola por estación (bar vs cocina), transiciones válidas/inválidas, agregado de orden, multi-tenant
- **Aceptación:** la cocina ve y avanza líneas en vivo; ninguna comanda se pierde.

## RES-5 — Cuenta + cobro (billing & settlement)  ⟵ dep: RES-3
- [ ] 5.1 `POST /:id/bill` — recálculo server de subtotal/tax + propina; orden→`billed`
- [ ] 5.2 `POST /:id/charge-to-room` — connector `restaurante-folios`: resolver folio por `reservationId` (patrón
      settle-folio-at-checkout) → `folios.postCharge(category:'restaurant', source:'pos')`; orden→`charged`, mesa→free
- [ ] 5.3 `POST /:id/pay` — connector `restaurante-payments`: `payments.createPayment(type:'charge', completed)`;
      orden→`paid`, mesa→free; rechazar cash sin turno de caja
- [ ] 5.4 `settlement` = folio XOR payment; idempotencia: re-liquidar → 409
- [ ] 5.5 Conectores best-effort para el asiento; cambio de estado de orden atómico
- [ ] 5.6 Tests: cargo a folio crea folio_charge y NO payment; cobro directo crea payment y entra a caja; doble
      cobro rechazado; propina sin impuesto; cliente sin reserva → charge-to-room rechazado
- **Aceptación:** las dos vías de cobro funcionan, mutuamente excluyentes, sin doble cobro.

## RES-6 — Contabilidad del POS (reconocimiento de ingreso)  ⟵ dep: RES-5
- [ ] 6.1 Agregar cuenta `Ventas Restaurante` (+ contrapartida ITBIS por pagar) al plan base sembrado
      (`accounting/usecases/seed-chart-of-accounts.ts`) y a `account-codes.ts`
- [ ] 6.2 Connector `restaurante-accounting.ts` (setSockets): `onOrderPaid` (venta directa) → reconoce ingreso
      neto + ITBIS **sin** re-mover Caja (payments-accounting ya lo hizo) — regla anti-doble-conteo
- [ ] 6.3 Verificar que `charge-to-room` NO genera asiento del POS (lo hace folios-accounting) — no doblar
- [ ] 6.4 Registrar el connector en `composition-root.ts`; self-gating si el hotel no tiene plan de cuentas
- [ ] 6.5 Tests de integración: venta directa asienta ingreso una vez; venta a folio asienta por folios; caja no se dobla
- **Aceptación:** cada venta se cuenta UNA vez; comprobación contable cuadra; caja no se dobla.

## RES-7 — Frontend POS  ⟵ dep: RES-1..RES-6
- [ ] 7.1 `RestaurantService` (API client, sin fetch en componentes) + tipos en `types/`
- [ ] 7.2 `pages/restaurante/carta.vue` (carta admin) · `salon.vue` (mapa de mesas)
- [ ] 7.3 `pages/restaurante/comanda.vue` (toma de comanda: carta + líneas + total en vivo + enviar a cocina)
- [ ] 7.4 `pages/restaurante/cocina.vue` (KDS por estación, tablet, auto-refresh)
- [ ] 7.5 `pages/restaurante/cobrar.vue` (desglose + propina + cargar a habitación | cobro directo)
- [ ] 7.6 Rutas en `router/index.ts` (/panel/restaurante/*) + `module-map.ts` (ROUTE_TO_KEY/PERMISSION) + menú en `AdminLayout.vue`
- [ ] 7.7 `bun run typecheck` (vue-tsc -b) + `bun run build` limpios
- **Aceptación:** flujo completo usable desde el panel; español; sin `<a>` internos; nombres por `/usuarios`.

## RES-8 — Permisos + entitlement + gate final  ⟵ dep: RES-7
- [ ] 8.1 Verificar `moduleGuard('restaurant')` en todas las rutas; permiso `restaurant:*` en la matriz de roles
- [ ] 8.2 Entitlement: `restaurant` en `plans.modules` del/los plan(es) que lo incluyan; toggle admin ON/OFF probado
- [ ] 8.3 Gate: `arckode analyze` 0 violaciones · `bun test` backend · `bun run typecheck`+`build` frontend
- [ ] 8.4 Deploy: RUN_MIGRATE (5 tablas) + `UPDATE roles.permissions` (3 pasos, ver memoria) + verificación en vivo
- [ ] 8.5 Actualizar `mapa-modulos.html` (nodo restaurante + edges a folios/payments/accounting) + memoria
- **Aceptación:** desplegado, controlable desde admin, permisos creables, verificado end-to-end en prod.

---

## Diagrama de fases

```
RES-0 (infra)
  ├─ RES-1 (carta) ──┐
  ├─ RES-2 (mesas) ──┴─ RES-3 (comandas) ──┬─ RES-4 (KDS)
  │                                         └─ RES-5 (cuenta/cobro) ── RES-6 (contab)
  └───────────────────────────────────────────────────────────────── RES-7 (frontend) ── RES-8 (gate/deploy)
```
