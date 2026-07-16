# Tasks: ttlock-planning-access (Fase A)

## Fase 1 — Componente RoomLockModal
- [x] 1.1 `RoomLockModal.vue` con props `roomId/roomNumber/reservationId`, tabs Cerradura + Códigos.
  - AC: resuelve la cerradura por `roomId` (listLocks) y los códigos por `lockId` (listCodes).
- [x] 1.2 Generar código para la reserva activa (si `reservationId`) y revocar códigos activos.
  - AC: generate/revoke recargan el panel y emiten `changed`.
- [x] 1.3 Estado vacío si la habitación no tiene cerradura asignada (link a /panel/cerraduras).

## Fase 2 — Integración en Planning
- [x] 2.1 Botón 🔒 por fila de habitación en `ReservationCalendar.vue`.
- [x] 2.2 `openRoomLock(room)` resuelve la reserva activa hoy (gRes) y abre el modal.
- [x] 2.3 `@changed` recarga el planning (refresca el badge 🔐 de la reserva).

## Fase 3 — Verificación
- [x] 3.1 `npx vue-tsc -b` → 0 errores en archivos nuevos/tocados.
- [x] 3.2 `bun --bun vite build` (build de prod) OK.
- [x] 3.3 Verificación visual en prod: 🔒 en el planning → modal con cerradura + códigos.
