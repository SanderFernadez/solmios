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

## Decisiones de diseño PENDIENTES (requieren SDD, NO improvisar)

Estas dos NO se deciden en este proposal — necesitan specs/design con `sdd-spec` y `sdd-design` antes de aplicar:

1. **Estado intermedio de orden `processing_payment`** (bloquea la mesa hasta confirmación de Stripe). Política de **expiración** de la Checkout Session (Stripe default 24h, demasiado para un POS) + **re-cobro** tras timeout (¿misma mesa reabre cobro? ¿se descarta la sesión y se genera otra?). Definir transición `processing_payment → billed` (cancelada por timeout) vs `→ paid` (confirmada), y qué pasa con la mesa si el cajero cierra el navegador.
2. **UX de checkout en POS**: **Stripe Checkout** (redirige al cajero fuera de la app, vuelve por `successUrl`) vs **Stripe Terminal** (tarjeta presente, SDK hardware aparte, requiere lector). Decisión de **producto**: Checkout es rápido de integrar pero rompe el flujo del cajero; Terminal es el flujo "real" POS pero suma SDK + hardware. Este change asume Checkout por defecto (mismo patrón que folios), pero la decisión cierra en spec.

## Plan técnico (sintetizado)

| Capa | Cambio |
|------|--------|
| **Backend — `settlement.payOrder(card)`** | Cuando `method==='card'`, llamar al nuevo port `chargeCardPayment` (en vez de `recordPayment`). La orden queda `processing_payment`; el payment queda `processing` con `stripePaymentId=''` hasta webhook. |
| **Backend — port `chargeCardPayment`** | Nuevo en `SettlementPorts` (`settlement.ts:14`). Devuelve `{ paymentId, checkoutUrl }`. Reusa `payments.chargeCard` (crear payment → Checkout Session → `processing`). `reference:'pos:'+orderId` (alinea con `idempotencia-settlement-pos`). |
| **Conector — socket inverso** | `connectors/restaurante-payments.ts` registra `onPaymentCompleted` en payments; payments lo dispara desde `settle-webhook.ts` (`onCompleted` ya existe en `SettleWebhookDeps`). El callback emite `restaurant.settlePaidOrder(orderId, paymentId)` → marca orden `paid`, libera mesa, descuenta inventario (receta). |
| **Webhook — `checkout.session.expired`** | `settle-webhook.ts` maneja expiración: marca payment `cancelled` y dispara `onPaymentExpired` → `restaurant.unsettleOrder` (vuelve orden a `billed`, mesa sigue tomada). |
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
- **Mesa trabada**: si el cajero abandona el checkout y no vuelve, la mesa queda `processing_payment` hasta expiración. La política del punto 1 (decisión PENDIENTE) es la que evita mesas zombies.
- **`stripePaymentId` vacío hasta webhook**: el guard de `refund.ts` debe seguir activo durante el ventana `processing` (un refund en ese momento no tiene PI todavía) — sólo se relaja cuando el webhook confirma.
