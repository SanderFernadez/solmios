# Tasks: Carta del restaurante — experiencia avanzada

Fuente de verdad: `proposal.md` + `specs/menu-*/spec.md` (F1-F8, completos y auditados) +
`design.md` (14 Architecture Decisions D1-D14, riesgos R1-R4, diagrama de secuencia,
migraciones). Este archivo NO reinterpreta ninguna decisión ya tomada — solo la
descompone en pasos ejecutables.

**Orden de implementación OBLIGATORIO: F0 → F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8**
(igual al orden de `design.md`, sección "Orden de implementación de las 8 fases").
Dependencias duras (no de conveniencia):
- **F3** (mitad combo) y **F4** (mitad combo) requieren **F2 aplicado** (tabla `menu_combos`
  ya creada) antes de agregarles food-cost/`translations`.
- **F0** (rate-limit extendido) es prerequisito de **F7** (lo consume su rate-limit propio).
- El resto es secuenciable por conveniencia (menos retrabajo), no por bloqueo técnico —
  ver `design.md` para el detalle completo.

Cada fase termina con un **Gate de verificación obligatorio** (`bun run typecheck` +
`arckode analyze` 0 violaciones en backend, `bun run typecheck` + `bun run build` en
frontend) — no solo al final del change, por fase, tal como exige `design.md` sección
"Testing Strategy" y `openspec/config.yaml`.

---

## F0 — Infraestructura compartida: `rateLimit()` extensible (hallazgo D13, prerequisito de F7)

### Backend

- [x] 0.1 Extender la firma de `rateLimit()` en
      `backend/src/shared/middlewares/rate-limit.ts` a
      `rateLimit(key: string, opts?: { maxAttempts?: number; windowMs?: number }): { allowed: boolean; retryAfter?: number }`.
      Usar `opts?.maxAttempts ?? MAX_ATTEMPTS` y `opts?.windowMs ?? WINDOW_MS` como
      defaults; `MAX_ATTEMPTS=20`/`WINDOW_MS=5*60_000` quedan como constantes de
      fallback, no se borran. `recordFailedAttempt`/`resetAttempts`/`getClientIp` no
      cambian.
      **Acceptance**: `rateLimit(key)` (sin segundo argumento) se comporta
      IDÉNTICO a hoy — mismo `MAX_ATTEMPTS`/`WINDOW_MS` compartido por key. Llamar
      `rateLimit(key, { maxAttempts: 3 })` permite 3 intentos para esa key
      independientemente de cualquier otra key en 20/5min.

- [x] 0.2 Test de regresión nuevo: `backend/src/shared/tests/rate-limit-opts.test.ts`
      (no reusar `rate-limit-clientip.test.ts`, que testea `getClientIp` — dominio
      distinto). Cubrir, llamando `rateLimit()` directo (sin pasar por HTTP):
      1. Sin `opts`: 20 llamadas con la misma key permiten, la 21ª devuelve
         `allowed:false` con `retryAfter` — reproduce el comportamiento de los
         **6 call-sites reales** de `backend/src/modules/usuarios/index.ts` que hoy
         llaman `rateLimit(key)` sin segundo argumento: `login:{ip}` (línea 51),
         `verify-email:{ip}` (línea 77), `resend-verif:{userId|ip}` (línea 82),
         `forgot-password:{ip}` (línea 93), `reset-password:{ip}` (línea 101),
         `create-user:{ip}` (línea 123).
      2. Con `opts={maxAttempts:120, windowMs:300000}`: una key distinta permite 120
         intentos antes de bloquear, SIN afectar el contador de ninguna key sin
         `opts` (buckets independientes por key, ya lo son hoy — el test lo confirma
         explícito tras el cambio de firma).
      3. Ventana expira: tras `windowMs`, el contador resetea (mismo criterio ya
         implementado, no debe romperse).
      **Acceptance**: `bun test backend/src/shared/tests/rate-limit-opts.test.ts` pasa;
      ninguna aserción depende de mockear `Date.now()` con librerías nuevas (usar el
      mismo patrón que el resto de `shared/tests/`).
      > Nota: el design.md y el prompt original de esta tarea mencionan "5
      > call-sites" — el código real (`usuarios/index.ts`) tiene **6**
      > (agrega `resend-verif`, línea 82, que el propio design.md no lista pero
      > SÍ usa `rateLimit(key)` sin `opts`). El test cubre los 6, no 5, para no dejar
      > un call-site real sin cubrir.

### Gate F0

- [x] 0.3 `cd backend && bun run typecheck` (0 errores) + `bun run node_modules/arckode-framework/bin/arckode.js analyze`
      (✅ VÁLIDO, 0 violaciones) + `bun test src/shared/tests/rate-limit-opts.test.ts` (verde).
      **Acceptance**: los tres comandos devuelven éxito antes de tocar F7.

---

## F1 — Modificadores/variantes

### Backend

- [x] 1.1 `backend/src/modules/restaurant/model.ts`: agregar `MenuItemModifierGroupModel`
      (tabla `menu_item_modifier_groups`: `id, hotelId, menuItemId, name, selectionType
      default 'single', required default 0, minSelect default 1, maxSelect nullable,
      sortOrder default 0` + timestamps) y `MenuItemModifierModel` (tabla
      `menu_item_modifiers`: `id, hotelId, groupId, name, priceDelta default 0,
      inventoryItemId nullable, inventoryQuantity nullable, active default 1, sortOrder
      default 0` + timestamps). Agregar columna `modifiers` (`type:'json'`, nullable) a
      `RestaurantOrderItemModel`. Registrar ambos modelos nuevos en
      `registerRestaurantModels(orm)`.
      **Acceptance**: `RUN_MIGRATE=1 bun run src/composition-root.ts` (dev SQLite) crea
      las 2 tablas nuevas y agrega la columna `modifiers` sin error; filas existentes de
      `restaurant_order_items` quedan con `modifiers=null`.

- [x] 1.2 `backend/src/modules/restaurant/validators/schema.ts`: agregar
      `CreateModifierGroupSchema`/`UpdateModifierGroupSchema`
      (`name, selectionType, required?, minSelect?, maxSelect?, sortOrder?`) y
      `CreateModifierSchema`/`UpdateModifierSchema`
      (`name, priceDelta, inventoryItemId?, inventoryQuantity?, active?, sortOrder?`).
      Extender `AddLineSchema` con `modifiers?: { type: 'array' }` (array de
      `{ modifierId: string }`).
      **Acceptance**: un `POST /modifier-groups` sin `name` responde 400; un
      `POST /orders/:id/items` con `modifiers` bien formado pasa el validator sin tocar
      `menuItemId: { required: true }` (eso lo toca F2, no esta tarea).

- [x] 1.3 Crear `backend/src/modules/restaurant/usecases/modifiers-crud.ts`: CRUD de
      grupos y opciones (`listGroups`, `createGroup`, `updateGroup`, `deleteGroup`
      cascada sobre sus opciones, `createModifier`, `updateModifier`, `deleteModifier`).
      Ownership: TODO `findById` de grupo/opción se resuelve con `findOne({id})` +
      `auth.assertOwnership(...)` (mismo patrón que `items-crud.ts:assertCategory`),
      NUNCA `findById` crudo sin ownership. `menuItemId`/`groupId` referenciados se
      validan `findOne({id})` + `hotelId` igual que `assertCategory`.
      **Acceptance**: crear un grupo para un `menuItemId` de OTRO hotel responde 400
      ("El ítem no existe o es de otro hotel"); borrar un grupo borra sus opciones en la
      misma operación.

- [x] 1.4 `backend/src/modules/restaurant/usecases/order-lines.ts`: `addLine` valida,
      por cada `modifierId` recibido en `dto.modifiers`: la opción existe, pertenece a
      un grupo del `menuItemId` de la línea y al mismo hotel (`findOne+assertOwnership`),
      y se cumple `required`/`minSelect`/`maxSelect` de CADA grupo del ítem antes de
      crear la fila (grupo `required` sin selección → `ValidationError` 400, línea NO se
      crea). `lineTotal = round2((unitPrice + Σ priceDelta elegidos) × quantity)`. El
      snapshot en `modifiers` (columna JSON de la fila) incluye
      `{ groupId, groupName, modifierId, name, priceDelta }` por opción — NO se crean
      filas adicionales en `restaurant_order_items`.
      **Acceptance**: cubre los 3 scenarios de "Grupos de modificadores por ítem" +
      los 2 de "Opciones con impacto en precio" de `specs/menu-modifiers/spec.md`
      (grupo obligatorio bloquea, grupo opcional no bloquea, `priceDelta` negativo
      resta del total).

- [x] 1.5 `backend/src/modules/inventario/usecases/recipes.ts`: nueva función
      `consumeForSaleWithModifiers(deps, line, user)` que recibe la línea completa,
      parsea `line.modifiers` (JSON) y, por cada modificador con `inventoryItemId`
      declarado, descuenta `inventoryQuantity` con
      `source:'pos_sale'`, `sourceId: '${lineId}:${modifierId}:${inventoryItemId}'`
      (distinto del `sourceId` de receta base `${lineId}:${inventoryItemId}` — no
      colisiona con la dedup existente). Best-effort: un fallo de descuento nunca
      lanza hacia arriba (mismo criterio que `consumeForSale`).
      **Acceptance**: reintentar la liquidación (evento `onOrderPaid` duplicado) NO
      duplica el movimiento de stock del modificador (dedup por `source`+`sourceId`);
      un modificador sin `inventoryItemId` no genera ningún movimiento adicional.

- [x] 1.6 `backend/src/connectors/restaurante-inventario.ts`: en `consumeOrder`, después
      de `consumeForSale` por línea, llamar también
      `inv.consumeForSaleWithModifiers({ hotelId: order.hotelId, line: l }, sys)` si
      `l.modifiers` no es null. El conector sigue siendo un loop tonto — la lógica de
      parseo vive en `inventario/usecases/recipes.ts` (regla "connector solo DELEGA vía
      sockets", ya citada en `specs/menu-modifiers/spec.md`).
      **Acceptance**: grep de `restaurante-inventario.ts` confirma que NO hay ningún
      `JSON.parse`/`for (... of ... modifiers)` inline en el conector.

- [x] 1.7 `backend/src/modules/restaurant/service.ts`: agregar repos de
      `menuItemModifierGroups`/`menuItemModifiers` al constructor de `RestaurantService`,
      método `modifierDeps()` (mismo patrón que `catDeps()`/`itemDeps()`), y delegar
      `listModifierGroups/createModifierGroup/updateModifierGroup/deleteModifierGroup/
      createModifier/updateModifier/deleteModifier` a `modifiers-crud.ts`.
      **Acceptance**: `RestaurantService` expone los 7 métodos nuevos sin romper ningún
      método existente (compila, `bun run typecheck` limpio).

- [x] 1.8 `backend/src/modules/restaurant/controller.ts` + `index.ts`: agregar rutas
      (permisos EXACTOS de `specs/menu-modifiers/spec.md`, sección API):
      `GET /api/restaurant/menu-items/:menuItemId/modifier-groups` (`restaurant:view`),
      `POST` mismo path (`restaurant-catalog:create`),
      `PUT /api/restaurant/modifier-groups/:id` (`restaurant-catalog:edit`),
      `DELETE /api/restaurant/modifier-groups/:id` (`restaurant-catalog:delete`),
      `POST /api/restaurant/modifier-groups/:groupId/modifiers` (`restaurant-catalog:create`),
      `PUT /api/restaurant/modifiers/:id` (`restaurant-catalog:edit`),
      `DELETE /api/restaurant/modifiers/:id` (`restaurant-catalog:delete`). `index.ts`
      sigue APPEND-ONLY (no tocar exports/rutas existentes).
      **Acceptance**: mesero (rol `waiter`, solo `restaurant:*`) recibe 403 en
      `POST /modifier-groups`; `hotel_admin` (con `restaurant-catalog:create`) recibe 201.

- [x] 1.9 Tests: `backend/src/modules/restaurant/tests/modifiers-crud.test.ts` (CRUD +
      ownership cross-hotel rechazado) y extender
      `backend/src/modules/restaurant/tests/service.test.ts` (o archivo nuevo
      `order-lines-modifiers.test.ts`) con: precio final con modificador (250+50)×2=600,
      modificador negativo resta, grupo required sin selección rechaza 400, editar/borrar
      modificador después de vendido no cambia el snapshot de la línea ya creada.
      Test en `inventario/tests/` para `consumeForSaleWithModifiers` (descuenta insumo
      extra, dedup en reintento, modificador sin insumo no descuenta nada).
      **Acceptance**: `bun test` verde en los 3 archivos, cubre los 8 scenarios de
      `specs/menu-modifiers/spec.md`.

### Frontend

- [x] 1.10 `frontend/src/services/Restaurant.service.ts`: agregar tipos
      `ModifierGroup { id, hotelId, menuItemId, name, selectionType, required, minSelect,
      maxSelect, sortOrder }`, `Modifier { id, hotelId, groupId, name, priceDelta,
      inventoryItemId, inventoryQuantity, active, sortOrder }`, extender
      `AddLineInput`/línea de comanda con `modifiers?: { modifierId: string }[]` y el
      snapshot `{ groupId, groupName, modifierId, name, priceDelta }[]`; agregar los 7
      métodos de API (`listModifierGroups`, `createModifierGroup`, etc.).
      **Acceptance**: `bun run typecheck` (vue-tsc -b) sin errores de tipos nuevos.

- [x] 1.11 `frontend/src/pages/restaurante/carta.vue`: sección/tab "Modificadores" en el
      editor de ítem (reusa `AppModal`/`SectionCard`) — crear grupos
      (nombre + `selectionType` + `required`) y sus opciones (nombre + `priceDelta` +
      insumo opcional).
      **Acceptance**: crear un grupo "Tamaño" con 2 opciones desde la UI y verlo
      reflejado tras recargar (persistencia real, no solo estado local).

- [x] 1.12 `frontend/src/pages/restaurante/comanda.vue`: al tocar un ítem con grupos
      configurados, abrir selector (radio `single` / checkbox `multiple`) ANTES de
      agregar la línea; grupos `required` bloquean el botón "Agregar" hasta
      completarse. La línea agregada muestra "Hamburguesa (Grande, +tocino)" con el
      precio ya ajustado. Ticket del KDS (vía `kds.ts` DTO, ya viaja en `modifiers`)
      muestra los modificadores junto al nombre del plato.
      **Acceptance**: agregar "Hamburguesa" sin elegir el grupo `required` "Tamaño"
      muestra el error del backend sin crear la línea; eligiendo "Grande" el total
      mostrado en la comanda es 300 (con quantity 1).

### Gate F1

- [x] 1.13 `cd backend && bun run typecheck && bun run node_modules/arckode-framework/bin/arckode.js analyze && bun test` (0 errores, ✅ VÁLIDO, tests verdes);
      `cd frontend && bun run typecheck && bun run build` (0 errores, build ✓ built).
      **Acceptance**: los 4 comandos en verde antes de empezar F2.

---

## F2 — Combos/paquetes

### Backend

- [x] 2.1 `backend/src/modules/restaurant/model.ts`: agregar `MenuComboModel` (tabla
      `menu_combos`: `id, hotelId, name, description nullable, price, taxRate nullable,
      imageUrl nullable, available default 1, sortOrder default 0` + timestamps) y
      `MenuComboItemModel` (tabla `menu_combo_items`:
      `id, hotelId, comboId, menuItemId, quantity default 1, sortOrder default 0` +
      timestamps). Agregar a `RestaurantOrderItemModel`: `kind` (`type:'string'`,
      default `'item'`), `comboId` (nullable, indexed), `parentLineId` (nullable,
      indexed). Registrar ambos modelos nuevos.
      **Acceptance**: filas `restaurant_order_items` PRE-existentes quedan con
      `kind='item'` tras el `ADD COLUMN` (retrocompat sin migración de datos manual).

- [x] 2.2 `backend/src/modules/restaurant/validators/schema.ts`: agregar
      `CreateComboSchema`/`UpdateComboSchema`
      (`name, description?, price, taxRate?, imageUrl?, available?, sortOrder?,
      items: [{menuItemId, quantity, sortOrder?}]`). **Cambiar `AddLineSchema.menuItemId`
      de `{ required: true }` a condicional** (solo valida `type:'string'` si viene, sin
      `required`) y agregar `comboId?: { type: 'string' }` — el schema NO puede expresar
      XOR entre los dos campos, esa regla vive en el usecase (D3 de `design.md`).
      **Acceptance**: un `POST /orders/:id/items` con SOLO `comboId` (sin `menuItemId`)
      ya NO es rechazado por el validator (pasa al usecase, que decide).

- [x] 2.3 Crear `backend/src/modules/restaurant/usecases/combos-crud.ts`: CRUD de
      combos (`listCombos`, `getCombo`, `createCombo`, `updateCombo` — reemplaza
      `items` completo si viene —, `deleteCombo`). Cada `menuItemId` de `items` se
      valida `findOne({id})` + `hotelId` igual (rechaza componente de otro hotel, 400).
      **Acceptance**: crear un combo con un componente de otro hotel responde 400
      ("El ítem no existe o es de otro hotel"), el combo NO se crea.

- [x] 2.4 `backend/src/modules/restaurant/usecases/order-lines.ts` — cambios en `addLine`:
      1. Validar EXACTAMENTE uno de `menuItemId`/`comboId` presente (nunca ambos, nunca
         ninguno) → `ValidationError` 400 si se incumple.
      2. **Si `dto.comboId` está presente Y `dto.modifiers` también viene poblado →
         rechazar con `ValidationError` 400** ("Los modificadores no están permitidos
         dentro de un combo") — prohibición total decidida en `design.md` (no la
         variante condicional `priceDelta=0`). Ningún componente de combo acepta
         `modifiers` nunca, sin excepción.
      3. Camino combo: resolver combo+componentes vía `combos-crud`, crear fila
         **header** (`kind:'combo_header'`, `comboId`, `menuItemId:null`, `name`=combo,
         `unitPrice`=precio combo, `stationId:null`, `lineTotal=unitPrice×quantity`) y
         una fila **component** por cada componente (`kind:'combo_component'`,
         `parentLineId`=id del header, `menuItemId`=componente, `quantity=componente.qty
         × quantity del combo`, `unitPrice:0`, `lineTotal:0`, `taxRate:0`,
         `stationId`/`stationName` resueltos con el MISMO `resolveStation()` que una
         línea normal — sin cambios ahí).
      4. `updateLine`: sobre una fila `combo_header`, recalcular cantidad + `lineTotal`
         del header Y multiplicar `quantity` de TODAS sus filas `combo_component`
         (mismo `parentLineId`) en la misma operación.
      5. `updateLine`/`removeLine` sobre una fila `combo_component` DIRECTA (sin pasar
         por su header) → rechazar 400 ("Esta línea pertenece a un combo; editá el
         combo completo").
      6. `removeLine` sobre un `combo_header` → borra el header Y todas sus
         `combo_component` en la misma operación.
      **Acceptance**: cubre los 3 scenarios de "Venta del combo..." + los 3 de
      "Edición y baja..." de `specs/menu-combos/spec.md` (1 header + N componentes,
      multiplicador de cantidad ×2, cambiar quantity del header propaga a componentes,
      borrar header borra todo, editar componente directo rechaza).

- [x] 2.5 `backend/src/modules/restaurant/usecases/kds.ts` — **dos exclusiones
      explícitas de `kind==='combo_header'`, no una sola**:
      1. `kdsQueue` (línea ~45): reforzar explícito el filtro para excluir
         `kind==='combo_header'` (hoy se auto-excluye por no tener `stationId`, pero la
         spec pide reforzarlo por claridad, no depender del efecto colateral).
      2. `recomputeOrderStatus` (línea ~75-84): el filtro `active = all.filter(l =>
         l.status !== 'cancelled')` **debe agregar** `&& l.kind !== 'combo_header'`.
         Sin este cambio, el header queda `status:'new'` para siempre (nunca lo toca
         cocina) y `active.every(...)` nunca se cumple → la orden queda encallada en
         `'preparing'` aunque los componentes reales ya estén `served`. Este es el
         cambio de código REAL señalado por `design.md` (R1) — no cosmético.
      **Acceptance**: cubre los 3 scenarios de "El KDS excluye la fila header" de
      `specs/menu-combos/spec.md` — el header nunca aparece en `GET /kds`, y una orden
      con 2 componentes `served` + header `new` pasa a `order.status='served'`.

- [x] 2.6 `backend/src/modules/restaurant/service.ts` + `controller.ts` + `index.ts`:
      wiring de repos `menuCombos`/`menuComboItems`, método `comboDeps()`, delegar
      `listCombos/getCombo/createCombo/updateCombo/deleteCombo`, y rutas:
      `GET /api/restaurant/combos` (`restaurant:view`), `GET /api/restaurant/combos/:id`
      (`restaurant:view`), `POST /api/restaurant/combos` (`restaurant-catalog:create`),
      `PUT /api/restaurant/combos/:id` (`restaurant-catalog:edit`),
      `DELETE /api/restaurant/combos/:id` (`restaurant-catalog:delete`).
      **Acceptance**: `arckode analyze` no marca ningún `findById` sin
      `assertOwnership` posterior en las rutas nuevas.

- [x] 2.7 `backend/src/connectors/restaurante-inventario.ts`: **CERO cambios de
      código** — confirmar (no modificar) que el loop `for (const l of lines)` ya
      salta el header por `if (!l.menuItemId ...) continue` y consume cada
      `combo_component` igual que un ítem suelto (tienen `menuItemId` propio y
      `quantity` ya multiplicada).
      **Acceptance**: diff de `restaurante-inventario.ts` entre el HEAD de F1 y el
      HEAD de F2 es VACÍO (verificable con `git diff`) — si esta tarea produce un
      diff no vacío, revisar que no se esté violando D2 (lógica de explosión en el
      conector, prohibida).

- [x] 2.8 Tests: `backend/src/modules/restaurant/tests/combos-crud.test.ts` (CRUD +
      componente de otro hotel rechazado) y extender/crear
      `order-lines-combos.test.ts`: vender combo genera 1 header + N componentes con
      `lineTotal` correcto; vender 2 unidades multiplica cantidades de componentes;
      combo con `comboId`+`modifiers` juntos → 400; editar quantity del header propaga;
      borrar header borra todo; editar componente directo → 400. Extender `kds.ts`
      tests: `recomputeOrderStatus` con header `new` + componentes `served` → orden
      pasa a `served`. Test de conector (`connectors/tests/`) confirmando que un combo
      descuenta stock de cada componente con su propio `sourceId`.
      **Acceptance**: `bun test` verde, cubre TODOS los scenarios de
      `specs/menu-combos/spec.md`.

### Frontend

- [x] 2.9 `frontend/src/services/Restaurant.service.ts`: tipos `Combo { id, hotelId,
      name, description, price, taxRate, imageUrl, available, sortOrder, items:
      ComboItem[] }`, `ComboItem { id, comboId, menuItemId, quantity, sortOrder }`;
      extender `AddLineInput` con `comboId?: string`; 5 métodos de API de combos.
      **Acceptance**: `bun run typecheck` sin errores.

- [x] 2.10 `frontend/src/pages/restaurante/carta.vue`: pestaña "Combos" — alta/edición
      con selector multi-ítem + cantidad por componente.
      **Acceptance**: crear "Combo Familiar" con 3 componentes desde la UI, verlo
      persistido tras recargar.

- [x] 2.11 `frontend/src/pages/restaurante/comanda.vue`: combos listados junto a ítems
      sueltos con badge "Combo"; al agregar, una sola línea "Combo Familiar × 1 — $800"
      con componentes desplegables debajo (solo informativo). KDS agrupa
      visualmente bajo "de: Combo Familiar" (cada componente transiciona
      independiente).
      **Acceptance**: agregar un combo genera 1 línea visual en la comanda (no 4
      líneas sueltas), con los 3 componentes visibles al desplegar.

### Gate F2

- [x] 2.12 `cd backend && bun run typecheck && bun run node_modules/arckode-framework/bin/arckode.js analyze && bun test` (0 errores, ✅ VÁLIDO, tests verdes);
      `cd frontend && bun run typecheck && bun run build`.
      **Acceptance**: los 4 comandos en verde antes de empezar F3. Correr también
      `RUN_MIGRATE=1 bun run src/composition-root.ts` en dev y confirmar que
      `menu_combos`/`menu_combo_items` existen (`sqlite3 data/managerhotel.db ".tables"`
      o equivalente).

---

## F3 — Food cost visible (requiere F2 aplicado para la mitad de combos)

### Backend

- [x] 3.1 `backend/src/modules/inventario/usecases/recipes.ts`: nueva función
      `recipeCost(deps, menuItemId, user)` (junto a `listRecipes`/`consumeForSale`,
      mismo archivo) que calcula `Σ (recipe.quantity × inventoryItem.avgCost)` sobre
      `menu_item_recipes` del ítem. Devuelve `{ cost: 0, hasRecipe: false }` si no hay
      filas (no "margen 100%" falso).
      **Acceptance**: ítem con receta `[{Pan qty:1, avgCost:15}, {Carne qty:0.2,
      avgCost:200}]` → `cost=55`.

- [x] 3.2 `backend/src/modules/inventario/service.ts`: exponer `recipeCost` en la
      facade (junto a `listRecipes`), sin romper la firma de `recipesUc`.
      **Acceptance**: `InventarioService.recipeCost(menuItemId, user)` disponible para
      el conector.

- [x] 3.3 `backend/src/connectors/restaurante-inventario.ts`: **una sola línea nueva**
      — agregar `getRecipeCost: (menuItemId, user) => inventario().recipeCost(menuItemId, user)`
      al MISMO objeto que ya inyecta `setRecipePorts({ menuItemsWithRecipe: ... })`
      (D4/D das de `design.md`: extender el puerto, no crear uno paralelo). NO
      reescribir el loop de consumo existente.
      **Acceptance**: `git diff` de este archivo muestra solo la línea agregada
      dentro del objeto de `setRecipePorts`, cero cambios en `consumeOrder`.

- [x] 3.4 `backend/src/modules/restaurant/service.ts`: extender el tipo de
      `recipePorts` (línea ~24) con `getRecipeCost?: (menuItemId: string, user:
      CurrentUser) => Promise<{ cost: number; hasRecipe: boolean }>`. `setRecipePorts`
      ya soporta merge parcial vía spread (línea ~60) — no tocar esa mecánica. Si
      `recipePorts.getRecipeCost` es `undefined` (inventario no montado), el usecase de
      F3 MUST degradar con `{ cost: null, available: false }`, nunca 500.
      **Acceptance**: en un hotel sin módulo `inventario`, `GET /menu-items/:id/food-cost`
      responde `{ cost: null, available: false }` con 200, no 500.

- [x] 3.5 Crear `backend/src/modules/restaurant/usecases/food-cost.ts`:
      - `itemFoodCost(deps, menuItemId, user)`: cruza `menu_items.price` +
        `recipePorts.getRecipeCost` → `{ cost, hasRecipe, margin: price-cost,
        marginPercent: price>0 ? round2(margin/price*100) : null }`. Ítems sin receta
        se EXCLUYEN del cálculo de margen (no "0%").
      - `comboFoodCost(deps, comboId, user)`: `Σ (recipePorts.getRecipeCost(component)
        × component.quantity)` sobre `menu_combo_items` del combo — vive en
        `restaurant` (dueño de `menu_combos`), NO en `inventario` (D4). Marca
        `complete:false` si algún componente no tiene receta (aporta 0 a la suma, no
        rompe, no inventa costo).
      - `foodCostReport(deps, user)`: lista TODOS los ítems con receta + TODOS los
        combos del hotel con `{ id, kind, name, price, cost, margin, marginPercent,
        complete, hasRecipe }`, ordenado por `marginPercent` ascendente por defecto.
      **Acceptance**: cubre los 2 scenarios de "Costo de receta de un ítem simple", los
      2 de "Margen por ítem" (incluyendo margen negativo SIN truncar a 0), los 2 de
      "Food cost de un combo", y el de "Reporte ordenable" de
      `specs/menu-food-cost/spec.md`.

- [x] 3.6 `backend/src/modules/restaurant/controller.ts` + `index.ts`: rutas
      `GET /api/restaurant/menu-items/:id/food-cost`, `GET /api/restaurant/combos/:id/food-cost`
      (requiere F2), `GET /api/restaurant/food-cost/report` — TODAS con
      `guard('restaurant-catalog', 'view')` (permiso YA existente en `permissions.ts`,
      hoy sin ninguna ruta de LECTURA que lo use — F3 es su primer consumidor real, D5).
      El reporte filtra por `hotelId` del JWT, SIN parámetro `hotelId` en query.
      **Acceptance**: mesero/cocina (con `restaurant:view` pero SIN `restaurant-catalog`
      en su rol) reciben 403 en las 3 rutas nuevas — confirmar contra
      `shared/permissions.ts:198-213` (ningún rol operativo tiene
      `restaurant-catalog:view`).

- [x] 3.7 Tests: `backend/src/modules/restaurant/tests/food-cost.test.ts` — ítem con 2
      insumos, ítem sin receta (`hasRecipe:false`, excluido de margen), margen negativo
      no trunca, combo con 3 componentes costeados, combo con 1 componente sin receta
      (`complete:false`), reporte ordenado ascendente, inventario no montado
      (`{cost:null, available:false}`, sin 500).
      **Acceptance**: `bun test` verde, cubre TODOS los scenarios de
      `specs/menu-food-cost/spec.md`.

### Frontend

- [x] 3.8 `frontend/src/services/Restaurant.service.ts`: tipos `FoodCost { menuItemId?,
      comboId?, price, cost, hasRecipe?, complete?, margin, marginPercent }`,
      `FoodCostReportRow` y 3 métodos de API.
      **Acceptance**: `bun run typecheck` limpio.

- [x] 3.9 `frontend/src/pages/restaurante/carta.vue`: badge de margen junto al precio
      (línea ~373, junto a `money(i.price)`) — verde >50%, ámbar 20-50%, rojo <20% o
      negativo — visible SOLO si `editPerm` (mismo gate que "Receta"/"Editar", el
      mesero no lo ve). NO se muestra si `hasRecipe===false` (ya existe el badge "Sin
      receta", línea ~366, no duplicar la señal). En la pestaña Combos, mismo badge +
      ícono de advertencia si `complete===false`. Nueva sección "Food cost": tabla del
      reporte completo ordenada por menor margen, buscador/filtro por categoría, reusa
      `SectionCard`/`.tbl-head` (mem `admin-card-header-navy-table-light`).
      **Acceptance**: un mesero logueado (sin `restaurant-catalog:view`) NO ve el badge
      de margen ni la sección Food cost en ningún punto de `carta.vue`.

### Gate F3

- [x] 3.10 `cd backend && bun run typecheck && bun run node_modules/arckode-framework/bin/arckode.js analyze && bun test` (0 errores, ✅ VÁLIDO, tests verdes);
      `cd frontend && bun run typecheck && bun run build`.
      **Acceptance**: los 4 comandos en verde antes de empezar F4.

---

## F4 — Multi-idioma de carta (requiere F2 aplicado para `menu_combos.translations`)

### Backend

- [x] 4.1 `backend/src/modules/restaurant/model.ts`: agregar columna `translations`
      (`type:'json'`, nullable) a `MenuCategoryModel`, `MenuItemModel`, y `MenuComboModel`
      (esta última solo si F2 ya está aplicado — el ADD COLUMN corre sobre la tabla
      creada en F2.1). **`type:'json'` nativo del ORM** (D6), NO un `string`
      serializado a mano tipo `hotels.descriptionJson`.
      **Acceptance**: `RUN_MIGRATE=1` agrega las 3 columnas sin backfill; filas
      existentes quedan `translations:null`.

- [x] 4.2 `backend/src/modules/restaurant/validators/schema.ts`: extender
      `CreateCategorySchema`/`UpdateCategorySchema`, `CreateItemSchema`/`UpdateItemSchema`,
      `CreateComboSchema`/`UpdateComboSchema` con
      `translations?: { type: 'json' }` (`Record<string, {name?, description?}>` para
      ítems/combos; `Record<string, {name}>` para categorías — el modelo de categoría
      NO tiene `description`).
      **Acceptance**: el validator acepta el objeto `translations` completo sin
      rechazarlo por forma (la validación de contenido, incluida la clave `es`
      prohibida, vive en el usecase, no acá).

- [x] 4.3 `backend/src/modules/restaurant/usecases/categories-crud.ts`: `createCategory`/
      `updateCategory` aceptan `translations`; rechazan con `ValidationError` si trae
      la clave `'es'` (`"El idioma base (es) no se traduce; usá el campo name"`).
      **Acceptance**: `translations: {es: {name:'x'}}` → 400; `translations: {en:
      {name:'Appetizers'}}` → 200, categoría queda con `name` base en español intacto.

- [x] 4.4 `backend/src/modules/restaurant/usecases/items-crud.ts`: `createItem`/
      `updateItem` aceptan `translations`; rechazan clave `'es'` (mismo mensaje,
      adaptado a `name`/`description`).
      **Acceptance**: traducción parcial (`{en:{name:'Fries'}}`, sin `description`)
      persiste correctamente — el fallback campo-por-campo se resuelve en lectura (ver
      4.6), no en escritura.

- [x] 4.5 `backend/src/modules/restaurant/usecases/combos-crud.ts` (si F2 aplicado):
      `createCombo`/`updateCombo` aceptan `translations`, misma validación de clave
      `'es'` prohibida.
      **Acceptance**: combo traducido a `en` persiste `translations.en.name`.

- [x] 4.6 Helper de resolución compartido (nuevo, ej.
      `backend/src/modules/restaurant/usecases/i18n.ts`, o función interna reusada por
      `categories-crud.ts`/`items-crud.ts`/`combos-crud.ts`): `resolveTranslation(entity,
      lang)` — si `lang` es `'es'` o se omite, devuelve el valor base SIN tocar
      `translations` (fallback final SIEMPRE español, hardcodeado — D7, NO
      `hotels.baseLanguage`, esa columna no existe). Si `lang` viene y es distinto de
      `es`, resuelve CAMPO POR CAMPO: `translations[lang]?.[campo] ?? valorBase`. `GET
      /categories`, `/menu-items`, `/combos` aceptan `?lang=xx`; si se omite, el
      `translations` crudo completo viaja en el DTO (para que `carta.vue` muestre todos
      los idiomas cargados); si `lang` viene, el DTO trae `name`/`description` ya
      resueltos y NO incluye el `translations` crudo (no duplicar payload).
      **Acceptance**: cubre los 4 scenarios de "Resolución con fallback campo por
      campo" de `specs/menu-i18n/spec.md` (idioma sin traducción cae a español,
      traducción completa, `lang=es` explícito ignora el mapa, categoría traduce
      nombre).

- [x] 4.7 `backend/src/modules/restaurant/controller.ts`: pasar `req.query.lang` a
      `listCategories`/`listItems`/`listCombos` (y a los `get*` singulares) sin romper
      la firma para quien no pasa `lang` (comportamiento IDÉNTICO al actual si se
      omite).
      **Acceptance**: `GET /menu-items` sin `?lang=` devuelve exactamente el mismo
      payload que antes de F4 (mismas keys, mismo orden) — regresión cero para el POS
      actual.

- [x] 4.8 Tests: `backend/src/modules/restaurant/tests/i18n.test.ts` — traducción
      completa (`en`), traducción parcial (fallback de `description`), idioma sin
      ninguna traducción (`fr` cae a español), `lang=es` explícito ignora el mapa,
      clave `es` rechazada en categoría/ítem/combo, combo traducido junto a ítem
      traducido en la misma categoría (consistencia F7 futura).
      **Acceptance**: `bun test` verde, cubre TODOS los scenarios de
      `specs/menu-i18n/spec.md`.

### Frontend

- [x] 4.9 `frontend/src/services/Restaurant.service.ts`: agregar
      `translations?: Record<string, { name?: string; description?: string }>` a
      `MenuCategory`/`MenuItem`/`Combo`; parámetro `lang?: string` en los métodos
      `listCategories`/`listItems`/`listCombos`.
      **Acceptance**: `bun run typecheck` limpio.

- [x] 4.10 `frontend/src/pages/restaurante/carta.vue`: selector de idioma en el editor
      de categoría/ítem/combo — mismo patrón que `settings/index.vue:525-538` (pestañas
      con `●` verde en las que tienen contenido, contador "N/M idiomas completados"),
      mismos 12 idiomas de `supportedLangs` (`settings/index.vue:1464-1477`, no
      inventar lista nueva). El tab `es` NO es editable ahí (se edita en los campos
      `name`/`description` ya existentes del formulario).
      **Acceptance**: agregar traducción `en` a un ítem, verla persistida tras
      recargar, contador muestra "1/12 idiomas completados".

### Gate F4

- [x] 4.11 `cd backend && bun run typecheck && bun run node_modules/arckode-framework/bin/arckode.js analyze && bun test` (0 errores, ✅ VÁLIDO, tests verdes);
      `cd frontend && bun run typecheck && bun run build`.
      **Acceptance**: los 4 comandos en verde antes de empezar F5.

---

## F5 — Alérgenos / info dietética

### Backend

- [x] 5.1 `backend/src/modules/restaurant/types.ts`: agregar constante
      `ALLERGEN_TAGS = ['gluten', 'lactose', 'nuts', 'shellfish', 'egg', 'soy', 'spicy',
      'vegan', 'vegetarian', 'gluten_free'] as const` — catálogo FIJO en código (D8), NO
      tabla nueva, mismo patrón que `OrderType`/`LineStatus` ya existentes en ese
      archivo.
      **Acceptance**: el tipo `AllergenTag = typeof ALLERGEN_TAGS[number]` se exporta y
      es usable en `MenuItemDTO.allergens?: AllergenTag[]`.

- [x] 5.2 `backend/src/modules/restaurant/model.ts`: agregar columna `allergens`
      (`type:'json'`, nullable — array de strings) a `MenuItemModel`. **`menu_combos`
      NO recibe columna `allergens`** (se deriva al leer, nunca se persiste — D9).
      **Acceptance**: `RUN_MIGRATE=1` agrega la columna sin backfill.

- [x] 5.3 `backend/src/modules/restaurant/validators/schema.ts`: extender
      `CreateItemSchema`/`UpdateItemSchema` con `allergens?: { type: 'array' }`. NO
      agregar `allergens` a `CreateComboSchema`/`UpdateComboSchema` — si llega en el
      body de combo, se descarta en silencio por el whitelist de `validateSchema`
      (mem 1805, comportamiento esperado, no un bug).
      **Acceptance**: `POST /combos` con `allergens` en el body no falla, pero el campo
      no se persiste (confirmado leyendo la fila creada).

- [x] 5.4 `backend/src/modules/restaurant/usecases/items-crud.ts`: nueva función
      `assertAllergens(allergens)` (mismo estilo que `assertPrice`/`assertTaxRate`) que
      valida cada elemento contra `ALLERGEN_TAGS`, rechaza con `ValidationError` 400
      (`"{tag}" no es un alérgeno/tag válido`) ante cualquier valor desconocido.
      Llamada desde `createItem`/`updateItem`. Los alérgenos NUNCA bloquean `addLine`
      (no tocar `order-lines.ts` en esta tarea — son informativos, no una regla de
      negocio).
      **Acceptance**: `allergens: ['gluten', 'invented_tag']` → 400; `['spicy',
      'lactose']` → 200, persistido tal cual.

- [x] 5.5 `backend/src/modules/restaurant/usecases/combos-crud.ts`: `getCombo`/
      `listCombos` calculan `allergens` como la UNIÓN de los `allergens` de todos sus
      `menu_combo_items.menuItemId` — CALCULADO al leer, nunca persistido, nunca
      aceptado en el body de create/update.
      **Acceptance**: cambiar un componente de un combo por uno con `allergens:
      ['lactose']` hace que la PRÓXIMA lectura del combo incluya `'lactose'` sin que
      nadie haya tocado el combo directamente (cubre el scenario de
      `specs/menu-allergens/spec.md`).

- [x] 5.6 Tests: `backend/src/modules/restaurant/tests/allergens.test.ts` — tags
      válidos persisten, tag inválido rechaza 400 sin actualizar el ítem, ítem con
      alérgenos se agrega a comanda SIN fricción (ningún `ValidationError` en
      `addLine`), combo deriva unión de componentes, componente sin `allergens`
      declarado no aporta falso negativo.
      **Acceptance**: `bun test` verde, cubre TODOS los scenarios de
      `specs/menu-allergens/spec.md`.

### Frontend

- [x] 5.7 `frontend/src/pages/restaurante/carta.vue`: multi-select de checkboxes con
      el catálogo fijo en el editor de ítem, cada uno con ícono + etiqueta en español
      (🌾 Gluten, 🥛 Lactosa, 🥜 Frutos secos, 🦐 Mariscos, 🌶️ Picante, 🌱 Vegano, 🥕
      Vegetariano, etc. — 10 tags de `ALLERGEN_TAGS`).
      **Acceptance**: guardar 2 tags, verlos reflejados como checkboxes marcados tras
      recargar.

- [x] 5.8 `frontend/src/pages/restaurante/carta.vue` (lista) + `comanda.vue`: tags como
      badges pequeños junto al nombre (mismo patrón visual que "Agotado"/"Sin receta",
      `carta.vue:365-366`). El combo muestra "Contiene (según sus componentes):" para
      dejar explícito que es un cálculo derivado.
      **Acceptance**: un ítem con `allergens` muestra sus badges en Carta y en Comanda
      sin bloquear el flujo de agregarlo a la comanda.

### Gate F5

- [x] 5.9 `cd backend && bun run typecheck && bun run node_modules/arckode-framework/bin/arckode.js analyze && bun test` (0 errores, ✅ VÁLIDO, tests verdes);
      `cd frontend && bun run typecheck && bun run build`.
      **Acceptance**: los 4 comandos en verde antes de empezar F6.

---

## F6 — Destacados y disponibilidad por horario

### Backend

- [x] 6.1 `backend/src/modules/restaurant/model.ts`: agregar a `MenuItemModel`:
      `featured` (`type:'number'`, default 0), `availableFrom`/`availableTo`
      (`type:'string'`, nullable, formato `"HH:mm"`). Ambos `null` (default) = sin
      restricción horaria, comportamiento IDÉNTICO al actual.
      **Acceptance**: `RUN_MIGRATE=1` agrega las 3 columnas sin backfill.

- [x] 6.2 `backend/src/modules/restaurant/validators/schema.ts`: extender
      `CreateItemSchema`/`UpdateItemSchema` con `featured?: {type:'number'}`,
      `availableFrom?: {type:'string'}`, `availableTo?: {type:'string'}`.
      **Acceptance**: el validator acepta los 3 campos opcionales sin romper payloads
      existentes que no los envían.

- [x] 6.3 `backend/src/modules/restaurant/usecases/items-crud.ts`: nueva función
      `assertTimeWindow(from, to)` (mismo estilo que `assertPrice`) que valida formato
      `HH:mm` y rechaza si viene solo uno de los dos (`availableFrom` sin
      `availableTo` o viceversa — franja todo-o-nada). Llamada desde
      `createItem`/`updateItem`.
      **Acceptance**: `availableFrom:"07:00"` sin `availableTo` → 400; ambos con
      formato válido → 200.

- [x] 6.4 `backend/src/modules/restaurant/usecases/order-totals.ts` (junto a
      `resolveStation`/`round2`): nueva función `isWithinAvailabilityWindow(item, now:
      Date)`. Si `availableFrom`/`availableTo` son `null` → `true` (sin restricción).
      Compara `now` (hora del SERVIDOR, `new Date()` — **NO conversión a
      `hotel.timezone`, deuda ya documentada y compartida con `attendance`, D10, NO
      resolver acá**) contra el rango; si `availableFrom > availableTo` (cruza
      medianoche), evalúa `hora >= availableFrom OR hora <= availableTo`.
      **Acceptance**: cubre los 3 scenarios de "Franja horaria de disponibilidad" de
      `specs/menu-featured-availability/spec.md` (fuera de horario diurno, dentro de
      horario diurno, franja que cruza medianoche en ambos sentidos).

- [x] 6.5 `backend/src/modules/restaurant/usecases/order-lines.ts`: `addLine` llama
      `isWithinAvailabilityWindow(item, new Date())` INMEDIATAMENTE después del
      chequeo existente de `item.available` (línea ~65) — se agrega, no reemplaza.
      Rechaza con `ValidationError` 400 (`""{item.name}" no está disponible en este
      horario"`) si está fuera de franja. Una línea YA creada conserva su snapshot sin
      importar que el ítem salga de franja después (no re-evaluar en `updateLine`).
      **Acceptance**: agregar "Pancakes" (07:00-11:00) a las 20:00 → 400, línea no se
      crea; una línea ya `preparing` sigue avanzando en el KDS aunque de la hora en
      curso el ítem salga de franja.

- [x] 6.6 `backend/src/modules/restaurant/usecases/items-crud.ts` (`listItems`/
      `getItem`): agregar campo derivado `availableNow: boolean` al DTO
      (`available=1 AND isWithinAvailabilityWindow(item, new Date())`) — el cálculo
      vive en un solo lugar (backend), el frontend solo lee el booleano.
      **Acceptance**: `GET /menu-items` incluye `availableNow` en cada fila sin que el
      frontend reimplemente la lógica de franja.

- [x] 6.7 Tests: `backend/src/modules/restaurant/tests/availability.test.ts` — ítem
      destacado sin regla de negocio, franja normal dentro/fuera de horario, franja
      que cruza medianoche (dentro a las 00:30, fuera a las 15:00), `addLine` rechaza
      fuera de franja, snapshot ya vendido no se ve afectado retroactivamente,
      `availableNow` correcto en el DTO de listado.
      **Acceptance**: `bun test` verde, cubre TODOS los scenarios de
      `specs/menu-featured-availability/spec.md`.

### Frontend

- [x] 6.8 `frontend/src/pages/restaurante/carta.vue`: checkbox "Destacado" + 2 campos
      de hora (`availableFrom`/`availableTo`) con opción "Sin restricción" (deja
      ambos `null`) en el editor de ítem. Ítem destacado con estrella/badge dorado en
      Carta/Comanda. Ítem fuera de franja se muestra atenuado (`opacity` reducida) con
      texto "Fuera de horario (07:00-11:00)", visualmente distinto del badge rojo
      "Agotado".
      **Acceptance**: marcar "Destacado" muestra la estrella en la lista de Carta sin
      recargar la página completa.

- [x] 6.9 `frontend/src/pages/restaurante/comanda.vue`: `availableItems` (línea ~48-49,
      hoy `items.value.filter(i => i.available !== 0)`) agrega
      `&& i.availableNow !== false` — un ítem fuera de horario simplemente no aparece
      en la lista para agregar.
      **Acceptance**: un ítem fuera de su franja horaria actual no aparece en el
      selector de "agregar ítem" de la comanda.

### Gate F6

- [x] 6.10 `cd backend && bun run typecheck && bun run node_modules/arckode-framework/bin/arckode.js analyze && bun test` (0 errores, ✅ VÁLIDO, tests verdes);
       `cd frontend && bun run typecheck && bun run build`.
       **Acceptance**: los 4 comandos en verde antes de empezar F7.

---

## F7 — Carta pública de solo lectura (depende de F0; se beneficia de F4/F5/F6 ya aplicados, no bloqueante)

### Backend

- [x] 7.1 Crear `backend/src/modules/restaurant/usecases/public-menu.ts`: función
      `publicMenu(deps, hotelId, lang, user)` que arma el DTO por **allow-list
      explícito, campo por campo — NUNCA spread del DTO interno**. Cada fila de ítem
      incluye ÚNICAMENTE: `id, name, description, price, imageUrl, allergens,
      featured, availableFrom, availableTo, availableNow`. Cada combo incluye
      `id, name, description, price, imageUrl, allergens, featured, components:
      [{name, quantity}]` (sin `menuItemId` crudo del componente). El objeto raíz
      incluye SOLO `hotel: { name }` (nada de `ownerName`/`taxId`/`email`/`phone`).
      **La respuesta NUNCA incluye, en ningún nivel**: `cost`, `margin`,
      `marginPercent`, `hasRecipe`, `complete`, `avgCost`, `currentStock`,
      `stationId`, `stationName`, `sortOrder`, `taxRate`, `hotelId` por fila. Filtra
      `available=0` (86'd) del todo; conserva ítems fuera de franja horaria con
      `availableNow:false` (no los oculta — el huésped puede querer ver el menú de
      cena a las 15:00). Resuelve `name`/`description` con el fallback de F4 si
      `?lang=` viene.
      **Acceptance**: cubre los 2 scenarios de "Campos que el sistema NUNCA expone" +
      los 2 de "Ítems agotados vs. fuera de horario" + los 2 de "Multi-idioma" de
      `specs/menu-public/spec.md`. Un test explícito recorre el JSON completo con
      `JSON.stringify` y confirma con regex/substring que ninguna de las 11 claves
      prohibidas aparece en ningún nivel.

- [x] 7.2 `public-menu.ts`: resolución de módulo SIN sesión — llamar DIRECTO a
      `getModuleStateForPlan(configRepo, plansRepo, hotel.plan)`
      (`admin/usecases/modules.ts:153`), **NO usar `createModuleGuard`** (depende de
      `req.user`, que no existe en una ruta sin `auth.authenticate()`). Si
      `hotelId` no existe → 404 genérico. Si el hotel existe pero `restaurant===false`
      para su plan → 404 genérico (MISMO mensaje que "hotel no existe", no distinguir
      los dos casos — anti-enumeración).
      **Acceptance**: pedir `/api/public/menu/{hotelId-inexistente}` y
      `/api/public/menu/{hotelId-sin-modulo-restaurant}` devuelven exactamente el
      mismo body de 404.

- [x] 7.3 `backend/src/modules/restaurant/index.ts`: inyectar `configRepo`/`plansRepo`
      (nuevos `OrmRepository` si no existen ya en `create()`) para que `public-menu.ts`
      pueda llamar `getModuleStateForPlan`. `index.ts` sigue APPEND-ONLY.
      **Acceptance**: el módulo `restaurant` sigue arrancando sin error si `plans` no
      tiene filas (fallback a `planModules=null`, mismo criterio que
      `getModuleStateForPlan` ya implementa).

- [x] 7.4 `backend/src/modules/restaurant/controller.ts`: handler `publicMenu(req)` que
      llama al usecase con `req.params.hotelId`, `req.query.lang`.
      **Acceptance**: el controller no requiere `req.user` en ningún punto de este
      handler.

- [x] 7.5 `backend/src/modules/restaurant/index.ts`: agregar
      `router.get('/api/public/menu/:hotelId', (req) => { ... })` **SIN
      `auth.authenticate()` ni `guard(...)` en el array de middlewares** (mismo
      criterio que `/api/public/hotel/:slug` de `bookingengine`). Dentro del handler,
      ANTES de llamar al controller: aplicar
      `rateLimit('public-menu:' + req.params.hotelId + ':' + getClientIp(req), {
      maxAttempts: 120, windowMs: 5*60_000 })` (usa la firma extendida de **F0** — si
      F0 no está mergeado, esta tarea NO puede empezar). 429 con `retryAfter` si
      excede, sin tocar el repositorio.
      **Acceptance**: cubre los 2 scenarios de "Ruta sin autenticación, con rate-limit
      por IP" de `specs/menu-public/spec.md` — request sin ningún header de auth
      recibe 200; 121ª request de la misma IP+hotel en la ventana recibe 429.

- [x] 7.6 Tests: `backend/src/modules/restaurant/tests/public-menu.test.ts` — allow-list
      (ninguna de las 11 claves prohibidas aparece), 404 genérico idéntico para
      hotel-inexistente y módulo-deshabilitado, 429 al superar 120/5min, ítem 86'd no
      aparece, ítem fuera de franja aparece con `availableNow:false`, `?lang=en`
      resuelve traducciones con fallback a español, combo público muestra componentes
      `{name, quantity}` sin `menuItemId`.
      **Acceptance**: `bun test` verde, cubre TODOS los scenarios de
      `specs/menu-public/spec.md`.

### Frontend

- [x] 7.7 `frontend/src/services/Restaurant.service.ts` (o nuevo
      `frontend/src/services/PublicMenu.service.ts` si se prefiere aislar el cliente
      sin token): método `getPublicMenu(hotelId, lang?)` que llama
      `GET /api/public/menu/:hotelId?lang=` SIN pasar el header de auth (cliente HTTP
      separado del `http.ts` autenticado, o el mismo si tolera ausencia de token).
      **Acceptance**: `bun run typecheck` limpio; la llamada funciona sin sesión
      iniciada (probado manualmente en incógnito o `curl`).

- [x] 7.8 Crear `frontend/src/pages/public/menu.vue`: layout propio mobile-first, SIN
      sidebar/header de panel (`SuperAdminLayout` u otro). Selector de idioma visible
      si hay traducciones cargadas; sección "Recomendados" arriba con los `featured`;
      ítems fuera de horario atenuados con su franja visible (NO ocultos); alérgenos
      como íconos/badges; genera el QR client-side a partir de la URL pública
      (`/menu/:hotelId`), sin servicio externo.
      **Acceptance**: abrir `/menu/{hotelId}` sin sesión iniciada muestra la carta
      completa con el layout mobile-first, sin ningún elemento del panel admin.

- [x] 7.9 `frontend/src/router/index.ts` (o archivo de rutas correspondiente): agregar
      ruta pública `/menu/:hotelId` → `pages/public/menu.vue`, SIN guard de
      autenticación, fuera del layout de panel.
      **Acceptance**: navegar a `/menu/{hotelId}` sin token no redirige a `/login`.

### Gate F7

- [x] 7.10 `cd backend && bun run typecheck && bun run node_modules/arckode-framework/bin/arckode.js analyze && bun test` (0 errores, ✅ VÁLIDO, tests verdes);
       `cd frontend && bun run typecheck && bun run build`.
       **Acceptance**: los 4 comandos en verde antes de empezar F8. Confirmar además
       que el gate de F0 (0.3, regresión de `rateLimit`) sigue verde tras F7 — el
       cambio de firma es compartido con `usuarios/index.ts`.

---

## F8 — Reordenar por drag-and-drop (100% frontend, sin backend nuevo)

### Frontend (sin cambios de backend — `sortOrder`, `PUT /categories/:id`, `PUT /menu-items/:id` ya existen)

- [x] 8.1 `frontend/src/pages/restaurante/carta.vue`: retirar el campo "Orden"
      (`<input type="number">`) de los `FormModal` de categoría/ítem (líneas ~92, 105,
      128, 141, 170, 195) — el modelo/schema/backend NO se tocan, `sortOrder` sigue
      siendo un `number` común en el server.
      **Acceptance**: abrir "Nueva categoría"/"Nuevo ítem" no muestra ningún campo
      "Orden".

- [x] 8.2 `carta.vue`: agregar `draggable="true"` + `@dragstart`/`@dragover.prevent`/
      `@drop.prevent` a las filas de categorías, con handle visual `⋮⋮` (sin el handle,
      un click sobre "Editar"/"Eliminar" podría iniciar un drag por error) — mismo
      patrón HTML5 nativo YA usado en `pages/maintenance/index.vue:70-96` (NO instalar
      `vuedraggable`/`sortablejs`, D14). Fila arrastrada semi-transparente
      (`opacity-50`, `maintenance/index.vue:97`).
      **Acceptance**: arrastrar una categoría a otra posición la mueve visualmente
      antes de soltar.

- [x] 8.3 `carta.vue`: mismo mecanismo de drag para ítems DENTRO de su categoría activa
      (mover de categoría sigue siendo el campo `categoryId` del formulario, sin
      cambios — no se reordena entre categorías en un solo drag).
      **Acceptance**: arrastrar un ítem a otra posición de la MISMA categoría lo mueve
      visualmente; arrastrarlo "a otra categoría" no es una operación soportada por
      esta UI (sigue siendo editar `categoryId`).

- [x] 8.4 `carta.vue`: al soltar (`@drop`), recalcular el `sortOrder` de la lista
      completa (categorías o ítems de la categoría activa) y comparar contra el orden
      ANTERIOR — mandar `PUT /api/restaurant/categories/:id` / `PUT
      /api/restaurant/menu-items/:id` con `{ sortOrder }` **SOLO a los que
      efectivamente cambiaron** de `sortOrder` (no a toda la lista en cada drag).
      **Acceptance**: cubre los 2 scenarios de "Reordenar ítems dentro de una
      categoría" (mover al principio → los 3 cambiaron, PUT a los 3; intercambiar 2
      adyacentes → PUT solo a esos 2) y el de "Reordenar categorías" de
      `specs/menu-ordering/spec.md`.

- [x] 8.5 `carta.vue`: si algún `PUT` disparado por el drop falla, revertir el orden
      visual COMPLETO al último estado confirmado por el servidor (re-fetch o snapshot
      previo) y mostrar un toast de error — nunca dejar un estado mixto (algunos
      persistidos, otros no) invisible para el admin. Toast de éxito "Orden
      actualizado" si todos los `PUT` resuelven.
      **Acceptance**: cubre el scenario "El servidor rechaza uno de los PUT de un
      reorder de 3 ítems" de `specs/menu-ordering/spec.md` — simular un fallo de red
      en 1 de 3 `PUT` y confirmar que la lista vuelve al orden pre-drag, no un híbrido.

- [x] 8.6 `carta.vue`: crear una categoría/ítem nuevo calcula `sortOrder` automático
      = `max(sortOrder existente en su categoría) + 1`, o `0` si está vacía — sin que
      el admin tenga que escribir un número (el campo ya no existe en el form, tarea
      8.1).
      **Acceptance**: crear un ítem nuevo en una categoría con 3 ítems (sortOrder
      0,1,2) lo persiste con `sortOrder=3` sin ningún input manual.

### Gate F8

- [x] 8.7 `cd backend && bun run typecheck && bun run node_modules/arckode-framework/bin/arckode.js analyze` (0 errores, ✅ VÁLIDO — confirma que F8 no tocó nada de backend);
      `cd frontend && bun run typecheck && bun run build`.
      **Acceptance**: los 3 comandos en verde. Change completo: correr también el Gate
      F0 (0.3) una última vez para confirmar que la firma extendida de `rateLimit`
      sigue sin romper los 6 call-sites de `usuarios/index.ts`.

---

## Definición de Hecho (mapea a `proposal.md`, sección Success Criteria)

- [x] F1: un ítem con modificadores permite elegir variante/extra y el precio final de
      la línea de comanda refleja el ajuste.
- [x] F2: un combo se vende como una sola línea, snapshotea sus componentes, y el
      conector de inventario descuenta stock de cada ítem componente.
- [x] F3: Carta muestra el margen (precio venta − costo receta) por ítem; hay un
      reporte de food cost ordenable por menor margen.
- [x] F4: la carta pública (F7) respeta el idioma del huésped con fallback correcto.
- [x] F5: los alérgenos configurados en un ítem se muestran en Carta y en la vista
      pública.
- [x] F6: un ítem fuera de su franja horaria no aparece disponible en Salón/Comanda.
- [x] F7: `/api/public/menu/:hotelId` sirve la carta sin login, sin exponer
      costo/insumo.
- [x] F8: reordenar categorías/ítems por drag-and-drop persiste `sortOrder` sin
      recargar.
- [x] Los 9 Gates de fase (F0-F8) pasaron en verde, uno por uno, en orden — no un solo
      gate al final.

## Fuera de alcance de este tasks.md (deuda ya trackeada, no silenciar)

- **R2** (`design.md`): F2 no valida `available`/franja horaria (F6) al explotar un
  combo — un combo con un componente 86'd o fuera de horario se sigue vendiendo sin
  bloqueo. Confirmado como deuda técnica a trackear en
  `openspec/changes/deudas-tecnicas-pendientes`, NO se resuelve ampliando F2 o F6 en
  este change.
- **D10** (`design.md`): comparación de horario F6 usa hora del SERVIDOR sin
  `hotel.timezone` — deuda compartida con `attendance`, no se resuelve acá (ver tarea
  6.4).
