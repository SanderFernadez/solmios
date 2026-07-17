# Change Proposal: ttlock-planning-access (Fase A)

## Summary

Llevar el acceso a las cerraduras TTLock al nivel de MisterPlan: un icono de candado por
habitación en el **Planning** que abre un panel con la cerradura de esa habitación y sus
códigos (ver / generar / revocar). Equivalente MisterPlan: en su planning cada fila de
habitación tiene un 🔒 que da acceso directo a la cerradura (ref. visual del usuario).

Esta es la **Fase A** de un plan mayor (analizado 2026-07-16):
- **Fase A (este change)**: acceso por habitación desde Planning — frontend solo.
- **Fase B (futuro)**: panel de cerraduras con tabs reales (Comprobar códigos activos leídos
  del hardware vía `/v3/lock/listKeyboardPwd`, Gateways vía `/v3/gateway/list`) — requiere
  nuevos métodos en `backend/src/services/ttlock-client.ts`.
- **Fase C (futuro)**: Fijos (códigos permanentes), Errores (`/v3/lockRecord/list`), toggle
  auto-códigos por cerradura.

## Motivation

Hoy las cerraduras solo se gestionan en `/panel/cerraduras` (config + tabla de dispositivos +
tabla de códigos). El operador que trabaja en el Planning no tiene acceso directo a la
cerradura de una habitación: tiene que cambiar de pantalla, encontrar el dispositivo y cruzar
manualmente. MisterPlan lo resuelve con un candado por fila.

Todo lo necesario ya existe en el backend (`listLocks`/`listCodes`/`generateCode`/`revokeCode`)
y el vínculo cerradura↔habitación es `LockDevice.roomId`. Es integración de UI, sin backend.

## Scope

- **IN**: icono 🔒 por habitación en `ReservationCalendar.vue`; componente `RoomLockModal.vue`
  con tabs "Cerradura" (estado/batería/MAC) y "Códigos" (listar/generar/revocar). Generación
  atada a la reserva activa HOY de esa habitación (si la hay).
- **OUT**: Gateways, Comprobar códigos activos en hardware, Fijos, Errores (Fases B/C — requieren
  nuevos endpoints del cliente TTLock).

## Rollback plan

- Frontend puro, dos archivos: `RoomLockModal.vue` (nuevo) + `ReservationCalendar.vue` (botón +
  ref + modal). Revertir el commit alcanza. Sin backend, sin schema, sin datos.
