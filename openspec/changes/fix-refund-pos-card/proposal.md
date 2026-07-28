# fix-refund-pos-card

## Objetivo

Hacer que el **reembolso de una orden POS cobrada con tarjeta funcione end-to-end**: al cobrar con tarjeta en el POS, que se cree un cargo **real** en Stripe (asociado al hotel) de forma que el flujo de refund existente (`payments/usecases/refund.ts`) pueda devolverlo sin intervención manual. Cierra la deuda abierta en `refund-orden-pos` (v1_cash_only) y deja sin efecto el guard de mitigación que hoy bloquea el refund con `ConflictError` 409.

## Contexto / bug actual

El cobro directo con tarjeta del POS **no toca Stripe**: registra el payment como manual.

- `restaurant/usecases/settlement.ts:106` (`payOrder`) llama al port `ports.recordPayment` con `method:'card'`, pero sin crear cargo en Stripe.
- `connectors/restaurante-payments.ts` (`recordPayment`) crea el payment con `status:'completed'` ("dinero recibido en el mostrador") y `metadata:{ source:'restaurant' }`, **sin `stripePaymentId`** (queda `''`). Es un cobro declarativo, no un cargo real.
- `payments/usecases/refund.ts` exige `payment.stripePaymentId` para llamar `stripe.refunds.create`. Como viene vacío, antes fallaba con un error críptico de PaymentIntent inválido.

**Mitigación ya deployada** (commit `7e9e37f` — *fix(payments): refund rechaza cobro card sin cargo Stripe (deuda refund-orden-pos)*, 2026-07-27): guard en `refund.ts` que devuelve `ConflictError` 409 con mensaje claro y workaround operativo (refund manual desde panel de Stripe). El guard referencia explícitamente este change (`openspec fix-refund-pos-card`).

**Resultado actual**: toda orden POS cobrada con tarjeta es **no-reembolsable por la app**. El refund existe (v1 `refund-orden-pos` está mergeado en `b324620`), pero el botón "Reembolsar" topa en el 409 para el caso `card`.

## Decisión

Fix **MEDIANO** (~350-500 líneas). NO parchear (feature de dinero + asíncrono + webhook).

**Patrón a replicar**: `chargeCard` de folios/payments (`payments/usecases/charge-card.ts` + `payments/usecases/settle-webhook.ts`), que crea un payment `processing`, abre una **Stripe Checkout Session**, y deja que el webhook `checkout.session.completed` confirme e asocié el PaymentIntent (`crud.updateStatus(id, 'completed', providerRef)`). Idempotencia nativa vía `PaymentEventStore.settleOnce` (claim-first atómico por `eventId`).

Mismo criterio de "feature de dinero merece change + QA robusto" que `refund-orden-pos`, `idempotencia-settlement-pos` y `depositos-stripe-holds`.

## Decisiones de diseño — RESUELTAS (usuario, 2026-07-28)

1. **Estado intermedio `processing_payment`**: Stripe Checkout Session con **expiración corta** (30 min — mínimo real que la API de Stripe acepta para `expires_at`; los 15 min pedidos originalmente hubieran sido rechazados por Stripe con 400 "expires_at too soon". Máximo permitido es 24h, se usa el mínimo práctico). Al expirar (`checkout.session.expired`): el payment se marca `cancelled`, la orden vuelve a `billed` **Y la mesa se libera** (`status: 'free'` en `restaurant_tables`, vía el mismo mecanismo que usa un `cancelOrder` normal) — el cajero puede re-cobrar generando una **nueva** Checkout Session (no se reutiliza la expirada). Si el cajero cierra el navegador sin esperar el timeout, el efecto es el mismo: la orden queda `processing_payment` hasta que el webhook de expiración llega (máx 15 min).
2. **UX de checkout**: **Stripe Checkout Session** (redirige al cajero, vuelve por `successUrl`), NO Stripe Terminal — mismo patrón que folios, sin sumar hardware/SDK nuevo.

## Plan técnico (sintetizado)

| Capa | Cambio |
|------|--------|
| **Backend — `settlement.payOrder(card)`** | Cuando `method==='card'`, llamar al nuevo port `chargeCardPayment` (en vez de `recordPayment`). La orden queda `processing_payment`; el payment queda `processing` con `stripePaymentId=''` hasta webhook. |
| **Backend — port `chargeCardPayment`** | Nuevo en `SettlementPorts` (`settlement.ts:14`). Devuelve `{ paymentId, checkoutUrl }`. Reusa `payments.chargeCard` (crear payment → Checkout Session → `processing`). `reference:'pos:'+orderId` (alinea con `idempotencia-settlement-pos`). |
| **Conector — socket inverso** | `connectors/restaurante-payments.ts` registra `onPaymentCompleted` en payments; payments lo dispara desde `settle-webhook.ts` (`onCompleted` ya existe en `SettleWebhookDeps`). El callback emite `restaurant.settlePaidOrder(orderId, paymentId)` → marca orden `paid`, libera mesa, descuenta inventario (receta). |
| **Webhook — `checkout.session.expired`** | `settle-webhook.ts` maneja expiración (30 min, `expires_at` al crear la sesión — piso real de Stripe): marca payment `cancelled` y dispara `onPaymentExpired` → `restaurant.unsettleOrder` (vuelve orden a `billed` Y libera la mesa — decisión de producto 2026-07-28 — el cajero re-cobra con una sesión nueva, no se reintenta la expirada). |
| **Frontend — `cobrar.vue`** | Al elegir tarjeta, llamar `payOrder` → recibir `checkoutUrl` → `window.location.href = checkoutUrl` (o iframe embebido). En retorno (`successUrl`), **poll** `GET /orders/:id` hasta `status==='paid'` (timeout + reintento, como ya hace checkout de folios). |
| **Tests** | restaurant (`payOrder` card deja `processing_payment`, idempotencia), payments (`chargeCard` reusa, webhook expired dispara callback), connectors (socket inverso cableado, doble emisión no duplica). |

## Workaround operativo (mientras)

Hasta implementar este change, el refund de orden POS cobrada con tarjeta se hace **manualmente**:

1. Localizar el cobro en el **Dashboard de Stripe** del hotel (por monto/fecha, no hay PI en la app).
2. Emitir el refund desde Stripe.
3. **Ajuste contable manual**: registrar la devolución para que cuadre el libro de ventas (el refund `type:'payment'` que crearía `refund.ts` no se genera → el reporte de ingresos queda inflado hasta corregirlo a mano).

El guard de `refund.ts` (commit `7e9e37f`) ya guía al operador con este mensaje. No tocar el guard hasta que el flujo completo esté en producción — es la única barrera contra un refund silencioso roto.

## Out of scope

- **Stripe Terminal** (tarjeta presente con lector físico): decisión de producto futura; este change usa Checkout Session.
- **Refund de cash**: ya rechazado por guard de `method` en `refund.ts` (`if payment.method !== 'card'`). No cambia.
- **Reversión de cargo a folio** (`settlement === 'folio'`): deuda separada de `refund-orden-pos` v2 (no hay reversal de `folio_charges` hoy).
- **Asiento contable de reversión** (`recordRestaurantSaleRefund` en accounting): deuda separada del módulo contabilidad.

## Riesgos

- **Estado `processing_payment` vs concurrencia**: si llega un doble submit mientras la sesión está abierta, el unique-index de `idempotencia-settlement-pos` (`payments.reference = 'pos:'+orderId`) es la barrera — este change DEBE convivir con aquel (mismo esquema de `reference`).
- **Webhook de expiración es nuevo**: hoy `settle-webhook.ts` solo actúa en `paid`; sumar `expired` sin romper el path existente requiere cuidar el `outcome.status` enum.
- **Mesa trabada**: si el cajero abandona el checkout y no vuelve, la mesa queda tomada máximo 30 min (piso real de Stripe para `expires_at`, no los 15 min pedidos originalmente) — al expirar, `onPaymentExpired` la libera. Ventana de 30 min es el trade-off aceptado (no hay forma de detectar "abandonó" antes sin polling agresivo del lado cliente).
- **`stripePaymentId` vacío hasta webhook**: el guard de `refund.ts` debe seguir activo durante el ventana `processing` (un refund en ese momento no tiene PI todavía) — sólo se relaja cuando el webhook confirma.
