# SPEC: Reservation Modal (Complete)

## Requirements

### REQ-1: Modal MUST have two-panel layout

The reservation modal MUST be organized as:
```
┌─────────────────────────────────────────────────────┐
│  Header: Reserva {locator}  [Print] [Edit] [×]      │
│  [Confirmar] [Anular Reserva]  [icons...]           │
├──────────────────────┬──────────────────────────────┤
│  LEFT PANEL          │  RIGHT PANEL                 │
│                      │                              │
│  ▼ Datos Reserva     │  ▼ Datos Cliente             │
│  ▼ Condiciones       │  ▼ Importe y Pago            │
│  ▼ Comunicaciones    │  ▼ Elementos Reserva         │
│  ▼ Com. Cliente      │  ▼ Otros Servicios           │
│  ▼ WhatsApp Plant.   │  ▼ Acompañantes              │
│                      │  ▼ QScanPro                  │
└──────────────────────┴──────────────────────────────┘
```

### REQ-2: Datos de la Reserva section

MUST display (read-only unless editing):
| Field | Type | Source |
|-------|------|--------|
| Reserva desde | text | reservation.source (OTA name) |
| Comisión | text | reservation.commission + "Indicar" button |
| Id reserva | text | reservation.id |
| Localizador externo | text | reservation.externalLocator |
| Fecha Reserva | datetime | reservation.createdAt |
| Entrada - Salida | text | "{checkIn} - {checkOut} ({nights} n.)" |
| Comentario de la reserva | textarea | reservation.notes (OTA comments) |

#### Scenario: Display OTA source
- **Given** reservation.source is "expedia"
- **When** modal opens
- **Then** "Reserva desde" MUST show "Expedia (QuickConnect)"

### REQ-3: Condiciones de Reserva section (collapsible)

MUST display:
- ✅ Protección de datos (checkbox)
- ✅ Deseo recibir información adicional (checkbox)
- ✅ Normas de Uso y Seguridad (checkbox)

#### Scenario: Toggle conditions
- **Given** conditions section is collapsed
- **When** user clicks header
- **Then** section MUST expand showing 3 checkboxes
- **And** checkboxes MUST reflect saved state

### REQ-4: Comunicaciones section (collapsible)

MUST display links/buttons:
- 📄 Bono del alojamiento (generates PDF)
- 📄 Bono para el Cliente (generates PDF)
- 📱 Autocheckin (opens autocheckin URL)

#### Scenario: Generate booking voucher
- **Given** reservation exists
- **When** user clicks "Bono del alojamiento"
- **Then** system MUST generate a PDF with: hotel logo, reservation details, room, dates, price
- **And** PDF MUST open in new tab for printing

### REQ-5: Comunicación con el Cliente section (collapsible)

MUST display:
- Text: "Los envíos de esta reserva se enviarán automáticamente"
- Toggle per auto-message: enabled/disabled (e.g., "Códigos de Acceso [Excluido]")

#### Scenario: Exclude from auto-send
- **Given** auto-message "Códigos de Acceso" is enabled
- **When** user clicks it to exclude
- **Then** text MUST change to "[Excluido]"
- **And** message_logs MUST NOT create entries for this reservation+message

### REQ-6: Plantillas de WhatsApp Web section (collapsible)

MUST display saved WhatsApp templates with send button per template.

#### Scenario: Send WhatsApp template
- **Given** template "codigos acceso" exists
- **When** user clicks send icon
- **Then** system MUST open wa.me link with template body filled with reservation variables

### REQ-7: Datos del Cliente panel

MUST display:
| Field | Type | Action |
|-------|------|--------|
| Nombre | text link | Click → edit client modal |
| Email | mailto link | Click → open email client |
| Teléfono | tel link | Click → call |
| WhatsApp | wa.me link | Click → open WhatsApp |

### REQ-8: Importe y Pago panel

MUST display:
| Field | Type |
|-------|------|
| Caja | "Ver movimientos" link → opens ledger |
| Forma de pago | select (transferencia/TPV/Tarjeta/Efectivo/PayPal/Bizum) |
| Importe de la reserva | currency (primary) |
| Anticipo | currency |
| Otros cobros | currency (editable) |
| Pendiente de cobro | currency (auto-calculated) |
| Conversión moneda secundaria | currency (auto-converted) |
| Requerimiento de pago | "Enviar" button |

#### Scenario: Calculate pending amount
- **Given** reservation total is $409.98, deposit is $0.00, other charges $0.00
- **When** modal renders
- **Then** "Pendiente de cobro" MUST show "$409.98"
- **And** secondary currency conversion MUST show (e.g., "RD$ 24,031.37")

#### Scenario: Send payment request
- **Given** pending amount > 0
- **When** user clicks "Requerimiento de pago → Enviar"
- **Then** system MUST generate a payment link (Stripe)
- **And** send link to guest email
- **And** show confirmation toast "Link de pago enviado"

### REQ-9: Elementos de la Reserva panel

MUST display:
| Field | Example |
|-------|---------|
| Habitación | "208 Hab Familiar (24/06/2026)" |
| Configuración | "SA" (Servicio de Alojamiento) |
| Detalle | "2 pax, 4P Estándar, 6 noches x USD $68.33 = USD $409.98" |
- Editable: change room, change occupancy

### REQ-10: Acompañantes panel

MUST display list of companions with:
- Name
- Document type + number
- Nationality
- "*" indicator if main guest
- Add companion button

#### Scenario: Add companion
- **Given** reservation has 1 companion (main guest)
- **When** user clicks "+ Añadir acompañante"
- **Then** form MUST appear: name, documentType, documentNumber, nationality
- **And** on save, companion MUST be added to companions table

### REQ-11: QScanPro code display

MUST display the hotel's QScanPro connection code with explanation.

### REQ-12: Action buttons in header

| Button | Action |
|--------|--------|
| Confirmar | Confirm reservation (status → confirmed) |
| Anular Reserva | Cancel reservation (status → cancelled) |
| Imprimir | Open print dialog |
| Editar | Enable all fields for editing |
| Eliminar | Delete reservation (soft delete) |

#### Scenario: Cancel reservation
- **Given** reservation status is "confirmed"
- **When** user clicks "Anular Reserva"
- **Then** confirmation dialog MUST appear: "¿Confirmar anulación?"
- **And** on confirm, status MUST change to "cancelled"
- **And** room MUST become available
- **And** planning MUST update (block turns red/gray)
