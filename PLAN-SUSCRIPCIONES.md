# PLAN-SUSCRIPCIONES — Condiciones especiales, Fundadores y Pioneros (SOLMI OS)

> Cubre GitLab #514–#542 ("Suscripciones | ..."). NO cubre Referidos (`PLAN-REFERIDOS.md`) ni Aliados (`PLAN-ALIADOS.md`) — esos son módulos aparte, aunque comparten la misma tabla `subscriptions`.
> Ámbito: **plataforma → hotel**. Es el Super Admin administrando la cuenta SaaS del hotel, no el hotel administrando su propio negocio.

---

## 0. Principio rector — cero hardcode

Mismo principio que `PLAN-REFERIDOS.md` §0: ningún número de negocio (cupos, %, días de gracia, plan mínimo) vive en código. Vive en tablas de configuración editables desde `/admin`.

| ❌ Prohibido | ✅ Correcto |
|---|---|
| `if (category === 'founder_one') discount = 0.4` | `discount = config.categories.find(c => c.key===category).discountPct` |
| `slots.founderOne = 10` en código | fila en `special_category_config` |
| `if (plan.slug === 'professional')` para el mínimo de Fundadores | `plan.sortOrder >= config.founderMinPlanSortOrder` |
| `graceDays = 5` | `config.gracePeriodDays` |

### 🏛️ Ownership

| Quién | userType / ruta | Qué hace |
|---|---|---|
| **Plataforma (SOLMI OS)** | `admin` (super_admin) · `/admin/subscriptions/*` | Único que ve/edita suscripciones de TODOS los hoteles, aplica condiciones especiales, gestiona cupos de Fundador/Pionero. |
| **Hotel (merchant)** | `merchant` · `/panel/settings/billing` | Solo ve **su propia** suscripción (plan, vencimiento, si tiene descuento activo, botón de pago). No edita nada de esto. |

---

## 1. El modelo (resumen)

Ya existe la base: tabla `subscriptions` (1 fila por hotel) + tabla `plans` (catálogo). Este plan **extiende** `subscriptions`, no la reemplaza, y agrega:

1. **Condiciones especiales**: un super admin busca una cuenta por email y le aplica descuento %, mes(es) gratis, o una categoría (Fundador Uno / Fundador Dos / Pionero).
2. **Categorías con cupo limitado**: Fundador Uno (10), Fundador Dos (15), Pionero (75) — 100 en total, con reglas de apertura/cierre secuenciales entre Fundador Uno y Dos.
3. **Ciclo de cobro y suspensión**: recurrente (Stripe auto-charge) vs manual, recordatorio a 5 días, 5 días de gracia post-vencimiento, suspensión real (bloquea el panel del hotel), reactivación al pagar.

---

## 2. Parámetros configurables

Editables en `/admin/subscriptions/settings` (una sola fila de config global, patrón idéntico a `referral_program`).

### Grupo A — Categorías especiales (Fundador/Pionero)

| Parámetro | Qué controla | Tipo | Default (= lo dicho en la reunión) |
|---|---|---|---|
| `categories[].key` | id de la categoría | `founder_one` \| `founder_two` \| `pioneer` | — |
| `categories[].totalSlots` | cupos totales | entero | 10 / 15 / 75 |
| `categories[].discountPct` | % descuento automático | entero 0–100 | 40 / 30 / 20 |
| `categories[].minPlanSortOrder` | plan mínimo requerido (`plans.sortOrder`) | entero \| null | Fundadores: `1` (2do plan) · Pionero: `null` (cualquiera) |
| `categories[].sequenceGroup` | grupo de exclusión mutua | string | `founder_one` y `founder_two` comparten `"founder-sequence"` (no pueden estar ambas `open` a la vez); `pioneer` no comparte grupo con nadie |
| `categories[].opensAfter` | qué categoría debe cerrarse antes de abrir esta | key \| null | `founder_two.opensAfter = 'founder_one'` |
| `categories[].status` | estado de apertura | `closed` \| `open` \| `full` | `founder_one: open`, `founder_two: closed`, `pioneer: open` |

> El motor de exclusión es genérico por `sequenceGroup`, no un `if` especial para Fundador Uno/Dos — si mañana se agrega "Fundador Tres" solo se configura, no se programa.

### Grupo B — Ciclo de cobro y suspensión

| Parámetro | Qué controla | Tipo | Default |
|---|---|---|---|
| `reminderDaysBefore` | días antes del vencimiento para avisar | entero | `5` |
| `gracePeriodDays` | días de gracia post-vencimiento antes de suspender | entero | `5` |
| `founderChurnBlocksReturn` | si cancela, ¿puede volver a calificar como Fundador? | boolean | `true` (nunca) |

### Grupo C — Condiciones especiales manuales (el botón)

No son "config global", son **acciones puntuales** que el super admin aplica a una cuenta (ver §3 `subscription_discounts`). El único parámetro global es:

| Parámetro | Qué controla | Tipo | Default |
|---|---|---|---|
| `maxManualDiscountPct` | tope que el slider permite otorgar sin approval extra | entero 0–100 | `100` |

---

## 3. Schema de datos

### `subscriptions` (existente — se le agregan columnas)
Modelo actual: `backend/src/modules/subscriptions/model.ts`. Se agregan:

| columna nueva | tipo | nota |
|---|---|---|
| `specialCategory` | TEXT nullable | `founder_one` \| `founder_two` \| `pioneer` \| `null` |
| `specialCategoryGrantedAt` | TEXT (ISO) | para auditar cuándo entró |
| `isRecurring` | INTEGER (boolean) | tarjeta autorizada para auto-cobro vs pago manual |
| `graceEndsAt` | TEXT (ISO) nullable | seteado al vencer `currentPeriodEnd`, se limpia al pagar |
| `suspendedAt` | TEXT (ISO) nullable | cuándo se suspendió por falta de pago |
| `suspendedReason` | TEXT nullable | `'grace_period_expired'` \| `'manual'` |

`status` (`SubscriptionStatus` en `types.ts`) gana un valor nuevo: **`suspended`** — distinto de `expired` (nunca pagó, sigue en trial vencido) y de `past_due` (venció pero todavía está en gracia). Ciclo: `active → past_due (venció, dentro de gracia) → suspended (gracia agotada) → active (paga y se reactiva)`.

### `subscription_discounts` (N filas — historial de condiciones especiales manuales)
Todo lo que sale del botón "Condiciones especiales" queda acá, no se pisa la fila de `subscriptions` — así se audita quién aplicó qué y cuándo.

| columna | tipo | nota |
|---|---|---|
| `id` | TEXT (uuid) | |
| `hotelId` | TEXT (FK hotels) | |
| `subscriptionId` | TEXT (FK subscriptions) | |
| `type` | TEXT | `percentage` \| `free_month` \| `category_bonus` (el % que trae la categoría) |
| `discountPct` | INTEGER | 0–100 |
| `startAt` / `endsAt` | TEXT (ISO) | `endsAt` null = permanente (dura mientras la categoría esté activa) |
| `appliedByUserId` | TEXT (FK users) | super admin que lo aplicó — trazabilidad |
| `reason` | TEXT nullable | nota libre |
| `status` | TEXT | `active` \| `expired` \| `revoked` |
| `createdAt` | TEXT (ISO) | |

### `special_category_config` (config del Grupo A, 3 filas — una por categoría)
Ver columnas en §2 Grupo A. Editable desde `/admin/subscriptions/settings`.

### `founder_history` (auditoría anti-recuperación)
| columna | tipo | nota |
|---|---|---|
| `id` | TEXT (uuid) | |
| `hotelId` | TEXT (FK hotels) | |
| `category` | TEXT | categoría que tuvo |
| `lostAt` | TEXT (ISO) | cuándo canceló/quedó moroso |
| `reason` | TEXT | `canceled` \| `delinquent` |

> Al aplicar una categoría especial, el motor consulta `founder_history` por `hotelId` — si hay un registro con `category` de tipo Fundador, se **rechaza** (aunque haya cupo), salvo `pioneer` que no tiene esta restricción según el documento.

**Reusa**: `hotels`, `plans`, `users` (para `appliedByUserId` y para buscar la cuenta por email).

---

## 4. Estados y flujo

### Suscripción (ciclo de cobro)
```
trialing ──(paga)──▶ active
active ──(vence currentPeriodEnd)──▶ past_due   (arranca gracia: graceEndsAt = currentPeriodEnd + gracePeriodDays)
past_due ──(paga dentro de gracia)──▶ active     (limpia graceEndsAt/suspendedAt)
past_due ──(pasa graceEndsAt sin pagar)──▶ suspended   (bloquea panel + reservas nuevas)
suspended ──(paga)──▶ active
active/past_due/suspended ──(cancela)──▶ canceled
```

### Categoría especial (Fundador)
```
none ──(super admin asigna, hay cupo, plan≥minPlanSortOrder, sin founder_history previo)──▶ founder_one|founder_two
founder_x ──(cancela suscripción o queda suspended)──▶ none + founder_history{reason} + libera 1 cupo
founder_x ──(intenta volver)──▶ RECHAZADO (founder_history existe) → solo puede recontratar a precio de mercado
```

---

## 5. Motor de reglas (cron diario, mismo patrón que `trial-reminder-cron.ts` y el night-audit)

```
para cada subscription en estado active:
    diasParaVencer = currentPeriodEnd - hoy
    if diasParaVencer == reminderDaysBefore:
        if isRecurring: enviar mensaje "se cobrará automáticamente el {fecha}"
        else:           enviar mensaje "tu plan vence, pagá para no perder el servicio"

para cada subscription en estado active con currentPeriodEnd < hoy:
    status → past_due
    graceEndsAt = currentPeriodEnd + gracePeriodDays

para cada subscription en estado past_due con graceEndsAt < hoy:
    status → suspended, suspendedAt = hoy, suspendedReason = 'grace_period_expired'
    if specialCategory is Fundador:
        founder_history.insert({hotelId, category, reason:'delinquent'})
        specialCategory = null   # pierde el beneficio, libera cupo
```

**Reactivación**: no es un cron, es el efecto del pago (`handle-stripe-event.ts` ya existe para `subscriptions`) — al confirmar el pago: `status → active`, limpia `graceEndsAt`/`suspendedAt`.

**Bloqueo real de acceso**: reusa `usecases/access.ts` (`MySubscriptionDTO.allowed`) — hoy ya calcula `allowed` para `trialing`/`expired`; se le agrega `status === 'suspended' → allowed:false, reason:'suspended'`. Este es el mismo gate que ya usa todo el panel merchant, no hay que tocar cada módulo.

---

## 6. Pantalla admin (`/admin/subscriptions`)

### Listado
Tabla de hoteles con: plan, status (badge, incluye `suspended` en rojo), vencimiento, categoría especial (badge Fundador 1/Fundador 2/Pionero si aplica), recurrente sí/no.

### Botón "Condiciones especiales" (solo `userType: admin`)
1. Buscador por email → `GET /api/admin/subscriptions/search?email=`.
2. Selecciona la cuenta encontrada.
3. Tabs: **Categoría** (radio Fundador 1/Fundador 2/Pionero/Ninguna, deshabilita las que no tienen cupo o violan `minPlanSortOrder`/`founder_history`) · **Descuento manual** (slider 0–100%, date range) · **Mes gratis** (botón directo = atajo que llama al mismo endpoint de descuento con `discountPct:100`, `durationMonths:1`).
4. Preview antes de confirmar: "Este hotel pagará $X en vez de $Y hasta el {fecha}".

### Pantalla de cupos (`/admin/subscriptions/founders-pioneers`)
3 cards (Fundador Uno, Fundador Dos, Pionero) con ocupados/disponibles, toggle abrir/cerrar por categoría (respeta `sequenceGroup`/`opensAfter` — si Fundador Uno no está `full` o cerrado a mano, no deja abrir Fundador Dos).

---

## 7. Pantalla merchant (`/panel/settings/billing`)

- Plan actual, precio, próximo vencimiento.
- Badge si tiene categoría especial o descuento activo, con fecha de fin si aplica.
- Si `status === 'past_due'`: banner de aviso + botón pagar.
- Si `status === 'suspended'`: pantalla de bloqueo (no accede al resto del panel) con botón pagar/reactivar.
- Toggle "pago recurrente" (conecta a Stripe: `create-checkout-session.ts` / `create-portal-session.ts`, ya existen).

---

## 8. Endpoints API

| Método + ruta | Auth | Qué hace |
|---|---|---|
| `GET /api/admin/subscriptions` | `admin` | Listado con filtros |
| `GET /api/admin/subscriptions/search?email=` | `admin` | Busca hotel por email de su admin |
| `GET /api/admin/subscriptions/:hotelId` | `admin` | Detalle + historial `subscription_discounts` + `founder_history` |
| `POST /api/admin/subscriptions/:hotelId/special-conditions` | `admin` | body `{type, category?, discountPct?, durationMonths?, reason}` — valida cupo/plan mínimo/`founder_history` antes de aplicar |
| `POST /api/admin/subscriptions/:hotelId/suspend` | `admin` | override manual (fuera del cron) |
| `POST /api/admin/subscriptions/:hotelId/reactivate` | `admin` | reactivar manualmente |
| `GET /api/admin/subscriptions/categories` | `admin` | config de Grupo A (cupos, %, estado) |
| `PUT /api/admin/subscriptions/categories/:key` | `admin` | editar/abrir/cerrar una categoría |
| `GET /api/subscriptions/me` | `merchant` (propio hotel) | ya existe (`access.ts`) — se le agrega `specialCategory`/`discount` activo |

> Acceso: como `admin` es un `userType` único (no hay roles granulares a nivel plataforma en el sistema actual), alcanza con `requireUserType('admin')`. No hace falta un permiso `subscriptions:*` nuevo salvo que en el futuro haya más de un rol dentro de super-admin.

---

## 9. Reglas y validaciones (no hay "anti-fraude" acá, hay reglas de negocio duras)

- **Cupo**: rechazar si `occupiedCount >= totalSlots` de la categoría.
- **Plan mínimo Fundador**: rechazar si `plan.sortOrder < category.minPlanSortOrder`, sugerir Pionero si tiene cupo.
- **Exclusión de fase**: no permitir `founder_two.status = open` si `founder_one.status = open` (y viceversa) — valida en el PUT de categorías, no solo en la asignación.
- **No recuperación de Fundador**: `founder_history` bloquea reasignación aunque haya cupo libre.
- **100% descuento = no cobro real**: al aplicar, igual se ejecuta el ciclo de facturación con `amount: 0` (no se salta el paso) para que el historial de `payments`/`invoices` (billing de plataforma) quede consistente — mismo criterio que ya usa el sistema de facturas de huéspedes con `pay-invoice.ts` (nunca "no generar el documento").

---

## 10. Integración con billing de plataforma

- Igual que `PLAN-REFERIDOS.md` §10: depende de que exista el SaaS billing de hoteles con Stripe (`subscriptions` + `create-checkout-session.ts`/`handle-stripe-event.ts` — **ya existen**, a diferencia de Referidos esto NO es una dependencia bloqueante, ya está la base).
- El descuento se traduce en un **cupón/línea de descuento de Stripe** aplicado a la suscripción del hotel (`stripeSubscriptionId`), no en recalcular el precio a mano — así el próximo cobro automático ya sale con el monto correcto sin lógica adicional en el cron.
- Mes gratis = mismo mecanismo con `discountPct: 100` y `durationMonths: 1`.

---

## 11. Plan de implementación por fases

| Fase | Qué | Gate |
|---|---|---|
| **F0** | ⚠️ Dependencia: el catálogo de **6 planes oficiales** (Host/Essential/Starter/Professional/Enterprise/Ultra, sección "Planes" del documento) todavía no existe — hoy `plans` solo tiene 3. `minPlanSortOrder` no tiene sentido sin el catálogo real. | Catálogo de planes cargado con `sortOrder` definitivo |
| **F1** | Migración: columnas nuevas en `subscriptions` + tablas `subscription_discounts`, `special_category_config`, `founder_history` + status `suspended` en el enum | `arckode analyze` 0 violaciones |
| **F2** | Motor cron (recordatorio 5 días, gracia, suspensión, reactivación) — extiende `trial-reminder-cron.ts` existente | Tests de los 5 estados del ciclo |
| **F3** | Endpoints admin (`special-conditions`, `search`, `categories`) + validaciones de §9 | Tests de rechazo (sin cupo, plan bajo, founder_history) |
| **F4** | Pantalla admin: buscador + botón "Condiciones especiales" + pantalla de cupos | Aplicar categoría end-to-end desde UI |
| **F5** | Pantalla merchant: billing con badge de descuento + bloqueo real por `suspended` | Un hotel suspendido no puede operar el panel |
| **F6** | Integración Stripe (cupón real en la suscripción) | El próximo cobro automático sale con el descuento aplicado |

---

## 12. Riesgos y edge cases

| Riesgo | Mitigación |
|---|---|
| Cambiar `discountPct` de una categoría con Fundadores ya asignados | `subscription_discounts.discountPct` es snapshot al momento de aplicar — no se recalcula retroactivo |
| Dos super admins asignan el último cupo a la vez (race) | `UPDATE special_category_config SET occupiedCount = occupiedCount + 1 WHERE key=? AND occupiedCount < totalSlots` atómico, no leer-luego-escribir |
| Hotel suspendido con reservas ya confirmadas de huéspedes | La suspensión bloquea el **panel** y **nuevas** reservas entrantes (Channel Manager), no cancela reservas existentes — el documento no pide eso |
| `isRecurring` sin tarjeta real cargada en Stripe | No debe poder togglearse `isRecurring:true` sin `stripeCustomerId` con payment method — validar antes de guardar |
| Fundador que pausa por error humano (no por mora real) | `suspendedReason:'manual'` no dispara `founder_history` (solo `'grace_period_expired'` lo hace) — un suspend manual no debe costarle la categoría a alguien que sí pagaba |

---

## 13. Abierto / a confirmar con el dueño

- El documento no define el **precio de mercado** al que vuelve un ex-Fundador (¿el plan que elija a precio de lista, sin ningún piso especial?) — asumido: precio de lista normal, sin restricción de plan mínimo (ya no es Fundador).
- No define si `suspended` debe además **ocultar el hotel del Channel Manager** activamente (des-sincronizar) o solo dejar de aceptar nuevas reservas desde el panel — el documento solo dice "las reservas no deben seguir llegando", tomado como: dejar de *procesar* reservas entrantes, no como acción activa sobre cada canal externo (eso requeriría confirmar con Channex).
