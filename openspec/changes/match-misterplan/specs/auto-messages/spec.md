# SPEC: Auto Messages (Envíos Automáticos)

## Requirements

### REQ-1: Auto-Message Editor

The system MUST provide a visual editor for auto-messages at `/panel/auto-messages`.

#### Fields per message:
| Field | Type | Description |
|-------|------|-------------|
| Título | text | Display name (e.g., "Códigos de Acceso") |
| Color | color-picker | Visual identifier color |
| Asunto del correo | text (multilingual) | Email subject line |
| Cuerpo del email | WYSIWYG (multilingual) | Rich text email body |
| Texto WhatsApp | textarea (multilingual) | Plain text for WhatsApp |
| Canal | select | email / whatsapp / both |
| Disparador | select | When to trigger (see REQ-3) |
| Offset | number | Days before/after trigger event |
| Variables | multi-select | Which dynamic variables to include |
| Activo | toggle | Enable/disable |

### REQ-2: Dynamic Variables

The system MUST support these variables in message bodies:

| Variable | Resolves To |
|----------|-------------|
| `{logo}` | Hotel logo image URL |
| `{hotel_name}` | Hotel name |
| `{hotel_address}` | Full address |
| `{hotel_phone}` | Phone number |
| `{locator}` | Reservation locator |
| `{guest_name}` | Guest full name |
| `{guest_first_name}` | First name only |
| `{checkin_date}` | Check-in date formatted |
| `{checkout_date}` | Check-out date formatted |
| `{nights}` | Number of nights |
| `{room_number}` | Room number |
| `{room_type}` | Room type label |
| `{total_amount}` | Total reservation amount |
| `{pending_amount}` | Pending payment |
| `{lock_codes}` | Lock access codes |
| `{wifi_network}` | WiFi network name |
| `{wifi_password}` | WiFi password |
| `{reservation_image}` | Room image URL |
| `{reservation_details}` | Full reservation summary |
| `{payment_link}` | Payment request URL |

#### Scenario: Variable substitution
- **Given** message body is "Hola {guest_name}, tu reserva {locator} del {checkin_date} al {checkout_date}"
- **And** guest is "Robinson", locator "3636-7174195", dates "24/06/2026" - "30/06/2026"
- **When** message is processed
- **Then** body MUST become "Hola Robinson, tu reserva 3636-7174195 del 24/06/2026 al 30/06/2026"

### REQ-3: Trigger Events

| Trigger | Description | Offset Direction |
|---------|-------------|------------------|
| `reservation_created` | When reservation is created | N/A |
| `pre_checkin` | X days before check-in | Negative offset |
| `checkin_day` | On check-in day (00:00) | 0 |
| `checkout_day` | On check-out day | 0 |
| `post_stay` | X days after check-out | Positive offset |

#### Scenario: Send check-in day message
- **Given** auto-message trigger is "checkin_day", offset 0
- **And** reservation check-in is today (2026-06-24)
- **When** cron job runs at 08:00
- **Then** message MUST be sent to guest
- **And** message_log entry MUST be created

#### Scenario: Send pre-checkin reminder 2 days before
- **Given** auto-message trigger is "pre_checkin", offset 2
- **And** reservation check-in is 2026-06-26
- **When** current date is 2026-06-24
- **Then** message MUST be sent

### REQ-4: Message Preview

#### Scenario: Preview message before sending
- **Given** auto-message is configured
- **When** admin clicks "Guardar y ver ejemplo"
- **Then** system MUST render the message with a sample reservation's data
- **And** show both email preview and WhatsApp preview

### REQ-5: Message Logs

The system MUST track all sent messages.

#### Scenario: View message logs
- **Given** messages have been sent
- **When** admin clicks "Logs"
- **Then** table MUST show: date, reservation, type (email/whatsapp), status, recipient
- **And** filterable by date range and status

### REQ-6: Per-Reservation Override

#### Scenario: Exclude reservation from auto-messages
- **Given** reservation exists
- **When** admin toggles auto-message OFF in reservation modal
- **Then** no auto-messages MUST be sent for this reservation
- **And** status MUST show "[Excluido]" in reservation modal

### REQ-7: Multilingual Support

Messages MUST support 12 languages:
- Español, English, Português, Français, Italiano, Deutsch, Català, Galego, Euskera, Nederlands, Griego, Mexicano

#### Scenario: Send message in guest's language
- **Given** guest nationality is "Dominican Republic" (language: Español)
- **And** message has Spanish and English versions
- **When** message is sent
- **Then** Spanish version MUST be used
