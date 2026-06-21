# SPEC: TTLock Smart Lock Integration

## Requirements

### REQ-1: TTLock OAuth2 Connection

The system MUST connect to TTLock Open Platform via OAuth2.

#### Configuration fields (Settings → Integraciones → TTLock):
| Field | Type |
|-------|------|
| Client ID | text (from open.ttlock.com) |
| Client Secret | password |
| Redirect URL | auto-generated (read-only) |
| Connection status | badge (Connected / Disconnected) |
| Connect button | OAuth flow |
| Sync Locks button | fetch lock list from TTLock |

#### Scenario: Connect TTLock account
- **Given** hotel_admin has Client ID and Secret from TTLock
- **When** they enter credentials and click "Conectar"
- **Then** system MUST redirect to TTLock OAuth login page
- **And** after authorization, redirect back with access token
- **And** token MUST be stored securely (encrypted in DB)
- **And** status badge MUST show "Connected"

#### Scenario: Token expires
- **Given** TTLock access token has expired
- **When** any TTLock API call fails with 401
- **Then** system MUST automatically refresh token using refresh_token
- **And** retry the failed request
- **And** if refresh fails, mark TTLock as "Reconnection Required"

### REQ-2: Lock Device Sync

#### Scenario: Sync locks from TTLock
- **Given** TTLock account is connected
- **When** user clicks "Sincronizar Cerraduras"
- **Then** system MUST call GET /v3/lock/list from TTLock API
- **And** create/update lock_devices table for each lock returned
- **And** display count: "5 cerraduras sincronizadas"

#### Scenario: Map lock to room
- **Given** lock device "lock-1" (ttlockLockId: 12345) exists
- **When** admin selects room "101" in lock management UI
- **Then** lock_devices.roomId MUST update to "101"

### REQ-3: Generate Passcode for Reservation

#### Scenario: Auto-generate code on reservation confirm
- **Given** reservation is confirmed and room has a mapped lock
- **When** reservation status changes to "confirmed"
- **Then** system MUST call POST /v3/keyboardPwd/add with:
  - lockId: mapped TTLock lock ID
  - keyboardPwdType: "time" (time-limited)
  - startDate: reservation.checkIn (timestamp)
  - endDate: reservation.checkOut (timestamp)
- **And** store returned passcode in lock_codes table
- **And** lock_codes.status MUST be "generated"

#### Scenario: Manual generate code
- **Given** reservation exists with mapped room/lock
- **When** admin clicks "Generar Código" in reservation modal
- **Then** system MUST create passcode via TTLock API
- **And** show toast "Código generado: ****"

#### Scenario: Delete code on checkout
- **Given** reservation checkOut has passed
- **When** night audit runs
- **Then** system MUST call POST /v3/keyboardPwd/delete for the code
- **And** lock_codes.status MUST change to "expired"

### REQ-4: Send Code to Guest

#### Scenario: Auto-send on check-in day
- **Given** auto_message "Códigos de Acceso" is active
- **And** reservation has lock_code with status "generated"
- **When** check-in day arrives (00:00 hotel local time)
- **Then** system MUST send email/WhatsApp with lock code to guest
- **And** lock_codes.status MUST change to "sent"
- **And** lock_codes.sentVia MUST record channel
- **And** lock_codes.sentAt MUST record timestamp
- **And** message_log MUST be created

#### Scenario: Manual resend code
- **Given** code was already sent
- **When** admin clicks "Reenviar código" in reservation modal
- **Then** system MUST resend via selected channel
- **And** update lock_codes.sentAt

### REQ-5: Lock Management UI

The lock management page MUST show:

| Column | Description |
|--------|-------------|
| Lock Name | Device name from TTLock |
| Room | Mapped room (or "Unassigned") |
| MAC | Device MAC address |
| Battery | Battery level with color indicator |
| Status | Online / Offline / Low Battery |
| TTLock ID | External reference |
| Actions | Edit mapping, View codes, Test |

#### Scenario: View lock codes history
- **Given** lock device mapped to room "101"
- **When** admin clicks "Ver códigos"
- **Then** modal MUST show all codes generated for this lock
- **And** each code shows: reservation guest, dates, code (masked), status

### REQ-6: Lock Icons in Planning

#### Scenario: Reservation with active lock code
- **Given** reservation has lock_code with status "sent"
- **When** planning renders
- **Then** green lock icon (🔒) MUST appear on reservation block

#### Scenario: Reservation without lock code
- **Given** reservation has no lock_code OR status "pending"
- **When** planning renders
- **Then** gray open lock icon (🔓) MUST appear

### REQ-7: Lock Code Variables in Auto-Messages

The auto-message system MUST support variable `{lock_codes}`:
- Resolves to: formatted text with all active lock codes for the reservation
- Format: "Habitación {room}: Código {code} (válido desde {checkin} hasta {checkout})"

#### Scenario: Lock code in message body
- **Given** auto-message body contains "Tu código de acceso es: {lock_codes}"
- **And** reservation has lock code "1234#"
- **When** message is sent
- **Then** body MUST render as "Tu código de acceso es: Habitación 101: Código 1234# (válido desde 24/06 15:00 hasta 30/06 11:00)"

### TTLock API Reference
```
Base URL: https://openapi.ttlock.com
Auth: OAuth2 (client_credentials or authorization_code)

Endpoints:
  POST /oauth2/token            → get access_token
  GET  /v3/lock/list            → list all locks (paginated)
  POST /v3/keyboardPwd/add     → create time passcode
  POST /v3/keyboardPwd/delete  → delete passcode
  GET  /v3/lock/queryOpenState  → check if door is open
  GET  /v3/lock/queryElectricQuantity → battery level
```
