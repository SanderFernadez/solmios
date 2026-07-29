# Change Proposal: ttlock-room-modal-complete

## Estado: ✅ CERRADO (verificado 2026-07-28)

Implementado y commiteado. Verificado en `RoomLockModal.vue`: las 5 pestañas existen exactamente
como se pidió — Cerradura (`tab==='device'`), Códigos (`'codes'`), Fijos (`'fijos'`), Activos
(`'active'`), Errores (`'errors'`, reenfocada desde "Registros" como se pidió). Backend: código fijo
(`createPermanentCode`, `keyboardPwdType=1`) en `ttlock/usecases/ttlock-hardware.ts:92` + ruta
`POST /api/ttlock/locks/:id/permanent-codes`. `bun test src/modules/ttlock/` → 67/67 pass. El
tasks.md nunca se creó/actualizó, se cierra desde acá.

## Summary

Completar el modal de cerradura por habitación (Planning) al nivel del de MisterPlan: 5 tabs con
todo lo de esa cerradura manejable desde ahí — **Cerradura** (device + gateway + abrir puerta),
**Códigos** (reserva), **Fijos** (permanentes de staff: crear/listar/borrar), **Activos** (PIN reales
del hardware), **Errores** (fallos, en vez de loguear cada apertura). Responde a dos pedidos del
usuario: el modal debe mostrar gateway/fijos/activos/etc., y "Registros" reenfocado a **errores**.

## Motivation

El usuario mostró el modal de MisterPlan (gateways, fijos, activos, errores) y pidió lo mismo, más:
"no sé si debería registrar cada apertura/cierre; mejor si muestra un error". Reenfocamos la pestaña
a errores. Además faltaban dos capacidades: ver **dónde está conectada** la cerradura (qué gateway,
con qué señal) y crear **códigos fijos** de staff.

Contratos verificados contra la API real antes de codear:
- `/v3/gateway/listByLock` → gateway con `rssi` (señal, -57 dBm = buena).
- Código permanente = `/v3/keyboardPwd/add` con `keyboardPwdType=1` + `endDate=0` (creado y borrado en la prueba).

## Scope

- **Backend** — `ttlock-client`: `listLockGateways` (`/v3/gateway/listByLock`) + `addPermanentPasscode`
  (keyboardPwdType=1, endDate=0). Usecase `ttlock-hardware`: `getLockGateways` + `createPermanentCode`
  (con ownership; genera el PIN si no se pasa). Service delega. Controller + rutas `GET
  /locks/:id/gateways` (view) y `POST /locks/:id/permanent-codes` (edit, `validateSchema`). 15 endpoints.
- **Frontend** — `TTLock.service`: `listLockGateways` + `createPermanentCode`. `RoomLockModal` con 5
  tabs; gateway + señal en Cerradura; tab Fijos (crear/listar/borrar permanentes); tab Errores
  (fallos, `success !== 1`, con badge de conteo). Icono electrónico + header con estado/batería (previo).
- **OUT**: toggle auto-códigos por cerradura (requiere columna nueva en `lock_devices` → migración aparte).

## Rollback plan

Backend aditivo (métodos/usecase/rutas/validator nuevos). Frontend: el modal se reescribió
conservando lo previo. Revertir el commit. Sin schema ni datos.
