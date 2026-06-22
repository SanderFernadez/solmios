# Channex — POC de Staging y Roadmap a Producción

> Documento vivo. Registra el estado real de la integración con Channex, el plan
> de prueba en staging, y el trabajo pendiente para pasar la certificación PMS y
> subir a producción. Fecha de baseline: 2026-06-21.

---

## 0. Veredicto (TL;DR)

- La integración con Channex **existe y funciona en staging** a nivel de columna
  vertebral: hay cliente HTTP, sincronización inicial, Channel API e ingesta de
  bookings. Alcanza para una **POC/demo en staging**.
- **NO pasa** los 14 tests de la certificación PMS hoy. Hay gaps técnicos reales
  (ARI granular inexistente, 1 solo rate plan por room type, sin connector de
  reservas→canales, push en rango fijo en vez de deltas). Ir a producción exige
  cerrarlos antes.
- **No confundir** "configurar hoteles en Channex" (datos) con "certificación PMS"
  (el examen de 14 escenarios para que Channex apruebe el paso a producción).

---

## 1. Conceptos — certificación ≠ configurar hoteles

| Concepto | Qué es |
|---|---|
| **Configurar un hotel** | Crear la propiedad + room types + rate plans en Channex y mapearlos con tu PMS. Es **datos**. Ya hecho para Palma. |
| **Certificación PMS** | Examen de Channex con **14 escenarios** (full sync, deltas, min stay, stop sell, restrictions, half-year, availability, booking receiving, rate limits, update logic). Es **comportamiento**. Requisito para pasar a producción. |
| **Staging** (`staging.channex.io`) | Entorno de prueba. Donde se hace la POC y la certificación. |
| **Producción** (`app.channex.io`) | Solo después de aprobar la certificación + screenshare demo con Channex. |

Doc oficial de certificación:
`https://docs.channex.io/api-v.1-documentation/pms-certification-tests`

---

## 2. Estado actual del entorno (baseline)

| Item | Valor |
|---|---|
| Base URL | `https://staging.channex.io/api/v1` (en `backend/.env`) |
| API Key | Configurada en `backend/.env` → `CHANNEX_API_KEY` (secreto, no commitear) |
| Hotel en DB | **Hotel Boutique Palma** · `hotelId = bca45933-075b-4f0b-bed2-322c3cd7a216` · USD |
| Propiedad en Channex | `channexPropertyId = 6fe6fcd0-dc40-4663-9f17-05a7a1877bb5` |
| `channel_config` | `id = 00309337-da54-4051-af2c-2f7fef612fc8` · `syncEnabled = 1` |
| Última sincronización | `2026-06-19` |
| Habitaciones | Tabla `rooms` (individuales) + `room_rates` (tarifas por fecha) |
| Cómo se modela para Channex | El sync agrupa `rooms` por `type` → 1 `RoomTypeSummary` por tipo |

> ⚠ El CLAUDE.md menciona "Caribe Paradise" como hotel demo, pero la DB real tiene
> **Hotel Boutique Palma**. Las credenciales demo (`admin@managerhotel.com / demo123`)
> siguen siendo válidas como super_admin.

### Archivos relevantes del código

| Archivo | Rol |
|---|---|
| `backend/src/modules/canales/usecases/channex.ts` | Cliente HTTP de Channex (419 líneas). Sync, pushRate, Channel API, ingesta. |
| `backend/src/modules/canales/service.ts` | Facade/orquestador. Config por hotel + delega al usecase. |
| `backend/src/modules/canales/controller.ts` | Adaptador HTTP. (El `/sync` se cablea en `index.ts` por ser cross-module.) |
| `backend/src/modules/canales/index.ts` | Rutas + cómo se agrupan habitaciones en room types (`:78-86`). |
| `backend/src/modules/canales/model.ts` | Tabla `channel_config`. |
| `backend/src/connectors/habitaciones-canales.ts` | Push de tarifa automático al editar una habitación. |
| `backend/doctor.ts` | Health-check completo contra staging. |
| `backend/.env` | `CHANNEX_API_KEY`, `CHANNEX_BASE_URL`. |

---

## 3. Gap analysis — 14 tests de certificación PMS vs estado actual

| # | Test de certificación | Estado hoy | Por qué falla / falta |
|---|---|:---:|---|
| Setup | 4 rate plans (Twin BAR 100 + B&B 120, Double BAR 100 + B&B 120) | ❌ | `syncProperty` crea **1 solo** "Standard" por room type (`channex.ts:138`). |
| Setup | Mapeo persistente local↔Channex | ❌ | No existe tabla `ChannelMapping`. Se matchea por `title` string (`channex.ts:164`). |
| 1 | Full Sync **500 días** (2 calls comprimidas) | ❌ | Sincroniza **30 días** en varias calls (`channex.ts:128,144`). |
| 2 | Single Date Update (1 noche, 1 rate) | ❌ | `pushRate` manda rango fijo today→+30d (`channex.ts:169-171`). No hay push de 1 noche. |
| 3 | Single Date Update (múltiples rates, 1 call) | ❌ | `pushRate` es 1 room type, 1 precio. |
| 4 | Multiple Date Update (rangos distintos, 1 call) | ❌ | No implementado. |
| 5 | Min Stay Update | ❌ | `pushRate` no manda `min_stay`. |
| 6 | Stop Sell Update | ❌ | No implementado. (Se puede declarar "no soportado" y Channex lo acepta.) |
| 7 | Multiple Restrictions (CTA, CTD, min/max stay) | ❌ | `/restrictions` solo manda `rate`, sin closures/stay. |
| 8 | Half-year Update (01 Dec 2026 – 01 May 2027) | ❌ | No implementado. |
| 9 | Single Date Availability Update (vía booking) | ❌ | **No existe** connector reservas→canales (Gap G17). Reserva directa no baja dispo OTA. |
| 10 | Multiple Date Availability Update | ❌ | No implementado. |
| 11 | Booking Receiving (crear booking OTA → recibir → ack) | ⚠️ | fetch+ack+ingest funcionan, pero **a mano**, con `orm.create` crudo (bypass servicio de reservas) y sin poller automático (`service.ts:128`). |
| 12 | Rate Limits (queue/limiter, no spamear API) | ❌ | Cada push es inline, sin debounce/queue. |
| 13 | Update Logic ("solo deltas, nunca full sync en timer") | ❌ | `pushRate` re-envía 30 días por cada cambio → Channex lo **rechaza** explícitamente. |
| 14 | Extra Notes (capabilities) | — | Solo 1 rate plan/room type. Restricciones limitadas. |

**Resultado: 0 de 14 pasan limpio.** El bloqueador más duro son los tests 12–13: la
filosofía actual de "mandar 30 días por cada cambio" la rechazan de entrada.

---

## 4. Plan de POC en staging (ejecutable)

Objetivo: validar el flujo bidireccional real con datos de Hotel Boutique Palma.
Cada paso es independiente y reversible (todo es staging).

### Requisitos previos
- Backend levantado: `cd backend && bun run dev` (puerto del `.env`).
- Login para obtener token: `POST /api/auth/login` con `admin@managerhotel.com / demo123`.
- Variables para los comandos:
  ```bash
  export BACKEND="http://localhost:3000"      # confirmar puerto con `bun run dev`
  export TOKEN="<jwt del login>"
  export HOTEL_ID="bca45933-075b-4f0b-bed2-322c3cd7a216"
  export PROP_ID="6fe6fcd0-dc40-4663-9f17-05a7a1877bb5"
  ```

### Paso 0 — Verificación read-only (no toca staging)
Ver el estado real de Palma en staging sin modificar nada.
```bash
# Health-check completo (lee TODO: key, properties, room_types, rate_plans, ARI readback, feed)
cd backend && bun run doctor
```
> ⚠ `doctor.ts` incluye **un push de ARI de prueba** (avail=5, rate=$150 sobre la
> 1ra propiedad) en `doctor.ts:148-176`. Si se quiere solo lectura, comentar ese
> bloque o hacer los GET a mano con `user-api-key` desde `.env`.

**Validar:** ¿Palma aparece con N room types y M rate plans coherentes con las
habitaciones locales?

### Paso 1 — (Opcional) Re-sync de Palma
Solo si el paso 0 muestra desfasaje. **Ojo:** recrea (borra+crea) room types y rate
plans en staging (`channex.ts:106-119`).
```bash
curl -s -X POST "$BACKEND/api/channels/sync" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"hotelId\":\"$HOTEL_ID\"}" | jq
```

### Paso 2 — Push de tarifa real (outbound)
Cambiar `basePrice` de una habitación → el connector `habitaciones-canales` debe
empujar la tarifa a Channex.
1. Editar 1 habitación en el PMS (UI o `PUT /api/habitaciones/:id` con nuevo `basePrice`).
2. Leer el resultado del connector en logs (`Tarifa Channex actualizada`).
3. **Readback** en staging (no confiar en el 200):
   ```bash
   curl -s "$BACKEND/api/channels/$PROP_ID/detail?hotelId=$HOTEL_ID" \
     -H "Authorization: Bearer $TOKEN" | jq
   # o directo a Channex: GET /restrictions?...&filter[restrictions]=rate
   ```
**Gap esperado:** verás que el push actualiza 30 días, no solo el día cambiado.

### Paso 3 — Ingesta de booking OTA (inbound)
1. En `staging.channex.io` → **Applications** → agregar **Booking CRS** → **Create** un booking manual sobre Palma.
2. Llegará al feed en ~1 min.
3. Ingestar:
   ```bash
   curl -s -X POST "$BACKEND/api/channels/bookings/ingest" \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d "{\"hotelId\":\"$HOTEL_ID\"}" | jq
   ```
4. Confirmar la reserva creada en el PMS (tabla `reservations`, con `otaReservationCode`).
5. Cancelar el booking en Channex → re-ingestar → confirmar que la cancelación fluye.

**Gap esperado:** la reserva se crea con `orm.create` crudo (sin pasar por el
servicio de reservas) y **no baja disponibilidad** de las habitaciones.

### Criterio de éxito de la POC
- [ ] Palma aparece en staging con room types + rate plans.
- [ ] Un cambio de tarifa en el PMS se refleja en Channex.
- [ ] Un booking de test en Channex llega como reserva al PMS y se ack.
- [ ] Documentados en este MD los gaps vistos en vivo.

---

## 5. Roadmap a producción (trabajo pendiente)

Ordenado por dependencia + impacto en la certificación. Cada ítem bloquea tests.

| # | Ítem | Tests que desbloquea | Dónde | Esfuerzo |
|---|---|---|---|---|
| R1 | **Mapeo persistente** — tabla `channel_mapping` (local room type / rate plan → UUID Channex) | Setup, 1–10 | nuevo model + `channex.ts` | M |
| R2 | **Multi-rate-plan** por room type (BAR, B&B, etc., configurable) | Setup, 3, 4 | `syncProperty` | M |
| R3 | **ARI granular por deltas** — push por fecha/rango, solo campos cambiados (no rango fijo 30d) | 2, 3, 4, 5, 6, 7, 8, 13 | `pushRate` + nuevo builder | L |
| R4 | **Compresión de rangos** (run-length encoding sobre valores iguales) | 1, 13 | nuevo util | S |
| R5 | **Connector reservas→canales** (Gap G17): reserva directa/bloqueo baja dispo OTA | 9, 10 | nuevo connector `reservas-canales.ts` | M |
| R6 | **Disponibilidad real** = rooms de tipo − ocupadas (holds/bloques) − canceladas, clamp 0 | 9, 10 | util de cálculo | M |
| R7 | **Poller automático** del feed (drain-until-empty, ack robusto, alerta si >30min) | 11 | scheduler/tarea periódica | M |
| R8 | **Ingesta vía servicio de reservas** (no `orm.create` crudo) | 11 | `service.ts:118-130` | S |
| R9 | **Queue/debounce** para pushes (rate limits) | 12 | job queue + limiter | M |
| R10 | **Re-sync periódica** como drift correction (fuera de pico, espaciada) | 13 | scheduler | S |
| R11 | (Opcional) **Webhooks inbound** complementarios al polling | 11 (latencia) | nuevo endpoint + `POST /webhooks` | M |

Esfuerzo: S = medio día · M = 1–3 días · L = 3+ días.

**Secuencia crítica:** R1 (mapeo) → R3+R4 (ARI granular) → R5+R6 (dispo real) son
los que destraban el grueso de los tests. R9+R10 son los que destraban 12–13 (los
que hoy te rechazan de entrada).

---

## 6. Comandos de referencia

```bash
# Health-check Channex (staging)
cd backend && bun run doctor

# Backend / Frontend
cd backend && bun run dev       # API
cd frontend && bun run dev      # UI

# Seed de DB (one-off)
cd backend && bun run migrate

# Verificación (pre-certificación, gate bloqueante)
cd backend && bun run node_modules/arckode-framework/bin/arckode.js analyze   # 0 violaciones
cd backend && bun run typecheck && bun test
cd frontend && npx vue-tsc --noEmit && bun run build
```

Endpoints del módulo `canales` (todos requieren `hotel_admin`/`super_admin`):

| Método | Ruta | Acción |
|---|---|---|
| GET | `/api/channels?hotelId=` | Canales conectados + pendientes del feed |
| POST | `/api/channels/sync` | Sync propiedad + room types + rate plans + ARI 30d |
| POST | `/api/channels/test-connection` | Probar credenciales de una OTA |
| GET | `/api/channels/mapping-details` | Rooms/rates de la OTA para mapear |
| POST | `/api/channels/connect` | Crear + activar canal OTA |
| GET | `/api/channels/:id/detail` | Detalle del canal con tarifas |
| GET | `/api/channels/bookings` | Bookings pendientes del feed |
| POST | `/api/channels/bookings/ingest` | Ingestar bookings → reservas + ack |
| GET | `/api/channels/iframe-token` | Token para embed de Channex (mapeo visual) |

---

## 7. Checklist pre-certificación (antes de pedir producción)

Antes de completar el Google Form de Channex (`forms.gle/xA8F3eSYBPBd8apYA`):

- [ ] R1–R11 del roadmap cerrados (o gaps declarados explícitamente en el form).
- [ ] POC de staging ejecutada y gaps documentados aquí.
- [ ] Cada uno de los 14 tests ejecutado en staging con el `task_id` que devuelve Channex.
- [ ] `arckode analyze` = 0 violaciones · `typecheck` + `vue-tsc` limpios.
- [ ] Pantalla de mapeo (screenshot) lista para el screenshare demo.
- [ ] Respuestas a las preguntas de capabilities (min stay through/arrival, stop sell,
      CTA/CTD, multi room type/rate plan, datos de tarjeta, PCI).

> Channex pide **screenshare demo en vivo** antes de aprobar. No aceptan Postman.

---

## 8. Bitácora de la POC

(Espacio para ir anotando resultados de cada corrida: fecha, qué se probó, qué falló.)

- _2026-06-19_ — Sync inicial ejecutado (lastSync en `channel_config`).
- _2026-06-21_ — **Paso 0 (read-only) ⚠ MISMATCH ENCONTRADO:** staging tiene 3 propiedades:
  - `647c6642-3b28-4ddb-936f-764d1a2ff926` **Hotel Boutique Palma** — ✅ 4 room types (doble 5u/2p, familiar 3u/6p, simple 7u/1p, suite 3u/4p) + 4 rate plans "X Standard" + availability real (doble=5, familiar=3, simple=7, suite=3).
  - `18c65fb3-...` Hotel Somi.
  - `6fe6fcd0-...` **Hotel Test** — ❌ vacía (0 room types, 0 rate plans, sin ARI).
  - **`channel_config` apunta a `6fe6fcd0` (Hotel Test, vacía), NO a `647c6642` (Palma con datos).** La integración apunta a la propiedad equivocada.
  - Canal "Airbnb Palma" conectado a `6fe6fcd0` (inactivo, `token_invalid: true`) — ruido de experimento previo.
  - **Acción requerida:** corregir `channel_config.channexPropertyId` → `647c6642-3b28-4ddb-936f-764d1a2ff926` (UPDATE local en SQLite, no toca staging).
- _2026-06-22_ — **Corrección + Push de tarifa (Capa 1, directo a API Channex) ✅**
  - `channel_config.channexPropertyId`: `6fe6fcd0` (Hotel Test) → `647c6642` (Palma real).
  - POST `/restrictions` sobre rate plan "doble Standard" (`a2496ad8`), `$150.00`, 2026-06-22→25 → **HTTP 200**, task_id `93966d04-e9bb-4690-86df-c8308a87d466`.
  - Readback confirma `doble Standard` = $150.00 en los 4 días; los demás rate plans en $100.00 intactos.
  - **Validado:** conexión de escritura a staging OK + propertyId correcto + formato `{values:[...]}` OK + `filter[restrictions]=rate` obligatorio en readback.
- _2026-06-22_ — **Paso 2 Capa 2 (flujo PMS completo) ✅ + BUG FIX aplicado**
  - PUT `/api/habitaciones/113` suite (`$155→$165`) → connector `habitaciones-canales` disparó → pushRate → Channex → readback suite Standard = **`$165.00`** ✅.
  - **BUG encontrado y arreglado (`channex.ts:167`):** `pushRate` buscaba `room_type_id` en `rp.attributes` (no existe) → `targetRp` siempre `undefined` → retornaba `pushed:false` en silencio. La API de Channex (JSON:API) devuelve `room_type_id` en `rp.relationships.room_type.data.id`. Fix: `(rp.attributes?.room_type_id || rp.relationships?.room_type?.data?.id)`. Mismo patrón riesgoso aún presente en `syncProperty:149` y `getChannelDetail:296` (pendiente revisar).
  - **Hallazgo previo (resuelto por re-sync 04:05):** room types estaban en español (`doble/familiar/simple`) vs habitaciones en inglés (`double/family/single`) → mismatch de mapeo por título. El re-sync alineó a inglés. Confirma la fragilidad del match por título (gap R1: falta mapeo persistente).
  - **Validado end-to-end:** editar habitación en el PMS → tarifa llega a Channex staging. La conexión de escritura + el flujo del connector funcionan.
- _(pendiente)_ — Paso 3 (ingesta de booking OTA).
