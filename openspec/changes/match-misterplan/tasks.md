# Tasks: match-misterplan

## Phase 1: Foundation (Database + Backend)

### 1.1 Database Migrations
- [x] 1.1.1 Add 30+ columns to `hotels` table (ALTER TABLE with DEFAULTs)
- [x] 1.1.2 Add 9 columns to `reservations` table
- [x] 1.1.3 Create `hotel_amenities` table
- [x] 1.1.4 Create `room_amenities` table
- [x] 1.1.5 Create `seasons` table
- [x] 1.1.6 Create `room_rates` table
- [x] 1.1.7 Create `lock_devices` table
- [x] 1.1.8 Create `lock_codes` table
- [x] 1.1.9 Create `auto_messages` table
- [x] 1.1.10 Create `companions` table
- [x] 1.1.11 Create `message_logs` table
- [x] 1.1.12 Create `payment_requests` table
- [x] 1.1.13 Create `whatsapp_templates` table
- [x] 1.1.14 Create `room_blocks` table (for planning bloqueos)

**Acceptance:** `sqlite3 .dump` shows all tables + columns. No data loss.

### 1.2 ORM Models (hoteles/model.ts + new modules)
- [x] 1.2.1 Update HotelesModel with all new fields
- [x] 1.2.2 Create `cerraduras` module (model, service, controller, types, validators)
- [x] 1.2.3 Create `temporadas` module
- [x] 1.2.4 Create `amenities` module
- [x] 1.2.5 Create `auto-messages` module
- [x] 1.2.6 Create `companions` module
- [x] 1.2.7 Create `payment-links` module
- [x] 1.2.8 Create `blocks` module (room bloqueos)
- [x] 1.2.9 Register all modules in composition-root.ts
- [x] 1.2.10 Run `arckode analyze` → MUST be 0 violations

**Acceptance:** Backend starts cleanly, `arckode analyze` = ✅ VÁLIDO

### 1.3 API Endpoints
- [x] 1.3.1 GET /api/settings/full (all hotel data in one call)
- [x] 1.3.2 PUT /api/settings/hotel (extended with 30+ fields)
- [x] 1.3.3 GET/PUT /api/amenities/hotel
- [x] 1.3.4 GET/PUT /api/amenities/room/:id
- [x] 1.3.5 GET /api/amenities/catalog
- [x] 1.3.6 GET/POST/PUT/DELETE /api/seasons
- [x] 1.3.7 GET/PUT /api/rates
- [x] 1.3.8 POST /api/rates/copy-next-year
- [x] 1.3.9 GET/POST/PUT/DELETE /api/blocks
- [x] 1.3.10 GET/POST/PUT/DELETE /api/companions
- [x] 1.3.11 GET /api/reservations/:id (extended with OTA fields, companions)

**Acceptance:** All endpoints return proper JSON envelope, auth required.

---

## Phase 2: Complete Settings Page

### 2.1 Datos Básicos (5-tab wizard)
- [x] 2.1.1 Tab 1: Propietario form (ownerName, taxId, deviceEmail)
- [x] 2.1.2 Tab 2: Alojamiento form (type select 54 options, website, motor link, currencies, starRating)
- [x] 2.1.3 Tab 3: Características (100+ amenity checkboxes grouped by category)
- [x] 2.1.4 Tab 4: Localización (Leaflet map, lat/lng, address, province/municipality)
- [x] 2.1.5 Tab 5: Descripción (multilingual textarea)

### 2.2 Condiciones (extend current)
- [x] 2.2.1 Add: cleaningType, depositType, depositFixed, advanceType, advanceAmount
- [x] 2.2.2 Add: releaseHours, defaultPaymentMethod
- [x] 2.2.3 Add: taxName, taxRate
- [x] 2.2.4 Add: requestReviews, publishReviewScore, publishReviewComments

### 2.3 Tarifas (new tab: matrix)
- [ ] 2.3.1 Grid: rows = roomType × occupancy, columns = 4 seasons
  > Crear una matriz de precios interactiva en la pestaña Tarifas de Settings.
  > Filas: cada combinación de tipo de habitación (Single/Double/Suite/Family) × capacidad máxima (1-4 huéspedes) obtenida de `rooms` agrupado por `room.type`.
  > Columnas: 4 temporadas (Baja, Media, Alta, Especial) leídas de `ConfigService.get('temporadas')`.
  > Celdas: input numérico editable con el precio por noche para esa combinación.
  > Layout: la tabla debe tener sticky header (columnas temporadas visibles al scrollear), bordes de grupo por tipo de habitación, y color de fondo alternado por season.
  > Datos de origen: tabla `room_rates` con columnas `roomType, occupancy, seasonKey, price, hotelId`.
- [ ] 2.3.2 Editable price inputs
  > Cada celda de la grid 2.3.1 debe ser un input `<input type="number">` con formato moneda (USD/DOP/etc según `hotel.currency`).
  > Al hacer focus: seleccionar todo el texto. Al hacer blur: validar que price >= 0 y mostrar indicador visual de "modificado" (borde azul).
  > Los cambios quedan en estado local ("dirty") hasta que se guarden con el botón general "💾 Guardar Cambios".
  > Si el usuario cambia de pestaña con datos dirty, mostrar modal de confirmación "¿Descartar cambios en tarifas?".
- [ ] 2.3.3 "Copiar al próximo año" button
  > Botón al lado del título de la sección Tarifas: "📋 Copiar al próximo año".
  > Al hacer clic: duplicar todas las `room_rates` de la temporada actual con fecha = fecha_actual + 1 año, manteniendo el mismo precio.
  > Mostrar modal de confirmación: "Se copiarán N tarifas al {año_siguiente}. ¿Continuar?"
  > En caso de conflictos (tarifa ya existe para ese año), mostrar opción "Sobrescribir" o "Saltar".
  > Toast success: "{N} tarifas copiadas a {año}."
- [ ] 2.3.4 Save all rates in batch
  > El botón "💾 Guardar Cambios" (global de Settings) debe ahora también guardar las tarifas editadas en la grid.
  > Enviar batch POST /api/rates/batch con array de `{roomType, occupancy, seasonKey, price}`.
  > Backend: upsert en `room_rates` (INSERT OR REPLACE por combinación roomType+occupancy+seasonKey+hotelId).
  > Mostrar loading state en el botón mientras guarda. Toast success "Tarifas actualizadas ({N} precios)."

### 2.4 Temporadas (new section)
- [ ] 2.4.1 CRUD 4 seasons (name, label, dateRange, color)
  > Crear sección de Temporadas en la pestaña Tarifas de Settings (antes de la grid de precios).
  > Lista de 4 temporadas preseleccionadas: Baja, Media, Alta, Especial.
  > Cada temporada tiene: nombre (texto), label corto (texto, ej "Baja"), rango de fechas (desde/hasta), color (color picker para la grid).
  > CRUD completo: crear nueva temporada (+), editar inline o modal, eliminar (con confirmación "¿Eliminar temporada? Las tarifas asociadas se mantendrán sin season.").
  > Persistir en `Configuration` con key `temporadas` vía `ConfigService.set('temporadas', ...)`.
  > Validación: no solapar rangos de fechas entre temporadas (alertar E2 "Las fechas de {temp1} y {temp2} se solapan.").
  > Si no hay temporadas configuradas, la grid de tarifas muestra una sola columna "Tarifa Base".
- [ ] 2.4.2 Date pickers for start/end
  > Inputs de fecha para cada temporada: selector de rango (desde/hasta) con calendario visual.
  > Usar el date picker existente del proyecto (vue-datepicker o similar).
  > Mostrar barra de timeline visual debajo del formulario: línea horizontal con bloques de color representando cada temporada en el año, para detectar solapamientos visualmente.
  > Al cambiar fechas, recalcular la timeline en tiempo real.
  > Formato de fecha: DD/MM/AAAA (configurable por locale del hotel).

**Acceptance:** Settings page saves ALL data, reloads correctly, `arckode analyze` clean. Grid muestra precios, inputs editables, botón copiar año funciona, batch save persiste. Temporadas CRUD completo con date pickers y timeline visual.

---

## Phase 3: Reservation Modal (Complete)

### 3.1 Modal Structure
- [x] 3.1.1 Create ReservationModal.vue with two-panel layout
- [x] 3.1.2 Header with locator, action buttons (Confirmar, Anular, Imprimir, Editar)
- [x] 3.1.3 Left panel with 5 collapsible sections
- [x] 3.1.4 Right panel with 6 sections

### 3.2 Left Panel Sections
- [x] 3.2.1 Datos Reserva (source, commission, locators, dates, OTA notes)
- [x] 3.2.2 Condiciones (3 checkboxes)
- [x] 3.2.3 Comunicaciones (bono PDF, autocheckin links)
- [x] 3.2.4 Comunicación Cliente (auto-message toggles per reservation)
- [x] 3.2.5 Plantillas WhatsApp (send buttons)

### 3.3 Right Panel Sections
- [x] 3.3.1 Datos Cliente (name, email, phone, WhatsApp links)
- [x] 3.3.2 Importe y Pago (total, deposit, pending, currency conversion, payment request)
- [x] 3.3.3 Elementos Reserva (room, config, pricing breakdown)
- [x] 3.3.4 Otros Servicios (collapsible add-ons)
- [x] 3.3.5 Acompañantes (list + add form)
- [x] 3.3.6 QScanPro (connection code display)

### 3.4 Actions
- [x] 3.4.1 Confirmar reserva (status → confirmed)
- [x] 3.4.2 Anular reserva (status → cancelled, confirmation dialog)
- [x] 3.4.3 Generate voucher PDF (window.print with styled template)
- [x] 3.4.4 Send payment request (generate Stripe link, send email)

**Acceptance:** Modal opens from planning click, shows ALL data, all actions work.

---

## Phase 4: Planning Visual (Drag & Drop)

### 4.1 Setup
- [x] 4.1.1 Install @fullcalendar/vue3 + resource + interaction plugins
- [x] 4.1.2 Create PlanningCalendar.vue wrapper
- [x] 4.1.3 Fetch rooms + reservations + blocks from API

### 4.2 Calendar Features
- [x] 4.2.1 Resource timeline view (rooms as rows)
- [x] 4.2.2 Render reservations as colored blocks
- [x] 4.2.3 Render blocks (bloqueos) as gray blocks
- [x] 4.2.4 Drag to create new reservation
- [x] 4.2.5 Drag to move reservation between rooms
- [x] 4.2.6 Resize to extend/shorten reservation
- [x] 4.2.7 Click reservation → open ReservationModal
- [x] 4.2.8 Right-click → context menu (Abrir, Bloquear, Cancelar)
- [x] 4.2.9 Lock icons on reservations (🔒/🔓)
- [x] 4.2.10 Month/Week/Day view toggle
- [x] 4.2.11 Prev/Next navigation
- [x] 4.2.12 Filters: room type, status, source

### 4.3 Room Blocks (Bloqueos)
- [ ] 4.3.1 Create block dialog (reason, dates)
  > En la vista Planning, al hacer clic derecho sobre una celda vacía del Gantt, mostrar menú contextual con opción "🔒 Bloquear habitación".
  > Al seleccionar "Bloquear", abrir modal con: selector de habitación (pre-seleccionada si viene de clic en celda), rango de fechas (desde/hasta), campo "Motivo del bloqueo" (textarea, ej: "Mantenimiento", "Reservado para familiar", "Obra").
  > Colores de bloqueo: gris con rayas diagonales (patrón CSS). Texto dentro del bloque: motivo abreviado + fechas.
  > Al confirmar, POST /api/blocks con `{roomId, startDate, endDate, reason, hotelId}`.
  > El bloqueo se renderiza inmediatamente en el Gantt como bloque gris, sin recargar toda la página.
  > Backend: endpoint POST /api/blocks ya existe (task 1.3.9 completada), solo integrar frontend.
- [ ] 4.3.2 Prevent reservation on blocked dates
  > Al crear o mover una reserva (drag) en el calendario, validar que la habitación NO tenga un bloqueo activo en el rango de fechas seleccionado.
  > Si hay conflicto: mostrar toast E2 "La Hab {n} está bloqueada del {start} al {end}: {motivo}." y rechazar la operación.
  > También validar en backend (capa service de reservas): al POST/PATCH reserva, verificar que no exista block solapado para esa roomId + fechas.
  > En la UI, las celdas con bloqueo deben mostrar un tooltip al hover: "🔒 Bloqueada: {motivo} ({fechas})".
- [ ] 4.3.3 Delete block from context menu
  > Clic derecho sobre un bloque gris en el Gantt → menú contextual con opción "🗑️ Eliminar bloqueo".
  > Mostrar modal de confirmación: "¿Eliminar bloqueo de Hab {n} ({motivo}) del {start} al {end}?".
  > Al confirmar, DELETE /api/blocks/:id. Remover el bloqueo del DOM sin recargar.
  > Toast success: "Bloqueo eliminado de Hab {n}."

**Acceptance:** Can create/move/resize reservations, blocks work, context menu works. Bloques visibles en gris, impiden reservar en esas fechas, se crean y eliminan desde menú contextual.

---

## Phase 5: TTLock Integration

### 5.1 Backend TTLock Service
- [x] 5.1.1 Create TTLock OAuth2 service (token management)
- [x] 5.1.2 GET /api/ttlock/connect (OAuth redirect)
- [x] 5.1.3 GET /api/ttlock/callback (OAuth callback)
- [x] 5.1.4 POST /api/ttlock/sync-locks (fetch from TTLock API)
- [x] 5.1.5 POST /api/ttlock/generate-code/:reservationId
- [x] 5.1.6 POST /api/ttlock/delete-code/:codeId
- [x] 5.1.7 GET /api/ttlock/locks (list mapped locks)

### 5.2 Frontend Lock Management
- [x] 5.2.1 Settings → Integraciones → TTLock config card
- [x] 5.2.2 Lock management page (/panel/cerraduras)
- [x] 5.2.3 Lock device table (name, room, battery, status)
- [x] 5.2.4 Map lock to room dropdown
- [x] 5.2.5 View codes history per lock
- [x] 5.2.6 Lock icons in planning

### 5.3 Auto-Generation
- [ ] 5.3.1 Auto-generate code when reservation confirmed
  > En el backend, cuando una reserva cambia a estado `confirmed` (PATCH /api/reservas/:id → status=confirmed), disparar automáticamente la generación de código TTLock.
  > Usar el servicio TTLock ya creado (task 5.1.5): POST /api/ttlock/generate-code/:reservationId.
  > El código generado se asocia a la reserva en `lock_codes` con columnas: `reservationId, code, startDate (checkIn), endDate (checkOut), status (active/pending/expired)`.
  > Si TTLock no está configurado para el hotel, saltar silenciosamente (sin error).
  > Loggear en `message_logs` la acción: "Código TTLock generado para reserva {id}".
- [ ] 5.3.2 Auto-send code on check-in day (via auto-messages)
  > Cuando se ejecute el cron de auto-messages (task 6.1.3) y detecte que HOY es el checkIn de una reserva, y la reserva tiene un código TTLock activo, incluir el código en el mensaje.
  > Variable `{lock_code}` para las plantillas de auto-messages. El sistema de substitución (task 6.1.2) debe reemplazar `{lock_code}` con el código real.
  > Si la reserva no tiene código (TTLock no configurado), la variable se reemplaza con cadena vacía.
  > Enviar el mensaje por el canal configurado (email/WhatsApp).
- [ ] 5.3.3 Auto-delete code after checkout (night audit)
  > En el night audit (cierre nocturno), para reservas cuyo checkOut = fecha actual y status = checked_out, eliminar automáticamente el código TTLock.
  > POST /api/ttlock/delete-code/:codeId para cada código activo.
  > Marcar el código como `expired` en `lock_codes.status`.
  > Loggear: "Código TTLock {id} expirado post check-out de reserva {id}."

**Acceptance:** Code generates via TTLock API, appears in reservation, auto-sends on check-in day. Code expires after checkout.

---

## Phase 6: Auto Messages

### 6.1 Backend
- [x] 6.1.1 Create auto_messages CRUD endpoints
- [x] 6.1.2 Variable substitution engine
- [ ] 6.1.3 Cron job for trigger processing (checkin_day, pre_checkin, etc.)
  > Implementar un cron job (setInterval) que cada 5 minutos evalúa todas las reservas activas y dispara los auto-messages
  > cuyo `triggerEvent` coincida con el evento del día (checkin_day, pre_checkin, checkout_day, post_stay).
  > Para cada auto-message activo, buscar reservas que cumplan la condición:
  > - pre_checkin: reservas con checkIn = hoy + triggerOffset días
  > - checkin_day: reservas con checkIn = hoy y status = checked_in
  > - checkout_day: reservas con checkOut = hoy y status = checked_in
  > - post_stay: reservas con checkOut = hoy - triggerOffset días
  > Si el auto-message tiene channel 'email', llamar a EmailService.send(). Si 'whatsapp', llamar a WhatsAppService.send().
  > Evitar duplicados: antes de enviar, verificar en `message_logs` si ya se envió ese messageId (auto-message.id + reservation.id).
  > Loggear cada envío en `message_logs` con status 'sent' o 'failed'.
- [ ] 6.1.4 Email sender (EmailService con nodemailer/SendGrid/Resend)
  > Crear `backend/src/services/email.service.ts` con método `send(to, subject, html)`.
  > Leer configuración SMTP de `Configuration` con key `email_config` (host, port, user, pass, from).
  > Si no hay SMTP configurado, usar Resend (API key en `Configuration` key `resend_api_key`) como fallback.
  > Variables en el HTML: `{guest_name}`, `{hotel_name}`, `{checkin_date}`, `{checkout_date}`, `{room_number}`,
  > `{total_amount}`, `{wifi_network}`, `{wifi_password}`, `{lock_code}`, `{hotel_phone}`, `{locator}`.
  > Encolar envíos fallidos y reintentar 3 veces con backoff exponencial (1min, 5min, 15min).
- [x] 6.1.5 message_logs tracking

### 6.2 Frontend
- [x] 6.2.1 Auto-messages page (/panel/auto-messages)
- [x] 6.2.2 Message editor (title, color, body WYSIWYG, WhatsApp text)
- [x] 6.2.3 Variable picker dropdown
- [x] 6.2.4 Trigger selector (event + offset)
- [x] 6.2.5 Preview button
- [x] 6.2.6 Logs viewer

**Acceptance:** Message sends on correct trigger day, variables substituted, logged.

---

## Phase 7: WhatsApp Integration

### 7.1 WhatsApp Web Links
- [x] 7.1.1 wa.me link generator per reservation
- [x] 7.1.2 WhatsApp template CRUD
- [x] 7.1.3 Template send button (opens wa.me)

### 7.2 WhatsApp Business API (optional, advanced)
- [ ] 7.2.1 Meta Business setup documentation
  > Crear guía de configuración en `/docs/whatsapp-business-setup.md` con pasos detallados:
  > 1. Crear cuenta de Meta Business (business.facebook.com)
  > 2. Registrar aplicación en Meta for Developers (developers.facebook.com)
  > 3. Configurar WhatsApp Business API (webhook, token, phone number ID)
  > 4. Obtener Permanent Access Token
  > 5. Configurar plantillas de mensajes (approval flow)
  > 6. Agregar los datos a Settings → Integraciones → WhatsApp (apiKey, phoneNumberId, businessAccountId)
  > Incluir screenshots de referencia y links oficiales de Meta.
  > La guía debe estar en español y ser ejecutable por un admin de hotel sin conocimientos técnicos profundos.
- [ ] 7.2.2 Template approval flow
  > El sistema debe permitir crear y enviar plantillas de WhatsApp para aprobación de Meta.
  > UI en /panel/auto-messages: botón "Enviar a aprobación" al lado de cada plantilla WhatsApp.
  > Al enviar, POST a WhatsApp Business API para crear la plantilla en Meta.
  > Mostrar estado de la plantilla: `pending` (en revisión), `approved` (aprobada), `rejected` (rechazada con motivo).
  > Webhook receiver: POST /api/whatsapp/webhook para recibir notificaciones de cambio de estado de Meta.
  > Si `rejected`, mostrar el motivo de rechazo en la UI y permitir editar y reenviar.
- [ ] 7.2.3 Send via API (no manual click)
  > Implementar envío REAL de mensajes WhatsApp a través de la API de Meta (no solo wa.me link).
  > POST https://graph.facebook.com/v22.0/{phone_number_id}/messages con el template aprobado.
  > Variables: {{1}}, {{2}}, etc se reemplazan con datos de la reserva (nombre huésped, fechas, código TTLock, etc).
  > El sistema de auto-messages (task 6.1.3) debe elegir entre wa.me link (si no hay API configurada) o API real (si está configurada).
  > Loggear envío en `message_logs` con status `sent`/`failed` y el message_id de Meta.

**Acceptance:** Click WhatsApp button opens wa.me with filled template. Con API configurada: envía mensaje real. Plantillas pasan por approval flow de Meta.

---

## Phase 8: Pre-Checkin / Auto-Checkin

### 8.1 Pre-checkin Form
- [x] 8.1.1 Public route /checkin/:hash (no auth, hash per reservation)
- [x] 8.1.2 Form: personal data, document upload, selfie
- [x] 8.1.3 Save to reservation + companions

### 8.2 Auto-checkin QR
- [x] 8.2.1 Generate QR per hotel
- [x] 8.2.2 QR links to auto-checkin page
- [x] 8.2.3 On completion: send lock codes

### 8.3 QScanPro Integration
- [ ] 8.3.1 Connection code per hotel
  > En Settings → Integraciones, agregar tarjeta "QScanPro".
  > Input: "Código de conexión QScanPro" (texto, provisto por QScanPro al contratar el servicio).
  > Botón "Probar conexión" que hace GET a un endpoint de prueba de QScanPro.
  > Guardar código en `Configuration` con key `qscanpro_connection_code`.
  > Mostrar estado: "Conectado" (verde) o "Desconectado" (rojo) según la prueba de conexión.
  > El código de conexión se usa para autenticar webhooks entrantes de QScanPro.
- [ ] 8.3.2 Document scan webhook receiver
  > Crear endpoint público POST /api/webhooks/qscanpro que recibe notificaciones de QScanPro cuando un huésped escanea su documento.
  > Validar autenticación: el webhook incluye el connection_code como token de seguridad.
  > Espera recibir: `{reservationHash, documentType (cedula/pasaporte), documentNumber, documentUrl (imagen escaneada)}`.
  > Guardar los datos del documento en la tabla `companions` o `guests` según corresponda.
  > Marcar la reserva como `document_scanned = true` en metadata.
  > Responder HTTP 200 OK a QScanPro. Si error, responder 400 con mensaje.

**Acceptance:** Guest completes pre-checkin via link, data saved, codes sent. QScanPro escanea documento y webhook guarda datos.

---

## Phase 9: Payment Requests

### 9.1 Stripe Integration
- [x] 9.1.1 Settings → Stripe API keys config
- [x] 9.1.2 Create payment link endpoint
- [x] 9.1.3 Webhook for payment confirmation
- [x] 9.1.4 Payment request from reservation modal

**Acceptance:** Click "Enviar" generates Stripe link, guest pays, reservation deposit updates.

---

## Phase 10: Advanced Reports

### 10.1 Report Endpoints
- [x] 10.1.1 GET /api/reports/facturacion (revenue by type, services, taxes)
- [x] 10.1.2 GET /api/reports/ocupacion (total, real, daily breakdown)
- [x] 10.1.3 GET /api/reports/pernoctaciones (overnight stays per day)
- [x] 10.1.4 GET /api/reports/rendimiento (ADR, RevPAR, avg stay)
- [x] 10.1.5 GET /api/reports/procedencia (by country, region)
- [x] 10.1.6 GET /api/reports/reservas-por-canal (by OTA source)

### 10.2 Report UI
- [x] 10.2.1 Reports page with 6 tabs
- [x] 10.2.2 Month/date-range selector
- [x] 10.2.3 Tables with daily breakdown
- [x] 10.2.4 Export to PDF/CSV

**Acceptance:** All 6 reports generate correct data matching MisterPlan format.

---

## Phase 11: Check-in Digital Completo (Email + Notificaciones + UX)

### 11.1 Email de Notificación — Check-in
- [ ] 11.1.1 Enviar email de confirmación al hacer check-in
  > En el endpoint `POST /api/reservas/:id/checkin` (composition-root.ts:536), después de confirmar el check-in,
  > disparar el envío de email usando el EmailService (task 6.1.4). El email debe contener:
  > - Asunto: "¡Bienvenido a {hotel_name}, {guest_name}!"
  > - Cuerpo: nombre del hotel, dirección, teléfono, número de habitación, fechas de estancia,
  >   red WiFi ({wifi_network} / {wifi_password}), códigos TTLock ({lock_code} si existen),
  >   enlace al pre-checkin ({pre_checkin_url}), y botón de contacto.
  > - Formato HTML con el branding del hotel (logo, colores).
  > Si el huésped no tiene email (walk-in sin datos), no enviar — solo loggear "walk-in sin email, no se envió notificación".
  > Loggear el envío en `message_logs` con messageType='email', status='sent'/'failed', recipient=guestEmail.
  > Toast en frontend después de check-in exitoso debe mostrar "Email de bienvenida enviado a {email}" o "Sin email registrado"
  > según el caso.

- [ ] 11.1.2 Email de bienvenida automático vía auto-messages (checkin_day trigger)
  > El cron de auto-messages (task 6.1.3) debe detectar reservas con status='checked_in' cuyo checkIn = fecha actual,
  > y buscar auto-messages activos con triggerEvent='checkin_day'.
  > Si encuentra, enviar el email usando la plantilla configurada (emailSubject + emailBody con variables sustituidas).
  > Esto permite que cada hotel personalice su mensaje de bienvenida sin tocar código.
  > Variables disponibles: {guest_name}, {hotel_name}, {hotel_address}, {hotel_phone}, {checkin_date},
  > {checkout_date}, {room_number}, {room_type}, {nights}, {total_amount}, {wifi_network},
  > {wifi_password}, {lock_codes}, {locator}, {pre_checkin_url}.

### 11.2 Email de Notificación — Check-out
- [ ] 11.2.1 Enviar email de agradecimiento al hacer check-out
  > En el endpoint `POST /api/reservas/:id/checkout` (composition-root.ts:584), después de confirmar el check-out,
  > disparar el envío de email. El email debe contener:
  > - Asunto: "¡Gracias por tu estancia en {hotel_name}, {guest_name}!"
  > - Cuerpo: agradecimiento, resumen de estancia (fechas, habitación, noches),
  >   enlace a la factura ({invoice_url} si el folio tiene invoiceId),
  >   invitación a dejar reseña ({review_url}), botón "Volver a reservar" ({booking_url}).
  > Si no se envió (sin email), loggear y omitir.
  > Toast en frontend después de check-out: "Email de agradecimiento enviado a {email}" o "Sin email registrado".

- [ ] 11.2.2 Email de post-estancia vía auto-messages (checkout_day trigger)
  > Mismo mecanismo que 11.1.2 pero con triggerEvent='checkout_day'.
  > Se dispara para reservas con checkOut = fecha actual y status='checked_out'.
  > Plantilla personalizable por hotel con las mismas variables.

### 11.3 Motor de Auto-Messages — Ejecución Real
- [ ] 11.3.1 Servicio de cron en backend
  > Crear `backend/src/services/cron.service.ts` que se inicializa en `composition-root.ts` después del server start.
  > Usar `setInterval` cada 5 minutos (300000ms) para ejecutar `processAutoMessages()`.
  > El cron consulta: (a) todas las reservas activas (status = 'checked_in' o 'checked_out' del día),
  > (b) todos los auto-messages activos (isActive = true),
  > (c) cruza triggerEvent con la fecha de la reserva.
  > Para cada coincidencia: sustituir variables en la plantilla, llamar a EmailService.send() si channel incluye 'email',
  > llamar a WhatsAppService.send() si channel incluye 'whatsapp'.
  > Antes de enviar, verificar `message_logs` para evitar duplicados: si ya existe un log con
  > messageId = auto_message.id + reservation.id, saltar.
  > Loggear cada envío (success/failure) con timestamp. Si falla, reintentar en el siguiente ciclo del cron.

- [ ] 11.3.2 Variable substitution engine real
  > La función `substituteVariables(template: string, reservation: any, hotel: any): string`
  > debe reemplazar TODAS las variables listadas en 11.1.2 con valores reales de la DB.
  > Buscar guest por reservation.guestId, room por reservation.roomId, hotel por reservation.hotelId.
  > WiFi: leer de `Configuration` key `wifi_config` (network + password) o de hotel.wifiNetwork/hotel.wifiPassword.
  > Lock codes: leer de `lock_codes` filtrando por reservationId, tomar el código más reciente no expirado.
  > Si una variable no tiene valor, reemplazar con cadena vacía (no mostrar "{wifi_password}" literal).
  > Esta función ya está declarada en task 6.1.2 como [x] — verificar que realmente existe. Si solo es un stub, implementarla.

### 11.4 UX — Check-in Page
- [ ] 11.4.1 Auto-refresh periódico
  > En `frontend/src/pages/checkin/index.vue`, agregar `setInterval(loadData, 30000)` (cada 30 segundos)
  > para refrescar automáticamente la lista de habitaciones, llegadas, en casa y salidas.
  > Limpiar el intervalo en `onUnmounted` para evitar memory leaks.
  > Solo refrescar si la página está visible (usar `document.visibilityState`): si está en background, pausar.

- [ ] 11.4.2 Sticky header para la grid de habitaciones
  > El header "Recepción Digital" y la barra de stats (en casa, por llegar, por salir) deben ser sticky (position: sticky, top: 0)
  > para que al scrollear hacia abajo en hoteles con muchas habitaciones, la información de cabecera siempre esté visible.
  > Agregar z-index: 10 y background blanco para que no se solape con el contenido.

- [ ] 11.4.3 Indicador visual de email enviado/no enviado
  > En el modal de check-in (línea 112-153), después de confirmar, mostrar un badge:
  > - "📧 Email enviado" (verde) si el huésped tiene email y se envió correctamente
  > - "⚠ Sin email" (ambar) si el huésped no tiene email registrado
  > - "❌ Error al enviar" (rojo) si el envío falló
  > El badge se muestra durante 3 segundos antes de cerrar el modal automáticamente.

- [ ] 11.4.4 Reducir polling de heartbeat
  > Los HEAD requests a `/__alive` se disparan ~30+ veces por minuto. Reducir el intervalo de polling
  > de ~2 segundos a 30 segundos. Revisar `frontend/src/composables/useAlive.ts` o donde esté configurado.

### 11.5 Configuración de Email en Settings
- [ ] 11.5.1 Sección de configuración SMTP/Email
  > Agregar en Settings → Integraciones una tarjeta "📧 Configuración de Email" con campos:
  > - Proveedor: selector (SMTP / Resend / SendGrid / Mailgun)
  > - SMTP Host, Puerto, Usuario, Contraseña (si SMTP)
  > - API Key (si Resend/SendGrid/Mailgun)
  > - Email remitente (from): input con validación de formato email
  > - Botón "Probar conexión": envía un email de prueba a la dirección del admin logueado
  > - Guardar en `Configuration` con key `email_config` como JSON
  > - Mostrar estado: "✅ Conectado" (verde) o "⚠ No configurado" (ambar)

**Acceptance:** 
- Al hacer check-in de una reserva con email, el huésped recibe email de bienvenida con WiFi + códigos TTLock + link pre-checkin.
- Al hacer check-out, el huésped recibe email de agradecimiento con link a factura + reseña.
- El cron de auto-messages procesa triggers checkin_day, checkout_day, pre_checkin y envía emails personalizados.
- La página de checkin se refresca automáticamente cada 30s y el header es sticky.
- Settings tiene configuración de email funcional con botón "Probar conexión".
- `message_logs` registra cada envío con status (sent/failed/pending).
- `arckode analyze` → VÁLIDO. `npx vue-tsc --noEmit` → 0 errors. `bun run typecheck` → 0 errors.

---

## Phase 12: Frontend Refactor (Code Quality / Consistencia)

> Refactor de mantenimiento, no feature nueva — limpieza de violaciones a las reglas de
> `CLAUDE.md` (sección Frontend) detectadas en auditoría de `frontend/src`. Sin equivalente
> en MisterPlan (tech debt interno).

### 12.1 Services que importan stores (violación de arquitectura)
- [ ] 12.1.1 `frontend/src/services/http.ts` importa `useAuthStore` directamente
  > Regla violada: "NUNCA service importa store → store orquesta el service, no al revés".
  > Mover la lectura del token/hotelId a un interceptor configurado desde el store (el store
  > inyecta el token en `http.ts` vía función `setAuthToken()`/header, en vez de que `http.ts`
  > importe el store).
- [ ] 12.1.2 `frontend/src/services/Payroll.service.ts:4,8` importa y usa `useAuthStore` en `hotelParam()`
  > Mismo patrón: `hotelId` debe llegar como parámetro desde el componente/store que llama al
  > service, no resuelto internamente importando el store.

### 12.2 Componentes sin `<style scoped>`
- [ ] 12.2.1 Agregar `<style scoped>` (aunque sea vacío o con clases mínimas) a:
  > `components/features/CameraCapture.vue`, `components/features/core-pms/AnnouncementBanner.vue`,
  > `BarChart.vue`, `KpiCard.vue`, `NotificationBell.vue`, `OfflineBanner.vue`.
  > Verificar que no dependen de estilos globales que deban quedar explícitos como scoped.

### 12.3 Tipado `any` evitable
- [ ] 12.3.1 Tipar `HotelSwitcher.vue` (líneas ~56,60,69,80): `hotels: any[]` → `Hotel[]`,
  > `switchTo(hotel: any)` → `switchTo(hotel: Hotel)`, `catch (e: any)` → `catch (e: unknown)` + type guard.
- [ ] 12.3.2 Tipar `NotificationBell.vue:123` `(n.metadata || {}) as any` con un tipo concreto de metadata.
- [ ] 12.3.3 Revisar `any` en `AdminLayout.vue` (filtros/maps de items de menú, 5+ instancias) y
  > tipar con la interfaz de menú existente en `types/index.ts`.
- [ ] 12.3.4 Revisar catch blocks `e: any` en `pages/attendance/index.vue` y `pages/ai-receptionist/config.vue`
  > → `unknown` + `error instanceof Error` guard.
  > Nota: `any` en `CameraCapture.vue` (`window as any).FaceDetector`, `faces: any[]`) está
  > justificado (Face Detection API sin tipos DOM) — NO tocar, dejar comentario explicando por qué.

### 12.4 Navegación interna con `<a href>` en vez de `router-link`
- [ ] 12.4.1 `pages/landing/index.vue:341` — `<a href="#">` placeholder roto → reemplazar por
  > `<router-link>` a la ruta real o quitar el enlace si no tiene destino aún.

**Acceptance:**
- `npx vue-tsc --noEmit` → 0 errors.
- `bun run build` → exitoso.
- Ningún `services/*.ts` importa un store (`grep -rn "from '@/stores" frontend/src/services` → vacío).
- Todos los `.vue` de `components/` tienen bloque `<style scoped>`.
- `grep -rn ": any" frontend/src` reducido a casos justificados con comentario inline.

---

## Verification Checklist (per phase)

After each phase:
- [ ] `npx vue-tsc --noEmit` → 0 errors (frontend)
- [ ] `bun run typecheck` → 0 errors (backend)
- [ ] `arckode analyze` → ✅ VÁLIDO (0 violations)
- [ ] No `alert()` calls (use toast)
- [ ] All new endpoints have `auth.authenticate()` middleware
- [ ] DB changes are backward-compatible (DEFAULT values)
- [ ] New pages follow vstruct naming conventions
