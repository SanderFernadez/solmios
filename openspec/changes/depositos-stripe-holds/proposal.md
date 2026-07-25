# depositos-stripe-holds

## Intent

Garantía de depósito **REAL** vía Stripe: una **autorización (hold)** en la tarjeta del huésped al reservar/check-in, que se **captura** (cobra al folio) o **libera** (devuelve al huésped) al checkout. Hoy los depósitos son **puramente lógicos** — `deposits.create` siempre pone `stripePaymentId: ''`, y `refund`/`release` solo cambian flags en la DB. **No retienen ni devuelven plata real**, así que la "garantía" es cosmética.

## Contexto (estado actual, verificado 2026-07-24)

- `payments/usecases/deposits.ts:24-39` — `create` guarda `stripePaymentId: ''`, `status: 'held'`. No llama a Stripe.
- `refund` (:54) — marca `refundAmount` + status. No devuelve dinero.
- `release` (:79) — marca `status: 'released'`. No libera nada en Stripe.
- `releaseHeldByReservation` (:102) — al checkout, marca `released` los `held`. Conector `reservas-deposits.ts`.
- `payments` (fuente de verdad del dinero) **no se entera** de los depósitos. `money.ts` ya excluye `deposit`/`withdrawal` del cobrado (no son ingreso).
- Stripe gateway: `services/payment-gateway/stripe-gateway.ts` — tiene `refund` y `handleWebhook`, **no** tiene `createHold`/`capture`/`cancel`.

## Decisión (2026-07-24)

**NO hacer la Opción A** (asentar depósitos lógicos en `payments`): haría que el ledger de tesorería reflejara una garantía que **no es real** (la tarjeta no tiene hold) → el sistema mentiría. Peor que el estado actual.

La solución correcta es **B: hold real en Stripe** (`capture_method: 'manual'`). Como es feature de dinero que toca Stripe + checkout + el ledger, merece change openspec + QA robusto (no parche de tarde).

## Scope (v1)

- Depósitos con `paymentMethod === 'card'` → **Stripe PaymentIntent con `capture_method: 'manual'`** (authorization/hold real).
- `create`: crear el PaymentIntent manual → guardar su id en `stripePaymentId` → `status: 'held'`.
- **Al checkout**, dos caminos (decide el recepcionista):
  - **Capturar**: `stripe.capture` (cobra la garantía al folio/huésped) → `status: 'captured'` + asienta en `payments` (ahora sí es ingreso/cobro real).
  - **Liberar**: `stripe.cancel` (libera el hold, devuelve al huésped) → `status: 'released'`.
- `refund` (post-captura): `stripe.refund` del monto capturado.

## Out of scope (v2)

- Depósitos **cash** (no hay hold real en efectivo; sería un pago lógico/anticipo).
- **Captura parcial**.
- Multi-hold / múltiples autorizaciones por reserva.
- Guardar tarjeta on-file (SetupIntent) para re-cobrar — v1 asume el PaymentIntent creado en el momento.

## Riesgos a vigilar

- **Expiración del hold**: las authorizations de Stripe expiran ~7 días. Estancias largas requieren re-hold o captura diferida.
- **Tarjeta del huésped**: v1 crea el PI en el momento (checkout hosted / payment element). Para re-cobro futuro hace falta SetupIntent (v2).
- **Multi-moneda**: el PI hereda la moneda del hotel/deposit.
- **Errores Stripe**: PI `declined`, `requires_action` (3DS), hold fallido → el deposit queda `failed` y no bloquea la reserva.
- **Checkout parcial**: si se captura solo parte del hold, restante se libera.
