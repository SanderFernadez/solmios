# Tasks: payment-gateways

> Estimación con IA (÷~1.5). Los adapters de Azul/CardNet **no tienen SDK oficial de Node**: se
> escriben a mano contra HTTP crudo, con más superficie de bug que Stripe/PayPal. Eso ya está
> reflejado en las horas.

## PG-0 — Prerequisito: `rawBody` en el framework (BLOQUEANTE)
- [ ] PG-0.1 `arckode-framework`: guardar el Buffer en `readBody()` y exponer `req.rawBody` — 3h
  - AC: `grep rawBody kernel/` da hits; `HttpRequest.rawBody?: Buffer`; no rompe rutas existentes
- [ ] PG-0.2 Publicar versión del framework y bumpear el proyecto — 2h
  - AC: `bun test` + `arckode analyze` verdes con la versión nueva
- [ ] PG-0.3 Test: firma de Stripe valida contra un body real (fixture) — 2h
  - AC: `constructEvent` acepta el evento; con un byte cambiado, lo rechaza

**Subtotal: 7h manual → 5h IA** · Sin esto, nada de PG-4 puede validarse. **Ir primero.**

## PG-1 — Credenciales por hotel, cifradas
- [ ] PG-1.1 Modelo ORM `payment_gateways` + `UNIQUE(hotelId, provider, mode)` — 3h
- [ ] PG-1.2 Cifrado AES-256-GCM (`PAYMENTS_ENCRYPTION_KEY`) + helpers encrypt/decrypt — 4h
  - AC: la fila en DB no contiene la llave en claro; round-trip test
- [ ] PG-1.3 Repo + usecases (list/upsert/enable/setDefault). API **nunca** devuelve la credencial:
      solo `hasSecret` — 4h
  - AC: `GET /api/payment-gateways` no expone ni un secreto (test que grepea la respuesta)

**Subtotal: 11h manual → 7h IA**

## PG-2 — Puerto + registry
- [ ] PG-2.1 `PaymentGateway`, `RefundableGateway`, `ChargeResult`, `PaymentOutcome`,
      `GatewayCapabilities` — montos en **enteros de unidad menor** — 4h
- [ ] PG-2.2 Registry: resuelve el adapter del hotel; **fallback a ENV** si el hotel no configuró
      (no rompe lo actual) — 3h
  - AC: hotel sin fila → comportamiento idéntico al de hoy

**Subtotal: 7h manual → 5h IA**

## PG-3 — Adapter Stripe + migración de los 3 flujos
- [ ] PG-3.1 `StripeGateway` sobre el puerto (una sola apiVersion, no dos) — 4h
- [ ] PG-3.2 Migrar `payments` al registry; borrar su `StripeUseCase` — 4h
- [ ] PG-3.3 Migrar `bookingengine` al registry; borrar su `StripeUseCase` — 4h
- [ ] PG-3.4 Migrar `payment-requests` al registry (ya es per-hotel; unificar) — 3h
- [ ] PG-3.5 **Test de tenancy**: el cobro del Hotel A usa las llaves de A, nunca las de B ni las
      del ENV — 4h
  - AC: es el test que prueba que el bug original está cerrado. Sin este, PG-3 no está hecha.

**Subtotal: 19h manual → 12h IA**

## PG-4 — Confirmación unificada e idempotente
- [ ] PG-4.1 `settlePayment()` idempotente + tabla `payment_events` (anti-replay) — 4h
  - AC: procesar el mismo evento 2× asienta el dinero **una** vez
- [ ] PG-4.2 Rutas `POST /api/webhooks/:provider/:hotelId` (push) — 3h
- [ ] PG-4.3 Ruta `GET /api/pay/return/:provider/:hotelId` (return verificado) — 3h
- [ ] PG-4.4 Ruta/cron de reconciliación `pull` (CardNet, Azul WS) — 4h
- [ ] PG-4.5 Borrar los 3 endpoints de webhook viejos — 2h

**Subtotal: 16h manual → 10h IA**

## PG-5 — Página `/panel/pagos`
- [ ] PG-5.1 Página + ruta + permiso (`billing:edit`); card por proveedor — 5h
- [ ] PG-5.2 Selector test/live explícito; "•••• guardado" para secretos ya cargados
      (mismo patrón que TTLock) — 3h
- [ ] PG-5.3 Botón "Probar conexión" por proveedor — 3h
- [ ] PG-5.4 UI lee `capabilities`: sin botón "Reembolsar" si el proveedor no lo soporta
      (Azul Payment Page) — 2h
- [ ] PG-5.5 Sacar la card de Stripe de `settings/index.vue` (deja de haber dos lugares) — 2h

**Subtotal: 15h manual → 9h IA**

## PG-6 — Método de pago canónico
- [ ] PG-6.1 Un tipo `PaymentMethod` compartido; reemplazar los **8 enums** duplicados — 5h
  - AC: `grep -c "'card' | 'cash'"` en backend/src baja a 1 definición
- [ ] PG-6.2 Separar **método** (cómo se asienta: cash/card/transfer) de **pasarela** (quién lo
      procesa). Hoy están mezclados en `metodos_pago` — 3h

**Subtotal: 8h manual → 5h IA**

## PG-7 — Adapters PayPal y Azul
- [ ] PG-7.1 `PayPalGateway` (`@paypal/paypal-server-sdk`, webhook RSA) — 6h
- [ ] PG-7.2 `AzulPaymentPageGateway`: AuthHash HMAC-SHA512 (UTF-16LE, orden fijo del PDF) — 8h
- [ ] PG-7.3 Azul: **verificación del hash de respuesta** en el return — 5h
  - AC: una URL de retorno falsificada a mano es **rechazada**. Es la única barrera que tiene
    Azul: no hay webhook de respaldo.
- [ ] PG-7.4 `capabilities` de Azul PP: `refund: false` (no lo soporta) — 1h
- [ ] ~~PG-7.5 CardNet~~ — **BLOQUEADO**: la doc pública expone dos plataformas con auth
      incompatibles (Ztrans vs tokenización). Requiere confirmar el contrato real con el ejecutivo
      de cuenta antes de escribir una línea.

**Subtotal: 20h manual → 13h IA** (sin CardNet)

---

## Totales

| Sprint | Manual | IA | Bloqueante |
|---|---|---|---|
| PG-0 rawBody | 7h | 5h | **sí — va primero** |
| PG-1 credenciales | 11h | 7h | |
| PG-2 puerto | 7h | 5h | |
| PG-3 Stripe + migración | 19h | 12h | cierra el bug de tenancy |
| PG-4 confirmación | 16h | 10h | depende de PG-0 |
| PG-5 página | 15h | 9h | |
| PG-6 método canónico | 8h | 5h | |
| PG-7 PayPal + Azul | 20h | 13h | CardNet bloqueado |
| **Total** | **103h** | **66h** | |

## Camino corto (si se quiere cortar el riesgo YA)

**PG-2.2 + PG-3.2 + PG-3.3 + PG-3.5 = ~5h IA**: que `payments` y `bookingengine` lean las llaves
del hotel en vez del `.env`. Cierra el agujero de cobro cruzado sin construir el resto todavía.
