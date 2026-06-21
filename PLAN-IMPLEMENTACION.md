# PLAN DE TRABAJO — ManagerHotel → Nivel MisterPlan

> Objetivo: Replicar TODA la funcionalidad de MisterPlan con mejor UX
> Basado en análisis exhaustivo del PMS solmirooms

---

## ESTADO ACTUAL vs OBJETIVO

### ✅ Ya tenemos (funciona):
- Auth con JWT (login, roles, multi-hotel)
- CRUD Habitaciones, Reservas, Huéspedes, Facturas
- Channel Manager (Channex API integrada)
- Housekeeping, Mantenimiento, Gastos, Paquetes, Grupos
- Notificaciones, Tickets de soporte
- Reports básicos, Night Audit
- Planning (tabla, NO drag-drop)
- Settings básico (recién arreglado)
- Booking widget público

### ❌ FALTA (ordenado por prioridad de dependencia):

---

## FASE 1 — FUNDACIÓN (Backend + DB)
> Sin esto nada funciona. Es la base de datos y estructura.

### 1.1 Migraciones de Base de Datos

```
Nuevas columnas en `hotels`:
  ownerName, ownerTaxId, deviceEmail
  accommodationType, registrationNumber, website, bookingEngineUrl
  phone2, warningPhone, secondaryCurrency, youtubeUrl
  starRating, onlineBookingStatus, motorVersion
  latitude, longitude, province, municipality, locality, postalCode
  cleaningType, depositType, depositFixed, advanceType, advanceAmount
  releaseHours, defaultPaymentMethod
  requestReviews, publishReviewScore, publishReviewComments
  descriptionJson (multilingüe)

Nuevas tablas:
  hotel_amenities (id, hotelId, amenityKey, category, isActive)
  room_amenities (id, roomId, amenityKey, isShared, isActive)
  seasons (id, hotelId, name, label, startDate, endDate, color)
  room_rates (id, hotelId, roomType, occupancy, season, price)
  lock_devices (id, hotelId, roomId, ttlockId, name, mac, battery, status)
  lock_codes (id, lockId, reservationId, code, startDate, endDate, status)
  auto_messages (id, hotelId, title, color, subject, body, channel, trigger, variables, isActive)
  whatsapp_templates (id, hotelId, name, body, variables)
  payment_requests (id, hotelId, reservationId, amount, status, url, createdAt)
  companions (id, reservationId, name, documentType, documentNumber, nationality)
  message_logs (id, hotelId, reservationId, messageType, status, sentAt, response)
```

### 1.2 Nuevos Módulos Backend (arckode-framework)

```
Módulos a crear con make:module:
  - cerraduras     (gestión TTLock + códigos)
  - temporadas     (CRUD seasons + rates)
  - amenities      (CRUD hotel + room amenities)
  - auto-messages  (envíos programados)
  - payment-links  (requerimientos de pago)
  - companions     (acompañantes de reserva)
  - scans          (QScanPro / documento scanning)
```

### 1.3 Endpoints adicionales en composition-root

```
PUT  /api/settings/hotel          (AMPLIAR con todos los campos nuevos)
GET  /api/settings/full           (TODO en una sola llamada)
GET  /api/amenities/catalog       (catálogo de 100+ amenities)
PUT  /api/amenities/hotel         (guardar amenities del hotel)
PUT  /api/amenities/room/:id      (guardar amenities de habitación)
GET  /api/seasons                 (4 temporadas)
PUT  /api/seasons                 (guardar temporadas)
GET  /api/rates                   (matriz completa)
PUT  /api/rates                   (guardar matriz)
```

---

## FASE 2 — PLANNING VISUAL (Drag & Drop)
> El corazón del PMS. Reemplaza la tabla actual.

### 2.1 Tecnología
- **FullCalendar 6** (@fullcalendar/vue3) o **DHTMLX Scheduler**
- Drag to create, drag to move, resize to change dates
- Context menu (right-click) con: Abrir, Bloquear, Mover, Eliminar
- Resource view: habitaciones como filas, días como columnas

### 2.2 Funcionalidades
```
- Vista mensual/semanal/diaria
- Crear reserva arrastrando (seleccionar rango de días)
- Mover reserva arrastrando (cambiar habitación o fechas)
- Bloquear habitación (click derecho → bloquear)
- Iconos por reserva: cerradura, estado pago, origen OTA
- Tooltip: nombre + localizador + noches + precio
- Color coding: por estado (confirmada, pendiente, checked-in, bloqueo)
- Filtros: por tipo de habitación, estado, origen
```

### 2.3 Componentes Vue
```
PlanningCalendar.vue     → wrapper FullCalendar
PlanningContextMenu.vue  → menú contextual
PlanningReservationBlock → bloque visual de reserva
PlanningBlockDialog.vue  → crear bloqueo
```

---

## FASE 3 — MODAL DE RESERVA COMPLETO
> Reemplaza el modal actual con TODOS los campos de MisterPlan.

### 3.1 Estructura del modal (2 paneles)

```
Panel Izquierdo:
├── Datos de la reserva (origen, comisión, localizadores, fechas, comentarios OTA)
├── Condiciones de reserva (colapsable: protección datos, normas)
├── Comunicaciones (colapsable: bono, autocheckin)
├── Comunicación cliente (colapsable: envíos automáticos on/off)
├── Plantillas WhatsApp (colapsable)

Panel Derecho:
├── Datos del cliente (nombre, email, teléfono, WhatsApp link)
├── Importe y pago (caja, forma pago, importe, anticipo, pendiente, conversión)
├── Elementos de la reserva (habitación, configuración, precio/noche)
├── Otros servicios (colapsable)
├── Acompañantes (lista con documentos)
├── QScanPro (código de conexión)
```

### 3.2 Nuevos campos en backend reservas
```
Nuevas columnas en `reservations`:
  externalLocator     (localizador de la OTA)
  source              (direct, booking, expedia, airbnb, etc.)
  commission          (comisión del canal)
  commissionAmount    (monto de comisión)
  paymentMethod       (transferencia, TPV, efectivo, etc.)
  deposit             (anticipo pagado)
  pendingAmount       (pendiente de cobro)
  notes               (comentarios del canal)
  autoSendEnabled     (envíos automáticos on/off)
  status              (pending, confirmed, checked_in, checked_out, cancelled, no_show)
```

---

## FASE 4 — CERRADURAS TTLock
> Integración con API TTLock para códigos remotos.

### 4.1 API TTLock
```
Documentación: https://open.ttlock.com/document/doc?url=english/description.md
Endpoints necesarios:
  POST /oauth2/token            → autenticación
  GET  /v3/lock/list            → listar cerraduras
  POST /v3/keyboardPwd/add     → crear código temporal
  GET  /v3/lock/queryOpenState  → estado de la puerta
  POST /v3/keyboardPwd/delete  → eliminar código

Flujo OAuth2:
  1. Hotel se registra en TTLock Open Platform
  2. Obtiene clientId + clientSecret
  3. ManagerHotel hace OAuth → guarda token
  4. Sincroniza cerraduras con habitaciones
```

### 4.2 Funcionalidades del módulo
```
- Panel de cerraduras: lista de dispositivos TTLock
- Mapeo cerradura ↔ habitación
- Generar código por reserva (fecha check-in → check-out)
- Estado: sinCodigo / conCodigo / enviado
- Reenviar código al huésped
- Icono de cerradura en planning (por reserva)
- Auto-generar al confirmar reserva
- Auto-enviar el día del check-in
- Ver historial de aperturas
- Ver nivel de batería
```

### 4.3 Configuración TTLock por hotel
```
Settings → Integraciones → TTLock:
  - Client ID
  - Client Secret
  - Account ID (o teléfono)
  - Botón "Conectar" → OAuth flow
  - Botón "Sincronizar cerraduras"
```

---

## FASE 5 — ENVÍOS AUTOMÁTICOS
> Editor visual de mensajes programados multi-canal.

### 5.1 Tipos de envío
```
Canales: Email, WhatsApp Web, WhatsApp Business API
Triggers:
  - Al crear reserva
  - X días antes del check-in
  - El día del check-in (códigos de acceso)
  - El día del check-out
  - X días después del check-out (pedir valoración)
```

### 5.2 Variables dinámicas disponibles
```
{logo}                    → logo del hotel
{locator}                 → localizador de reserva
{guest_name}              → nombre del huésped
{checkin_date}            → fecha entrada
{checkout_date}           → fecha salida
{room_number}             → número de habitación
{room_type}               → tipo de habitación
{nights}                  → cantidad de noches
{total_amount}            → importe total
{pending_amount}          → pendiente de cobro
{lock_codes}              → códigos de cerradura
{hotel_name}              → nombre del hotel
{hotel_address}           → dirección
{hotel_phone}             → teléfono
{wifi_network}            → red WiFi
{wifi_password}           → contraseña WiFi
{reservation_image}       → imagen del elemento
```

### 5.3 Editor visual
```
- Título editable
- Color personalizable (color picker)
- Asunto del correo (multilingüe)
- Cuerpo del mensaje (editor WYSIWYG)
- Texto WhatsApp (con emojis)
- Selector de variables (dropdown)
- Vista previa
- Programación (trigger + timing)
- Activar/desactivar
- Logs de envío
```

---

## FASE 6 — CONFIGURACIÓN COMPLETA
> Replicar TODOS los campos de MisterPlan en Settings.

### 6.1 Datos Básicos (5 tabs wizard)
```
Tab 1: Propietario (nombre, CIF/NIF, email, teléfono, email dispositivos)
Tab 2: Alojamiento (tipo 54 opciones, web, motor reservas, moneda dual, clasificación)
Tab 3: Características (100+ checkboxes amenities)
Tab 4: Localización (mapa Leaflet, lat/lng, dirección, país/provincia/municipio)
Tab 5: Descripción (textarea multilingüe 12 idiomas)
```

### 6.2 Amenities (100+ checkboxes)
```
Categorías:
  Interior: AC, cocina, electrodomésticos, ropa de cama, baño, entertainment
  Exterior: piscina, jardín, parking, gym, spa, restaurante, barbacoa
  Entorno: montaña, playa, rutas, caza, pesca
  Actividades: yoga, tenis, padel, billar, juegos
Toggle por hotel (global) + por habitación (individual)
```

### 6.3 Tarifas (matriz ocupación × temporada)
```
Tabla: Filas = tipos de habitación × ocupación (1p, 2p, 3p, 4p)
Columnas = 4 temporadas (Baja, Media, Alta, Especial)
+ Botón "Copiar precios al próximo año"
+ Release (horas mínimas antes de reservar)
+ Estancia mínima por temporada
```

---

## FASE 7 — WHATSAPP BUSINESS
> Integración directa desde el PMS.

### 7.1 Opciones
```
A) WhatsApp Web links (más fácil):
   - wa.me/phone?text=template
   - Botón "Enviar WhatsApp" en cada reserva
   - Plantillas predefinidas

B) WhatsApp Business API (más potente):
   - Meta Business Platform
   - Envío automático sin intervención
   - Templates aprobados por Meta
   - Requiere verificación de negocio
```

### 7.2 Funcionalidades
```
- Botón WhatsApp en cada reserva (link directo)
- Plantillas de WhatsApp Web (editar/guardar)
- Auto-envío programado (con Envíos Automáticos)
- Historial de mensajes enviados
- Click en teléfono → wa.me link
```

---

## FASE 8 — PRE-CHECKIN / AUTO-CHECKIN
> Check-in digital sin contacto humano.

### 8.1 Pre-checkin online
```
- Link único por reserva (con hash)
- Formulario: datos personales, documento, foto documento
- Escaneo de documento (QScanPro o similar)
- Validación de identidad
- Firma digital de condiciones
- Estados: pendiente, en progreso, completado
```

### 8.2 Auto-checkin con QR
```
- Generar QR por hotel
- Huésped escanea → formulario
- Recibe códigos de cerradura
- Notificación al hotel de check-in completado
```

---

## FASE 9 — REQUERIMIENTOS DE PAGO
> Links de pago para reservas.

### 9.1 Funcionalidades
```
- Generar link de pago (Stripe/PayPal)
- Enviar por email/WhatsApp
- Seguimiento de estado (pendiente, pagado, expirado)
- Botón desde el modal de reserva
- Pago parcial o total
- Conversión a moneda secundaria
```

---

## FASE 10 — REPORTES AVANZADOS
> Replicar los 4 reportes de MisterPlan.

### 10.1 Reportes a crear
```
1. FACTURACIÓN: Ingresos por tipo, servicios extra, impuestos, comisiones
2. OCUPACIÓN: Total, real (sin bloqueos), diaria (% por día), libres vs ocupadas
3. PERNOCTACIONES: Personas por noche, total, desglose por día
4. RENDIMIENTO: ADR por tipo, RevPAR, estancia media, revenue por tipo
5. PROCEDENCIA: Por país, por región
6. RESERVAS: Por canal (OTA vs directo), por fecha de disfrute
```

---

## ORDEN DE IMPLEMENTACIÓN (Dependencias)

```
Fase 1 (DB + Backend)     → TODO primero, base de todo
    ↓
Fase 6 (Configuración)    → Datos del hotel, amenities, tarifas
    ↓
Fase 3 (Modal Reserva)    → Necesita campos nuevos de Fase 1
    ↓
Fase 2 (Planning Visual)  → Necesita reservas completas de Fase 3
    ↓
Fase 4 (TTLock)           → Necesita planning y reservas funcionando
    ↓ (paralelo)
Fase 5 (Envíos Auto)      → Necesita TTLock para enviar códigos
Fase 7 (WhatsApp)         → Independiente
Fase 8 (Pre-checkin)      → Independiente
Fase 9 (Pagos)            → Independiente
    ↓
Fase 10 (Reportes)        → Necesita todo funcionando para reportar
```

---

## TECNOLOGÍAS A INSTALAR

### Frontend (npm)
```bash
npm install @fullcalendar/core @fullcalendar/vue3 @fullcalendar/daygrid
npm install @fullcalendar/interaction @fullcalendar/resource
npm install leaflet                           # mapa interactivo
npm install vue-color-kit                     # color picker
npm install @vueup/vue-quill                  # editor WYSIWYG
npm install qrcode.vue                        # QR codes
npm install vue3-html2pdf                     # generar PDFs (bonos)
```

### Backend (npm)
```bash
npm install node-fetch                        # TTLock API calls
npm install stripe @paypal/checkout-server-sdk # pagos
npm install twilio                            # WhatsApp Business API (opcional)
npm install sharp                             # procesar imágenes (documentos)
npm install node-qrcode                       # generar QR server-side
```

### Integraciones externas (cuentas)
```
1. TTLock Open Platform → https://open.ttlock.com
   - Registrar cuenta
   - Crear aplicación OAuth
   - Obtener clientId + clientSecret

2. Stripe → https://stripe.com
   - Cuenta business
   - API keys (publishable + secret)

3. WhatsApp Business → https://business.whatsapp.com
   - Verificar negocio
   - Obtener Phone Number ID
   - Aprobar templates

4. QScanPro → https://qscanpro.com
   - Cuenta por hotel
   - Código de conexión

5. Google Maps API → para mapa interactivo
   - API key con Maps JavaScript
```

---

## TIEMPO ESTIMADO POR FASE

| Fase | Módulo | Estimación | Prioridad |
|------|--------|------------|-----------|
| 1 | DB + Backend foundation | 2-3 días | CRÍTICA |
| 6 | Configuración completa | 3-4 días | CRÍTICA |
| 3 | Modal de reserva | 2-3 días | CRÍTICA |
| 2 | Planning visual | 3-5 días | CRÍTICA |
| 4 | TTLock Cerraduras | 3-4 días | ALTA |
| 5 | Envíos automáticos | 2-3 días | ALTA |
| 7 | WhatsApp | 1-2 días | ALTA |
| 8 | Pre-checkin | 2-3 días | MEDIA |
| 9 | Pagos | 2 días | MEDIA |
| 10 | Reportes | 2-3 días | MEDIA |

**TOTAL: ~25-30 días de trabajo**

---

## CONFIGURACIÓN TTLock — Paso a paso

```
1. Ir a https://open.ttlock.com
2. Registrarse como desarrollador/empresa
3. Crear nueva aplicación
4. Obtener:
   - Client ID
   - Client Secret
5. Configurar OAuth redirect URL: https://tudominio.com/api/ttlock/callback
6. En ManagerHotel → Settings → Integraciones → TTLock:
   - Ingresar Client ID + Client Secret
   - Click "Conectar cuenta TTLock"
   - OAuth flow → autorizar
   - Sincronizar cerraduras
7. Mapear cada cerradura a una habitación
8. Configurar auto-generación de códigos:
   - Generar código al confirmar reserva
   - Vigencia: desde check-in hasta check-out
   - Enviar automáticamente el día del check-in
```
