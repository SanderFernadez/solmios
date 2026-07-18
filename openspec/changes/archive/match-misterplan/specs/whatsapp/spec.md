# SPEC: WhatsApp Integration

## Requirements

### REQ-1: WhatsApp Web Quick Send

Every reservation MUST have a WhatsApp button that opens wa.me with pre-filled message.

#### Scenario: Send WhatsApp from reservation
- **Given** reservation for guest "Robinson" with phone "+18095551234"
- **When** admin clicks WhatsApp icon in reservation modal
- **Then** browser MUST open `https://wa.me/18095551234?text={encoded_message}`
- **And** message MUST be pre-filled with selected template body

### REQ-2: WhatsApp Templates CRUD

The system MUST allow creating reusable WhatsApp templates.

| Field | Type |
|-------|------|
| Name | text (e.g., "codigos acceso") |
| Body | textarea with variable support |
| Category | select (checkin / checkout / payment / general) |
| Active | toggle |

#### Scenario: Create WhatsApp template
- **Given** admin is on WhatsApp templates page
- **When** clicks "Nuevo envío al WhatsApp"
- **Then** form MUST appear with: name, body (with variable picker), category
- **And** on save, stored in whatsapp_templates table

#### Scenario: Edit template body with variables
- **Given** template body is "Hola {guest_name}, tu código es {lock_codes}"
- **When** admin selects {lock_codes} from variable dropdown
- **Then** variable tag MUST be inserted at cursor position

### REQ-3: WhatsApp from Planning

Each reservation block in planning MUST have a quick WhatsApp action.

#### Scenario: Quick WhatsApp from planning
- **Given** planning shows reservation block
- **When** admin right-clicks → "Enviar WhatsApp"
- **Then** context submenu MUST show available templates
- **And** clicking a template opens wa.me with filled body

### REQ-4: Auto-Send via WhatsApp (Business API — Optional Advanced)

If WhatsApp Business API is configured:

#### Scenario: Auto-send lock codes via WhatsApp API
- **Given** auto-message channel is "whatsapp" and trigger is "checkin_day"
- **And** WhatsApp Business API is configured (Phone Number ID + Token)
- **When** check-in day arrives
- **Then** system MUST call WhatsApp Cloud API:
  ```
  POST https://graph.facebook.com/v18.0/{phone_number_id}/messages
  Body: { messaging_product: "whatsapp", to: guest_phone, type: "template", template: {...} }
  ```
- **And** response MUST be logged in message_logs

### REQ-5: WhatsApp in Reservation Modal

The "Plantillas de WhatsApp Web" section MUST:
- List all active templates
- Each template has: name, edit icon, send icon
- Send icon opens wa.me link

#### Scenario: Send template from modal
- **Given** reservation modal is open
- **And** template "codigos acceso" exists
- **When** admin clicks send icon
- **Then** wa.me link MUST open with:
  - Guest phone number
  - Template body with variables resolved from THIS reservation's data

### REQ-6: WhatsApp Contact Integration

Phone numbers throughout the system MUST have WhatsApp links.

#### Scenario: Phone number in guest profile
- **Given** guest has phone "+18095551234"
- **When** admin views guest profile
- **Then** phone MUST be a clickable link
- **And** WhatsApp icon next to it MUST link to wa.me/18095551234

### REQ-7: Click-to-Chat from Guest List

#### Scenario: WhatsApp from guest list
- **Given** guests page shows list of guests
- **When** admin clicks WhatsApp icon next to a guest
- **Then** wa.me MUST open with a generic greeting template
