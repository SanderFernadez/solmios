# FRD · M02 — Channel Manager (Channex, OTAs, Sincronización ARI, Ingesta de Reservas)

> **Módulo de distribución.** Documenta cómo ManagerHotel empuja disponibilidad + tarifas (ARI) a las OTAs vía Channex, y cómo recibe reservas de vuelta. Sigue el molde de `M01-PMS-Central.md` y los códigos de `00-MASTER.md`.
>
> Todo lo documentado acá está **extraído del código real** de `backend/src/modules/canales/` (model, service, controller, usecases/channex), `backend/src/connectors/habitaciones-canales.ts`, y `frontend/src/pages/channel-manager/index.vue` + `channel-detail/index.vue` + `Channel.service.ts`. La columna "Gap" marca lo que hoy NO cumple el modelo canónico y hay que corregir.

**Módulo:** M02 — Channel Manager
**Pantallas cubiertas:** Channel Manager (lista de canales) · Channel Detail (detalle de un canal)
**Servicios frontend:** `Channel.service.ts` (status, sync, connect, deactivate, bookings, ingestBookings, groups, mappingDetails, testConnection, iframeToken)
**Servicios backend:** módulo `canales` (Channex real) + conector `habitaciones-canales`
**Proveedor externo:** Channex (`https://staging.channex.io/api/v1`), API key vía `process.env.CHANNEX_API_KEY` o `canales_config.channexApiKey`

---

## 1. Modelo de datos (fuente de verdad)

### 1.1 Tabla física `channel_config` (una fila por hotel)

Fuente: `backend/src/modules/canales/model.ts` + migración `1781810563360_create_canales.ts`.

| Campo | Tipo | Significado |
|-------|------|-------------|
| `id` | string (PK) | UUID de la config |
| `hotelId` | string (indexed) | Hotel al que pertenece (relación 1:1) |
| `channexPropertyId` | string? | ID de la "property" creada en Channex. `null` = hotel aún no sincronizado |
| `channexApiKey` | string? | API key por hotel (si vacía → usa `process.env.CHANNEX_API_KEY`) |
| `channexGroupId` | string? | ID del grupo Channex (para multi-propiedad) |
| `syncEnabled` | number (default 1) | 1 = sincronización activa, 0 = pausada |
| `lastSync` | string? | ISO timestamp de la última sincronización exitosa |
| `config` | json (default {}) | Blob extra (reservado) |

> ⚠ **InCONSISTENCIA DETECTADA (Gap #0):** el DTO en `types.ts` declara `channexGroupId` y `ultimaSync`, pero `model.ts` NO declara esos campos físicamente. El service escribe `ultimaSync` y `syncProperty` lee `hotel.nombre/moneda/...` (español) mientras el ORM de Hotels expone `name/currency`. Los campos se persisten en JSON `config` de forma implícita o se pierden. Resolver: alinear `model.ts` ↔ `types.ts` ↔ nombres de columnas reales.

### 1.2 Estado de conexión de un canal (`ChannelDTO.conectado`)

No es una columna: se deriva en runtime al llamar `GET /api/channels` (`ChannexUseCase.listChannels`).

| Estado derivado | Significado | Badge | ¿Recibe reservas? |
|-----------------|-------------|-------|--------------------|
| `conectado=true`, `activo=true` | Canal creado Y activado en Channex | teal "Conectado" | Sí |
| `conectado=true`, `activo=false` | Canal creado pero desactivado | coral "Inactivo" | No |
| `conectado=false` | Sólo existe en el catálogo OTA (disponible para conectar) | gray "Disponible" | No |

### 1.3 Catálogo OTA (fuente de metadatos)

Tabla `Configuration` con `clave='canales_ota'` (hotelId='platform'). Si está vacía → fallback hardcodeado en `channel-manager/index.vue:213` (`DEFAULT_OTA_CATALOG`):

| channexCode | name | type |
|-------------|------|------|
| `AirBNB` | Airbnb | ota |
| `BookingCom` | Booking.com | ota |
| `A-Expedia` | Expedia | ota |
| `GHA` | Google Hotels | metasearch |
| `HW` | Hostelworld | ota |
| `Agoda` | Agoda | ota |
| `Despegar` | Despegar | ota |
| `TripCom` | Trip.com | ota |

### 1.4 Estado de un booking recibido (`BookingRevisionDTO.status`)

Traído directo del feed `booking_revisions/feed` de Channex.

| status | Significado | Acción en ingestión (`ingestBookings`) |
|--------|-------------|----------------------------------------|
| `new` | Reserva nueva de la OTA | Crea `Reservations` con `estado='confirmada'`, `canal={otaName}` |
| `modified` | Reserva modificada por la OTA | **Crea un DUPLICADO** (Gap — ver §7.2) |
| `cancelled` | Reserva cancelada por la OTA | Crea `Reservations` con `estado='cancelada'` |

### 1.5 Tipos de sincronización ARI

| Tipo | Endpoint | Qué empuja | Cuándo |
|------|----------|------------|--------|
| **Sync completo** | `POST /api/channels/sync` | Crea/borra room_types + rate_plans + availability + restrictions (30 días) | Botón "Forzar Sync Ahora" |
| **Push de tarifa** | `CanalesService.pushRate` (vía conector) | Solo `restrictions` del rate_plan del tipo de habitación | Al editar `basePrice` de una habitación (conector `habitaciones-canales`) |
| **Ingesta de reservas** | `POST /api/channels/bookings/ingest` | Lee feed + crea `Reservations` + ack | Botón "Recibir Reservas" |

---

## 2. Pantalla — Channel Manager (`/panel/channel-manager`)

Cabecera: título "Channel Manager" + badge "Sincronizando cada 15 min" (ver Gap #6) + botones **"Forzar Sync Ahora"** y **"Recibir Reservas"**. Cuerpo: grid de "Canales Conectados", grid de "Canales Disponibles para Conectar", tabla "Historial de Sincronización".

> **Permisos backend:** todas las rutas `/api/channels/*` requieren `auth.authenticate('hotel_admin', 'super_admin')`. El CRUD admin `/api/canales/*` requiere `super_admin`. (Fuente: `index.ts:48-94`.)

### 2.1 Decision Table

| Trigger (botón/acción) | Condición / Estado previo | Resultado | Modal/Toast (texto literal) | Errores posibles (códigos) | Notificación F5 |
|------------------------|---------------------------|-----------|------------------------------|-----------------------------|-----------------|
| `onMounted` → `loadStatus()` | hotel con sesión | Carga `GET /api/channels` + catálogo OTA | — (hoy: sin skeleton) | E6 "Sin conexión" (hoy: silencioso, catch vacío `index.vue:253,263`) | — |
| Botón **"Forzar Sync Ahora"** (`index.vue:15`) | `channexPropertyId` set o ausente | `POST /api/channels/sync` → crea/actualiza property + room_types + rate_plans + ARI (30 días) | **Target:** Toast success: "Sincronización completa: {n} room types, {m} rate plans." + recarga. **Hoy:** Toast error vía `alert(e.message)` (`index.vue:272`) | E2 "No hay habitaciones para sincronizar" (no implementado) · E3 "Sin permiso" · E6 "Sin conexión" (`alert`) · E7 "Algo salió mal" | **Sí (target):** F5 Recepción "Inventario actualizado en {n} OTAs" |
| Botón **"Forzar Sync Ahora"** loading | request en curso | Botón → `disabled` + texto "Sincronizando..." (`index.vue:16`) | — | — | — |
| Botón **"Recibir Reservas"** (`index.vue:18`) | hay bookings pendientes en feed | `POST /api/channels/bookings/ingest` → crea `Reservations` + ack en Channex | **Target:** Toast success: "{n} reservas recibidas de OTAs." **Hoy:** `alert(result.message)` (`index.vue:352`) | E2 "Reserva OTA duplicada (ya existe {otaCode})" (no implementado) · E6 (`alert` `index.vue:355`) | **Sí (target):** F5 Recepción/Admin "Nueva reserva de {otaName} — {huésped}" por cada reserva ingesada |
| Botón **"Recibir Reservas"** sin bookings | feed vacío | `ingestBookings` retorna `message='No hay bookings pendientes'` | **Hoy:** `alert('No hay bookings pendientes')`. **Target:** Toast info F1 "No hay reservas nuevas." | — | — |
| Clic tarjeta canal **conectado** (`index.vue:104`) | `channel.connected=true` | Sin handler directo (sólo hover). Las acciones son los botones internos | — | — | — |
| Botón **"Configurar"** en canal conectado (`index.vue:129`) | `channel.id` set Y `channel.connected` | `router.push('/panel/channel/${id}')` → va a Channel Detail | — | — | — |
| Botón **"Configurar"** sin id/conectado | canal del catálogo sin `channex id` | Abre **modal detail** estático: nombre, estado, ID Channex, código OTA, reservas, última sync | Modal `detail`: header "{name}", botón **"Cerrar"** (`index.vue:79`) | — | — |
| Botón **"Desconectar"** (`index.vue:130`) | `channel.connected=true`, `channel.id` set | **Hoy:** `POST /api/channels/:id/deactivate` directo sin confirmar. **Target:** Modal `danger`: "¿Desconectar {name}? Las reservas futuras seguirán vigentes pero no habrá nueva sincronización." | **Target:** Toast success: "{name} desconectado." **Hoy:** sin feedback salvo recarga; `alert(result.message)` si falla (`index.vue:367`) | E3 · E4 "No se encontró el canal" · E6 (`alert` `index.vue:369`) | — |
| Botón **"Desconectar"** en canal sin `otaCode` | canal mock del catálogo | Sólo muta `ch.connected=false` en memoria (no llama API) (`index.vue:363`) | — (sin feedback) | — | — |
| Botón **"Conectar"** (azul, tarjeta disponible) (`index.vue:134`) | canal del catálogo NO conectado | Abre **modal form** "Conectar {channelName}" con inputs: Código OTA (readonly) + Título | Modal `form`: header "Conectar {channelName}" (`index.vue:28`), botones **"Cancelar"** / **"Conectar"** (`index.vue:44-45`) | — | — |
| Botón **"Conectar"** dentro del modal (`index.vue:45`) | `hotelId` set | Secuencia: `groups()` → `status()` (para `propertyId`) → `connect()`. Crea canal en Channex + activa | **Target:** Toast success: "{name} conectado." **Hoy:** inline teal `connectResult` (`index.vue:41`) con `result.message`, cierra a los 1.2s (`index.vue:313`) | E1 "Título es obligatorio" (no validado) · E2 "No hay grupos configurados en Channex" (`index.vue:296`) / "No hay propiedad configurada en Channex" (`index.vue:300`) (inline coral `connectError`) · E6/E7 (inline coral) | **Sí (target):** F5 Admin "Canal {name} activo" |
| Botón **"Conectar"** loading | request en curso | Botón → `disabled` + texto "Conectando..." (`index.vue:46`) | — | — | — |
| Botón **"Cancelar"** (modal conectar) (`index.vue:44`) | modal abierto | Cierra modal sin acción (`cancelConnect`) | — | — | — |
| Click fondo oscuro modal conectar (`@click.self`) (`index.vue:26`) | modal abierto | Cierra (`cancelConnect`) | — | — | — |
| Botón **"Solicitar Conexión"** (canales disponibles) (`index.vue:157`) | — | **Sin handler** (Gap #1) — botón muerto | — | — | — |
| Botón **"Ver Todo"** (historial sync) (`index.vue:167`) | — | **Sin handler** (Gap #2) — botón muerto | — | — | — |
| Tabla "Historial de Sincronización" | `syncLog` siempre `[]` (`index.vue:229`) | **Nunca se pobla** (Gap #3) — la tabla está siempre vacía | — | — | — |

### 2.2 Gap actual (Channel Manager list)

- ❌ Errores = `alert(e.message)` en `syncNow` (`index.vue:272`), `ingestBookings` (`index.vue:352,355`), `disconnectChannel` (`index.vue:367,369`) → debe ser Toast F1 con texto E6/E7.
- ❌ Éxito de sync **sin feedback** (sólo recarga) → falta Toast success.
- ❌ Ingesta exitosa = `alert(result.message)` → debe ser Toast success/info.
- ❌ `connectError` / `connectResult` son cajas inline dentro del modal, no Toasts F1 (inconsistente con el resto del sistema).
- ❌ Botones **"Solicitar Conexión"** y **"Ver Todo"** no hacen nada (sin handler).
- ❌ Tabla "Historial de Sincronización" nunca se carga (`syncLog=[]`).
- ❌ **"Desconectar"** sin modal `danger` de confirmación — acción destructiva sin proteccion.
- ❌ `loadStatus()` no tiene skeleton (sólo `catch` vacío); la página aparece en blanco hasta que carga.
- ❌ Badge "Sincronizando cada 15 min" es **decorativo**: no hay cron/scheduler en el backend que ejecute sync automática (Gap #6).
- ❌ El título del modal de conectar no valida `form` dirty al cerrar (no hay "¿Descartar cambios?").

### 2.3 Flow — Sincronizar disponibilidad/tarifa a OTA (Forzar Sync Ahora)

```mermaid
flowchart TD
    A([Usuario clic "Forzar Sync Ahora"]) --> B{permiso hotel_admin/super_admin?}
    B -- no --> X1[E3 Toast: Sin permiso]
    B -- sí --> C[Botón loading "Sincronizando..."]
    C --> D[POST /api/channels/sync]
    D --> E[Service.syncProperty: lee Rooms por hotelId]
    E --> F{hay room types?}
    F -- no --> X2[E2 Toast: No hay habitaciones para sincronizar]
    F -- sí --> G{channexPropertyId existe?}
    G -- no --> H[POST /properties en Channex]
    H --> I{ok?}
    I -- no --> X3[E7 Toast: No se pudo crear la propiedad en Channex]
    I -- sí --> J[Guarda propertyId en channel_config]
    G -- sí --> K[Borra rate_plans + room_types viejos]
    J --> L[Crea room_types por tipo de habitación]
    K --> L
    L --> M[Crea rate_plans por room_type]
    M --> N[POST /availability 30 días]
    N --> O[POST /restrictions con tarifa]
    O --> P{HTTP 200 + success?}
    P -- sí --> Q[Actualiza lastSync en config]
    Q --> R[Toast success: Sincronización completa n room types, m rate plans]
    R --> S["F5 (target): Recepción — Inventario actualizado en OTAs"]
    S --> T([Fin])
    P -- falla red --> X4[E6 Toast: Sin conexión con Channex]
    P -- error Channex --> X5[E7 Toast: Algo salió mal]
```

### 2.4 Flow — Recibir reserva de OTA (ingesta)

```mermaid
flowchart TD
    A([Usuario clic "Recibir Reservas"]) --> B{permiso hotel_admin/super_admin?}
    B -- no --> X1[E3 Toast: Sin permiso]
    B -- sí --> C[Botón loading "Ingestando..."]
    C --> D[POST /api/channels/bookings/ingest]
    D --> E[GET /booking_revisions/feed Channex]
    E --> F{hay bookings?}
    F -- no --> Y1[Toast info: No hay reservas nuevas]
    Y1 --> Z([Fin])
    F -- sí --> G[Por cada booking revision]
    G --> H{status revision?}
    H -- new/modified --> I[Crea Reservations estado=confirmada canal=otaName]
    H -- cancelled --> J[Crea Reservations estado=cancelada]
    I --> K{otaReservationCode ya existe?}
    K -- sí (target) --> X2[E2 Toast: Reserva OTA duplicada otaCode]
    K -- no (target) --> L[OK]
    J --> L
    L --> M[POST /booking_revisions/id/ack]
    M --> N{ack ok?}
    N -- no --> O[Registra error en result.errors]
    N -- sí --> P{quedan más bookings?}
    P -- sí --> G
    P -- no --> Q[Toast success: n reservas recibidas, m acknowledged]
    Q --> R["F5 (target): Recepción — Nueva reserva de otaName — huésped"]
    R --> Z
```

> ⚠ **Gap crítico (ver §7):** la validación `otaReservationCode ya existe?` (nodo X2) **NO está implementada**. Hoy, ingestar dos veces el mismo feed crea reservas duplicadas. Tampoco se valida overbooking contra el calendario de M01 antes de insertar.

---

## 3. Pantalla — Channel Detail (`/panel/channel/:id`)

Muestra cabecera del canal (título, código OTA, ID, estado Activo/Inactivo), "Rate Plans Mapeados" y "Rate Plans del Hotel". **No tiene botones de acción** (sólo "← Volver").

### 3.1 Decision Table

| Trigger (botón/acción) | Condición / Estado previo | Resultado | Modal/Toast (texto literal) | Errores posibles (códigos) | Notificación F5 |
|------------------------|---------------------------|-----------|------------------------------|-----------------------------|-----------------|
| `onMounted` | `:id` en ruta | `fetch('/api/channels/:id/detail')` (`channel-detail/index.vue:14`) → carga `detail` | — | E4 "Canal no encontrado" (hoy: texto plano "Canal no encontrado" `index.vue:27`) · E6 (hoy: `catch` vacío `index.vue:17` silencia) | — |
| Estado `loading=true` | request en curso | Muestra "Cargando..." texto centrado (`index.vue:26`) | — | — | — |
| Estado `!detail` | API respondió vacío | Muestra "Canal no encontrado" texto plano (`index.vue:27`) | — (sin ilustración/CTA) | E4 | — |
| Botón **"← Volver"** (`channel-detail/index.vue:44`) | — | `router.push('/panel/channel-manager')` | — | — | — |
| Clic en rate plan mapeado | — | Sin handler (sólo muestra `JSON.stringify(rp.settings)`) | — | — | — |
| Clic en rate plan del hotel | — | Sin handler | — | — | — |

### 3.2 Gap actual (Channel Detail)

- ❌ Usa `fetch()` crudo (`channel-detail/index.vue:14`) en vez de `ChannelService.channelDetail(...)` — **anti-patrón CLAUDE.md** (prohibido `fetch()` en componentes; debe ir por service).
- ❌ No pasa `hotelId` ni autenticación al `fetch` → potencial 401/403 silenciado.
- ❌ `catch {}` vacío (`index.vue:17`) silencia todo error → debería ser Toast E6/E7 + F4 alert de página con "Reintentar".
- ❌ Estados vacíos ("Cargando...", "Canal no encontrado") son **strings sueltos** sin ilustración ni CTA (viola F6 §4.2).
- ❌ No hay acciones: no se puede **activar/desactivar** el canal desde acá, ni **editar mapeo**, ni **ver tarifa actual**. La pantalla es de sólo lectura pasiva.
- ❌ `JSON.stringify(rp.settings)` renderiza JSON crudo en UI (`index.vue:56`) — mala UX.

---

## 4. Consecuencias cross-módulo (eventos que dispara o recibe M02)

### 4.1 M02 → otros módulos (salida)

| Acción en M02 | Módulo afectado | Efecto real hoy | Efecto target + Notificación F5 |
|---------------|-----------------|------------------|----------------------------------|
| `ingestBookings` crea reserva OTA | **M01 Reservas** | Inserta en `Reservations` con `estado='confirmada'`, `canal=otaName` (`usecases/channex.ts:380-394`). **Sin validar overbooking ni duplicados.** | Mismo + Toast F5 a Recepción: "Nueva reserva de {otaName} — {huésped}, Hab {n}" |
| `ingestBookings` reserva cancelada | **M01 Reservas** | Crea `estado='cancelada'` (NO cancela una reserva existente, crea un registro nuevo) | Target: buscar reserva por `otaReservationCode` y cancelarla |
| `pushRate` (conector) | **M01 Habitaciones** → Channex | Cuando se actualiza `basePrice` de una hab, empuja `restrictions` al rate_plan (`habitaciones-canales.ts:13`) | Mismo + F5 Admin "Tarifa {roomType} actualizada en OTAs" si `pushed=true`; F5 warning si `pushed=false` (hoy silencioso) |
| `syncProperty` lee habitaciones | **M01 Habitaciones** (read-only) | Agrupa `Rooms` por `type` → room_types ARI (`index.ts:78-84`) | — |

### 4.2 Otros módulos → M02 (entrada)

| Acción externa | Módulo origen | Efecto en M02 | Notificación F5 |
|-----------------|---------------|----------------|------------------|
| Editar `basePrice` de habitación | **M01 Habitaciones** | Conector `habitaciones-canales` → `CanalesService.pushRate` → Channex `restrictions` | **Faltante:** no hay feedback al usuario que editó (debería ser F5 "Tarifa sincronizada con OTAs") |
| Reserva directa creada en PMS | **M01 Reservas / M03 Motor Reservas** | **HOY: NO decrementa disponibilidad en Channex** (no hay hook `onReservaCreated → pushAvailability`) | **Faltante (Gap crítico):** sin esto, una reserva directa puede producir overbooking en OTAs. M01 ya menciona "F5: Sincronizar {canal}" como target (`M01-PMS-Central.md:233`), pero el hook NO está cableado. |
| Habitación → `out_of_service` | **M01 / M08 Mantenimiento** | **No implementado:** debería bloquear ese room_type en Channex | Faltante |

### 4.3 M07 Housekeeping

Hoy **no hay efecto directo** entre M02 y Housekeeping. Una reserva OTA ingesada debería disparar las mismas F5 que una reserva directa (tarea de preparación de habitación al confirmar), pero el conector no existe.

---

## 5. Reglas de negocio a validar en backend (E2)

El backend debe rechazar (HTTP 400 `BUSINESS_RULE` o 422 con `code:'BUSINESS_RULE'`) estas situaciones y el frontend mostrar el Toast E2. **Las marcadas ❌ NO están implementadas hoy.**

1. ❌ **Ingesta de reserva OTA duplicada** → si ya existe `Reservations` con el mismo `otaReservationCode`, NO crear otra. Texto: "La reserva OTA {otaCode} ya fue importada."
2. ❌ **Overbooking al ingestar reserva OTA** → si las fechas del booking colisionan con reservas existentes y no hay room_type disponible, rechazar. Texto: "No hay disponibilidad para {otaName} en esas fechas (overbooking)."
3. ❌ **Sync sin habitaciones** → si `orm.findMany('Rooms', {hotelId})` retorna `[]`, no crear property vacía en Channex. Texto: "No hay habitaciones para sincronizar. Creá habitaciones primero."
4. ❌ **Conectar canal sin property sincronizada** → si `channexPropertyId` es null, rechazar `connect`. Texto: "Primero debés sincronizar la propiedad (Forzar Sync Ahora)."
5. ❌ **Conectar canal sin grupo** → si `listGroups` retorna `[]`, rechazar. Texto: "No hay grupos configurados en Channex."
6. ❌ **Desactivar canal ajeno** → verificar que el `channelId` pertenece al `channexPropertyId` del hotel. Texto: "El canal no pertenece a tu propiedad."
7. ⚠ **Push de tarifa con precio ≤ 0** → `pushRate` hoy acepta cualquier número; debería validar `precioBase > 0`. Texto: "La tarifa debe ser mayor a 0."
8. ⚠ **Ingesta sin ORM disponible** → hoy lanza `Error('ORM no disponible')` genérico (`service.ts:121`) → debe ser E7 con traceId.

### 5.1 Validaciones de entrada (E1) faltantes

`validators/schema.ts` sólo define `CreateCanalesSchema`/`UpdateCanalesSchema` (usados en CRUD admin `/api/canales/*`). **No hay validación** para:

- `POST /api/channels/connect` → `OTAChannelCreateDTO` no validado (falta `validateSchema` en `controller.connectOTA`).
- `POST /api/channels/test-connection` → sin validar.
- `POST /api/channels/:id/deactivate` → `hotelId` puede ser undefined.
- `POST /api/channels/sync` → sin body schema.

---

## 6. Gap Analysis — código real vs modelo canónico

| # | Gap | Dónde | Severidad |
|---|-----|-------|-----------|
| G1 | Botón **"Solicitar Conexión"** sin handler | `channel-manager/index.vue:156-158` | Media (UX rota) |
| G2 | Botón **"Ver Todo"** sin handler | `channel-manager/index.vue:167` | Media (UX rota) |
| G3 | Tabla "Historial de Sincronización" nunca se popula (`syncLog=[]`) | `channel-manager/index.vue:229` | Alta (feature falsa) |
| G4 | `alert(e.message)` en `syncNow` | `channel-manager/index.vue:272` | Alta (anti-patrón §1 MASTER) |
| G5 | `alert(result.message)` + `alert(e.message)` en `ingestBookings` | `channel-manager/index.vue:352,355` | Alta |
| G6 | `alert(result.message)` + `alert(e.message)` en `disconnectChannel` | `channel-manager/index.vue:367,369` | Alta |
| G7 | Badge "Sincronizando cada 15 min" sin scheduler real | `channel-manager/index.vue:11-14` (header), sin contraparte en backend | Alta (claim falso) |
| G8 | **"Desconectar"** sin modal `danger` de confirmación | `channel-manager/index.vue:130,359` | Alta (acción destructiva) |
| G9 | `connectError`/`connectResult` como cajas inline, no Toasts F1 | `channel-manager/index.vue:40-41` | Media (inconsistencia) |
| G10 | `loadStatus()` sin skeleton + `catch {}` vacío | `channel-manager/index.vue:238-264` | Media |
| G11 | Channel Detail usa `fetch()` crudo (anti-patrón CLAUDE.md) | `channel-detail/index.vue:14` | Alta |
| G12 | Channel Detail `catch {}` vacío silencia errores | `channel-detail/index.vue:17` | Alta |
| G13 | Channel Detail estados vacíos sin ilustración/CTA | `channel-detail/index.vue:26-27` | Media |
| G14 | Channel Detail muestra `JSON.stringify(settings)` crudo | `channel-detail/index.vue:56` | Baja (UX) |
| G15 | **No hay prevención de overbooking** en `ingestBookings` | `usecases/channex.ts:367-413` | **CRÍTICA** |
| G16 | **No hay dedupe** por `otaReservationCode` → reservas duplicadas | `usecases/channex.ts:378-396` | **CRÍTICA** |
| G17 | **No hay conector `reservas → canales`** (reserva directa no decrementa OTA) | ausente en `src/connectors/` | **CRÍTICA** |
| G18 | `pushRate` falla silenciosa (`pushed=false` sin F5) | `usecases/channex.ts:155,163`, `service.ts:82-84` | Alta |
| G19 | `iframeToken` URL con `property_id` hardcodeado `6fe6fcd0-...` | `controller.ts:97` | Alta (bug) |
| G20 | Sin `validateSchema` en `connect/test-connection/sync/deactivate` | `controller.ts:35,59,67`, `index.ts:71` | Alta (E1 ausente) |
| G21 | `ingestBookings` escribe `Reservations` vía ORM directo (bypass del módulo reservas) | `service.ts:120-124` | Alta (violación arquitectura) |
| G22 | `model.ts` no declara `channexGroupId` ni `ultimaSync` aunque `types.ts` y el service los usan | `model.ts:11-19` vs `types.ts:6-17`, `service.ts:77-78` | Media (datos perdidos) |
| G23 | Booking `modified` se inserta como reserva nueva (no actualiza la existente) | `usecases/channex.ts:388` (mapea status≠cancelled → confirmada) | Alta |
| G24 | Tests sólo cubren `getById/create/delete` admin; sin tests de sync/ingest/connect | `tests/service.test.ts` | Media |

---

## 7. Checklist de verificación M02

Estado actual vs. target. Marcar cuando se cumpla.

### Channel Manager (lista)
- [ ] Reemplazar `alert(e.message)` por Toast E6/E7 en `syncNow` (G4)
- [ ] Reemplazar `alert(...)` por Toast success/info/error en `ingestBookings` (G5)
- [ ] Reemplazar `alert(...)` por Toast + modal `danger` en `disconnectChannel` (G6, G8)
- [ ] Convertir `connectError`/`connectResult` a Toasts F1 (G9)
- [ ] Botón "Forzar Sync Ahora" con Toast success al completar (hoy sólo recarga)
- [ ] Skeleton en `loadStatus()` (G10)
- [ ] Implementar handler de "Solicitar Conexión" o quitar el botón (G1)
- [ ] Implementar handler de "Ver Todo" o quitar el botón (G2)
- [ ] Poblar "Historial de Sincronización" desde el backend (G3)
- [ ] Implementar scheduler de sync cada 15 min o quitar el badge (G7)

### Channel Detail
- [ ] Migrar `fetch()` crudo a `ChannelService.channelDetail()` pasando `hotelId` (G11)
- [ ] Reemplazar `catch {}` vacío por Toast E6/E7 + F4 alert con "Reintentar" (G12)
- [ ] Estados vacíos con ilustración + CTA (G13)
- [ ] Renderizar rate plans con UI legible (no `JSON.stringify`) (G14)
- [ ] Agregar acciones: activar/desactivar canal, editar mapeo

### Backend — reglas de negocio (E2)
- [ ] Dedupe por `otaReservationCode` en `ingestBookings` (G16)
- [ ] Validación de overbooking contra calendario M01 (G15)
- [ ] Rechazar sync sin habitaciones (E2)
- [ ] Rechazar connect sin property sincronizada (E2)
- [ ] Rechazar connect sin grupo Channex (E2)
- [ ] Manejar booking `modified` como update, no como alta (G23)
- [ ] `validateSchema` en connect/test-connection/sync/deactivate (G20)
- [ ] Validar `pushRate` con `precioBase > 0`

### Cross-módulo
- [ ] Crear conector `reservas-canales`: reserva directa → `pushAvailability` decrementa OTA (G17)
- [ ] F5 a Recepción/Admin por cada reserva OTA ingesada (target M01 §6)
- [ ] F5 warning al admin cuando `pushRate` retorna `pushed=false` (G18)
- [ ] `ingestBookings` debe ir por el módulo `reservas` (service), no escribir ORM directo (G21)

### Datos
- [ ] Alinear `model.ts` ↔ `types.ts` (agregar `channexGroupId`, `ultimaSync`/`lastSync`) (G22, G0)
- [ ] Reemplazar `property_id` hardcodeado en `iframeToken` por `cfg.channexPropertyId` (G19)

### Tests
- [ ] Cobertura de `syncProperty`, `ingestBookings`, `createOTAChannel`, `pushRate` con mocks de Channex (G24)

---

## 8. Pendiente de documentar en M02 (próximas iteraciones)

- [ ] Flujo de **mapeo visual** dentro del iframe de Channex (hoy es una caja negra embebida).
- [ ] Estrategia de **reintentos** cuando Channex responde 5xx (hoy no hay; las llamadas fallan y se loguean).
- [ ] **Webhook de Channex** → hoy la ingesta es por pull manual ("Recibir Reservas"); documentar el target de push automático.
- [ ] Matriz de permisos: ¿puede `recepcion` ver Channel Manager, o sólo `hotel_admin`? (hoy backend lo permite, frontend no gatea).
- [ ] Manejo de **multi-moneda** y comisiones por OTA.
- [ ] **Stop-sell** (cerrar venta en una OTA puntualemnte) — no implementado.

---

*Este documento sigue el molde de `M01-PMS-Central.md`. Mismas secciones: 1 modelo de datos → 2..n decision tables → flows → cross-módulo → reglas backend → gap analysis → checklist. Códigos F1–F6 y E1–E7 de `00-MASTER.md`.*
