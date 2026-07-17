# Design: payment-gateways

## Decisión 1 — El puerto se modela sobre la confirmación, no sobre Stripe

El error natural es copiar la forma de Stripe (crear intent → esperar webhook firmado). **Azul
y CardNet-Ztrans no tienen webhook.** El contrato debe admitir tres formas de enterarse de que
el dinero entró:

| Modo | Quién avisa | Proveedores | Cómo se valida |
|---|---|---|---|
| `push` | el proveedor hace POST a nuestra URL | Stripe, PayPal | firma criptográfica sobre el **body crudo** (HMAC / RSA) |
| `return` | el navegador del huésped vuelve con los datos | **Azul Payment Page** | HMAC-SHA512 sobre **campos de negocio concatenados en orden fijo**, no sobre el body |
| `pull` | nadie: hay que preguntar | **CardNet Ztrans**, Azul WS | la respuesta viene autenticada por el propio canal TLS + credenciales |

Los tres desembocan en **una sola función** del dominio:

```ts
settlePayment(hotelId, providerRef, outcome): Promise<void>   // idempotente
```

Nada del núcleo financiero sabe qué proveedor cobró. Cambiar de Azul a Stripe no toca folios,
facturas ni caja.

## Decisión 2 — Refund es capacidad opcional, no parte del contrato base

**Azul Payment Page no soporta reembolsos** (hay que tener además afiliación a Webservices).
Si `refund()` estuviera en la interfaz base, ese adapter tendría que lanzar "no implementado" —
un contrato que miente.

```ts
interface PaymentGateway {
  readonly provider: PaymentProvider
  readonly capabilities: GatewayCapabilities      // { refund: boolean, void: boolean, ... }
  createCharge(req: ChargeRequest): Promise<ChargeResult>
  confirm(ctx: ConfirmContext): Promise<PaymentOutcome>
}

interface RefundableGateway extends PaymentGateway {
  refund(ref: string, amountMinor?: number): Promise<RefundResult>
  void(ref: string): Promise<void>
}
```

La UI **lee `capabilities`** para decidir si muestra el botón "Reembolsar". Un hotel con Azul
Payment Page no ve un botón que va a fallar.

## Decisión 3 — Estados, no booleanos

`createCharge` no devuelve "pagó / no pagó". Devuelve un estado, porque Azul y CardNet tienen
pasos intermedios (3DS, redirect) que Stripe abstrae:

```ts
type ChargeResult =
  | { status: 'redirect';        redirectUrl: string; providerRef: string }   // Azul PP, PayPal, Stripe Checkout
  | { status: 'requires_action'; action: ProviderAction; providerRef: string } // 3DS de CardNet/Azul
  | { status: 'succeeded';       providerRef: string }                        // Azul WS (síncrono)
  | { status: 'failed';          reason: string }
```

## Decisión 4 — Montos en unidades menores (enteros)

Cada proveedor tiene su formato: Azul y CardNet usan enteros con 2 decimales implícitos; PayPal
usa string decimal (`"10.00"`); Stripe usa centavos. **El puerto habla siempre en enteros de
unidad menor** (`amountMinor: number` + `currency`), y cada adapter traduce. Un float suelto en
un flujo de dinero es un bug esperando su turno.

## Decisión 5 — Credenciales por hotel, cifradas

```
payment_gateways
  id           TEXT PK
  hotelId      TEXT NOT NULL          -- multi-tenant, como todo el resto
  provider     TEXT NOT NULL          -- stripe | paypal | azul | cardnet
  mode         TEXT NOT NULL          -- test | live
  credentials  TEXT NOT NULL          -- JSON cifrado AES-256-GCM (nunca en claro)
  enabled      INTEGER DEFAULT 0
  isDefault    INTEGER DEFAULT 0      -- el que se usa si no se especifica
  createdAt / updatedAt
  UNIQUE(hotelId, provider, mode)
```

Hoy los secretos de integración se guardan **en texto plano** (`ttlock_config` es el precedente).
Acá se guardan llaves que mueven dinero: `secretKey` de Stripe, `AuthKey` de Azul. Se cifran con
AES-256-GCM y una master key en env (`PAYMENTS_ENCRYPTION_KEY`). La API **nunca** devuelve una
credencial: devuelve `hasSecret: true`, igual que hicimos en TTLock.

`mode` es una columna, no un prefijo adivinado. Stripe se puede inferir por `sk_test_`/`sk_live_`,
pero Azul distingue test/prod **por host y credenciales distintas**, sin prefijo. La ambigüedad
se resuelve con un campo explícito.

## Decisión 6 — Un webhook por proveedor, con el hotel en la ruta

```
POST /api/webhooks/:provider/:hotelId     ← push (Stripe, PayPal)
GET  /api/pay/return/:provider/:hotelId   ← return verificado (Azul Payment Page)
POST /api/pay/sync/:provider/:hotelId     ← pull manual / cron de reconciliación
```

El `hotelId` va **en la ruta** porque para verificar la firma hay que saber de qué hotel es el
secreto **antes** de poder confiar en el contenido. No se puede leer el `hotelId` del body: el
body todavía no está autenticado. Es el orden correcto: identificar tenant → cargar su secreto →
verificar firma → recién ahí creer lo que dice.

Estas rutas son **públicas** (el proveedor no tiene JWT). Su autenticación **es** la firma.

## Decisión 7 — Idempotencia obligatoria

Stripe reintenta webhooks. CardNet reintenta hasta recibir 200. El huésped puede recargar la
página de retorno de Azul. **El mismo cobro va a llegar más de una vez.**

```
payment_events
  id           TEXT PK
  hotelId      TEXT NOT NULL
  provider     TEXT NOT NULL
  eventId      TEXT NOT NULL      -- id del evento del proveedor
  processedAt  TEXT NOT NULL
  UNIQUE(hotelId, provider, eventId)
```

`settlePayment()` inserta acá primero; si viola el UNIQUE, el evento ya se procesó y sale sin
tocar el dinero. Sin esto, un reintento de webhook asienta el cobro dos veces — el mismo bug de
doble conteo que ya vivimos con `invoices.type='payment'`.

## Flujo — Azul Payment Page (el más ajeno al patrón Stripe)

```
1. Recepción cobra  → createCharge()
2. Adapter Azul     → arma el form + AuthHash = HMAC-SHA512(
                         MerchantId+MerchantName+MerchantType+CurrencyCode+OrderNumber+
                         Amount+ITBIS+ApprovedUrl+DeclinedUrl+CancelUrl+...+AuthKey
                       )  [UTF-16LE, orden fijo — PDF oficial p.64]
                    → { status:'redirect', redirectUrl: pruebas.azul.com.do/PaymentPage/ }
3. Huésped paga en el sitio de Azul
4. Azul redirige por GET a /api/pay/return/azul/:hotelId con el resultado
5. Adapter recalcula el HASH DE RESPUESTA (cadena distinta:
   OrderNumber+Amount+AuthorizationCode+DateTime+ResponseCode+ISOCode+...+AuthKey)
   y lo compara. Si no coincide → se descarta: es un impostor.
6. settlePayment() idempotente → payments → folio → caja
```

Punto crítico: **el paso 5 es la única barrera** entre "el huésped pagó" y "alguien escribió una
URL a mano diciendo que pagó". No hay webhook de respaldo. Si el hash no se valida, cualquiera
puede marcar una reserva como pagada visitando una URL.

## Prerequisito PG-0 — `req.rawBody` en el framework

`kernel/http/server.ts:201` (`readBody`) devuelve `{ body, files }` con el JSON ya parseado y
tira los bytes. `HttpRequest` (línea 97) no los guarda. **`grep -rn rawBody kernel/` → 0 hits.**

Stripe (`constructEvent`) y PayPal (RSA sobre el body) necesitan los **bytes exactos**:
`JSON.stringify(req.body)` **no** los reproduce (orden de claves, espacios, unicode). Por eso el
webhook de Stripe hoy devuelve 400 a todo evento.

Fix upstream: guardar el Buffer y exponerlo como `req.rawBody`. Es aditivo y no rompe a nadie.
Mismo camino que el remap camelCase de la 1.6.2.

**Hasta que PG-0 esté publicado, ningún adapter se habilita en `mode: live`.**

## Migración de los 3 flujos (sin big bang)

El registry resuelve así:

```
gateway del hotel (payment_gateways) → si no hay, ENV global (comportamiento actual)
```

Así `payments` y `bookingengine` se migran **sin romper** lo que hoy funciona: un hotel sin fila
en `payment_gateways` sigue exactamente igual que hoy. Se migra hotel por hotel, y cuando no
quede ninguno usando el ENV, se borra el fallback y con él las clases `StripeUseCase` duplicadas.
