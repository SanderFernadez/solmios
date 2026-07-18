# SPEC: Pre-Checkin / Auto-Checkin

## Requirements

### REQ-1: Pre-Checkin Public Form

The system MUST provide a public pre-checkin form accessible without authentication.

#### Route: `/checkin/:hash`
- No auth required (hash validates access)
- Hash is unique per reservation (crypto-generated)
- Hash expires after check-out date + 7 days

#### Scenario: Guest opens pre-checkin link
- **Given** reservation "res-123" has hash "abc123def456"
- **When** guest navigates to `/checkin/abc123def456`
- **Then** pre-checkin form MUST load
- **And** hotel logo + name MUST be displayed
- **And** reservation details (dates, room type) MUST be pre-filled (read-only)
- **And** guest data form MUST be editable

### REQ-2: Pre-Checkin Form Fields

#### Step 1: Personal Data
| Field | Type | Validation |
|-------|------|------------|
| Nombre completo | text | required |
| Email | email | required |
| Teléfono | tel | required |
| Nacionalidad | select | required |
| Fecha nacimiento | date | required |
| Género | select | optional |

#### Step 2: Document
| Field | Type | Validation |
|-------|------|------------|
| Tipo documento | select | passport / dni / license |
| Número documento | text | required |
| Foto documento (frente) | file upload | required, image |
| Foto documento (dorso) | file upload | optional |

#### Step 3: Additional
| Field | Type |
|-------|------|
| Dirección | text |
| Ciudad | text |
| Código postal | text |
| Ocupación | text |
| Motivo del viaje | select (negocio / turismo / familiar) |
| Preferencias | textarea (smoking, high floor, etc.) |

#### Step 4: Vehicle (optional)
| Field | Type |
|-------|------|
| Matrícula | text |
| Marca/Modelo | text |

#### Step 5: Acceptance
| Field | Type |
|-------|------|
| Acepto condiciones | checkbox (required) |
| Acepto política privacidad | checkbox (required) |
| Firma digital | canvas (draw signature) |

#### Scenario: Complete pre-checkin
- **Given** guest fills all required fields
- **When** clicks "Completar Check-in"
- **Then** data MUST be saved to reservation + companions
- **And** reservation.preCheckinStatus MUST = "completed"
- **And** hotel MUST receive notification "Pre-checkin completado"
- **And** guest MUST see confirmation page with next steps

#### Scenario: Invalid hash
- **Given** hash "invalid-hash" doesn't exist
- **When** guest navigates to `/checkin/invalid-hash`
- **Then** error page MUST show "Link inválido o expirado"

### REQ-3: Auto-Checkin QR Code

#### Scenario: Display QR in hotel lobby
- **Given** hotel has auto-checkin enabled
- **When** hotel_admin generates QR code
- **Then** system MUST create QR linking to `/auto-checkin/:hotelSlug`
- **And** QR MUST be downloadable as PNG

#### Scenario: Guest scans QR
- **Given** guest scans QR code at hotel entrance
- **When** phone opens auto-checkin page
- **Then** page MUST show:
  - Hotel welcome message
  - "Enter your locator" input
  - OR "Scan reservation email" option
- **And** after locator validation, pre-checkin form loads

### REQ-4: Pre-Checkin Status Tracking

| Status | Description |
|--------|-------------|
| pending | Reservation created, no pre-checkin yet |
| started | Guest opened the form but hasn't completed |
| completed | Guest submitted all required data |
| expired | Past check-out + 7 days |

#### Scenario: View pre-checkin status in reservation modal
- **Given** reservation modal is open
- **When** pre-checkin section renders
- **Then** status badge MUST show (Pendiente / En Progreso / Completado)
- **And** if completed, link to view submitted data MUST be available

### REQ-5: Document Scanning (QScanPro)

#### Scenario: QScanPro connection
- **Given** hotel has QScanPro account
- **When** hotel settings shows QScanPro section
- **Then** connection code MUST display (e.g., "106EfB-695")
- **And** link to qscanpro.com for setup

#### Scenario: Document scan webhook
- **Given** QScanPro scans a document for a reservation
- **When** QScanPro sends webhook to `/api/scans/webhook`
- **Then** system MUST update companion data with extracted fields
- **And** mark document as verified

### REQ-6: Auto-Checkin with Lock Codes

#### Scenario: Complete check-in triggers code send
- **Given** pre-checkin status changes to "completed"
- **And** check-in date is today
- **When** pre-checkin form is submitted
- **Then** system MUST trigger lock code auto-send (if TTLock configured)
- **And** guest MUST receive email/WhatsApp with lock codes
- **And** reservation status MAY auto-change to "checked_in" (configurable)

### REQ-7: Admin Pre-Checkin Dashboard

The admin MUST be able to see all pre-checkin statuses.

#### Scenario: View pre-checkin overview
- **Given** admin navigates to checkin page
- **When** page loads
- **Then** table MUST show:
  - Guest name
  - Reservation locator
  - Check-in date
  - Pre-checkin status (badge)
  - Action: View details / Send link / Manual check-in

### REQ-8: Send Pre-Checkin Link Manually

#### Scenario: Resend pre-checkin link
- **Given** reservation pre-checkin status is "pending"
- **When** admin clicks "Enviar link de check-in"
- **Then** system MUST send email with pre-checkin link
- **And** toast MUST confirm "Link enviado a {email}"
