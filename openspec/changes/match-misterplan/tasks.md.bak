# Tasks: match-misterplan

## Phase 1: Foundation (Database + Backend)

### 1.1 Database Migrations
- [ ] 1.1.1 Add 30+ columns to `hotels` table (ALTER TABLE with DEFAULTs)
- [ ] 1.1.2 Add 9 columns to `reservations` table
- [ ] 1.1.3 Create `hotel_amenities` table
- [ ] 1.1.4 Create `room_amenities` table
- [ ] 1.1.5 Create `seasons` table
- [ ] 1.1.6 Create `room_rates` table
- [ ] 1.1.7 Create `lock_devices` table
- [ ] 1.1.8 Create `lock_codes` table
- [ ] 1.1.9 Create `auto_messages` table
- [ ] 1.1.10 Create `companions` table
- [ ] 1.1.11 Create `message_logs` table
- [ ] 1.1.12 Create `payment_requests` table
- [ ] 1.1.13 Create `whatsapp_templates` table
- [ ] 1.1.14 Create `room_blocks` table (for planning bloqueos)

**Acceptance:** `sqlite3 .dump` shows all tables + columns. No data loss.

### 1.2 ORM Models (hoteles/model.ts + new modules)
- [ ] 1.2.1 Update HotelesModel with all new fields
- [ ] 1.2.2 Create `cerraduras` module (model, service, controller, types, validators)
- [ ] 1.2.3 Create `temporadas` module
- [ ] 1.2.4 Create `amenities` module
- [ ] 1.2.5 Create `auto-messages` module
- [ ] 1.2.6 Create `companions` module
- [ ] 1.2.7 Create `payment-links` module
- [ ] 1.2.8 Create `blocks` module (room bloqueos)
- [ ] 1.2.9 Register all modules in composition-root.ts
- [ ] 1.2.10 Run `arckode analyze` → MUST be 0 violations

**Acceptance:** Backend starts cleanly, `arckode analyze` = ✅ VÁLIDO

### 1.3 API Endpoints
- [ ] 1.3.1 GET /api/settings/full (all hotel data in one call)
- [ ] 1.3.2 PUT /api/settings/hotel (extended with 30+ fields)
- [ ] 1.3.3 GET/PUT /api/amenities/hotel
- [ ] 1.3.4 GET/PUT /api/amenities/room/:id
- [ ] 1.3.5 GET /api/amenities/catalog
- [ ] 1.3.6 GET/POST/PUT/DELETE /api/seasons
- [ ] 1.3.7 GET/PUT /api/rates
- [ ] 1.3.8 POST /api/rates/copy-next-year
- [ ] 1.3.9 GET/POST/PUT/DELETE /api/blocks
- [ ] 1.3.10 GET/POST/PUT/DELETE /api/companions
- [ ] 1.3.11 GET /api/reservations/:id (extended with OTA fields, companions)

**Acceptance:** All endpoints return proper JSON envelope, auth required.

---

## Phase 2: Complete Settings Page

### 2.1 Datos Básicos (5-tab wizard)
- [ ] 2.1.1 Tab 1: Propietario form (ownerName, taxId, deviceEmail)
- [ ] 2.1.2 Tab 2: Alojamiento form (type select 54 options, website, motor link, currencies, starRating)
- [ ] 2.1.3 Tab 3: Características (100+ amenity checkboxes grouped by category)
- [ ] 2.1.4 Tab 4: Localización (Leaflet map, lat/lng, address, province/municipality)
- [ ] 2.1.5 Tab 5: Descripción (multilingual textarea)

### 2.2 Condiciones (extend current)
- [ ] 2.2.1 Add: cleaningType, depositType, depositFixed, advanceType, advanceAmount
- [ ] 2.2.2 Add: releaseHours, defaultPaymentMethod
- [ ] 2.2.3 Add: taxName, taxRate
- [ ] 2.2.4 Add: requestReviews, publishReviewScore, publishReviewComments

### 2.3 Tarifas (new tab: matrix)
- [ ] 2.3.1 Grid: rows = roomType × occupancy, columns = 4 seasons
- [ ] 2.3.2 Editable price inputs
- [ ] 2.3.3 "Copiar al próximo año" button
- [ ] 2.3.4 Save all rates in batch

### 2.4 Temporadas (new section)
- [ ] 2.4.1 CRUD 4 seasons (name, label, dateRange, color)
- [ ] 2.4.2 Date pickers for start/end

**Acceptance:** Settings page saves ALL data, reloads correctly, `arckode analyze` clean.

---

## Phase 3: Reservation Modal (Complete)

### 3.1 Modal Structure
- [ ] 3.1.1 Create ReservationModal.vue with two-panel layout
- [ ] 3.1.2 Header with locator, action buttons (Confirmar, Anular, Imprimir, Editar)
- [ ] 3.1.3 Left panel with 5 collapsible sections
- [ ] 3.1.4 Right panel with 6 sections

### 3.2 Left Panel Sections
- [ ] 3.2.1 Datos Reserva (source, commission, locators, dates, OTA notes)
- [ ] 3.2.2 Condiciones (3 checkboxes)
- [ ] 3.2.3 Comunicaciones (bono PDF, autocheckin links)
- [ ] 3.2.4 Comunicación Cliente (auto-message toggles per reservation)
- [ ] 3.2.5 Plantillas WhatsApp (send buttons)

### 3.3 Right Panel Sections
- [ ] 3.3.1 Datos Cliente (name, email, phone, WhatsApp links)
- [ ] 3.3.2 Importe y Pago (total, deposit, pending, currency conversion, payment request)
- [ ] 3.3.3 Elementos Reserva (room, config, pricing breakdown)
- [ ] 3.3.4 Otros Servicios (collapsible add-ons)
- [ ] 3.3.5 Acompañantes (list + add form)
- [ ] 3.3.6 QScanPro (connection code display)

### 3.4 Actions
- [ ] 3.4.1 Confirmar reserva (status → confirmed)
- [ ] 3.4.2 Anular reserva (status → cancelled, confirmation dialog)
- [ ] 3.4.3 Generate voucher PDF (window.print with styled template)
- [ ] 3.4.4 Send payment request (generate Stripe link, send email)

**Acceptance:** Modal opens from planning click, shows ALL data, all actions work.

---

## Phase 4: Planning Visual (Drag & Drop)

### 4.1 Setup
- [ ] 4.1.1 Install @fullcalendar/vue3 + resource + interaction plugins
- [ ] 4.1.2 Create PlanningCalendar.vue wrapper
- [ ] 4.1.3 Fetch rooms + reservations + blocks from API

### 4.2 Calendar Features
- [ ] 4.2.1 Resource timeline view (rooms as rows)
- [ ] 4.2.2 Render reservations as colored blocks
- [ ] 4.2.3 Render blocks (bloqueos) as gray blocks
- [ ] 4.2.4 Drag to create new reservation
- [ ] 4.2.5 Drag to move reservation between rooms
- [ ] 4.2.6 Resize to extend/shorten reservation
- [ ] 4.2.7 Click reservation → open ReservationModal
- [ ] 4.2.8 Right-click → context menu (Abrir, Bloquear, Cancelar)
- [ ] 4.2.9 Lock icons on reservations (🔒/🔓)
- [ ] 4.2.10 Month/Week/Day view toggle
- [ ] 4.2.11 Prev/Next navigation
- [ ] 4.2.12 Filters: room type, status, source

### 4.3 Room Blocks (Bloqueos)
- [ ] 4.3.1 Create block dialog (reason, dates)
- [ ] 4.3.2 Prevent reservation on blocked dates
- [ ] 4.3.3 Delete block from context menu

**Acceptance:** Can create/move/resize reservations, blocks work, context menu works.

---

## Phase 5: TTLock Integration

### 5.1 Backend TTLock Service
- [ ] 5.1.1 Create TTLock OAuth2 service (token management)
- [ ] 5.1.2 GET /api/ttlock/connect (OAuth redirect)
- [ ] 5.1.3 GET /api/ttlock/callback (OAuth callback)
- [ ] 5.1.4 POST /api/ttlock/sync-locks (fetch from TTLock API)
- [ ] 5.1.5 POST /api/ttlock/generate-code/:reservationId
- [ ] 5.1.6 POST /api/ttlock/delete-code/:codeId
- [ ] 5.1.7 GET /api/ttlock/locks (list mapped locks)

### 5.2 Frontend Lock Management
- [ ] 5.2.1 Settings → Integraciones → TTLock config card
- [ ] 5.2.2 Lock management page (/panel/cerraduras)
- [ ] 5.2.3 Lock device table (name, room, battery, status)
- [ ] 5.2.4 Map lock to room dropdown
- [ ] 5.2.5 View codes history per lock
- [ ] 5.2.6 Lock icons in planning

### 5.3 Auto-Generation
- [ ] 5.3.1 Auto-generate code when reservation confirmed
- [ ] 5.3.2 Auto-send code on check-in day (via auto-messages)
- [ ] 5.3.3 Auto-delete code after checkout (night audit)

**Acceptance:** Code generates via TTLock API, appears in reservation, auto-sends on check-in day.

---

## Phase 6: Auto Messages

### 6.1 Backend
- [ ] 6.1.1 Create auto_messages CRUD endpoints
- [ ] 6.1.2 Variable substitution engine
- [ ] 6.1.3 Cron job for trigger processing (checkin_day, pre_checkin, etc.)
- [ ] 6.1.4 Email sender (nodemailer or framework email adapter)
- [ ] 6.1.5 message_logs tracking

### 6.2 Frontend
- [ ] 6.2.1 Auto-messages page (/panel/auto-messages)
- [ ] 6.2.2 Message editor (title, color, body WYSIWYG, WhatsApp text)
- [ ] 6.2.3 Variable picker dropdown
- [ ] 6.2.4 Trigger selector (event + offset)
- [ ] 6.2.5 Preview button
- [ ] 6.2.6 Logs viewer

**Acceptance:** Message sends on correct trigger day, variables substituted, logged.

---

## Phase 7: WhatsApp Integration

### 7.1 WhatsApp Web Links
- [ ] 7.1.1 wa.me link generator per reservation
- [ ] 7.1.2 WhatsApp template CRUD
- [ ] 7.1.3 Template send button (opens wa.me)

### 7.2 WhatsApp Business API (optional, advanced)
- [ ] 7.2.1 Meta Business setup documentation
- [ ] 7.2.2 Template approval flow
- [ ] 7.2.3 Send via API (no manual click)

**Acceptance:** Click WhatsApp button opens wa.me with filled template.

---

## Phase 8: Pre-Checkin / Auto-Checkin

### 8.1 Pre-checkin Form
- [ ] 8.1.1 Public route /checkin/:hash (no auth, hash per reservation)
- [ ] 8.1.2 Form: personal data, document upload, selfie
- [ ] 8.1.3 Save to reservation + companions

### 8.2 Auto-checkin QR
- [ ] 8.2.1 Generate QR per hotel
- [ ] 8.2.2 QR links to auto-checkin page
- [ ] 8.2.3 On completion: send lock codes

### 8.3 QScanPro Integration
- [ ] 8.3.1 Connection code per hotel
- [ ] 8.3.2 Document scan webhook receiver

**Acceptance:** Guest completes pre-checkin via link, data saved, codes sent.

---

## Phase 9: Payment Requests

### 9.1 Stripe Integration
- [ ] 9.1.1 Settings → Stripe API keys config
- [ ] 9.1.2 Create payment link endpoint
- [ ] 9.1.3 Webhook for payment confirmation
- [ ] 9.1.4 Payment request from reservation modal

**Acceptance:** Click "Enviar" generates Stripe link, guest pays, reservation deposit updates.

---

## Phase 10: Advanced Reports

### 10.1 Report Endpoints
- [ ] 10.1.1 GET /api/reports/facturacion (revenue by type, services, taxes)
- [ ] 10.1.2 GET /api/reports/ocupacion (total, real, daily breakdown)
- [ ] 10.1.3 GET /api/reports/pernoctaciones (overnight stays per day)
- [ ] 10.1.4 GET /api/reports/rendimiento (ADR, RevPAR, avg stay)
- [ ] 10.1.5 GET /api/reports/procedencia (by country, region)
- [ ] 10.1.6 GET /api/reports/reservas-por-canal (by OTA source)

### 10.2 Report UI
- [ ] 10.2.1 Reports page with 6 tabs
- [ ] 10.2.2 Month/date-range selector
- [ ] 10.2.3 Tables with daily breakdown
- [ ] 10.2.4 Export to PDF/CSV

**Acceptance:** All 6 reports generate correct data matching MisterPlan format.

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
