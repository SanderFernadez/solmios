# Change Proposal: ttlock-auto-codes-toggle

## Estado: ✅ CERRADO (verificado 2026-07-28)

Implementado y commiteado (`a730cee` y relacionados). Verificado contra el código real: columna
`autoCodesEnabled` en `ttlock/model.ts:16` (default `true`, filas viejas en NULL se tratan como
habilitado), lógica de skip en `service.ts:131`, toggle expuesto en `RoomLockModal.vue:253,349-350`.
`bun test src/modules/ttlock/` → 67/67 pass. El tasks.md nunca se creó/actualizó, se cierra desde acá.

## Summary

Toggle **por cerradura** para prender/apagar la generación automática del código al pagarse la seña.
Cuando está apagado, el flujo automático (connector `payment-requests-ttlock` → `generateCodeIfAbsent`)
NO genera el PIN para reservas de la habitación de esa cerradura. El **botón manual** sigue generando
siempre (`generateCode` no pasa por el toggle). Se opera desde el modal por habitación del Planning.

Es el único ítem de la lista TTLock que requería **migración** (columna nueva).

## DB — migración

- Campo nuevo en el modelo `LockDevices` (tabla `lock_devices`): **`autoCodesEnabled`** boolean, default
  `true`. El ORM mapea `type:'boolean'` → columna **INTEGER (0/1)** en ambos motores.
- Migración: `RUN_MIGRATE=1 bun run src/composition-root.ts` hace **`ADD COLUMN`** (fw 1.6.2+). Filas
  existentes quedan en NULL → se tratan como **habilitado** (la lógica solo apaga con `=== false`), así
  el comportamiento previo (auto-códigos ON) se conserva sin backfill.
- En prod (Postgres) usar el bun completo: `/root/.bun/bin/bun`, con `.env` cargado.

## API / lógica

- `PUT /api/ttlock/lock/:id` (`updateLock`) ahora acepta `autoCodesEnabled` (validado boolean).
- `generateCodeIfAbsent(hotelId, reservationId)`: tras la guarda de idempotencia, resuelve la cerradura
  de la habitación de la reserva; si `autoCodesEnabled === false`, retorna `{skipped, reason:'auto-disabled'}`.

## UI

- `RoomLockModal` (Planning), tab Cerradura: switch "Códigos automáticos (al pagar la seña)" →
  `updateLock(lockId, { autoCodesEnabled })`. ON salvo que sea explícitamente false.

## Rollback plan

- Código: revertir el commit (métodos aditivos + un branch en `generateCodeIfAbsent`).
- Schema: la columna `autoCodesEnabled` queda; es inocua (default true / NULL = ON). No hace falta
  dropearla para revertir el comportamiento.
