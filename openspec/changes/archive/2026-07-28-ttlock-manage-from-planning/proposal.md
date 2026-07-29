# Change Proposal: ttlock-manage-from-planning

## Estado: ✅ CERRADO (verificado 2026-07-28)

Implementado y commiteado. Verificado: `unlockLock` (`ttlock/service.ts:91`, `controller.ts:132`,
ruta wireada) + borrado de PIN del hardware, ambos con tests reales (`ttlock/tests/service.test.ts`
"unlockLock / deletePasscode"). `bun test src/modules/ttlock/` → 67/67 pass. El tasks.md nunca se
creó/actualizó, se cierra desde acá.

## Summary

Convertir el modal de cerradura del Planning en un **centro de gestión**, no solo de consulta:
desde ahí se puede **abrir la puerta en remoto** (por gateway) y **borrar un PIN directo del
hardware**. Antes el modal solo mostraba información; ahora también actúa sobre la cerradura.

## Motivation

El usuario pidió que "todo sobre eso pueda manejarse desde el Planning". El modal ya tenía toda la
información (device, códigos, activos, registros); le faltaba poder ejecutar acciones. Las dos de
mayor impacto y menor riesgo son la apertura remota y el borrado de un código vivo en la puerta.

Contrato verificado contra la API real antes de codear: `POST /v3/lock/unlock` devolvió errcode 0
y **abrió físicamente la cerradura 204** por el gateway (re-bloquea sola).

## Scope

- **Backend** — `ttlock-client.unlockLock(creds, lockId)` (`/v3/lock/unlock`). Nuevo usecase
  `usecases/ttlock-hardware.ts` que concentra TODAS las operaciones de hardware (gateways, activos,
  registros, apertura, borrado) con ownership + creds — extraído para que el service no supere las
  200 líneas (God Object). Service delega. `deletePasscode` además **sincroniza la BD**: marca
  revocada la fila de `lock_codes` que apunte a ese keyboardPwdId. Rutas `POST
  /api/ttlock/locks/:id/unlock` y `DELETE /api/ttlock/locks/:id/passcodes/:pwdId` (guard
  `ttlock:edit`). 13 endpoints.
- **Frontend** — `TTLock.service`: `unlockLock(lockId)` + `deletePasscode(lockId, pwdId)`. En
  `RoomLockModal`: botón "Abrir puerta" (tab Cerradura, deshabilitado si offline) + botón "Borrar"
  por código en el tab Activos.
- **OUT** (siguiente): Fijos (códigos permanentes de staff) y toggle auto-códigos por cerradura
  (este último requiere un campo nuevo en `lock_devices` → migración, se hará aparte).

## Rollback plan

- Backend aditivo (métodos, usecase, rutas nuevas). El refactor a `ttlock-hardware` es equivalente
  funcional (tests lo cubren). Revertir el commit. Sin schema ni datos.
- Frontend: dos botones nuevos en el modal. Revertir el commit.
