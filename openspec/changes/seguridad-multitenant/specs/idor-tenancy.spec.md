# Spec: IDOR / Tenancy — resolución de hotelId

## Contexto

El sistema es multi-tenant por columna `hotelId`. Toda operación de un usuario `merchant`
DEBE quedar acotada al `hotelId` de su token. El `query.hotelId` solo es legítimo para
`super_admin`/`userType==='admin'`, que operan cross-hotel por diseño.

## DB
Sin cambios de schema. Se apoya en la columna `hotelId` ya presente en todas las tablas.

## API

### REQ-1 — Resolución de hotelId (helper `hotelOf`)
El helper que resuelve el hotel de un request MUST seguir esta regla:

- **Given** un usuario `merchant` autenticado con `token.hotelId = H_user`
  **When** llega un request con `query.hotelId = H_other` (H_other ≠ H_user)
  **Then** el sistema MUST usar `H_user` e ignorar el query (o responder `403 FORBIDDEN`
  si el query se pasó explícitamente y no coincide). MUST NOT usar `H_other`.

- **Given** un usuario `super_admin`/`admin`
  **When** llega un request con `query.hotelId = H_other`
  **Then** el sistema MAY usar `H_other` (operación cross-hotel legítima).

- **Given** un `merchant` sin `query.hotelId`
  **Then** el sistema MUST usar `token.hotelId`.

Afecta: `ttlock/controller.ts:hotelOf` (V1), `pricing/controller.ts:hotelOf` (V3),
`amenities/controller.ts:hotelOf` (V5). El patrón actual `if (q.hotelId) return q.hotelId`
MUST reemplazarse por el patrón seguro ya usado en `activos/controller.ts:8`
(`user?.hotelId ?? query.hotelId`, token primero).

### REQ-2 — Ownership real en operaciones por ID
- **Given** un recurso con `resource.hotelId`
  **When** se ejecuta una operación de escritura/lectura sobre él
  **Then** `assertOwnership(resource.hotelId, currentHotelId)` MUST comparar contra el
  hotel **derivado del token** (REQ-1), NUNCA contra un `hotelId` que a su vez salió del
  query. (V2: hoy `ttlock/usecases/ttlock-config.ts:17` compara contra el valor tainted,
  autocumpliendo el check.)

- **Given** `pricing deleteBlock` (V4)
  **When** se borra un rate-block por `id`
  **Then** el service MUST recibir el `hotelId` del token y MUST verificar
  `block.hotelId === hotelId` antes de borrar. MUST NOT borrar solo por `id`.

### REQ-3 — Generación de códigos de puerta (V2, CRÍTICO)
- **Given** un `merchant` del hotel H_user
  **When** solicita generar un código TTLock para una reserva `R`
  **Then** el sistema MUST verificar que `R.hotelId === H_user` con el hotel del token
  antes de invocar la cerradura. Si `R.hotelId ≠ H_user` → `403 FORBIDDEN`.
  MUST NOT generar un código físico para una reserva de otro hotel bajo ninguna
  combinación de `query.hotelId`.

### REQ-4 — Endpoint público de usuarios (V6)
- **Given** `GET /api/public/users` (`admin/index.ts:51`)
  **Then** el endpoint MUST exigir `authenticate` + `requireUserType('admin')`, **o** ser
  removido si ya no lo consume nadie. MUST NOT exponer `name/email/role` sin autenticación.

## UI
Sin cambios de UI. Los endpoints ya ocultan cross-hotel en el front para merchant; el fix
es de backend (ocultar el botón nunca fue la protección — la protección es el guard).

## Errores
| Código | Cuándo |
|--------|--------|
| `403 FORBIDDEN` | merchant intenta operar sobre un hotelId ≠ su token |
| `404 NOT_FOUND` | recurso por id no existe o no es de su hotel (preferible a 403 para no filtrar existencia) |

## Verificación
- `arckode analyze` → 0 violaciones.
- Test nuevo: merchant de H1 con `?hotelId=H2` → 403/404 en ttlock, pricing, amenities.
- Regresión: super_admin con `?hotelId=H2` → 200.
- Regresión: merchant de H1 genera código para reserva de H1 → 200; para reserva de H2 → 403.
