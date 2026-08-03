# PLAN-ALIADOS — Programa de Aliados y Aliados Certificados (SOLMI OS)

> Cubre GitLab #550–#554 ("Aliados | ...") + secciones de "Aliados Certificados" del documento (todavía sin subir a GitLab — ver mensaje anterior). NO es lo mismo que `PLAN-REFERIDOS.md`.

## ⚠️ DECISIÓN FINAL (2026-08-04) — alcance reducido, este documento queda como referencia histórica

Lo implementado (commits `6eaf0e6`, `dc3db18`, `f78192d`, módulo `backend/src/modules/aliados/`) **NO sigue este plan**: no existe el actor `allies` nuevo, ni `ally_hotels`, ni `userType: 'ally'`, ni el portal `/ally/*`. En cambio, "Aliado" se implementó como un atributo (`Partners.hotelId`) sobre un hotel que YA es cliente de SolmiOS y se convierte vía Referidor→Aliado (#549).

**El dueño confirmó explícitamente aceptar este alcance reducido** en vez de construir el actor externo separado que describe este documento (§0–§8). Esto significa:

- ✅ Cubierto: un hotel que refiere a otros hoteles puede convertirse en Aliado y cobrar comisión en dinero (escalonada o fija si Certificado), con las mismas reglas de validación/clawback/pago único que este plan describe.
- ❌ NO cubierto, y NO se va a construir salvo que el dueño lo pida explícitamente de nuevo: personas/empresas externas SIN cuenta de hotel (contadores, consultores, agencias de viaje, influencers) registrándose como Aliados. Esa era la persona **principal** que describe §0/§1 de este documento — quedó fuera.
- GitLab #550 ("Registro de Aliado") se cerró como decisión de producto, no como implementado.
- Las secciones de abajo (§3 schema `allies`/`ally_hotels`, §6 Back Office con `userType:'ally'`, §11 fases F3/F4/F7) describen el diseño que NO se construyó — no usar como referencia de "qué falta hacer", son historia de una arquitectura descartada.

## 0. Aliado ≠ Referidor — la distinción que hay que respetar en el modelo

| | **Referidor** (`PLAN-REFERIDOS.md`) | **Aliado** (este documento) |
|---|---|---|
| Quién es | Un **hotel** que ya usa SOLMI OS | Una **persona/empresa externa** (contador, consultor, agencia de viajes, influencer, vendedor) que NO necesariamente usa SOLMI OS |
| Qué recibe | **Meses gratis** de su propia suscripción | **Dinero** (comisión) |
| Dónde vive | `hotels` es el actor | Actor nuevo: `allies` |
| Conversión | Un Referidor con 5+ hoteles puede **convertirse en Aliado** (`Referidos | Conversión de referidor a Aliado`, #549) — cambia de "meses gratis" a "comisión en dinero" | — |

**Cero hardcode** — mismo principio que `PLAN-REFERIDOS.md` §0: tramos de comisión, % del Aliado Certificado, ventana de validación, todo en tablas de config, no en código.

---

## 1. El modelo (resumen)

- **Aliado**: persona registrada que trae hoteles nuevos a SOLMI OS mediante su propio link/código.
- **Aliado Certificado**: Aliado que pasó un proceso de evaluación. Empieza en 20% fijo (no escalona desde 10%) y tiene acceso a un **Back Office** (super-admin limitado a sus propios hoteles).
- **Recompensa**: comisión mensual recurrente (mientras el hotel siga activo) **o** pago único equivalente a un mes (solo Aliado normal — el Certificado NO puede elegir pago único).
- **Validación**: igual que Referidos — el hotel referido debe estar 3 meses activo antes de liberar la comisión.

---

## 2. Parámetros configurables (`ally_program`, 1 fila global, `/admin/allies/program`)

### Grupo A — Comisión del Aliado normal (escalonada)

| Parámetro | Qué controla | Tipo | Default |
|---|---|---|---|
| `commission_tiers` | tramos `{fromHotelCount, percentage}` | tabla aparte (`ally_commission_tiers`) | **⚠️ SIN DEFINIR** — ver §13 |
| `maxCommissionPct` | tope superior | entero | `20` (confirmado en el documento) |
| `startCommissionPct` | punto de partida | entero | `10` (confirmado) |

> El documento es explícito: **"el dueño no recordó la cantidad exacta de hoteles por nivel... no deben inventarse los rangos que no quedaron confirmados"**. Los 5 valores (10/12/15/18/20%) están confirmados, los **umbrales de cantidad de hoteles no**. F3 (§11) queda bloqueada hasta tener esa tabla — el schema se construye igual (tramos configurables), pero no se puede seedear con números inventados.

### Grupo B — Comisión del Aliado Certificado

| Parámetro | Qué controla | Tipo | Default |
|---|---|---|---|
| `certifiedCommissionPct` | % fijo desde el primer hotel | entero | `20` |
| `certifiedAllowsOneTime` | ¿puede elegir pago único? | boolean | `false` (el documento lo prohíbe explícitamente) |

### Grupo C — Validación y pago

| Parámetro | Qué controla | Tipo | Default |
|---|---|---|---|
| `activeMonthsRequired` | meses que el hotel debe estar activo para liberar comisión | entero | `3` (mismo valor que Referidos, configurable independiente) |
| `oneTimePayoutMonths` | a cuántos meses de plan equivale el pago único | entero | `1` |
| `payoutHoldDays` | días de gracia antes de pagar tras liberar (proceso administrativo) | entero | `0` (a definir con Finanzas) |

### Grupo D — Certificación

| Parámetro | Qué controla | Tipo | Default |
|---|---|---|---|
| `certificationQuestions` | banco de preguntas de la solicitud | colección editable | ver §6 |
| `certificationPassScore` | nota mínima del examen post-tutoriales | entero 0–100 | **⚠️ sin definir por el dueño** |
| `certificationTutorialUrls` | videos/tutoriales asignados | array de URLs | vacío |

---

## 3. Schema de datos

### `allies` (1 fila por Aliado)
| columna | tipo | nota |
|---|---|---|
| `id` | TEXT (uuid) | |
| `name` | TEXT | |
| `email` | TEXT UNIQUE | login del Back Office si es certificado |
| `phone` | TEXT nullable | |
| `type` | TEXT | `standard` \| `certified` |
| `payoutMode` | TEXT | `monthly` \| `one_time` (solo válido `one_time` si `type=standard`) |
| `code` | TEXT UNIQUE | código/slug de su link de venta |
| `status` | TEXT | `active` \| `suspended` |
| `originReferralHotelId` | TEXT nullable (FK hotels) | si nació de una conversión Referidor→Aliado (#549), queda el rastro |
| `createdAt` / `updatedAt` | TEXT (ISO) | |

### `ally_hotels` (1 fila por hotel incorporado por un Aliado)
| columna | tipo | nota |
|---|---|---|
| `id` | TEXT (uuid) | |
| `allyId` | TEXT (FK allies) | |
| `hotelId` | TEXT (FK hotels) | |
| `status` | TEXT | `pending` \| `active` \| `validated` \| `churned` — mismo patrón de estados que `referrals.status` |
| `activeMonthsCount` | INTEGER | |
| `createdAt` / `validatedAt` | TEXT (ISO) | |

### `ally_commission_tiers` (N filas — Grupo A, hoy sin seedear, ver §13)
| columna | tipo |
|---|---|
| `id` | TEXT (uuid) |
| `fromHotelCount` | INTEGER |
| `percentage` | INTEGER |

### `ally_commissions` (1 fila por comisión generada — mensual o pago único)
| columna | tipo | nota |
|---|---|---|
| `id` | TEXT (uuid) | |
| `allyHotelId` | TEXT (FK ally_hotels) | |
| `allyId` | TEXT (FK allies) | |
| `type` | TEXT | `monthly` \| `one_time` |
| `period` | TEXT nullable | `YYYY-MM`, solo para `monthly` |
| `percentage` | INTEGER | snapshot del tramo/% al momento de generarse |
| `basePlanAmount` | REAL | precio del plan del hotel ese período |
| `amount` | REAL | `basePlanAmount * percentage / 100` (o `basePlanAmount * oneTimePayoutMonths` si `one_time`) |
| `status` | TEXT | `pending` \| `released` \| `paid` \| `revoked` |
| `earnedAt` / `releasedAt` / `paidAt` | TEXT (ISO) | |

### `certified_ally_applications` (solicitud de certificación)
| columna | tipo | nota |
|---|---|---|
| `id` | TEXT (uuid) | |
| `allyId` | TEXT (FK allies) | el aliado ya existe como `standard` antes de aplicar |
| `answers` | TEXT (JSON) | respuestas al cuestionario de experiencia |
| `tutorialsCompletedAt` | TEXT (ISO) nullable | |
| `examScore` | INTEGER nullable | |
| `status` | TEXT | `submitted` \| `in_review` \| `approved` \| `rejected` |
| `reviewedByUserId` | TEXT (FK users) nullable | super admin que aprobó/rechazó |
| `createdAt` / `resolvedAt` | TEXT (ISO) | |

**Reusa**: `hotels`, `plans`, `users` (revisor). El Back Office del Certificado necesita un actor de auth nuevo — ver §6.

---

## 4. Estados y flujo

### Hotel incorporado por un Aliado
```
pending ──(hotel completa alta con código del aliado)──▶ active
active ──(cumple activeMonthsRequired)──▶ validated  ──▶ genera primera ally_commission
active ──(churn antes de validar)──▶ churned  (no genera comisión)
```

### Comisión
```
monthly:  cada ciclo de facturación del hotel validado → pending → released (automático, no hay "esperar 3 meses" de nuevo, eso ya pasó al validar) → paid
one_time: se genera UNA vez al validar → pending → released → paid; el ally_hotel queda flagged "ya cobrado" (no genera más comisiones mensuales)
```

### Certificación
```
standard ──(solicita)──▶ certified_ally_applications: submitted
submitted ──(responde preguntas + completa tutoriales)──▶ in_review
in_review ──(rinde examen, score ≥ certificationPassScore)──▶ approved → allies.type = 'certified'
in_review ──(score < certificationPassScore)──▶ rejected (el documento no aclara si puede reintentar — asumido: sí, nueva solicitud)
```

---

## 5. Motor de reglas (cron diario, mismo patrón que Referidos)

```
para cada ally_hotel en active:
    if activeMonthsCount >= activeMonthsRequired and hotel.subscription.status in ('active'):
        status → validated
        if ally.payoutMode == 'one_time':
            crear ally_commission { type:'one_time', amount: plan.price * oneTimePayoutMonths, status:'released' }
        # si es 'monthly', las comisiones se generan por ciclo de facturación del hotel (evento, no cron diario)

en cada ciclo de facturación exitoso de un hotel con ally_hotel.status='validated' y ally.payoutMode='monthly':
    percentage = ally.type == 'certified' ? certifiedCommissionPct : tierPercentage(count(ally_hotels validados de este ally), ally_commission_tiers)
    crear ally_commission { type:'monthly', period, percentage, amount: plan.price * percentage/100, status:'released' }

para cada ally_hotel validated que churnea antes de completar el ciclo en curso:
    revocar (status:'revoked') cualquier ally_commission 'pending' de ese período — no la ya 'paid'
```

> Igual que en Referidos: el motor **lee** `ally_program`/`ally_commission_tiers`, nunca decide un número a mano.

---

## 6. Back Office del Aliado Certificado — la pieza más grande de este módulo

El documento es explícito: *"la diferencia no es una medalla, es un Back Office... funciona como un Super Admin limitado"*. Esto es una decisión de arquitectura, no solo de UI:

- **Nuevo actor de auth**: no es `admin` (ve todo) ni `merchant` (es dueño de un hotel). Se necesita `userType: 'ally'` (o reutilizar `admin` con un `scopeAllyId` — **desaconsejado**: mezclar el rol de máximo privilegio con un scope filtrado es la clase de bug que ya está documentada en este proyecto como "silent field drop" / permisos mal filtrados; mejor un tipo propio).
- **Filtro obligatorio**: todo query de este actor lleva `WHERE hotelId IN (SELECT hotelId FROM ally_hotels WHERE allyId = :self)` — igual patrón que `hotelId` en multi-tenancy, pero en vez de "1 hotel" es "N hoteles propios".
- **Menú reducido**: solo lo que el documento autoriza — ver configuraciones básicas (foto, descripción), no cerraduras/pagos/nada que "requiera escalar a SOLMI OS".
- **Ruta**: `/ally/*` en el frontend, layout propio (no reusar `SuperAdminLayout.vue` tal cual — mismo look, menú distinto).

---

## 7. Pantalla Aliado — "Mi Back Office" (`/ally/dashboard`)

- Mis hoteles (los de `ally_hotels`), estado de cada uno.
- Mis comisiones: pendientes / liberadas / pagadas, por mes.
- Configuración básica de cada hotel propio (foto, descripción, ubicación en Maps) — con botón "escalar a SOLMI OS" para lo que no puede tocar.
- Si es `standard`: botón "Solicitar certificación" → dispara `certified_ally_applications`.
- Mi link + código para compartir.

## 7bis. Pantalla admin (`/admin/allies`)

- Listado de Aliados (normal/certificado), sus hoteles, comisiones acumuladas.
- Bandeja de solicitudes de certificación (`certified_ally_applications` en `submitted`/`in_review`) — aprobar/rechazar, ver respuestas y score.
- Editor de `ally_commission_tiers` (bloqueado hasta tener los umbrales reales — ver §13).

---

## 8. Endpoints API

| Método + ruta | Auth | Qué hace |
|---|---|---|
| `POST /api/allies/apply` | público (o `merchant` si viene de conversión Referidor→Aliado) | Alta de un Aliado |
| `GET /api/ally/me` | `ally` | Su dashboard: hoteles + comisiones |
| `GET /api/ally/hotels/:hotelId` | `ally` (ownership vía `ally_hotels`) | Config básica de un hotel propio |
| `PATCH /api/ally/hotels/:hotelId` | `ally` | Editar lo autorizado (foto/descripción) |
| `POST /api/ally/certification/apply` | `ally` (`type=standard`) | Envía solicitud + respuestas |
| `POST /api/ally/certification/exam` | `ally` | Envía resultado del examen |
| `GET /api/admin/allies` | `admin` | Listado |
| `GET /api/admin/allies/certifications` | `admin` | Bandeja de solicitudes |
| `POST /api/admin/allies/certifications/:id/resolve` | `admin` | Aprobar/rechazar |
| `GET/PUT /api/admin/allies/tiers` | `admin` | CRUD de tramos de comisión |
| `GET /r/ally/:code` | público | Landing de signup con código de Aliado (mismo mecanismo de tracking que `/r/:code` de Referidos, pero vincula a `ally_hotels` en vez de `referrals`) |

---

## 9. Reglas duras

- **Certificado no puede pago único**: `certifiedAllowsOneTime=false` bloqueado en backend, no solo ocultado en UI.
- **Conversión Referidor→Aliado** (#549): al convertir, el hotel de origen deja de acumular meses gratis por *nuevos* referidos y sus referidos futuros entran como `ally_hotels`; los créditos ya generados como Referidor (`referral_credits`) no se tocan retroactivo.
- **Un hotel = un solo canal de atribución**: si un hotel llega por link de Aliado, no puede *también* contar como referido de un hotel (evitar doble comisión sobre el mismo alta) — el signup guarda un solo `attributionType` (`referral` \| `ally`) resuelto por el primer código válido usado.
- **Comisión mensual depende de que el hotel siga pagando**: si el hotel referido cae en `suspended` (`PLAN-SUSCRIPCIONES.md`), ese período no genera `ally_commission`.

---

## 10. Integración con billing de plataforma

- Mismo patrón que Referidos: no inventa cobro, se engancha al evento de "ciclo de facturación exitoso" del hotel (Stripe invoice.paid de la suscripción de plataforma).
- El pago AL Aliado (transferencia real de dinero) **no está definido en el documento** — solo se define cuánto se le debe (`ally_commissions.amount`). El "pagar de verdad" es un proceso manual de Finanzas marcando `status: paid`, no una integración de payouts automática (no hay Stripe Connect ni similar mencionado). Si se necesita automatizar, es una fase futura no cubierta acá.

---

## 11. Plan de implementación por fases

| Fase | Qué | Gate |
|---|---|---|
| **F0** | Confirmar con el dueño: umbrales reales de `ally_commission_tiers` (§13) y `certificationPassScore` — **bloqueante para F3 en adelante**, no para F1/F2 | Documento con los rangos reales |
| **F1** | Schema completo (`allies`, `ally_hotels`, `ally_commission_tiers`, `ally_commissions`, `certified_ally_applications`) + migración | `arckode analyze` 0 violaciones |
| **F2** | Motor de validación (3 meses) + generación de comisiones (mensual/pago único) | Tests de los 3 flujos de estado |
| **F3** | Auth nuevo `userType: 'ally'` + ownership por `ally_hotels` | Un Aliado no puede ver hoteles de otro Aliado (test de aislamiento, mismo patrón que multi-tenancy) |
| **F4** | Back Office del Certificado (`/ally/*`) — menú reducido, config básica | QA de menú: solo aparecen las opciones autorizadas |
| **F5** | Flujo de certificación completo (solicitud → preguntas → tutoriales → examen → aprobación) | Un `standard` certificado pasa a `certified` con 20% desde el próximo hotel |
| **F6** | Pantalla admin (listado, bandeja de certificaciones, editor de tramos) | Aprobar/rechazar end-to-end |
| **F7** | Landing `/r/ally/:code` + integración con conversión Referidor→Aliado (#549) | Un Referidor con 5+ hoteles puede convertirse sin perder su historial |

---

## 12. Riesgos y edge cases

| Riesgo | Mitigación |
|---|---|
| Aliado certificado con `ally_hotels` de antes de certificarse | Al aprobar, `certifiedCommissionPct` aplica solo a comisiones **futuras** — las `pending`/`released` previas mantienen su `percentage` snapshot (mismo criterio que Fundadores en `PLAN-SUSCRIPCIONES.md`) |
| Doble atribución (mismo hotel llega por link de Aliado Y de Referidor) | `attributionType` único, resuelto por orden de llegada del código en el signup |
| Aliado suspendido con comisiones `pending` | `pending` queda congelada, no se libera hasta reactivar (mismo patrón `on_hold` de Referidos) |
| Examen de certificación sin nota mínima definida | Bloquear F5 hasta tener `certificationPassScore` real — no inventar un número |
| Back Office mal filtrado (bug histórico del proyecto: recursos resueltos por el id equivocado, ver memoria `guests-detail-alignment`/`silent-field-drop-in-usecase-create`) | Todo endpoint `/api/ally/*` valida ownership vía `ally_hotels`, nunca confía en un `hotelId` que venga del cliente sin cruzarlo contra la tabla de relación |

---

## 13. Abierto / a confirmar con el dueño (NO inventar)

- **Umbrales de `ally_commission_tiers`**: el documento solo confirma los 5 porcentajes (10/12/15/18/20%), no la cantidad de hoteles de cada tramo. Citado del documento: *"La tabla exacta debe tomarse del documento más amplio mencionado por él. No deben inventarse los rangos que no quedaron confirmados."*
- **`certificationPassScore`**: nota mínima del examen, no definida.
- **`certificationQuestions`**: banco de preguntas real (el documento da la naturaleza — experiencia web/programación/config — no las preguntas exactas).
- **Mecanismo de pago real al Aliado**: transferencia manual vs. integración de payouts — no definido.
- **¿Puede un Aliado rechazado reintentar la certificación?** No lo dice el documento — asumido que sí, sin límite de intentos, hasta que se diga lo contrario.
