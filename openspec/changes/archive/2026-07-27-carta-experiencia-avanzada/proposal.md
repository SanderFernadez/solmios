# Proposal: Carta del restaurante — experiencia avanzada

## Intent

El módulo de Carta (`restaurante-pos`, RES-0→RES-8) cubre el flujo operativo básico:
categorías, ítems con precio, ruteo a KDS, receta/consumo de inventario y cobro. Es
sólido para un restaurante simple de hotel, pero al auditarlo a fondo (2026-07-27)
aparecieron gaps estructurales que un restaurante real necesita para vender bien y
controlar rentabilidad — no bugs, features que nunca se construyeron:

- No se puede personalizar un pedido (modificadores/variantes) más allá de una nota libre.
- No hay combos/paquetes — cada línea de venta es un ítem plano.
- El costo de receta vs. precio de venta existe como dato (inventario ya lo calcula)
  pero nadie lo muestra — el dueño no ve el margen de cada plato.
- La carta es mono-idioma, sin alérgenos, sin destacados, sin franja horaria — y es
  100% administrable, no hay ninguna vista para que el huésped la vea desde su celular.
- Reordenar ítems/categorías es escribir un número a mano, no arrastrar.

Dos bugs puntuales de datos (impuesto por ítem no editable, foto de plato no
editable) se corrigieron aparte, fuera de este change (el modelo ya los soportaba,
solo faltaba exponerlos en el formulario de `carta.vue`).

## Scope

### In Scope

- **F1 — Modificadores/variantes**: grupos de opciones (ej. "Tamaño": chico/grande,
  "Extras": +queso/+tocino) con impacto en precio y, opcionalmente, en el consumo de
  insumo de la receta.
- **F2 — Combos/paquetes**: ítem compuesto por N ítems de carta con precio propio;
  se vende y snapshotea en la comanda igual que un ítem simple.
- **F3 — Food cost visible**: costo de receta vs. precio de venta como columna/badge
  en Carta y como reporte de margen por plato. Sin tabla nueva — deriva de datos que
  ya existen (`menu_item_recipes` + `inventory_items.avgCost`).
- **F4 — Multi-idioma de carta**: nombre/descripción por idioma con fallback al
  idioma base del hotel.
- **F5 — Alérgenos / info dietética**: tags configurables (gluten, lactosa, picante,
  vegano, etc.) por ítem.
- **F6 — Destacados y disponibilidad por horario**: plato del día / recomendado,
  franjas (desayuno/almuerzo/cena) que ocultan el ítem fuera de horario.
- **F7 — Carta pública de solo lectura**: vista sin login accesible por QR de mesa
  (el huésped VE la carta, no pide — ver Out of Scope).
- **F8 — Reordenar por drag-and-drop**: reemplaza el campo numérico `sortOrder`
  manual en categorías e ítems.

### Out of Scope

- **Self-order desde el QR** (el cliente pide y paga sin operador): cambio de flujo
  mayor con implicancias de pago y aprobación de mesero — change propio si se decide.
- **Impresión térmica de comandas** (driver ESC/POS, hardware específico): se evalúa
  aparte, no bloquea nada de esta lista.
- **División de cuenta (split bill)**: toca el modelo de `settlement`, no el de Carta
  — candidato para `deudas-tecnicas-pendientes` o change propio.
- **Sub-recetas (receta de receta)**: cambio al modelo BOM de inventario — se evalúa
  junto a `compras-inventario`, no en este change.

## Approach

Fases incrementales (F1→F8), cada una entregable y verificable por separado,
reusando el patrón ya establecido (`usecases/`, `RepositoryAdapter<T>`, ownership
por `hotelId`). Reglas de compatibilidad:

- F1/F2 agregan tablas nuevas (`menu_item_modifier_groups`, `menu_item_modifiers`,
  `menu_combos`, `menu_combo_items`) — no tocan `menu_items` existente.
- F3 es solo lectura: ningún modelo nuevo, un usecase que cruza `menu_item_recipes`
  con `inventory_items.avgCost`.
- F4/F5/F6 son columnas nuevas nullable en `menu_items`/`menu_categories`
  (`translations`, `allergens`, `featured`, `availableFrom`/`availableTo`).
- F7 es una ruta pública nueva, sin `auth.authenticate()`, rate-limited, que NO
  expone costo/insumo/receta — solo nombre, descripción, precio, foto, alérgenos.
- F8 es puramente frontend: sigue persistiendo `sortOrder` vía los endpoints ya
  existentes (`updateCategory`/`updateItem`), sin cambios de modelo.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `backend/src/modules/restaurant/model.ts` | Modified | Nuevas tablas F1/F2, columnas nullable F4/F5/F6 |
| `backend/src/modules/restaurant/usecases/` | New + Modified | `modifiers-crud.ts`, `combos-crud.ts`, `food-cost.ts`, `public-menu.ts` |
| `backend/src/modules/restaurant/validators/schema.ts` | Modified | Schemas nuevos (campos no declarados se descartan en silencio — mem 1805) |
| `backend/src/modules/restaurant/controller.ts` | Modified | Rutas nuevas; F7 sin `auth.authenticate()` |
| `frontend/src/pages/restaurante/carta.vue` | Modified | Modificadores, combos, food cost, alérgenos, destacados, drag-and-drop |
| `frontend/src/pages/restaurante/comanda.vue` | Modified | Selección de modificadores/combo al agregar línea |
| `frontend/src/pages/public/menu.vue` | New | Carta pública (F7), ruta sin layout de panel |
| `frontend/src/services/Restaurant.service.ts` | Modified | Tipos y llamadas nuevas |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| F7 expone precios/carta a competencia vía scraping | Medium | Rate-limit por IP; solo campos públicos, nunca costo/receta/insumo |
| Modificadores (F1) complican el snapshot de la línea de comanda (settlement ya asume línea = 1 ítem) | Medium | Modificador se snapshotea como sub-línea con su propio `lineTotal`; `settlement.ts` sigue sumando `lineTotal`, no reabre esa lógica |
| Combos (F2) rompen el consumo de receta (INT-1 espera 1 `menuItemId` por línea) | Medium | El conector `restaurante-inventario` resuelve combo → N `consumeForSale` (uno por ítem componente), no una receta nueva |
| Alcance grande, riesgo de scope creep por fase | Low | Cada fase (F1-F8) es un change de tasks independiente — se implementa y verifica una por vez, no todas juntas |

## Rollback Plan

Todas las fases son aditivas (tablas/columnas nuevas nullable). Revertir una fase =
dejar de usar la UI/ruta nueva; no requiere migración destructiva DOWN. Única
excepción a vigilar: F7 (ruta pública) — si se revierte, remover la ruta del router
del backend explícitamente (no solo el frontend) para no dejar un endpoint sin auth
expuesto de forma huérfana.

## Dependencies

- Ninguna dependencia externa dura. F7 (si se quiere QR físico en la mesa) puede
  generar el QR client-side desde la URL pública, sin servicio externo.
- F1/F2 dependen de que `restaurante-pos` (base) siga estable — no se toca su schema
  existente, solo se agregan tablas nuevas relacionadas.

## Success Criteria

- [ ] F1: un ítem con modificadores permite elegir variante/extra y el precio final
      de la línea de comanda refleja el ajuste.
- [ ] F2: un combo se vende como una sola línea, snapshotea sus componentes, y el
      conector de inventario descuenta stock de cada ítem componente.
- [ ] F3: Carta muestra el margen (precio venta − costo receta) por ítem; hay un
      reporte de food cost ordenable por menor margen.
- [ ] F4: la carta pública (F7) respeta el idioma del huésped con fallback correcto.
- [ ] F5: los alérgenos configurados en un ítem se muestran en Carta y en la vista pública.
- [ ] F6: un ítem fuera de su franja horaria no aparece disponible en Salón/Comanda.
- [ ] F7: `/menu/:hotelId` (o slug) sirve la carta sin login, sin exponer costo/insumo.
- [ ] F8: reordenar categorías/ítems por drag-and-drop persiste `sortOrder` sin recargar.
- [ ] `bun run typecheck` + `arckode analyze` (0 violaciones) en cada fase.
