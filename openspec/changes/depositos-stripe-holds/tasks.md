# depositos-stripe-holds — Tasks

## 1. Stripe gateway — métodos de hold (`services/payment-gateway/stripe-gateway.ts`)
- [ ] 1.1 `createHold({ hotelId, amount, currency })`: crea PaymentIntent con `capture_method: 'manual'`, retorna `{ paymentIntentId, status }`.
- [ ] 1.2 `capture(paymentIntentId, amount?)`: captura el hold (total o parcial) → funds transferidos.
- [ ] 1.3 `cancel(paymentIntentId)`: cancela el PI (libera el hold, devuelve al huésped).
- [ ] 1.4 Manejo de estados: `requires_payment_method`, `requires_action` (3DS), `succeeded`, `canceled`.
- [ ] 1.5 Tests del gateway con mocks de Stripe (createHold/capture/cancel + errores declined/3DS).

## 2. Modelo + tipos
- [ ] 2.1 `DepositStatus`: agregar `'captured'` y `'failed'` a los existentes (`held`/`released`/`partially_refunded`/`fully_refunded`).
- [ ] 2.2 `DepositDTO`: `stripePaymentId` ahora significativo (PI id); agregar `capturedAmount?: number`.

## 3. deposits.ts — integrar hold real
- [ ] 3.1 `create`: si `paymentMethod === 'card'` y Stripe configurado → `stripe.createHold(amount)` → guardar `stripePaymentId`; si falla (declined/3DS no completado) → `status: 'failed'` (no rompe la reserva). Cash → flujo lógico actual (sin hold).
- [ ] 3.2 `capture(id, amount?)`: `stripe.capture(stripePaymentId, amount)` → `status: 'captured'`, `capturedAmount`, y asienta `payment` tipo `deposit`→`charge` en `payments` (ahora es cobro real). Idempotente.
- [ ] 3.3 `release(id)`: si `held` → `stripe.cancel(stripePaymentId)` (libera hold real); si `captured` → no (ya se cobró, requiere refund).
- [ ] 3.4 `refund(id, amount)`: si `captured` → `stripe.refund(stripePaymentId, amount)` + marcar `refundAmount`. Si solo `held` → `release` (cancel).

## 4. Checkout — capturar o liberar (decisión del recepcionista)
- [ ] 4.1 `settle-folio-at-checkout.ts` / connector `reservas-deposits.ts`: además de liberar, ofrecer **capturar** al folio. Body del checkout: `depositAction?: 'capture' | 'release'` (default `release`).
- [ ] 4.2 Si `capture`: el monto capturado se postea como cargo al folio (o pago directo) y se asienta en `payments`.
- [ ] 4.3 Si `release`: `stripe.cancel` (hold liberado de verdad).

## 5. Frontend
- [ ] 5.1 Vista de depósito: mostrar estado **real** del hold (`held` con PI id / `captured` / `released` / `failed`), no solo el flag lógico.
- [ ] 5.2 Al checkout, selector: "Capturar garantía" (al folio) vs "Liberar" (devolver al huésped).
- [ ] 5.3 Manejar PI `requires_action` (3DS) — redirigir al huésped a completar.

## 6. Webhook Stripe (eventos del PI)
- [ ] 6.1 `payment_intent.amount_capturable.updated`, `payment_intent.succeeded`, `payment_intent.canceled`, `charge.refunded` (ya existe) → sincronizar estado del depósito.
- [ ] 6.2 Idempotente vía `PaymentEventStore.settleOnce` (patrón existente).

## 7. money.ts / reportes
- [ ] 7.1 Un depósito `held` **no** es ingreso (seguir excluido). Un depósito `captured` **sí** (asentado en `payments` tipo charge) → ya entra por la lógica normal. Confirmar que no hay doble conteo.

## 8. Gate (antes de deploy)
- [ ] 8.1 `arckode analyze` 0 violaciones.
- [ ] 8.2 `bun test` (payments + reservas + stripe).
- [ ] 8.3 typecheck backend + frontend.
- [ ] 8.4 e2e con tarjetas de test de Stripe: create hold → checkout capture (fondo al folio) y checkout release (hold liberado). Verificar `payments` y el extracto del huésped.
- [ ] 8.5 Validar expiración del hold (~7d) en estancias largas.

## Dependencias externas
- Stripe configurado por hotel (ya requerido para otros cobros).
- Tarjetas de test de Stripe para QA (4242 success, 4000 decline, 4000 3DS).
