# Change Proposal: payment-gateways

## Summary

Convertir la integración de pagos de **"Stripe cableado a la plataforma"** a **"cada hotel
configura sus propias pasarelas"**, con un puerto `PaymentGateway` que admita los cuatro
proveedores que el negocio necesita en RD: **Stripe, PayPal, Azul y CardNet**.

Hoy el cobro con tarjeta y el motor de reservas público se procesan contra **una cuenta de
Stripe global del `.env` del servidor**, no contra la del hotel. En un SaaS multi-tenant donde
cada dueño cobra a su propia cuenta bancaria, eso es un defecto de aislamiento con impacto
directo sobre el dinero.

Equivalente MisterPlan: configuración de pasarela por propiedad (cada hotel conecta su cuenta).

## Motivation

### El dinero de un hotel puede cobrarse en la cuenta de otro

Hay **tres integraciones de Stripe distintas** conviviendo, y solo una respeta al hotel:

| Flujo | Resuelve las llaves desde | ¿Por hotel? | Evidencia |
|---|---|---|---|
| `payment-requests` (links de pago) | tabla `configuration` → `stripe_config` | ✅ | `infrastructure/stripe-config.ts:4-13` |
| `payments` (cobro con tarjeta, refunds) | `process.env.STRIPE_SECRET_KEY` | ❌ **global** | `modules/payments/index.ts:77-80` |
| `bookingengine` (motor de reservas público) | `process.env.STRIPE_SECRET_KEY` | ❌ **global** | `modules/bookingengine/index.ts:72-75` |

Consecuencia hoy: si el dueño del Hotel A carga sus llaves en `/panel/settings`, **solo le
funcionan los links de pago**. Un cobro en recepción o una reserva del widget público se
procesan contra la cuenta del `.env`. Con dos hoteles con llaves cargadas, la plata de uno
puede terminar en la cuenta del otro.

Que no esté explotando hoy es **suerte, no diseño**: las tres variables del `.env` de producción
están vacías (verificado 2026-07-14), así que ese camino falla en vez de cobrar mal. El día que
alguien cargue una llave global, empieza a cobrar mal en silencio.

Deuda alrededor, verificada:
- `payments` y `bookingengine` tienen **clases `StripeUseCase` duplicadas**, con **versiones
  distintas de la API de Stripe** (`2026-05-27.dahlia` vs `2025-08-27.basil`).
- **Tres endpoints de webhook** separados (`/api/webhooks/stripe`, `/api/public/webhook/stripe`,
  `/api/stripe/webhook`), cada uno resolviendo su secreto de firma por su cuenta.
- **Ocho enums** distintos de método de pago (`payments`, `folios`, `facturas`, `cash`, `hoteles`,
  `payroll`, `gastos`), sin un tipo canónico compartido.
- `deposits` tiene `stripePaymentId: ''` **hardcodeado** (`payments/usecases/deposits.ts:33`): la
  "garantía" no es una retención real, es un flag en una tabla.
- Los secretos de integración se guardan **en texto plano** en `configuration` (mismo patrón que
  `ttlock_config`). Acá se guardarían llaves que mueven dinero.

### El puerto no puede tener forma de Stripe

Investigación de los contratos reales (PDFs oficiales de Azul, doc de CardNet, doc de PayPal):

| | Azul WS | Azul Payment Page | CardNet Ztrans | PayPal | Stripe |
|---|---|---|---|---|---|
| Confirmación | **síncrona** | **redirect GET + hash** | **síncrona / polling** | webhook + redirect | webhook + redirect |
| Firma | Auth1/Auth2 + **mTLS** | **HMAC-SHA512** sobre campos concatenados | ninguna | RSA sobre el body | HMAC sobre el body |
| Refund | sí | **NO SOPORTA** | sí (+bearer extra) | sí | sí |
| SDK Node oficial | no | no | no | sí | sí |

**Azul y CardNet-Ztrans no tienen webhook.** Un puerto que modele la confirmación como "espero
el webhook y listo" excluye a los dos proveedores dominicanos. El puerto debe soportar los
**tres patrones**: push (webhook), return verificado (redirect con hash), y pull (polling).

Y **refund no es universal**: Azul Payment Page no lo soporta. Si el contrato base lo exige,
un hotel con solo Payment Page rompe la interfaz.

## Scope

### In Scope

- **PG-0 (prerequisito, en el framework)** Exponer `req.rawBody` en `arckode-framework`.
  Hoy `kernel/http/server.ts:201` hace `JSON.parse` y **descarta los bytes crudos**; la palabra
  `rawBody` no existe en el kernel. Sin esto **ninguna** verificación de firma es posible
  (Stripe, PayPal y Azul firman sobre bytes/cadenas exactas). No es un fix de Stripe: es el
  cimiento de toda la reforma.
- **PG-1** Tabla `payment_gateways` por hotel (provider + mode test/live + credenciales), con
  **credenciales cifradas at-rest** (AES-256-GCM, master key por env).
- **PG-2** Puerto `PaymentGateway` + `RefundableGateway` (capacidad opcional) + registry que
  resuelve el adapter del hotel.
- **PG-3** Adapter Stripe sobre el puerto, y **migración de los 3 flujos** (`payments`,
  `bookingengine`, `payment-requests`) a resolver por hotel. Elimina las clases duplicadas.
- **PG-4** Confirmación unificada e **idempotente**: los tres patrones (push/return/pull)
  convergen en un único `settlePayment()`. Tabla de eventos procesados anti-replay.
- **PG-5** Página `/panel/pagos`: el dueño configura sus proveedores, modo test/live, y prueba
  la conexión. Como `/panel/cerraduras`.
- **PG-6** Método de pago canónico: un solo tipo compartido, reemplazando los 8 enums.
- **PG-7** Adapters PayPal y Azul (Payment Page primero: no requiere mTLS ni certificados).

### Out of Scope

- **Adapter CardNet**: la doc pública expone **dos plataformas con esquemas de auth
  incompatibles** ("Ztrans" con `merchant-id`/`terminal-id`, y una de tokenización con
  `PrivateAccountKey`+Basic Auth, cuyo HTML contiene la cadena `"SiemprePago"` — indicio de
  doc de un white-label ajeno). **No se puede saber cuál aplica a un comercio dado sin hablar
  con el ejecutivo de cuenta.** Diseñamos el puerto para que entre, pero no se implementa a
  ciegas. → riesgo abierto, requiere credenciales reales.
- **Azul Webservices** (el modo con mTLS y certificados por ambiente). Payment Page cubre el
  caso de uso de cobro sin manejar tarjetas en nuestro servidor. WS se agrega si el hotel
  necesita refund/void por API.
- Reescribir la conciliación de caja o el ledger de depósitos (se anota como deuda aparte).

## Risks / Rollback

| Riesgo | Mitigación |
|---|---|
| Migrar los 3 flujos toca el núcleo financiero | Feature flag por hotel: si no hay fila en `payment_gateways`, cae al comportamiento actual (env). Se migra hotel por hotel. |
| PG-0 requiere publicar versión del framework | Es el mismo camino ya usado para el remap camelCase (1.6.2). Si se demora, el resto del diseño avanza; solo la verificación de firma queda pendiente. |
| Cifrar credenciales rompe lo ya guardado | `stripe_config` en prod está **vacío** (verificado): no hay data que migrar. Para `ttlock_config` se deja el cifrado como opt-in posterior. |
| Un webhook mal validado asienta un cobro falso | Hasta que PG-0 esté, **ningún adapter nuevo se habilita en modo live**. Solo test. |

**Rollback**: el puerto es aditivo. Revertir = volver a apuntar los 3 flujos a su implementación
anterior (los commits quedan separados por flujo, no en un único merge).

## Open Questions

1. **CardNet**: ¿qué contrato tiene el hotel — Ztrans o tokenización? Bloqueante para PG-7.
2. **Azul**: ¿el hotel tiene afiliación a Payment Page, a Webservices, o ambas? Payment Page
   **no permite reembolsos**: si el hotel necesita devolver dinero desde el panel, necesita WS.
3. ¿El cobro con tarjeta en recepción debe seguir existiendo como "checkout redirect", o el
   hotel espera pasar la tarjeta físicamente (lo que implica scope PCI y datáfono, no pasarela web)?
