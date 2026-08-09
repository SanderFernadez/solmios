# SPEC: Backend del Embudo Hotel Fundador

> Documenta EXCLUSIVAMENTE los faltantes de backend del frontend ya implementado
> en `frontend/src/pages/hotel-fundador/index.vue`. El frontend NO se modifica
> salvo para cablear los endpoints nuevos.

Referencia normativa: `frontend/embudolamding.md` (PRD Versión A "El Costo
Invisible"). Las reglas de copywriting y veracidad de ese PRD son obligatorias.

---

## REQ-1: Persistencia de leads (Captura del formulario)

**Gap**: Hoy `submitForm()` (`hotel-fundador/index.vue:591`) solo setea
`submitted.value = true`. El lead se pierde al recargar.

El sistema **MUST** persistir cada envío del formulario de Hotel Fundador.

### Database

Tabla nueva `founder_leads`:

| Columna | Tipo | Notas |
|---------|------|-------|
| id | TEXT (UUID) | PK |
| name | TEXT | obligatorio |
| hotel | TEXT | obligatorio |
| country | TEXT | obligatorio |
| email | TEXT | obligatorio, índice |
| whatsapp | TEXT | obligatorio |
| rooms | INTEGER | nullable (null si waitlist) |
| type | TEXT | `'founder' \| 'waitlist'` (default `'founder'`) |
| status | TEXT | `'new' \| 'contacted' \| 'qualified' \| 'demo' \| 'paid' \| 'rejected'` (default `'new'`) |
| source | TEXT | utm_source / referrer (nullable) |
| stripeCheckoutSessionId | TEXT | nullable (se llena en Fase 5) |
| contactedAt | TIMESTAMP | nullable |
| createdAt | TIMESTAMP | default now |
| updatedAt | TIMESTAMP | |

Índice UNIQUE sobre `email` NO aplica (un hotelero puede re-enviar); en su lugar
deduplicar por `(email, type)` con ventana de 24h en el servicio.

### API endpoints

| Método | Ruta | Auth | Permiso |
|--------|------|------|---------|
| POST | `/api/founder-leads` | público (sin login) | ninguno — rate-limit |
| GET | `/api/founder-leads` | `requireUserType('admin')` | — |
| GET | `/api/founder-leads/:id` | `requireUserType('admin')` | — |
| PATCH | `/api/founder-leads/:id` | `requireUserType('admin')` | body: `status` |

El POST **MUST** aplicar rate-limit (ver `shared/middlewares/rate-limit.ts`)
— sugerencia 5 envíos/IP/hora — por ser endpoint público de captación.

### Scenarios

#### Scenario: Enviar formulario de fundador (país soportado)
- **Given** visitante completa nombre, hotel, "República Dominicana", email válido, whatsapp válido, 20 habitaciones
- **When** POST `/api/founder-leads` con ese body
- **Then** registro MUST crearse con `type='founder'`, `status='new'`, `rooms=20`
- **And** response MUST devolver `{ id, status: 'new' }` con HTTP 201
- **And** `rooms` MUST ser obligatorio cuando `type='founder'`

#### Scenario: Enviar formulario desde país no soportado (waitlist)
- **Given** visitante completa el formulario con country distinto de "República Dominicana"
- **When** POST `/api/founder-leads`
- **Then** registro MUST crearse con `type='waitlist'`, `rooms=NULL`
- **And** `rooms` NO MUST ser requerido en este caso
- **And** el lead de waitlist MUST NOT descontar cupo del contador

#### Scenario: Validación de campos obligatorios
- **Given** body POST con email vacío o mal formateado
- **When** se ejecuta el handler
- **Then** `validateSchema()` MUST rechazar con HTTP 422 antes de tocar el ORM
- **And** email MUST pasar regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`
- **And** whatsapp MUST tener ≥ 8 dígitos tras `replace(/\D/g,'')`

#### Scenario: Rate limiting
- **Given** una IP envía 6 formularios en una hora
- **When** llega el 6º POST
- **Then** MUST responder HTTP 429 con `Retry-After`
- **And** los 5 primeros MUST estar persistidos normalmente

#### Scenario: Deduplicación
- **Given** existe un lead con email X y type 'founder' creado hace 2 horas
- **When** llega otro POST con mismo email X y type 'founder'
- **Then** el servicio MUST devolver el lead existente (HTTP 200) en lugar de duplicar
- **But** si el lead anterior tiene más de 24h, MUST crear uno nuevo (re-intento válido)

### UI requirements
- El frontend `submitForm()` MUST reemplazar `submitted.value = true` por un
  `await FounderLeadsService.create(payload)` que llame al POST.
- En error de red MUST mostrar mensaje y conservar los datos del formulario.
- En éxito MUST mostrar la confirmación existente (que ya está armada).

---

## REQ-2: Contador de cupos veraz

**Gap**: `hotel-fundador/index.vue:558-559` define `slotsTotal = 10` y
`slotsTaken = 3` como constantes hardcodeadas. El PRD (Sección 5) prohíbe esto:
*"Nunca puede ser falso. Debe alimentarse automáticamente desde la base de
datos o pasarela de pago."*

El contador **MUST** reflejar cupos realmente reservados.

### Database
Sin cambios adicionales (usa `founder_leads`). Cupo tomado =
`COUNT(*) WHERE type='founder' AND status IN ('paid','reserved')`.

El total de cupos (ej. 25 Fundadores / 10 Ola 1) **SHOULD** vivir en
`configuration(key='founder_slots_total')` para ajustar sin deploy.

### API endpoint

| Método | Ruta | Auth |
|--------|------|------|
| GET | `/api/founder-leads/slots` | público |

Response:
```json
{ "total": 10, "taken": 3, "left": 7, "updatedAt": "2026-08-05T..." }
```

### Scenarios

#### Scenario: Contador al cargar la página
- **Given** existen 3 leads `type='founder' status='paid'`
- **When** el frontend carga `/hotel-fundador`
- **Then** MUST llamar GET `/api/founder-leads/slots`
- **And** la barra de progreso MUST mostrar 30% y "Quedan 7 de 10 cupos"
- **And** `updatedAt` MUST reflejar la última reserva confirmada

#### Scenario: Reserva nueva decrementa cupo
- **Given** contador marca left=7
- **When** un lead pasa a `status='paid'` (vía webhook Stripe o marca manual admin)
- **Then** el próximo GET `/slots` MUST devolver left=6
- **And** la barra sticky MUST actualizarse en siguientes visitas

#### Scenario: Lead pendiente no descuenta
- **Given** un lead con `status='new'` (aún no paga)
- **When** se consulta el contador
- **Then** ese lead MUST NOT contar como cupo tomado
- **Because** reservar el cupo requiere depósito confirmado

#### Scenario: Total configurable
- **Given** `configuration(founder_slots_total) = 10`
- **When** admin cambia el valor a 25
- **Then** el contador MUST reflejar el nuevo total sin redeploy
- **And** si taken > nuevo total, la barra MUST mostrar 100% (clamp)

### UI requirements
- Reemplazar las constantes `slotsTotal`/`slotsTaken` por un `ref` poblado por
  `onMounted` vía `FounderLeadsService.slots()`.
- Si el fetch falla MUST ocultar la barra sticky (NO mostrar número falso) y
  loguear a consola. Nunca inventar el número.

---

## REQ-3: Lista de espera persistida

**Gap**: El frontend detecta waitlist (`isWaitlist` computed en
`index.vue:577`) pero no hay segregación real; todo va al mismo flujo.

Los leads de países no soportados **MUST** almacenarse como `type='waitlist'`
y **MUST NOT** mezclarse con la cola de Fundadores.

### Scenarios

#### Scenario: Lead de waitlist se guarda segregado
- **Given** visitante envía formulario con country="Panamá"
- **When** se persiste
- **Then** el registro MUST tener `type='waitlist'`, `rooms=NULL`
- **And** el contador REQ-2 MUST ignorarlo

#### Scenario: Vista admin de waitlist
- **Given** admin autenticado
- **When** GET `/api/founder-leads?type=waitlist`
- **Then** MUST devolver solo leads de waitlist
- **And** MUST permitir marcar `status='notified'` cuando el país se habilite

#### Scenario: País se habilita
- **Given** 12 leads waitlist de Panamá
- **When** Panamá pasa a soportado (cambio manual en configuration)
- **Then** SHOULD poder notificar masivamente por email a esos 12 leads
- **But** MUST NOT migrarlos automáticamente a fundadores (acción humana)

---

## REQ-4: Correo automático de confirmación

**Gap**: El PRD exige *"Debe enviarse inmediatamente"* tras el envío del
formulario. Hoy no se envía nada.

Tras crear un lead, el sistema **MUST** encolar un correo de confirmación.

### Database
Reutiliza `email_queue` existente (infra `email-bootstrap.ts`).
Plantilla `founder-confirmation` (ES) en tabla de plantillas o `auto_messages`.

### API behavior
El POST `/api/founder-leads` (REQ-1) **MUST**, como efecto secundario tras
persistir, encolar un email con:
- Confirmación de recepción
- Presentación breve de SOLMI OS (NO revender — regla PRD)
- Siguiente paso explícito ("Le escribiremos por WhatsApp en menos de 5 minutos")
- Un enlace útil (calculadora o landing)

### Scenarios

#### Scenario: Email inmediato tras alta de fundador
- **Given** POST crea lead type='founder'
- **When** la transacción confirma
- **Then** una fila MUST insertarse en `email_queue` con `to=email`, `template='founder-confirmation'`
- **And** el worker de email MUST procesarla en menos de 1 minuto
- **And** el asunto MUST contener "Hotel Fundador"

#### Scenario: Email distinto para waitlist
- **Given** POST crea lead type='waitlist'
- **When** se encola el email
- **Then** la plantilla MUST ser `founder-waitlist` (NO prometer cupo)
- **And** el cuerpo MUST decir "Le avisaremos cuando esté disponible en su país"

#### Scenario: Fallo de email no rompe el alta
- **Given** el SMTP/Resend está caído
- **When** se encola el email
- **Then** el lead MUST quedar persistido de todos modos
- **And** el email queda en `email_queue` con `status='pending'` para reintentos

### UI requirements
La confirmación inline existente en el frontend ya cumple; solo añadir texto:
"Le enviamos un correo de confirmación a {email}".

---

## REQ-5: Página de Gracias (Caso 1 y Caso 2)

**Gap**: Hoy solo existe confirmación inline (Caso 1 parcial). El PRD pide una
página de gracias con dos variantes.

### Caso 1 — Solo completó formulario
Página `/hotel-fundador/gracias?lead={id}` mostrando:
- Confirmación
- Siguiente paso (WhatsApp en < 5 min)
- Acceso a calculadora
- Botón "Reservar cupo" (ir a depósito → Caso 2)

### Caso 2 — Va a pagar (depósito reembolsable)
Tras iniciar el pago, mostrar:
- Resumen del plan seleccionado
- Monto del depósito reembolsable
- Beneficios del Programa Fundador
- Política de devolución
- Métodos de pago (Stripe checkout session)

### Database
Sin tablas nuevas. `founder_leads.stripeCheckoutSessionId` (REQ-1) enlaza el
lead con la sesión de Stripe.

### API endpoints

| Método | Ruta | Auth |
|--------|------|------|
| POST | `/api/founder-leads/:id/checkout` | público con lead id |
| POST | `/webhooks/stripe-founder` | firma Stripe |

`POST /:id/checkout` crea una Stripe Checkout Session para el depósito del
plan seleccionado y devuelve `{ url }`. El webhook marca
`founder_leads.status='paid'` al confirmar (lo que dispara REQ-2 contador).

### Scenarios

#### Scenario: Gracias Caso 1
- **Given** lead recién creado, status='new'
- **When** frontend navega a `/hotel-fundador/gracias?lead={id}`
- **Then** MUST mostrar confirmación + bloque WhatsApp + calculadora + CTA reservar
- **And** NO MUST pedir pago todavía

#### Scenario: Iniciar depósito (Caso 2)
- **Given** visitante en página de gracias hace clic en "Reservar cupo"
- **When** frontend POST `/api/founder-leads/:id/checkout` con `{ plan: 'professional' }`
- **Then** backend MUST crear Stripe Checkout Session con el Price del plan Fundador
- **And** devolver `{ url }` a la que el frontend MUST redirigir
- **And** guardar `stripeCheckoutSessionId` en el lead

#### Scenario: Webhook confirma depósito
- **Given** Stripe envía `checkout.session.completed`
- **When** el webhook valida la firma
- **Then** MUST marcar `founder_leads.status='paid'`
- **And** el contador REQ-2 MUST decrementar cupos al siguiente GET

#### Scenario: Devolución del depósito
- **Given** lead con status='paid'
- **When** el hotelero pide reembolso dentro del plazo
- **Then** admin MUST poder disparar `stripe.refunds.create`
- **And** el lead pasa a `status='rejected'`
- **And** el contador MUST liberar el cupo

---

## REQ-6: Flujo WhatsApp automatizado (BLOQUEADO)

**Gap**: El PRD pide 4 mensajes de WhatsApp con primer contacto en < 5 minutos.
Requiere WhatsApp Business API (verificación Meta) — **mismo blocker que
`match-misterplan/phase-7-whatsapp`**.

Estado: **blocked-external**. Se documenta el contrato para cuando las creds
estén, pero NO se implementa hasta desbloqueo.

### Scenarios (contrato futuro)

#### Scenario: Mensaje 1 — Presentación (< 5 min)
- **Given** lead nuevo `type='founder' status='new'`
- **When** pasan menos de 5 minutos desde `createdAt`
- **Then** MUST enviarse mensaje WhatsApp de presentación con 2 preguntas calificadoras
- **And** el lead pasa a `status='contacted'`

#### Scenario: Mensaje 2 — Lead calificado
- **Given** respuestas indican ≥ 20 habitaciones e interés
- **When** el agente califica
- **Then** MUST enviarse mensaje para agendar demo
- **And** lead pasa a `status='qualified'` → `status='demo'`

#### Scenario: Mensaje 3 — Lead no calificado
- **Given** respuestas indican hotel pequeño o sin presupuesto
- **When** el agente descarta
- **Then** MUST enviarse mensaje con recursos (academy, blog)
- **And** lead pasa a `status='rejected'`

#### Scenario: Mensaje 4 — Seguimiento
- **Given** lead `status='demo'` sin respuesta en 48h
- **When** se cumple el plazo
- **Then** MUST enviarse mensaje de seguimiento (máx. 1 re-envío)

### Notas de desbloqueo
Compartir creds Meta Business con el equipo. Al desbloquear, este change Y
`match-misterplan/phase-7-whatsapp` avanzan simultáneamente (mismo Phone Number
ID + Token). Crear plantillas aprobadas por Meta para cada uno de los 4 mensajes.

---

## REQ-7: Integraciones de marketing y analytics

**Gap**: El PRD lista integraciones que NO existen: CRM, Pixel Meta, GA4, GTM.

### Tags de analytics (JS, sin backend crítico)
El frontend `hotel-fundador/index.vue` **SHOULD** cargar condicionalmente:
- **Meta Pixel** — `fbq('track', 'Lead')` al enviar formulario, `fbq('track','InitiateCheckout')` al ir a depósito
- **GA4** — evento `generate_lead` y `begin_checkout`
- **GTM** — dataLayer push para los mismos eventos

Los IDs (Pixel ID, Measurement ID, GTM container) **MUST** leerse de
`configuration` (clave `marketing`) para no hardcodear ni exponer en repo.

### CRM
**SHOULD** enviar el lead al CRM (HubSpot/Pipedrive) vía webhook al crear.
Mapeo: `founder_leads` → contacto CRM. No bloqueante — fallback: export CSV
manual desde vista admin (REQ-1 GET).

### Scenarios

#### Scenario: Pixel Lead fire
- **Given** Meta Pixel configurado (`configuration.marketing.metaPixelId`)
- **When** el POST de lead responde 201
- **Then** frontend MUST ejecutar `fbq('track','Lead')` con `{ value: plan_price, currency:'USD' }`
- **And** si NO está configurado, MUST omitir silenciosamente (no error)

#### Scenario: Eventos sin config
- **Given** `configuration.marketing` vacío
- **When** se carga la página
- **Then** ningún tag MUST inyectarse
- **And** no MUST haber errores en consola

#### Scenario: Sync CRM
- **Given** webhook CRM configurado
- **When** se crea un lead
- **Then** backend SHOULD hacer POST al webhook con el payload del lead
- **And** si falla, MUST reintentar vía cola (no bloquear la captura)

---

## Reglas transversales (del PRD, aplicables a TODOS los REQ)

- **Nunca inventar testimonios** — la sección Prueba solo usa cifras internas de Solmi Rooms.
- **Nunca prometer funcionalidades inexistentes** — el copy de emails/WhatsApp MUST alinearse con lo que el PMS realmente hace hoy.
- **Nunca mencionar precio antes del problema** — el flujo email MUST respetar el orden del embudo.
- **Mostrar cifras reales** — el contador (REQ-2) es la veracidad más crítica.
- **Lenguaje orientado al hotelero** — sin "PMS/ERP/ecosistema/disruptivo" en copy de captación.
