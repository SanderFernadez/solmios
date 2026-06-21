# SPEC: Payment Requests (Requerimientos de Pago)

## Requirements

### REQ-1: Payment Link Generation

The system MUST generate Stripe payment links for reservations with pending amounts.

#### Scenario: Create payment request from reservation
- **Given** reservation has pendingAmount > 0
- **When** admin clicks "Requerimiento de pago → Enviar" in reservation modal
- **Then** system MUST:
  1. Create Stripe Checkout Session (or Payment Link)
  2. Store in payment_requests table
  3. Send email to guest with payment link
  4. Show toast "Link de pago enviado a {email}"

### REQ-2: Payment Request Data Model

```sql
CREATE TABLE payment_requests (
  id TEXT PRIMARY KEY,
  hotelId TEXT NOT NULL,
  reservationId TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  stripeSessionId TEXT,
  stripePaymentUrl TEXT,
  status TEXT DEFAULT 'pending',  -- pending / paid / expired / cancelled
  sentTo TEXT,                     -- email address
  sentVia TEXT DEFAULT 'email',   -- email / whatsapp / manual
  paidAt TEXT,
  createdAt TEXT DEFAULT '',
  updatedAt TEXT DEFAULT ''
);
```

### REQ-3: Stripe Integration Configuration

Settings → Integraciones → Stripe:
| Field | Type |
|-------|------|
| Publishable Key | text (pk_...) |
| Secret Key | password (sk_...) |
| Webhook Secret | password (whsec_...) |
| Mode | select (Test / Live) |
| Connection status | badge |

#### Scenario: Configure Stripe
- **Given** admin has Stripe API keys
- **When** enters keys in settings and saves
- **Then** Stripe status badge MUST show "Connected"
- **And** system MUST validate keys by creating a test customer

### REQ-4: Payment Flow

#### Scenario: Guest pays via link
- **Given** payment request URL was sent to guest
- **When** guest opens link and completes payment
- **Then** Stripe webhook MUST call `/api/payments/webhook`
- **And** system MUST:
  1. Update payment_requests.status = "paid"
  2. Update payment_requests.paidAt = now
  3. Update reservation.deposit += amount
  4. Update reservation.pendingAmount -= amount
  5. Create message_log entry
  6. Notify hotel_admin via notification

#### Scenario: Partial payment
- **Given** reservation total is $409.98
- **And** payment request is for $200.00
- **When** guest pays $200
- **Then** reservation.deposit MUST = $200.00
- **And** reservation.pendingAmount MUST = $209.98

### REQ-5: Payment Methods Support

Payment links MUST support:
- Credit/debit cards (Visa, Mastercard, Amex)
- Alternative methods based on country (OXXO Mexico, PSE Colombia, etc.)

### REQ-6: Payment Request from Reservation Modal

In the "Importe y Pago" section:
| Element | Description |
|---------|-------------|
| Amount input | Pre-filled with pendingAmount, editable |
| "Enviar" button | Generates link + sends email |
| Payment history | List of previous payment requests for this reservation |
| Status badges | pending (yellow) / paid (green) / expired (gray) |

#### Scenario: Multiple payment requests
- **Given** reservation has 2 payment requests (1 paid, 1 pending)
- **When** admin opens reservation modal
- **Then** payment history MUST show both with status badges
- **And** total paid MUST be visible

### REQ-7: Payment Receipt

#### Scenario: Generate receipt after payment
- **Given** payment_requests.status changed to "paid"
- **When** webhook processes
- **Then** system MUST generate PDF receipt
- **And** email receipt to guest
- **And** make receipt available in reservation modal ("Ver recibo")

### REQ-8: Currency Conversion

#### Scenario: Display secondary currency
- **Given** hotel primary currency is USD, secondary is DOP
- **And** payment amount is $409.98 USD
- **When** payment request is created
- **Then** email MUST show: "$409.98 USD (≈ RD$ 24,031.37)"
- **And** conversion rate MUST be fetched from API or configured

### REQ-9: Webhook Handler

#### Endpoint: POST /api/payments/webhook
- No auth (Stripe webhook signature verification)
- MUST verify `stripe-signature` header
- MUST be idempotent (same event processed once)

#### Scenario: Duplicate webhook
- **Given** Stripe sends same event twice
- **When** webhook handler processes
- **Then** second event MUST be ignored
- **And** response MUST be 200 OK (don't trigger retry)
