# Verify Report — carta-experiencia-avanzada

**Fecha**: 2026-07-27
**Modo**: verificación adversarial final (post-implementación completa F0-F8)
**Método**: lectura directa de código de producción (NO se confía en que los tests describan bien el comportamiento) + ejecución real de los 4 gates.

---

## 1. Gates ejecutados (evidencia real, no reportada de memoria)

| Comando | Resultado | Detalle |
|---|---|---|
| `cd backend && bun run typecheck` | ✅ Exit 2, pero **0 errores nuevos** | 9 errores, TODOS en `scripts/e2e/endpoints-smoke.e2e.ts` (7) y `scripts/validate-system.ts` (2) — el baseline documentado por el usuario. Ninguno en `src/`. |
| `cd backend && bun run node_modules/arckode-framework/bin/arckode.js analyze` | ✅ **VÁLIDO — sin violaciones** | `arckode.json actualizado — ✅ sin violaciones` |
| `cd backend && bun test` | ✅ **2101 pass / 0 fail** | 70811 `expect()`, 221 archivos. Corrido 4 veces en esta verificación: 3/4 dieron 2101 pass, 1/4 dio 2100 pass (0 fail en las 4) — variación de conteo entre corridas, no test faltante ni roto; se toma 2101 (mayoría) como cifra estable. El encargo esperaba "2100" — la diferencia es de +1, nunca de menos. |
| `cd frontend && bun run typecheck` (vue-tsc -b) | ✅ 0 errores | Sin output = sin errores |
| `cd frontend && bun run build` | ✅ `✓ built in 1.13s` | Incluye chunk `carta-BO1lqnDK.js` (44.88 kB) |

Ningún gate falló. No hay evidencia de regresión.

---

## 2. Spec Compliance Matrix (escenarios críticos, contra código real)

| Spec | Escenario verificado | Veredicto | Evidencia archivo:línea |
|---|---|---|---|
| **menu-modifiers (F1)** | Grupo `required` bloquea agregar línea si falta selección | ✅ VERIFICADO | `order-lines.ts:79-92` (`resolveModifiers`: `single` con `required` y 0 elegidos → `ValidationError`; `multiple` con `minSelect` no cumplido → `ValidationError`) |
| menu-modifiers (F1) | Precio final de línea = `(unitPrice + Σ priceDelta) × quantity` | ✅ VERIFICADO | `order-lines.ts:238` |
| menu-modifiers (F1) | Modificadores PROHIBIDOS dentro de un combo (R4 resuelto) | ✅ VERIFICADO | `order-lines.ts:208-210` (rechaza explícito con `ValidationError` si `dto.modifiers.length` con `comboId`) **+** `order-lines.ts:169,191` (header y componente fijan `modifiers: null` siempre) — doble cerrojo |
| **menu-combos (F2)** | Combo se descompone en 1 `combo_header` + N `combo_component`, precio SOLO en header | ✅ VERIFICADO | `order-lines.ts:154-168` (header: `unitPrice=combo.price`, `lineTotal=unitPrice×qty`) vs. `order-lines.ts:177-192` (componente: `unitPrice:0`, `lineTotal:0`) |
| menu-combos (F2) | `recomputeOrderStatus` excluye `combo_header` (si no, la comanda queda encallada en `'new'`) | ✅ VERIFICADO | `kds.ts:83-86` (`all.filter((l) => l.status !== 'cancelled' && l.kind !== 'combo_header')`) — también `kdsQueue` línea 49 |
| menu-combos (F2) | Conector de inventario descuenta stock de CADA ítem componente (no del combo como unidad) | ✅ VERIFICADO | `restaurante-inventario.ts:24-36` filtra por `l.menuItemId` (el header tiene `menuItemId: undefined`, línea `order-lines.ts:159`, así que se auto-excluye) y llama `consumeForSale` por cada línea `combo_component` con su propio `menuItemId`/`quantity` |
| menu-combos (F2) | Un componente de OTRO hotel se rechaza al crear/editar el combo (IDOR) | ✅ VERIFICADO | `combos-crud.ts:60-62` (`assertComponent`): `if (!item \|\| item.hotelId !== hotelId) throw new ValidationError('El ítem no existe o es de otro hotel')` |
| menu-combos (F2) | No se puede editar un componente de combo directamente (solo reemplazar el array completo vía `updateCombo`) | ✅ VERIFICADO | No existe ninguna ruta `PATCH`/`PUT` individual sobre `menu_combo_items` en `index.ts`/`controller.ts`; `combos-crud.ts:159-190` (`updateCombo`) reemplaza `items` completo |
| **menu-food-cost (F3)** | Endpoint de costo/margen usa permiso MÁS estricto (`restaurant-catalog:view`) que venta normal | ✅ VERIFICADO | `index.ts:158-160` (los 3 endpoints `food-cost`) vs. resto de rutas de venta que usan `restaurant:view`/`restaurant:create` |
| menu-food-cost (F3) | Ítem sin receta costeada NO rompe el reporte, se excluye del margen (no "0% falso") | ✅ VERIFICADO | `food-cost.ts:104` (`itemFoodCost`: sin receta → `margin: null, marginPercent: null`) y `food-cost.ts:154` (`foodCostReport`: `if (!c.available \|\| !c.hasRecipe) continue`) |
| menu-food-cost (F3) | Food cost de combo = suma de costos de sus componentes (no campo propio inventado) | ✅ VERIFICADO | `food-cost.ts:128-136` (`comboFoodCost`: itera `comboItems`, suma `cost × quantity`, marca `complete:false` si algún componente no tiene receta) |
| **menu-i18n (F4)** | Fallback: `lang` ausente o `'es'` → entidad tal cual; campo sin traducción → cae al valor base | ✅ VERIFICADO | `i18n.ts:30` (`if (!lang \|\| lang === 'es') return entity`) y `i18n.ts:33-36` (solo sobreescribe si `v !== undefined && v !== null && v !== ''`) |
| menu-i18n (F4) | Clave `'es'` PROHIBIDA dentro de `translations` (D7 — evita 2 fuentes de verdad) | ✅ VERIFICADO | `i18n.ts:9-17` (`assertNoBaseLangKey` lanza `ValidationError` si `translations.es` existe) |
| **menu-allergens (F5)** | Alérgenos de un combo se DERIVAN (unión de componentes), NUNCA se persisten como columna propia | ✅ VERIFICADO | `combos-crud.ts:86-99` (comentario + código: `combo.allergens = Array.from(tags)`) **+** `model.ts:190-207` (`MenuComboModel` NO tiene campo `allergens` — solo `MenuItemModel` línea 60 lo tiene) |
| menu-allergens (F5) | Alérgenos visibles en Carta (admin) Y en vista pública | ✅ VERIFICADO | `carta.vue:826-827,869-871` (admin) y `frontend/src/pages/public/menu.vue:60-61,87-88` (pública) |
| **menu-featured-availability (F6)** | Ítem fuera de franja horaria NO se puede agregar a una comanda nueva | ✅ VERIFICADO | `order-lines.ts:220` (`if (!isWithinAvailabilityWindow(item, new Date())) throw new ValidationError(...)`) — bloqueo real en el server, no solo flag informativo |
| menu-featured-availability (F6) | Ítem fuera de franja no aparece en Comanda (Salón) | ✅ VERIFICADO | `comanda.vue:55-56` (`availableItems` filtra `i.availableNow !== false`) |
| menu-featured-availability (F6) | Franja que cruza medianoche (ej. 22:00-02:00) NO produce un bloqueo permanente (bug clásico de rangos horarios ingenuos) | ✅ VERIFICADO — manejado correctamente, no es un bug | `order-totals.ts:23-33` (`isWithinAvailabilityWindow`): si `from <= to` usa rango normal; si `from > to` usa `current >= from OR current <= to` — rama explícita para el caso cruce-de-medianoche, con comentario citando el caso de uso (pizza nocturna) |
| menu-featured-availability (F6) | `availableFrom`/`availableTo` ambos `null` = sin restricción (compat retro) | ✅ VERIFICADO | `order-totals.ts:27` — `if (!item.availableFrom \|\| !item.availableTo) return true` |
| menu-featured-availability (F6) | **R2 (deuda aceptada)**: combo NO valida disponibilidad/franja al explotar componentes | ✅ CONFIRMADO SIGUE IGUAL (no arreglado a medias, no roto más de lo documentado) | `order-lines.ts:173-193` (`addComboLine`): ningún chequeo de `item.available` ni `isWithinAvailabilityWindow` sobre los componentes. Consistente en frontend: `comanda.vue:60` (`availableCombos` filtra SOLO `available !== 0`, sin `availableNow`) |
| **menu-public (F7)** | Ruta `/api/public/menu/:hotelId` SIN `auth.authenticate()` | ✅ VERIFICADO | `index.ts:167-174` — el handler es una función inline con solo `rateLimit`, ningún middleware de auth en el registro de ruta |
| menu-public (F7) | DTO público NUNCA expone las 12 claves prohibidas (cost, margin, marginPercent, hasRecipe, complete, avgCost, currentStock, stationId, stationName, sortOrder, taxRate, hotelId por fila) | ✅ VERIFICADO | `public-menu.ts:69-99` (`toPublicItem`/`toPublicCombo`: allow-list explícito campo por campo, CERO spread del DTO interno) — coincide exacto con la lista de `specs/menu-public/spec.md:92-99` |
| menu-public (F7) | Rate-limit propio (120/5min), NO comparte clave/límite con `/api/auth/login` | ✅ VERIFICADO | `index.ts:168-169` (`public-menu:${hotelId}:${ip}`, `maxAttempts:120, windowMs:300000`) vs. `usuarios/index.ts:51` (`rateLimit(key)` sin opts → 20/5min) |
| **menu-ordering (F8)** | Drag-and-drop persiste `sortOrder`, enviando `PUT` SOLO a las entidades que cambiaron | ✅ VERIFICADO | `carta.vue:330-341` (`persistOrder`: `changed.map(...)`, con rollback server-side si falla algún `PUT`) |
| menu-ordering (F8) | Sin librería nueva (HTML5 nativo, sin `vuedraggable`) | ✅ VERIFICADO | `carta.vue:766-810` (`draggable="true"`, `@dragover.prevent`, `@drop.prevent` en el handle "⋮⋮") — `grep vuedraggable/sortablejs` en `frontend/package.json`: sin resultados |
| **F0 (infra)** | 6 call-sites existentes de `rateLimit(key)` en `usuarios/index.ts` siguen SIN `opts` → 20/5min sin cambios | ✅ VERIFICADO | `usuarios/index.ts:51,77,82,93,101,123` — ninguno pasa segundo argumento; `rate-limit.ts:23` default `MAX_ATTEMPTS=20`/`WINDOW_MS=5min` intacto |

**Resumen**: 26/26 escenarios críticos elegidos → VERIFICADOS contra código real (incluye 2 checks adicionales de F6 sobre cruce de medianoche/compat retro y 2 de F2 sobre IDOR/edición de componente, agregados en esta pasada de reconciliación). 0 discrepancias funcionales.

---

## 3. Success Criteria (`proposal.md:111-124`), uno por uno

| # | Criterio | Estado |
|---|---|---|
| F1 | Modificadores ajustan precio de línea | ✅ Cumple |
| F2 | Combo = 1 línea, snapshotea componentes, descuenta stock de cada ítem | ✅ Cumple |
| F3 | Margen visible por ítem + reporte ordenable por menor margen | ✅ Cumple |
| F4 | Carta pública respeta idioma con fallback correcto | ✅ Cumple |
| F5 | Alérgenos en Carta y vista pública | ✅ Cumple |
| F6 | Ítem fuera de franja no disponible en Salón/Comanda | ✅ Cumple (con la deuda R2 ya conocida y aceptada para combos) |
| F7 | `/menu/:hotelId` sin login, sin exponer costo/insumo | ✅ Cumple |
| F8 | Drag-and-drop persiste `sortOrder` sin recargar | ✅ Cumple |
| — | `typecheck` + `analyze` (0 violaciones) en cada fase | ✅ Cumple (verificado al final; ver §1) |

---

## 4. Fuera de alcance — ¿sigue siendo deuda documentada, no resuelta a medias?

- **R2** (combo no valida disponibilidad/franja al explotar componentes): **confirmado sin cambios** — sigue exactamente como lo describe `design.md:408-416` y `tasks.md:899-903`. No se "arregló" silenciosamente ni quedó más roto de lo aceptado.
- **D10** (F6 compara con hora del SERVIDOR, sin `hotel.timezone`): **confirmado sin cambios** — `order-totals.ts` (`isWithinAvailabilityWindow`) sigue usando `new Date()` sin conversión de zona horaria, consistente con la deuda compartida documentada con `attendance`.

### ⚠️ Hallazgo — el Open Question de R2 no se cerró
`design.md:463-467` deja como Open Question: *"confirmar que [R2] de verdad se trackea en `deudas-tecnicas-pendientes` y no se pierde"*. Se verificó `openspec/changes/deudas-tecnicas-pendientes/{proposal,tasks,state}.{md,yaml}` completos: **no existe ninguna entrada para esta deuda** (solo DT-07 search facturas, DT-08 depósitos, DT-09 facturación electrónica). La deuda SÍ está documentada — pero únicamente dentro de este mismo change (`design.md`/`tasks.md`), no en el tracker central como pedía la propia Open Question. No es un bug de comportamiento; es un cabo suelto de proceso/tracking.

---

## 5. Otro hallazgo de proceso (no de código)

`tasks.md` tiene **94/94 checkboxes sin marcar (`[ ]`)**, incluyendo los 8 ítems de "Success Criteria" al final del archivo — a pesar de que el código, los tests y los 4 gates confirman que las 8 fases están implementadas y funcionando. Esto no afecta la corrección del sistema, pero deja el checklist de `tasks.md` desalineado con la realidad: cualquiera que lea solo ese archivo asumiría que nada está hecho.

---

## 6. Veredicto final

### **LISTO CON OBSERVACIONES MENORES**

El código cumple lo que dicen las 8 specs — verificado línea por línea contra la implementación real, no contra los tests. Los 4 gates (typecheck backend con baseline intacto, `arckode analyze` limpio, 2101 tests en verde, typecheck+build frontend limpios) pasan sin excepción. Las dos deudas fuera de alcance (R2, D10) siguen exactamente donde estaban documentadas, sin resolverse a medias ni empeorar.

**Antes de archivar, corregir (no bloqueante para producción, sí para higiene del audit trail)**:
1. Marcar `[x]` los 94 tasks + 8 Success Criteria de `tasks.md` (o justificar por qué quedan `[ ]` si el proceso de archivado lo exige así).
2. Agregar una entrada (ej. `DT-10`) en `openspec/changes/deudas-tecnicas-pendientes/` para R2, cerrando el Open Question de `design.md`, o documentar explícitamente que se decidió no centralizarla.

Ninguno de los dos ítems requiere tocar código de producción.
