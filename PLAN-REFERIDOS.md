# PLAN-REFERIDOS — Programa de Referidos configurable (SOLMI OS)

> Programa de referidos **B2B**: un hotel recomienda SOLMI OS a otro hotel.
> Doble incentivo (referidor + referido). **100% configurable desde el admin, sin deploy.**

---

## 0. Principio rector — cero hardcode

**Ningún valor de negocio vive en el código.** Ni los meses, ni los tramos, ni los planes válidos, ni el "3 meses activo".
El código implementa **un motor genérico** que lee la configuración y evalúa. El admin cambia las reglas por UI.

| ❌ Prohibido (hardcode) | ✅ Correcto (configurable) |
|---|---|
| `if (activeMonths >= 3)` | `if (activeMonths >= config.activeMonthsRequired)` |
| Tabla de tramos en código | Tabla `referral_tiers` editable |
| `plan.price === 199` | `plan.price` leído de `plans` + valor calculado según `creditBasePlan` |

> Regla de oro: si un número o una regla puede cambiar sin tocar código → **es un parámetro**.

### 🏛️ Ownership — la config es del ADMIN DE LA PLATAFORMA (global)

| Quién | `userType` / ruta | Qué hace con el programa |
|---|---|---|
| **Plataforma (SOLMI OS)** | `admin` (super_admin) · `/admin/*` | **Define y configura TODO** el programa. Es **una sola config global** para todos los hoteles. |
| **Hotel (merchant)** | `merchant` · `/panel/*` | **Solo participa**: comparte su link, ve sus referidos y créditos. **No configura** el programa. |

> `referral_program` = **1 fila global**, NO una config por hotel. El programa pertenece a la plataforma; los hoteles son actores del programa, no sus dueños. Un cambio desde `/admin` impacta a toda la plataforma al instante.

---

## 1. El modelo (resumen)

- **Referidor**: hotel existente (`merchant`) que ya usa SOLMI OS.
- **Referido**: hotel nuevo que se suma usando el código del referidor.
- **Recompensa al referido**: 1er mes gratis (configurable).
- **Recompensa al referidor**: meses gratis de su suscripción, **escalonados por cantidad** de referidos válidos.
- **Validez**: un referido "cuenta" recién cuando estuvo **N meses activo** (regla de los 3 meses, configurable).

---

## 2. Parámetros configurables — el corazón del sistema

Estos son **todos** los knobs. El admin los edita en `/admin/referrals/program`. Cada uno tiene un default razonable.

### Grupo A — Recompensa al referidor

| Parámetro | Qué controla | Tipo | Default |
|---|---|---|---|
| `rewardType` | Forma del premio | `months_free` \| `credit_amount` \| `discount_pct` | `months_free` |
| `referral_tiers` | Tramos escalonados (tabla aparte) | colección `{fromCount, months}` | ver §3 |

**Tramos por default** (= la foto):

| fromCount (referido nº) | monthsGranted (suma) |
|---|---|
| 1 | 1 |
| 2 | 1 |
| 3 | 2 |
| 4 | 2 |
| 5 | 3 (aplica a 5º y siguientes) |

### Grupo B — Validez del referido (la regla de los 3 meses)

| Parámetro | Qué controla | Tipo | Default |
|---|---|---|---|
| `activeMonthsRequired` | Meses que el referido debe estar activo para validar | entero | `3` |
| `trialMonthCounts` | ¿El mes gratis del referido cuenta en esos N? | boolean | `false` |
| `mustBeConsecutive` | ¿Si pausa un mes, se reinicia el contador? | boolean | `true` |
| `validPlans` | Planes que cuentan como "activos" | array de plan ids | todos los pagos |
| `requirePaidStatus` | El referido debe tener suscripción paga al día | boolean | `true` |

### Grupo C — Cálculo del mes gratis (las "dos cosas para planes")

| Parámetro | Qué controla | Tipo | Default |
|---|---|---|---|
| `creditBasePlan` | ¿Sobre qué plan se calcula el mes gratis? | `referrer` \| `referred` | `referrer` |
| `valuationMoment` | ¿Valor al ganarlo o al aplicarlo? | `earned` \| `applied` | `applied` |
| `applyAutomatically` | ¿Se descuenta solo del próximo ciclo? | boolean | `true` |

> Esto resuelve lo de "plan del referidor vs referido" y "cuándo se valúa": **no se decide en código, lo setea el admin.**

### Grupo D — Recompensa al referido (bienvenida)

| Parámetro | Qué controla | Tipo | Default |
|---|---|---|---|
| `referredRewardType` | Forma del premio de bienvenida | `first_month_free` \| `discount_pct` | `first_month_free` |
| `referredRewardValue` | % de descuento en el 1er ciclo | entero 0–100 | `100` |

### Grupo E — Topes, expiración y clawback

| Parámetro | Qué controla | Tipo | Default |
|---|---|---|---|
| `maxAccumulatedMonths` | Máximo de meses gratis acumulables | entero \| null | `12` |
| `creditExpiresMonths` | Meses sin usar → expira | entero \| null | `12` |
| `clawbackWindowDays` | Días post-validación: si el referido churnea, se revoca | entero | `30` |

### Grupo F — Tracking y vinculación

| Parámetro | Qué controla | Tipo | Default |
|---|---|---|---|
| `codeFormat` | Formato del código | `slug` \| `hash` | `slug` (ej. `hotel-mar`) |
| `landingUrl` | URL base del aterrizaje | string | `https://app.solmios.com/r/{code}` |
| `requireExplicitCode` | ¿El referido debe meter el código a mano si no viene por link? | boolean | `false` |

### Grupo G — Estado del programa

| Parámetro | Qué controla | Tipo | Default |
|---|---|---|---|
| `enabled` | Programa activo globalmente | boolean | `false` |
| `programName` | Nombre visible | string | `Cómo crece SOLMI OS` |

---

## 3. Schema de datos

### `referral_program` (1 fila — config global de plataforma)
Guarda **todos** los parámetros escalares de los grupos A, C, D, E, F, G. Una sola fila editable.

### `referral_tiers` (N filas — tramos escalonados)
| columna | tipo | nota |
|---|---|---|
| `id` | TEXT (uuid) | |
| `fromCount` | INTEGER | referido nº a partir del cual aplica (1, 2, 3, 4, 5) |
| `monthsGranted` | INTEGER | meses que suma cada referido en ese tramo |
| `sortOrder` | INTEGER | orden de evaluación |

### `referrals` (1 fila por referido)
| columna | tipo | nota |
|---|---|---|
| `id` | TEXT (uuid) | |
| `referrerHotelId` | TEXT (FK hotels) | quien refiere |
| `referredHotelId` | TEXT (FK hotels, nullable al inicio) | el nuevo hotel |
| `code` | TEXT UNIQUE | código usado |
| `status` | TEXT | `pending` \| `trial` \| `active` \| `validated` \| `churned` |
| `activeMonthsCount` | INTEGER | contador de meses activos |
| `createdAt` / `validatedAt` | TEXT (ISO) | timestamps |

### `referral_credits` (1 fila por bono ganado)
| columna | tipo | nota |
|---|---|---|
| `id` | TEXT (uuid) | |
| `referralId` | TEXT (FK referrals) | referido que lo generó |
| `referrerHotelId` | TEXT (FK hotels) | a quién se le acredita |
| `monthsGranted` | INTEGER | meses que vale |
| `status` | TEXT | `pending` \| `released` \| `applied` \| `expired` \| `revoked` |
| `basePlanId` | TEXT (FK plans) | plan sobre el que se calculó (snapshot) |
| `baseAmount` | REAL | valor del mes al calcularse |
| `earnedAt` / `releasedAt` / `appliedAt` | TEXT (ISO) | timestamps |
| `appliedToInvoiceId` | TEXT (nullable) | factura donde se consumió |

**Reusa tablas existentes**: `hotels`, `plans` (suscripción SaaS), y el billing de plataforma (Stripe subscriptions).

---

## 4. Estados y flujo

### Referido
```
pending ──(se registra con código)──▶ trial   (mes 1: gratis, según referredReward)
trial   ──(empieza a pagar)────────▶ active  (contador de meses activos++)
active  ──(cumple activeMonthsRequired)──▶ validated  ✅ libera crédito
active  ──(churn antes de validar)──▶ churned   ❌ no genera crédito
```

### Crédito del referidor
```
pending ──(referido validated)──▶ released ──(próximo ciclo factura)──▶ applied
released ──(excede creditExpiresMonths)──▶ expired
released/applied ──(churn del referido dentro clawbackWindowDays)──▶ revoked
```

---

## 5. Motor de reglas (el evaluador)

Worker / cron **diario** (reutiliza el patrón del night-audit). Pseudo-lógica determinística, **no IA**:

```
para cada referido en estado active:
    if cumpleActivo(referido, config):        # activeMonthsRequired, trialMonthCounts,
                                             # mustBeConsecutive, validPlans, requirePaidStatus
        meses = tierMonths(contadorDelReferidor, referral_tiers)
        crear referral_credit { status: released, monthsGranted: meses,
                                basePlan: resolverBase(config.creditBasePlan),
                                baseAmount: precioSegun(config.valuationMoment) }
        referido → validated

para cada credit released:
    if applyAutomatically and hayPróximoCiclo(referrer):
        aplicar al próximo invoice del referidor → status: applied

para cada credit released sin aplicar:
    if (hoy - releasedAt) > creditExpiresMonths → expired

para cada referido validated que churneó:
    if (hoy - validatedAt) <= clawbackWindowDays → revoke su crédito
```

> **Importante**: el motor solo **lee** `referral_program` y `referral_tiers`. Si el admin cambia la regla a "2 meses" o "que el trial cuente", el motor lo refleja al día siguiente sin tocar una línea de código.

---

## 6. Pantalla admin — configuración (`/admin/referrals/program`)

**Acceso**: `userType: admin` (super_admin de la plataforma) · ruta bajo `/admin/*` · permiso `referrals:edit`.
Es la **única** pantalla que edita el programa. **Global**: un solo cambio aplica a todos los hoteles. Los `merchant` (`/panel/*`) no llegan acá.

- Toggle `enabled`.
- Form con **todos** los parámetros de §2 (grupos A–G).
- **Editor de tramos**: tabla editable (agregar / editar / quitar filas `fromCount` / `monthsGranted`).
- **Vista previa en vivo** del ejemplo (como la foto): "refieres 3 hoteles Starter → 1+1+2 = 4 meses = $796".
- Validación al guardar: tramos no solapados, meses ≥ 0, `activeMonthsRequired` ≥ 1.

### Dashboard de métricas (`/api/admin/referrals/metrics`)
- Total referidos, % que validaron (conversión trial→validated).
- Costo del programa (ingresos diferidos = suma de créditos aplicados).
- Top embajadores (hoteles que más refieren).
- Tiempo promedio hasta validación.

---

## 7. Pantalla merchant — "Mis referidos" (dentro del panel del hotel)

- **Mi link + código + QR** + botones compartir (WhatsApp/email) con texto configurable.
- **Tabla de mis referidos**: estado (`trial` / `active 2/3` / `validated`) y fecha.
- **Mis créditos**: pendientes / liberados / aplicados + meses gratis acumulados + tope (`maxAccumulatedMonths`).
- **Progreso al próximo tramo** ("te falta 1 referido para sumar 3 meses").
- Aviso cuando un crédito se aplica: *"Este mes no pagás, cortesía de tus referidos."*

---

## 8. Endpoints API

| Método + ruta | Permiso | Qué hace |
|---|---|---|
| `GET /api/admin/referrals/program` | `referrals:view` | Lee la config |
| `PUT /api/admin/referrals/program` | `referrals:edit` | Actualiza parámetros |
| `GET/POST/PUT/DELETE /api/admin/referrals/tiers` | `referrals:edit` | CRUD de tramos |
| `GET /api/admin/referrals/metrics` | `referrals:view` | Dashboard |
| `GET /api/referrals/me` | propio hotel | Mis referidos + créditos |
| `GET /api/referrals/share-link` | propio hotel | Link/código/QR |
| `GET /r/:code` | público | Landing de signup con código pre-cargado |
| `POST /api/signup` con `referralCode` | público | Alta del referido, vincula |

> Convención SOLMI OS: rutas en **inglés**, UI en español, multi-tenant por `hotelId`.

---

## 9. Anti-fraude

- **No autoreferral**: `referrerHotelId !== referredHotelId` + match por dominio / datos fiscales / email (no solo ID).
- **`validPlans`** excluye trials/free → un referido "activo" siempre paga.
- **`activeMonthsRequired` + `requirePaidStatus`** = gate de calidad.
- **`clawbackWindowDays`** revoca si el referido se va apenas validar.
- Tope `maxAccumulatedMonths` evita el caso "nunca más pago".

---

## 10. Integración con el billing de plataforma

- El programa **no inventa facturación**: se engancha al SaaS billing existente (`plans` + Stripe subscriptions).
- **Mes gratis del referido** → 100% off en su 1er invoice (cupón Stripe / línea de descuento).
- **Mes gratis del referidor** → al aplicar un crédito, se descuenta del próximo invoice de su suscripción.
- `baseAmount` se calcula del `plan.price` según `creditBasePlan` y `valuationMoment`.

> ⚠️ **Verificar al implementar**: ¿SOLMI OS factura suscripciones de hoteles con Stripe ya integrado? Si no existe el SaaS billing, **eso es una dependencia previa** (Fase 0).

---

## 11. Plan de implementación por fases

| Fase | Qué | Gate |
|---|---|---|
| **F0** | Confirmar/crear SaaS billing de hoteles (si falta) | Stripe subscriptions funcionando |
| **F1** | Schema (`referral_program`, `referral_tiers`, `referrals`, `referral_credits`) + migración + defaults | `arckode analyze` 0 violaciones |
| **F2** | Motor de evaluación (cron) + liberación/aplicación de créditos | Tests de los estados |
| **F3** | Pantalla admin de configuración + editor de tramos + vista previa | Config editable sin deploy |
| **F4** | Pantalla merchant + share link + tracking `/r/:code` | Referido se vincula solo |
| **F5** | Integración billing (aplicar créditos al invoice) | Mes gratis aplicado end-to-end |
| **F6** | Métricas + anti-fraude + clawback | Dashboard + revoque probado |

---

## 12. Riesgos y edge cases

| Riesgo | Mitigación |
|---|---|
| **Cambiar config con referidos en curso** | Snapshot del `referral_program` al crear cada referido/crédito (reglas vigentes al ganar) o policy explícita "nuevos parámetros solo aplican a nuevos referidos" |
| **Referido cambia de plan** | `valuationMoment: applied` recalcula al consumir; `earned` freeza al ganar |
| **Referidor cancela su suscripción** | Créditos no aplicables se congelan (`on_hold`) hasta reactivación o expiran |
| **Config inválida** (tramos solapados, meses negativos) | Validar al guardar (backend + frontend) |
| **Fraude de autoreferral con cuentas nuevas** | Validación por dominio/fiscal/email, no por ID |
| **Acumulación explosiva** (10 referidos = 24 meses) | `maxAccumulatedMonths` con default 12 |

---

## 13. Defaults para arrancar (= la foto)

```yaml
enabled: true
programName: "Cómo crece SOLMI OS"
rewardType: months_free
referral_tiers:
  - { fromCount: 1, monthsGranted: 1 }
  - { fromCount: 2, monthsGranted: 1 }
  - { fromCount: 3, monthsGranted: 2 }
  - { fromCount: 4, monthsGranted: 2 }
  - { fromCount: 5, monthsGranted: 3 }
activeMonthsRequired: 3
trialMonthCounts: false
mustBeConsecutive: true
requirePaidStatus: true
creditBasePlan: referrer
valuationMoment: applied
applyAutomatically: true
referredRewardType: first_month_free
referredRewardValue: 100
maxAccumulatedMonths: 12
creditExpiresMonths: 12
clawbackWindowDays: 30
codeFormat: slug
```

---

## Cobertura de requisitos

| Requerimiento | Cubierto en |
|---|---|
| Programa de referidos B2B (hotel→hotel) | §1 |
| Doble incentivo (referidor + referido) | §1, grupos A + D |
| Regla "3 meses activo" para validar | §2 grupo B, §5 |
| "Dos cosas para planes" (cálculo del mes) | §2 grupo C |
| **Todo configurable, cero hardcode** | §0, §2, §3, §5 |
| Detalle de cada cosa (schema, estados, API, UI, fases) | §3–§11 |
| Defaults iguales a la foto | §13 |
