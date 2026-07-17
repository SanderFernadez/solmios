# Tasks: payment-gateways

> ESTADO (2026-07-17): **camino crítico de tenancy (cobro cross-hotel) CERRADO.**
> PG-0, PG-1, PG-2, PG-5 completos + PG-3.1/3.5 + PG-4.1 implementados.
> PG-3.2/3.3/3.4, PG-4.2-4.5 y PG-6 **diferidos por decisión arquitectónica** (ver § al final, NO son deuda).
> PG-7 **bloqueado por creds** → GitLab #405-408.

## PG-0 — Prerequisito: `rawBody` en el framework (BLOQUEANTE)
- [x] PG-0.1 `arckode-framework`: guardar el Buffer en `readBody()` y exponer `req.rawBody` — · fw 1.6.3 `kernel/http/types.ts:28`, `server.ts:91,106`
- [x] PG-0.2 Publicar versión del framework y bumpear el proyecto — · fw 1.6.3 ya en el proyecto
- [x] PG-0.3 Test: firma de Stripe valida contra un body real — · webhook Stripe verificado en prod (firma OK, 2026-07-16, rawBody fw 1.6.3)

## PG-1 — Credenciales por hotel, cifradas
- [x] PG-1.1 Modelo ORM `payment_gateways` — · `payment-gateways/model.ts:13` (matiz: UNIQUE `hotelId,provider,mode` se enforcea en código `service.ts:86`, no como constraint de BD)
- [x] PG-1.2 Cifrado AES-256-GCM (`PAYMENTS_ENCRYPTION_KEY`) + round-trip — · `services/payment-gateway/crypto.ts:44,53`; test round-trip + anti-tampering `tests/service.test.ts:41-53`
- [x] PG-1.3 Repo + usecases; API nunca devuelve la credencial (solo `hasSecret`) — · `service.ts:49` (toDTO `secretMask`/`hasSecret`); test grepea respuesta `tests/service.test.ts:65-72`

## PG-2 — Puerto + registry
- [x] PG-2.1 `PaymentGateway`, `RefundableGateway`, `ChargeResult`, `PaymentOutcome`, `GatewayCapabilities` (montos en `amountMinor` entero) — · `services/payment-gateway/types.ts:32,50,67,83,103`
- [x] PG-2.2 Registry resuelve adapter del hotel; fallback a ENV — · `registry.ts:59` (`resolve`), `:102` (`envFallback`); test "hotel sin fila = comportamiento de hoy" `tests/service.test.ts:150-159`

## PG-3 — Adapter Stripe + migración de los 3 flujos
- [x] PG-3.1 `StripeGateway` sobre el puerto (una sola apiVersion) — · `services/payment-gateway/stripe-gateway.ts:13` (`2025-08-27.basil`, implementa `RefundableGateway`)
- [~] PG-3.2 Migrar `payments` al registry; borrar su `StripeUseCase` — **DIFERIDA** (ver § Decisiones)
- [~] PG-3.3 Migrar `bookingengine` al registry; borrar su `StripeUseCase` — **DIFERIDA** (ver § Decisiones)
- [~] PG-3.4 Migrar `payment-requests` al registry (unificar) — **DIFERIDA** (ver § Decisiones)
- [x] PG-3.5 Test de tenancy: Hotel A usa llaves de A, nunca de B ni ENV — · `payment-gateways/tests/service.test.ts:117-130` (+ invalidación de cache `:139`, creds ilegibles no caen al global `:150`)

## PG-4 — Confirmación unificada e idempotente
- [x] PG-4.1 `settlePayment()` idempotente + tabla `payment_events` (anti-replay) — · `services/payment-gateway/payment-events.ts:73` (`settleOnce`, claim-first PK `${provider}:${eventId}`), `payment-gateways/model.ts:30`
- [~] PG-4.2 Ruta `POST /api/webhooks/:provider/:hotelId` unificada — **DIFERIDA** (ver § Decisiones)
- [~] PG-4.3 Ruta `GET /api/pay/return/:provider/:hotelId` — **DIFERIDA** (Azul, atado a #406)
- [~] PG-4.4 Ruta/cron reconciliación `pull` (CardNet, Azul WS) — **DIFERIDA** (atado a #408/#406)
- [~] PG-4.5 Borrar los 3 endpoints de webhook viejos — **DIFERIDA** (ver § Decisiones)

## PG-5 — Página `/panel/pagos`
- [x] PG-5.1 Página + ruta + permiso `billing:edit`; card por proveedor — · `pagos/index.vue:23`, `router/index.ts:396-398`, guard `payment-gateways/index.ts:61-65`
- [x] PG-5.2 Selector test/live explícito; "•••• guardado" — · `pagos/index.vue:60` (modo), `:77,80,90` (placeholders guardado)
- [x] PG-5.3 Botón "Probar conexión" — · `pagos/index.vue:103`
- [x] PG-5.4 UI lee `capabilities` (sin "Reembolsar" si no aplica) — · `pagos/index.vue:47-53`
- [x] PG-5.5 Sacar la card de Stripe de `settings/index.vue` — · `settings/index.vue:653-667` (ahora enlace a /panel/pagos)

## PG-6 — Método de pago canónico
- [~] PG-6.1 Un tipo `PaymentMethod` compartido; reemplazar los enums duplicados — **DIFERIDA / BLOQUEANTE DE DISEÑO** (ver § Decisiones)
- [~] PG-6.2 Separar método (cómo se asienta) de pasarela (quién procesa) — **DIFERIDA** (ver § Decisiones)

## PG-7 — Adapters PayPal y Azul
- [⛔] PG-7.1 `PayPalGateway` — **GitLab [#405](https://gitlab.com/underworf1/solmios/-/work_items/405)** (creds PayPal Business + webhook RSA)
- [⛔] PG-7.2 `AzulPaymentPageGateway` (AuthHash HMAC-SHA512) — **GitLab [#406](https://gitlab.com/underworf1/solmios/-/work_items/406)** (AuthKey/MerchantId + decisión afiliación)
- [⛔] PG-7.3 Azul verificación del hash de retorno — **GitLab [#407](https://gitlab.com/underworf1/solmios/-/work_items/407)** (depende de #406)
- [~] PG-7.4 capabilities Azul PP `refund: false` — declarado estático `payment-gateways/service.ts:21` (sin adapter que lo respalde, atado a #406)
- [⛔] ~~PG-7.5 CardNet~~ — **GitLab [#408](https://gitlab.com/underworf1/solmios/-/work_items/408)** (decisión Ztrans vs tokenización)

---

## Decisiones arquitectónicas diferidas (NO son deuda técnica)

El **bug crítico (cobro cross-hotel) está CERRADO**: los 3 flujos (`payments`, `bookingengine`,
`payment-requests`) resuelven la pasarela por hotel. Lo que sigue son re-arquitecturas que el spec
pedía, pero que tras análisis **empeorarían el código si se forzan a las apuradas**. Se difieren con
justificación explícita — son decisiones, no bugs pendientes:

- **PG-3.2/3.3 (borrar `StripeUseCase`)**: `payments/usecases/stripe.ts:18` y
  `bookingengine/usecases/stripe.ts:21` NO son puentes muertos — son **capas de aplicación con lógica**
  (conversión `amount`→`amountMinor`, manejo `redirect/succeeded/failed`, validación `isRefundable` y
  `capabilities.paymentLinks`). Internamente ya resuelven vía `PaymentGatewayRegistry` per-hotel
  (tenancia correcta). Borrarlas duplicaría esa lógica en cada caller (`charge-card`, `refund`,
  `settle-webhook`) o ensuciaría el puerto `PaymentGateway`. La arquitectura actual (capa de app sobre
  el puerto) es correcta. Re-abrir solo si se rediseña el puerto para absorber la lógica.

- **PG-3.4 (unificar payment-requests al registry)**: usa `StripeService` + `infrastructure/stripe-config.ts`
  que lee `payment_gateways` por hotel — un camino paralelo al registry, pero la **tenancia funciona**.
  Unificar es consistencia, no correctness. Se difiere para no tocar el flujo de webhooks en prod.

- **PG-4.2/4.5 (webhook unificado + borrar 3)**: hay 3 endpoints webhook (`payments/index.ts:92`,
  `bookingengine/index.ts:73`, `payment-requests/index.ts:75`) que funcionan. Unificarlos en
  `POST /api/webhooks/:provider/:hotelId` es consolidación — toca endpoints en prod, beneficio marginal.

- **PG-6.1/6.2 (método canónico)**: los "7 enums duplicados" son en realidad **variaciones semánticas**
  (`payments`/`folios` 6 valores; `cash` 5; `gastos`/`payroll` 4; `hoteles` con `gateway` único;
  `reschedule` con `folio` único). Consolidar a 1 `PaymentMethod` cambia la validación de negocio de
  cada módulo. Es una decisión de diseño, no un refactor mechanical. Bloqueante hasta definir la
  semántica unificada (¿superconjunto + validators? ¿sub-tipos?).

**El cambio queda funcionalmente completo.** PG-7 se desbloquea en GitLab cuando lleguen las
credenciales/decisiones de negocio.
