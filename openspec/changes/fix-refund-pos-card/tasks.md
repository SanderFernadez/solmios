# fix-refund-pos-card — Tasks

> Previo: cerrar las 2 decisiones PENDIENTES del `proposal.md` (estado `processing_payment` + UX Checkout vs Terminal) vía `sdd-spec` / `sdd-design`. Las tasks asumen **Stripe Checkout** (decisión por defecto del proposal).

## 1. Spec / Design (SDD — bloqueante para Apply)
- [ ] 1.1 `sdd-spec`: delta spec con escenarios Given/When/Then (payOrder card → processing_payment; webhook completed → paid; webhook expired → billed; refund de orden paid con stripePaymentId → OK).
- [ ] 1.2 `sdd-design`: secuencia del flujo async (POS → Checkout Session → webhook → socket inverso → orden paid), política de expiración, diagrama de estados de la orden.
- [ ] 1.3 Decisión cerrada: timeout de Checkout Session (¿1h?), comportamiento de mesa en timeout, re-cobro vs descarte.

## 2. Contrato del módulo restaurant (`restaurant/usecases/settlement.ts`)
- [ ] 2.1 Agregar `'processing_payment'` a `OrderStatus` (`restaurant/types.ts`).
- [ ] 2.2 Nuevo port `chargeCardPayment?: (input: { orderId, hotelId, amount, currency, description, successUrl, cancelUrl }, user) => Promise<{ paymentId, checkoutUrl }>` en `SettlementPorts` (`settlement.ts:14`).
- [ ] 2.3 `payOrder` (`settlement.ts:106`): si `method==='card'`, llamar `ports.chargeCardPayment` (NO `recordPayment`); orden → `processing_payment`; guardar `paymentId`. Si `method!=='card'`, flujo actual.
- [ ] 2.4 Nuevo `settlePaidOrder(deps, orderId, paymentId, user)`: validar ownership + estado `processing_payment` → update `paid`, `closedAt`, liberar mesa, emitir `sockets.onOrderPaid?.(order)`. Idempotente por estado.
- [ ] 2.5 Nuevo `unsettleOrder(deps, orderId, user)`: validar estado `processing_payment` → volver a `billed` (mesa sigue tomada). Idempotente.

## 3. Sockets / events
- [ ] 3.1 Registrar `'onOrderPaid'` en `events: [...]` del `restaurant/index.ts` (si no existe ya; RES-5 pudo dejarlo).
- [ ] 3.2 Exponer `setOnPaymentCompleted(cb)` en el módulo payments ( hook para que el conector inyecte el callback inverse).

## 4. Conector — socket inverso (`connectors/restaurante-payments.ts`)
- [ ] 4.1 `chargeCardPayment`: delegar a `payments().chargeCard({ ..., reference:'pos:'+orderId, successUrl, cancelUrl })` → devuelve `{ paymentId, checkoutUrl }`. Reusa `payments/usecases/charge-card.ts`.
- [ ] 4.2 Registrar `onPaymentCompleted(payment)` en payments: si `payment.metadata?.source === 'restaurant'` y `metadata.orderId`, llamar `restaurant.settlePaidOrder(orderId, paymentId, sys)`.
- [ ] 4.3 Registrar `onPaymentExpired(payment)` → `restaurant.unsettleOrder(orderId, sys)` (same source check).
- [ ] 4.4 Conector `restaurante-inventario`: ya descuenta en `onOrderPaid` (v1) — verificar que el socket inverso lo dispara (no doble-descontar vs el `recordPayment` síncrono actual).

## 5. Webhook — expiración (`payments/usecases/settle-webhook.ts`)
- [ ] 5.1 Manejar `outcome.status === 'expired'` (checkout.session.expired): marcar payment `cancelled` + disparar `onExpired?.(payment)` (nuevo callback simétrico a `onCompleted`).
- [ ] 5.2 No romper el path `paid` existente (cuidar el enum de status y el early-return).
- [ ] 5.3 `StripeUseCase.handleWebhook` debe mapear `checkout.session.expired` → `{ status:'expired', reference, eventId }`.

## 6. Controller + rutas
- [ ] 6.1 `restaurant/controller.ts:payOrder` devuelve `{ checkoutUrl }` cuando el payment quedó `processing` (frontend lo usa para redirigir).
- [ ] 6.2 Ruta existente `POST /api/restaurant/orders/:id/pay` mantiene permiso `restaurant:create` (sin cambio de permiso).
- [ ] 6.3 Exponer `GET /api/restaurant/orders/:id` con status actualizado para el poll del frontend (ya existe).

## 7. Frontend — `cobrar.vue` + `Restaurant.service.ts`
- [ ] 7.1 `Restaurant.service.payOrder(id, method)`: si devuelve `checkoutUrl`, el componente redirige (`window.location.href`).
- [ ] 7.2 `successUrl` apunta a la ruta de la orden con query `?paid=pending`; al volver, **poll** `GET /orders/:id` cada ~1.5s hasta `status==='paid'` (timeout ~60s, luego toast "no confirmamos el cobro, revisá Stripe").
- [ ] 7.3 `cancelUrl` vuelve a la orden sin cobrar (toast "cobro cancelado").
- [ ] 7.4 Botón "Reembolsar" ya existe (v1 `refund-orden-pos`): ahora debe funcionar para órdenes `paid` con `method==='card'` (sin topar el 409).

## 8. Guard de `refund.ts` (relajación condicional)
- [ ] 8.1 El guard `if (!payment.stripePaymentId)` en `refund.ts` (commit `7e9e37f`) **se mantiene** durante el ventana `processing`. Solo es seguro relajarlo cuando el webhook confirma y puebla `stripePaymentId` (lo hace `crud.updateStatus(id, 'completed', providerRef)`).
- [ ] 8.2 Verificar que tras el webhook, `payment.stripePaymentId !== ''` → el guard deja de dispararse para órdenes POS pagadas con tarjeta.

## 9. Tests
- [ ] 9.1 `restaurant/tests`: `payOrder(card)` deja orden `processing_payment` y devuelve `checkoutUrl`; `payOrder(cash)` flujo actual sin cambio.
- [ ] 9.2 `restaurant/tests`: `settlePaidOrder` idempotente (segunda llamada no duplica socket/libera mesa).
- [ ] 9.3 `restaurant/tests`: `unsettleOrder` solo aplica a `processing_payment` (no a `paid`/`billed`).
- [ ] 9.4 `payments/tests`: webhook `expired` marca payment `cancelled` y dispara `onExpired`.
- [ ] 9.5 `connectors/tests`: tras `onPaymentCompleted` con `metadata.source='restaurant'`, se llama `settlePaidOrder`; con otro source, NO.
- [ ] 9.6 E2E manual en dev: cobro tarjeta (test card 4242) → redirect Checkout → volver → orden `paid` → botón Reembolsar → refund OK en Stripe (no 409).

## 10. Deploy + Gate
- [ ] 10.1 `arckode analyze` 0 violaciones (backend).
- [ ] 10.2 `bun run typecheck` (backend) + `bun run typecheck` (frontend, con `-b`).
- [ ] 10.3 `bun test` (restaurant + payments + connectors).
- [ ] 10.4 Deploy: sin migration de DB nueva (estados en enum TS, no en schema) — pero validar `OrderStatus` en cualquier seeder/validator que enumere estados.
- [ ] 10.5 En prod: probar con Stripe test mode primero (hotel con clave test), luego pasar a live.
- [ ] 10.6 Una vez confirmado end-to-end en prod: evaluar retirar el mensaje de workaround del guard `refund.ts` (mantener el guard, solo ajustar copy).

## Riesgos a vigilar
- **Doble descuento de inventario**: hoy `recordPayment` (cash/folio) descuenta al cobrar; el nuevo flujo async debe hacerlo en `onOrderPaid` (webhook), NO antes. Si queda el descuento síncrono, el webhook lo duplica.
- **`reference` compartido**: debe convivir con `idempotencia-settlement-pos` (`'pos:'+orderId`) — usar el mismo esquema para no romper el unique index de aquel.
- **Mesa zombie**: sin política de expiración clara (task 1.3), una sesión abandonada deja la mesa tomada hasta las 24h default de Stripe.
- **Stripe no configurado**: `chargeCardPayment` debe fallar explícito (`ValidationError`) si el hotel no tiene pasarela — hoy `recordPayment` no valida eso porque no toca Stripe.
- **Cobro directo `cash`/`folio`**: no se tocan — solo `method==='card'` cambia de path.
