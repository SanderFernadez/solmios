# Tasks: ttlock-panel-tabs (Fase B)

## Fase 1 — Backend
- [x] 1.1 `ttlock-client.ts`: `listGateways` (`/v3/gateway/list`) + `listLockPasscodes` (`/v3/lock/listKeyboardPwd`), paginados.
- [x] 1.2 `TtlockService.listGateways` + `listActiveCodes` (assertOwnership sobre la cerradura antes de leer el hardware).
- [x] 1.3 Controller + rutas `GET /api/ttlock/gateways`, `GET /api/ttlock/locks/:id/active-codes` (guard ttlock:view). index.ts append-only.
- [x] 1.4 Tests: listGateways passthrough · listActiveCodes lee del hardware · ownership cross-tenant corta.

## Fase 2 — Frontend
- [x] 2.1 `TTLock.service.ts`: `listGateways()` + `listActiveCodes(lockId)` + tipos.
- [x] 2.2 `cerraduras/index.vue` con tabs Configuración · Cerraduras · Gateways · Códigos activos.
- [x] 2.3 Tab Gateways (cards: online, red, MAC, nº cerraduras). Tab Códigos activos (selector + tabla). Atajo "Verificar hardware".

## Fase 3 — Verificación
- [x] 3.1 `bun test` (ttlock) + `arckode analyze` 0 violaciones.
- [x] 3.2 `vue-tsc -b` 0 errores (archivos tocados) + `vite build` OK.
- [ ] 3.3 Verificación en prod: tab Gateways lista el gateway real; Códigos activos lee el hardware; visual OK.
