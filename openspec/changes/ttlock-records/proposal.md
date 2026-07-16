# Change Proposal: ttlock-records (Fase C · parte 1)

## Summary

Agregar el tab **Registros** al panel de cerraduras: el historial de actividad de una cerradura
(aperturas, intentos, operaciones) leído del hardware TTLock (`/v3/lockRecord/list`), de los últimos
30 días. Cubre el "Errores/Actividad" de la referencia MisterPlan. Aditivo y de solo lectura.

Fase C del plan TTLock (Fase A `ttlock-planning-access`, Fase B `ttlock-panel-tabs`). Restan de Fase C:
**Fijos** (códigos permanentes de staff) y **toggle auto-códigos por cerradura** (requiere un campo
nuevo en `lock_devices` — se hará aparte por implicar migración).

Contrato verificado contra la API real antes de codear: la cerradura devolvió 13 registros reales
(incluida la apertura con el PIN de prueba `121563`).

## Scope

- **Backend** — `ttlock-client.listLockRecords(creds, lockId, startMs, endMs)` (usa `fetchWithRetry`
  como el resto del cliente). `TtlockService.listLockRecords(hotelId, lockDeviceId, days=30)` con
  `assertOwnership`. Ruta `GET /api/ttlock/locks/:id/records` (guard `ttlock:view`). 11 endpoints.
- **Frontend** — `TTLock.service.listLockRecords(lockId)`. Tab "Registros" en `cerraduras/index.vue`:
  selector de cerradura + tabla (fecha, evento, código/usuario, OK/falló). Tokens del sistema.
- **OUT**: Fijos y toggle auto-códigos (parte 2 de Fase C).

## Rollback plan

- Aditivo: métodos y ruta nuevos, un tab nuevo. Revertir el commit. Sin schema ni datos.
