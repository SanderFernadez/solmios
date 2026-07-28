# fix-refund-pos-card — Tasks

> Decisiones ya resueltas (usuario, 2026-07-28, ver `proposal.md`): Stripe Checkout Session (NO Terminal),
> expiración corta (30 min — piso real de la API de Stripe; 15 min pedidos originalmente hubieran sido
> rechazados) y la mesa se LIBERA al expirar (no queda tomada esperando re-cobro sobre la misma sesión
> — el cajero genera una Checkout Session nueva).

## 1. Spec / Design (SDD)
- [x] 1.1 Escenarios resueltos en `proposal.md`: payOrder card → processing_payment; webhook completed →
      paid; webhook expired (15min) → billed + mesa liberada; refund de orden paid con stripePaymentId → OK.
- [x] 1.2 Secuencia del flujo async documentada en `proposal.md` (tabla "Plan técnico").
- [x] 1.3 Timeout: 30 min (`expires_at` al crear la Checkout Session — piso real de Stripe, 15 min pedidos
      hubieran sido rechazados). Mesa: se libera al expirar. Re-cobro: sesión nueva, NO se reintenta la expirada.

## 2. Contrato del módulo restaurant (`restaurant/usecases/settlement.ts`)
- [x] 2.1 Agregar `'processing_payment'` a `OrderStatus` (`restaurant/types.ts`).
- [x] 2.2 Nuevo port `chargeCardPayment?: (input: { orderId, hotelId, amount, currency, description, successUrl, cancelUrl }, user) => Promise<{ paymentId, checkoutUrl }>` en `SettlementPorts` (`settlement.ts:14`).
- [x] 2.3 `payOrder` (`settlement.ts:106`): si `method==='card'`, llamar `ports.chargeCardPayment` (NO `recordPayment`); orden → `processing_payment`; guardar `paymentId`. Si `method!=='card'`, flujo actual.
- [x] 2.4 Nuevo `settlePaidOrder(deps, orderId, paymentId, user)`: validar ownership + estado `processing_payment` → update `paid`, `closedAt`, liberar mesa, emitir `sockets.onOrderPaid?.(order)`. Idempotente por estado.
- [x] 2.5 Nuevo `unsettleOrder(deps, orderId, user)`: validar estado `processing_payment` → volver a `billed` Y **liberar la mesa** (`status:'free'` en `restaurant_tables`, mismo mecanismo que `cancelOrder`). Idempotente.
- [x] 2.6 (no listado, hallado en implementación) `assertSettleable` rechaza un segundo `payOrder`/`chargeToRoom` sobre una orden `processing_payment` (doble click no abre una 2da Checkout Session); `LINES_LOCKED` (order-lines.ts) y `cancelOrder` (orders.ts) también bloquean `processing_payment` — sin esto se podía editar líneas o cancelar una orden con un cobro de Stripe en curso.

## 3. Sockets / events
- [x] 3.1 Registrar `'onOrderPaid'` en `events: [...]` del `restaurant/index.ts` (si no existe ya; RES-5 pudo dejarlo). Ya estaba.
- [x] 3.2 Hook para que el conector inyecte el callback inverso: se reusó el mecanismo `setSockets`/`PaymentsSockets` ya existente (`onPaymentCompleted`/`onPaymentExpired` nuevo) en vez de agregar un setter dedicado `setOnPaymentCompleted(cb)` — mismo patrón que `payments-accounting.ts` ya usa para lo mismo.

## 4. Conector — socket inverso (`connectors/restaurante-payments.ts`)
- [x] 4.1 `chargeCardPayment`: delegar a `payments().chargeCard({ ..., reference:'pos:'+orderId, successUrl, cancelUrl })` → devuelve `{ paymentId, checkoutUrl }`. Reusa `payments/usecases/charge-card.ts`.
- [x] 4.2 Registrar `onPaymentCompleted(payment)` en payments: si `payment.metadata?.source === 'restaurant'` y `metadata.orderId`, llamar `restaurant.settlePaidOrder(orderId, paymentId, sys)`.
- [x] 4.3 Registrar `onPaymentExpired(payment)` → `restaurant.unsettleOrder(orderId, sys)` (same source check).
- [x] 4.4 Conector `restaurante-inventario`: ya descuenta en `onOrderPaid` (v1) — verificado, sin cambios: `onOrderPaid` ahora SOLO lo emite `settlePaidOrder` (webhook) para `method==='card'`, y `payOrder` síncrono para cash/transfer — mutuamente excluyentes, cero doble descuento.

## 5. Webhook — expiración (`payments/usecases/settle-webhook.ts`)
- [x] 5.1 Manejar `outcome.status === 'expired'` (checkout.session.expired): marcar payment `cancelled` + disparar `onExpired?.(payment)` (nuevo callback simétrico a `onCompleted`).
- [x] 5.2 No romper el path `paid` existente (cuidar el enum de status y el early-return).
- [x] 5.3 `StripeUseCase.handleWebhook` debe mapear `checkout.session.expired` → `{ status:'expired', reference, eventId }`.

## 6. Controller + rutas
- [x] 6.1 `restaurant/controller.ts:payOrder` devuelve `{ checkoutUrl }` cuando el payment quedó `processing` (frontend lo usa para redirigir).
- [x] 6.2 Ruta existente `POST /api/restaurant/orders/:id/pay` mantiene permiso `restaurant:edit` (el código real ya usaba `edit`, no `create`; sin cambio de permiso de todos modos).
- [x] 6.3 Exponer `GET /api/restaurant/orders/:id` con status actualizado para el poll del frontend (ya existe).

## 7. Frontend — `cobrar.vue` + `Restaurant.service.ts`
- [x] 7.1 `Restaurant.service.payOrder(id, method)`: si devuelve `checkoutUrl`, el componente redirige (`window.location.href`).
- [x] 7.2 `successUrl` apunta a la ruta de la orden con query `?paid=pending`; al volver, **poll** `GET /orders/:id` cada ~1.5s hasta `status==='paid'` (timeout ~60s, luego toast "no confirmamos el cobro, revisá Stripe").
- [x] 7.3 `cancelUrl` vuelve a la orden sin cobrar (toast "cobro cancelado").
- [x] 7.4 Botón "Reembolsar" ya existe (v1 `refund-orden-pos`): ahora debe funcionar para órdenes `paid` con `method==='card'` (sin topar el 409). Verificado con test (`refund-after-webhook.test.ts`).
- [x] 7.5 (no listado, hallado en implementación) `salon.vue` (`LIVE`) y `comanda.vue` (`LOCKED`) actualizados para tratar `processing_payment` como "mesa/comanda ocupada, no editable" — sin esto la mesa aparecía libre en el salón mientras el cobro seguía en curso.

## 8. Guard de `refund.ts` (relajación condicional)
- [x] 8.1 El guard `if (!payment.stripePaymentId)` en `refund.ts` (commit `7e9e37f`) **se mantiene** durante el ventana `processing`. Solo es seguro relajarlo cuando el webhook confirma y puebla `stripePaymentId` (lo hace `crud.updateStatus(id, 'completed', providerRef)`). Sin cambios en refund.ts.
- [x] 8.2 Verificado con test (`refund-after-webhook.test.ts`): tras el webhook, `payment.stripePaymentId !== ''` → el guard deja de dispararse para órdenes POS pagadas con tarjeta.

## 9. Tests
- [x] 9.1 `restaurant/tests`: `payOrder(card)` deja orden `processing_payment` y devuelve `checkoutUrl`; `payOrder(cash)` flujo actual sin cambio.
- [x] 9.2 `restaurant/tests`: `settlePaidOrder` idempotente (segunda llamada no duplica socket/libera mesa).
- [x] 9.3 `restaurant/tests`: `unsettleOrder` solo aplica a `processing_payment` (no a `paid`/`billed`).
- [x] 9.4 `payments/tests`: webhook `expired` marca payment `cancelled` y dispara `onExpired` (`webhook-expiry.test.ts`).
- [x] 9.5 `connectors/tests`: tras `onPaymentCompleted` con `metadata.source='restaurant'`, se llama `settlePaidOrder`; con otro source, NO (`restaurante-payments-webhook.test.ts`).
- [x] 9.6 E2E REAL en prod contra Stripe test mode (2026-07-28, Playwright, Hotel Boutique Palma —
      único hotel con `payment_gateways.mode='test'`): comanda "Para llevar" → 1 ítem ($1.18) →
      Cobrar → Tarjeta → **confirmado**: crea Checkout Session real (`cs_test_...`), redirige a
      Stripe, tarjeta 4242 4242 4242 4242 aceptada, Stripe confirma el pago y redirige a
      `successUrl` (`?paid=pending`). **HALLAZGO REAL (no eran solo suposiciones)**: el webhook de
      Stripe **NUNCA llegó al backend** — `payment_events` para este hotel tiene 0 filas, la orden
      quedó indefinidamente en `processing_payment` y el payment en `processing` con
      `stripePaymentId` vacío. No se pudo probar el botón Reembolsar (nunca se alcanza `paid`).
      **Causa: el webhook endpoint del hotel no está suscripto a `checkout.session.completed` en el
      Dashboard de Stripe** (config externa, no bug de código — mismo gap que ya se había anotado
      para `checkout.session.expired`). Se limpió el order/payment de prueba (cancelados a mano) y
      la carta de prueba (estación/categoría/ítem QA borrados) — Hotel Boutique Palma queda como
      estaba antes del test.

## 10. Deploy + Gate
- [x] 10.1 `arckode analyze` 0 violaciones (backend). ✅ VÁLIDO.
- [x] 10.2 `bun run typecheck` (backend) + `bun run typecheck` (frontend, con `-b`). Ambos limpios.
- [x] 10.3 `bun test` (restaurant + payments + connectors). 327/327 verdes (2262/2262 en la suite completa).
- [x] 10.4 Deploy: sin migration de DB nueva (estados en enum TS, no en schema). Validado `OrderStatus` en los enumeradores que existían: `order-lines.ts:LINES_LOCKED`, `orders.ts:cancelOrder` (backend) y `salon.vue:LIVE`/`comanda.vue:LOCKED` (frontend) — todos actualizados para incluir `processing_payment` donde correspondía.
- [x] 10.5 Probado en prod con Stripe test mode (Hotel Boutique Palma) — ver 9.6. **El código funciona
      hasta donde el webhook lo permite**; el flujo end-to-end NO cierra hoy porque falta la
      suscripción del webhook en el Dashboard de Stripe de ese hotel. **Bloqueado para pasar a
      "confirmado end-to-end"** hasta que se suscriba `checkout.session.completed` (y
      `checkout.session.expired`) en el hotel de prueba y se repita el E2E.
- [ ] 10.6 NO retirar el mensaje de workaround del guard `refund.ts` — el punto 10.5 mostró que el
      flujo real puede quedar atascado en `processing`/`processing_payment` en producción (no solo
      en teoría), así que el guard sigue siendo necesario. Reevaluar cuando 10.5 esté realmente
      cerrado.

## Riesgos a vigilar
- **Doble descuento de inventario**: hoy `recordPayment` (cash/folio) descuenta al cobrar; el nuevo flujo async debe hacerlo en `onOrderPaid` (webhook), NO antes. Si queda el descuento síncrono, el webhook lo duplica.
- **`reference` compartido**: debe convivir con `idempotencia-settlement-pos` (`'pos:'+orderId`) — usar el mismo esquema para no romper el unique index de aquel.
- **Mesa zombie**: resuelto — expiración de 30 min (`expires_at` en la Checkout Session, piso real de Stripe) + `unsettleOrder` libera la mesa al expirar. Ventana máxima de exposición: 30 min.
- **Stripe no configurado**: `chargeCardPayment` debe fallar explícito (`ValidationError`) si el hotel no tiene pasarela — hoy `recordPayment` no valida eso porque no toca Stripe.
- **Cobro directo `cash`/`folio`**: no se tocan — solo `method==='card'` cambia de path.
