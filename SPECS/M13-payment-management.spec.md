# SPEC — M13: Gestión de Cobros y Pagos

**Suite**: Ventas & Web
**Prioridad**: P0
**Complejidad**: Alta
**Integraciones**: Stripe, Mercado Pago, PayPal

---

## Descripción

Múltiples métodos de pago con conciliación automática. Tarjetas con tokenización segura, transferencias bancarias, enlaces de pago y gestión de depósitos/garantías.

---

## Funcionalidades

### 1. Métodos de Pago
- Tarjetas de crédito/débito (tokenización segura vía Stripe)
- Transferencias bancarias con conciliación automática
- Enlaces de pago personalizados (WhatsApp/email)
- Efectivo
- Depósitos y garantías
- Integración futura: SulusPay

### 2. Procesamiento
- Cobro único o parcial
- Pre-autorización de tarjeta
- Reembolsos totales o parciales
- Cargos futuros (minibar, servicios)
- Divisa local + conversión automática

### 3. Conciliación
- Match automático de transacciones bancarias
- Reporte diario de ingresos
- Alertas por discrepancias
- Exportación contable (CSV/Excel)

### 4. Seguridad
- Tokenización PCI-DSS compliant
- No se almacenan números de tarjeta
- 3D Secure para pagos online
- Fraud detection básico

---

## Modelo de Datos

```typescript
interface Payment {
  id: UUID
  hotelId: UUID
  reservationId?: UUID
  guestId: UUID
  amount: number
  currency: string
  method: 'card' | 'transfer' | 'cash' | 'link' | 'deposit'
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
  stripePaymentId?: string
  mercadopagoId?: string
  cardLast4?: string
  cardBrand?: string
  receiptUrl?: string
  metadata: JSON
  createdAt: Date
}

interface PaymentLink {
  id: UUID
  hotelId: UUID
  amount: number
  currency: string
  description: string
  guestEmail: string
  url: string
  expiresAt: Date
  status: 'active' | 'used' | 'expired'
  paymentId?: UUID
}

interface Deposit {
  id: UUID
  hotelId: UUID
  reservationId: UUID
  amount: number
  status: 'held' | 'released' | 'applied'
  releasedAt?: Date
}
```

---

## Endpoints

```
POST   /payments                        # Crear pago
GET    /payments/:id                    # Detalle del pago
POST   /payments/:id/refund             # Reembolsar

POST   /payment-links                   # Crear enlace de pago
GET    /payment-links/:id               # Verificar estado

POST   /deposits                        # Crear depósito/garantía
PATCH  /deposits/:id/release            # Liberar depósito
POST   /deposits/:id/apply              # Aplicar a folio

GET    /billing/reconciliation          # Conciliación
GET    /billing/daily-report            # Reporte diario
GET    /billing/export                  # Exportación contable

POST   /webhooks/stripe                 # Webhook Stripe
POST   /webhooks/mercadopago            # Webhook Mercado Pago
```

---

## Integraciones

### Stripe
```typescript
// Tarjetas: tokenización + cobros
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Crear pago
const paymentIntent = await stripe.paymentIntents.create({
  amount: amountInCents,
  currency: 'usd',
  customer: stripeCustomerId,
  metadata: { reservationId, hotelId },
})
```

### Mercado Pago
```typescript
// Pagos en LATAM
const preference = await mercadopago.preferences.create({
  items: [{ title: 'Estadía Hotel', quantity: 1, unit_price: amount }],
  external_reference: reservationId,
})
```

### Transferencias Bancarias
```typescript
// Conciliación automática
// 1. Importar extracto bancario (CSV/OFX)
// 2. Match por monto + fecha + referencia
// 3. Marcar como conciliado
// 4. Alertar discrepancias
```

---

## Reglas de Negocio

1. Los depósitos se liberan automáticamente 48h después del check-out
2. Reembolsos parciales requieren justificación
3. Enlaces de pago expiran en 7 días (configurable)
4. La pre-autorización se libera automáticamente al check-out
5. Los pagos en efectivo registran el usuario que recibió el dinero
6. Conciliación diaria automática a las 06:00 AM
