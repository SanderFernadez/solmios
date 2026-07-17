# Change Proposal: ttlock-panel-tabs (Fase B)

## Summary

Rearmar `/panel/cerraduras` con tabs estilo MisterPlan (ref. visual del usuario): **Configuración ·
Cerraduras · Gateways · Códigos activos**. Agrega dos capacidades nuevas leídas del hardware TTLock:

- **Gateways**: lista los gateways de la cuenta (`/v3/gateway/list`) con estado online, red WiFi,
  MAC y nº de cerraduras.
- **Comprobar códigos activos**: lee los PIN que la cerradura tiene HOY en el hardware
  (`/v3/lock/listKeyboardPwd`) — distinto de la tabla `lock_codes` de la BD.

Fase B del plan TTLock (ver `ttlock-planning-access` para Fase A). Contrato de ambos endpoints
verificado contra la API real de Sciener antes de codificar (gateway `G2_8fb201` online, red "phantom").

## Motivation

El panel de cerraduras era una sola vista plana (config + tabla de dispositivos + tabla de códigos de
la BD). MisterPlan organiza todo en tabs y, sobre todo, permite **verificar contra el hardware**: qué
gateways hay y qué códigos viven realmente en cada cerradura. Sin esto, el operador solo ve la "verdad"
de la base, no la de la puerta.

## Scope

- **Backend** — `ttlock-client.ts`: `listGateways(creds)` + `listLockPasscodes(creds, lockId)`.
  `TtlockService`: `listGateways(hotelId)` + `listActiveCodes(hotelId, lockDeviceId)` (con
  `assertOwnership` sobre la cerradura). Rutas `GET /api/ttlock/gateways` y
  `GET /api/ttlock/locks/:id/active-codes` (guard `ttlock:view`).
- **Frontend** — `TTLock.service.ts`: `listGateways()` + `listActiveCodes(lockId)`.
  `cerraduras/index.vue`: tabs, tab Gateways (cards), tab Códigos activos (selector + tabla),
  atajo "Verificar hardware" por cerradura. Estilo con los tokens del sistema.
- **OUT** (Fase C): Fijos (códigos permanentes), Errores (`/v3/lockRecord/list`), toggle auto-códigos.

## Rollback plan

- Backend: métodos nuevos aditivos (no tocan los existentes). Revertir el commit.
- Frontend: `cerraduras/index.vue` reescrito conservando toda la lógica previa; revertir el commit
  restaura la versión plana. Sin schema ni datos.
