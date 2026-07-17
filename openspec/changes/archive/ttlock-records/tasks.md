# Tasks: ttlock-records (Fase C · parte 1)

- [x] 1.1 Verificar `/v3/lockRecord/list` contra la API real (13 registros reales).
- [x] 1.2 `ttlock-client.listLockRecords` (fetchWithRetry, paginado).
- [x] 1.3 `TtlockService.listLockRecords` con assertOwnership + ventana 30 días (MS_PER_DAY, sin magic number).
- [x] 1.4 Ruta `GET /api/ttlock/locks/:id/records` (append-only, guard ttlock:view).
- [x] 1.5 Tests: passthrough + ownership cross-tenant.
- [x] 2.1 `TTLock.service.listLockRecords` + tipo `LockRecord`.
- [x] 2.2 Tab "Registros" en `cerraduras/index.vue` (selector + tabla).
- [x] 3.1 `bun test` (19 ttlock) + `arckode analyze` 0 violaciones + typecheck 0.
- [x] 3.2 `vue-tsc -b` 0 errores (mis archivos) + `vite build` OK.
- [x] 3.3 Verificación en prod: tab Registros lista la actividad real de la cerradura.
