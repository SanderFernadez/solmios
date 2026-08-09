# Tasks: funnel-hotel-fundador

> Frontend (Fase 0) ya está DONE. Las tareas siguientes son solo backend/integración.

---

## Fase 1 — Persistencia de leads (REQ-1) · `ready`

- [ ] 1.1 Crear modelo ORM `FounderLeads` en módulo `backend/src/modules/founder-leads/model.ts`
  - Campos según spec REQ-1 (name, hotel, country, email, whatsapp, rooms, type, status, source, stripeCheckoutSessionId, contactedAt, timestamps)
  - `type:'string'`, `status:'string'`, `rooms:'number'` (nullable), booleanos N/A
  - **Criterio**: `arckode analyze` pasa con 0 violaciones; `RUN_MIGRATE=1` crea la tabla en SQLite y Postgres.
- [ ] 1.2 Registrar modelo en `composition-root.ts` (system.registerSharedModels o módulo dedicado)
  - **Criterio**: `ormMigrate` hace `CREATE TABLE founder_leads` en DB limpia.
- [ ] 1.3 Crear servicio `FounderLeadsService` + controller + endpoint `POST /api/founder-leads` (público con rate-limit) + `GET/PATCH` admin
  - `validateSchema()` en POST (email regex, whatsapp ≥8 dígitos, rooms requerido si founder)
  - Dedup `(email,type)` ventana 24h
  - Rate-limit 5/IP/hora (reusar `shared/middlewares/rate-limit.ts`)
  - **Criterio**: `bun test` cubre los 5 escenarios del spec (founder, waitlist, validación, rate-limit, dedup).
- [ ] 1.4 Frontend: crear `FounderLeads.service.ts` y reemplazar `submitted.value=true` en `hotel-fundador/index.vue:591` por `await service.create(payload)`
  - Manejar error de red (conservar datos del form, mostrar mensaje)
  - **Criterio**: `vue-tsc --noEmit` pasa; enviar form persiste en DB y muestra confirmación.

---

## Fase 2 — Contador de cupos veraz (REQ-2) · `ready`

- [ ] 2.1 Agregar endpoint `GET /api/founder-leads/slots` (público) que cuenta `WHERE type='founder' AND status IN ('paid','reserved')`
  - Total desde `configuration(founder_slots_total)` (default 10)
  - **Criterio**: devuelve `{ total, taken, left, updatedAt }`; con 3 paid → `{total:10,taken:3,left:7}`.
- [ ] 2.2 Sembrar `configuration(founder_slots_total)=10` en `migrate-db.ts`
  - **Criterio**: migración idempotente; `exists()` check.
- [ ] 2.3 Frontend: reemplazar constantes `slotsTotal=10`/`slotsTaken=3` (`index.vue:558-559`) por `ref` cargado vía `onMounted`
  - Si fetch falla → ocultar barra sticky (NO mostrar número falso)
  - **Criterio**: al cambiar un lead a `paid`, recargar la página muestra el nuevo número.

---

## Fase 3 — Lista de espera (REQ-3) · `ready`

- [ ] 3.1 Asegurar que `POST /api/founder-leads` con país ≠ RD setee `type='waitlist'`, `rooms=NULL` y NO descuente cupo
  - **Criterio**: escenario spec REQ-3 "Lead waitlist se guarda segregado" pasa en test.
- [ ] 3.2 Filtro admin `GET /api/founder-leads?type=waitlist` + acción `PATCH status='notified'`
  - **Criterio**: vista admin lista waitlist por separado de fundadores.

---

## Fase 4 — Correo automático (REQ-4) · `ready`

- [ ] 4.1 Crear plantillas `founder-confirmation` (ES) y `founder-waitlist` (ES) en semilla `auto_messages` o `email_templates`
  - Contenido: confirmación + presentación breve + siguiente paso + enlace útil. NO revender.
  - **Criterio**: plantillas existen tras `bun run migrate`.
- [ ] 4.2 En `FounderLeadsService.create()`, tras persistir, encolar en `email_queue` según `type`
  - founder → `founder-confirmation`, waitlist → `founder-waitlist`
  - Falla de email NO rompe el alta (catch + log)
  - **Criterio**: tras POST, fila en `email_queue` aparece; worker la procesa.
- [ ] 4.3 Frontend: añadir en confirmación inline "Le enviamos un correo a {email}"
  - **Criterio**: copy visible tras envío exitoso.

---

## Fase 5 — Página de Gracias (REQ-5) · `ready` (Caso 2 requiere Stripe Price)

- [ ] 5.1 Crear página `frontend/src/pages/hotel-fundador/gracias.vue` + ruta `/hotel-fundador/gracias`
  - Lee `?lead={id}` → muestra Caso 1 (confirmación + WhatsApp + calculadora + CTA reservar)
  - Mismo lenguaje visual (Playfair/DM Sans, paleta) que `hotel-fundador/index.vue`
  - **Criterio**: `vue-tsc --noEmit` pasa; `?lead=abc` renderiza sin error.
- [ ] 5.2 Crear `POST /api/founder-leads/:id/checkout` que genera Stripe Checkout Session del plan Fundador
  - Requiere Price "Hotel Fundador" creado en Stripe + mapeo plan→priceId en `configuration`
  - Guarda `stripeCheckoutSessionId` en el lead; devuelve `{ url }`
  - **Criterio**: en modo test, redirect a checkout.stripe.com exitoso.
- [ ] 5.3 Webhook `POST /webhooks/stripe-founder` (firma Stripe) → `status='paid'` al `checkout.session.completed`
  - **Criterio**: tras webhook, contador REQ-2 decrementa; reembolso → `status='rejected'` libera cupo.
- [ ] 5.4 Frontend Caso 2: al clic "Reservar cupo" en gracias.vue → POST checkout → `window.location = url`
  - **Criterio**: flujo end-to-end en Stripe test mode.

---

## Fase 6 — Flujo WhatsApp (REQ-6) · `blocked-external`

> Requiere WhatsApp Business API verificado por Meta. Mismo blocker que
> `match-misterplan/phase-7-whatsapp`. NO iniciar hasta tener creds.

- [ ] 6.1 Aprobar 4 plantillas de Meta (presentación, calificado, no calificado, seguimiento)
- [ ] 6.2 Worker cron que dispare Mensaje 1 < 5 min tras `createdAt` (status new→contacted)
- [ ] 6.3 Acción admin "calificar" → Mensaje 2 o 3 según input (status→qualified/rejected)
- [ ] 6.4 Cron seguimiento 48h sin respuesta (Mensaje 4, máx 1 re-envío)
- [ ] 6.5 Logging en `message_logs` de cada envío + estado delivery

---

## Fase 7 — Marketing & Analytics (REQ-7) · `ready` (algunos requieren cuentas)

- [ ] 7.1 Cargar IDs desde `configuration(marketing)` → `{ metaPixelId, ga4MeasurementId, gtmContainerId }`
  - Sembrar en `migrate-db.ts` vacío/null por defecto
  - **Criterio**: sin config → ningún tag se inyecta, sin errores consola.
- [ ] 7.2 Frontend: inyectar scripts (Pixel/GA4/GTM) solo si config presente
  - Eventos: `Lead` al enviar form (201), `InitiateCheckout` al ir a depósito
  - **Criterio**: Meta Pixel Helper / GA Debug muestran eventos.
- [ ] 7.3 Webhook CRM opcional: `FounderLeadsService.create()` hace POST al webhook si `configuration(marketing.crmWebhook)` seteado
  - Reintentos vía cola; no bloquea captura
  - **Criterio**: con webhook mock, lead llega al CRM de prueba.
- [ ] 7.4 Export CSV desde vista admin (fallback CRM): `GET /api/founder-leads?format=csv`
  - **Criterio**: descarga archivo con todos los leads.

---

## Verificación final (todas las fases listas)

```bash
cd backend && bun run node_modules/arckode-framework/bin/arckode.js analyze   # 0 violaciones
cd backend && bun run typecheck && bun test
cd frontend && npx vue-tsc --noEmit && bun run build
```

Y validación manual del PRD:
- [ ] Contador refleja cupos reales (no hardcodeado)
- [ ] Email llega < 1 min tras envío
- [ ] Lead aparece en vista admin
- [ ] Waitlist no descuenta cupo
- [ ] Depósito Stripe confirma y decrementa contador
