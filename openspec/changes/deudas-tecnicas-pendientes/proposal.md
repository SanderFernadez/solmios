# Change Proposal: deudas-tecnicas-pendientes

## Summary

Trackear formalmente las deudas técnicas que quedaban sueltas en la tabla "Deudas técnicas" del
`CLAUDE.md` del proyecto, y que **siguen reales tras verificar contra el código actual** (2026-07-24).
Dos de las cuatro filas candidatas resultaron ya resueltas en sesiones previas (el `CLAUDE.md` estaba
desactualizado, corregido en este mismo cambio). Estado final (2026-07-28): **DT-08 y DT-10 cerradas
· DT-07 y DT-11 bloqueadas de framework (investigado, no accionable sin SQL crudo o feature nueva del
framework) · DT-09 bloqueada por decisión de negocio · DT-12 nueva (hallada al verificar
contabilidad-tesoreria), documentada, sin impacto en prod hoy (0 facturas standalone existen)**.

**2026-07-29**: DT-13 (endpoint IDOR muerto, mitigado en prod). DT-14 a DT-19 nuevas — halladas al
re-auditar `mapa-modulos.html` conexión por conexión contra el código real: admin sin P&L
consolidado cross-hotel (DT-14), arqueo de caja sin asiento contable (DT-15), bank
`currentBalance` nunca se recalcula (DT-16), auditlog sin lectura desde el panel del hotel
(DT-17), cron de marketing no event-driven (DT-18), capacitación no pesa en el score de
desempeño #321 (DT-19). Todas requieren una decisión de producto antes de implementar (ninguna
es un bug urgente ni bloqueante) — quedan documentadas, no implementadas en esta pasada.

## Motivation

El usuario pidió "crear las tareas de las deudas técnicas" para dejar de tenerlas como una nota en un
markdown y pasarlas a algo accionable/trackeable con el mismo proceso SDD que usa el resto del proyecto.

Antes de crear tareas para algo que YA no es cierto, se verificó cada fila candidata contra el código:

| Fila del CLAUDE.md | Estado real verificado | Acción |
|---|---|---|
| `electronic_invoicing.enabled` inalcanzable | **Ya resuelto.** `settings/index.vue` (tab Facturación electrónica) ya persiste el config como objeto `{enabled,...}`, no como array. No queda ningún seed/escritura vieja. | Corregido en `CLAUDE.md` (marcado ✅ RESUELTO), sin tarea. |
| PC-4 Service Worker desactivado | **Ya resuelto.** Commit `5857848` (#369 #370 #222) reactivó el SW con network-first + bypass `/api/*`. Código verificado en `frontend/public/sw.js` + `main.ts`. | Corregido en `CLAUDE.md` (marcado ✅ RESUELTO), sin tarea. |
| Search de facturas O(n) | **BLOQUEADA de framework (confirmado 2026-07-28).** `RepositoryAdapter<T>.findMany/paginate/count` de `arckode-framework` solo acepta `filters: Record<string, unknown>` — igualdad exacta, sin operador `contains`/`LIKE`/`ILIKE`. El propio `list-invoices.ts` ya documenta esto en comentario. Mover el filtro a WHERE sin esa capacidad exige SQL crudo (prohibido) o un parche al framework (mismo criterio que el patch de Postgres, fuera de alcance). El código actual es la única implementación válida hoy, acotada por `hotelId` antes de escanear. | **DT-07** en este change, marcada `blocked`. |
| Depósitos = ledger desconectado | **RESUELTO (2026-07-28, opción mínima viable).** `PaymentsService.createDeposit/refundDeposit/releaseDeposit` emiten `onDepositCreated/onDepositRefunded/onDepositReleased`; `connectors/payments-accounting.ts` los asienta como pasivo real (DR Bancos/CR Depósitos de Huéspedes) vía `recordDeposit`/`recordDepositRelease` — funciones que YA existían sin cablear. De paso se corrigió un bug preexistente en `recordDepositRelease` (`refundAmount ?? amount` nunca caía al fallback porque `refundAmount` tiene default 0, no `undefined`). Stripe real (hold con `capture_method:manual`) queda fuera, tal como se decidió. | **DT-08 cerrada** en este change. |
| Facturación electrónica (stub) | **Sigue real, pero bloqueada.** `fiscal.ts` tiene la estructura (`FiscalAdapter`) lista, pero el `stubFiscalAdapter` solo simula — implementarlo de verdad requiere credenciales/certificados de la autoridad fiscal del país (DGII para RD), igual que WhatsApp requiere creds Meta. No es trabajo de código puro. | **DT-09** en este change, marcada `blocked` (decisión de negocio: ¿qué país/autoridad priorizar?). |
| Combo POS no valida disponibilidad de sus componentes | **CERRADA (2026-07-28).** `addComboLine` (`order-lines.ts`) ahora resuelve y valida TODOS los componentes (`available` + `isWithinAvailabilityWindow`) ANTES de crear ninguna fila — si uno falla, rechaza el combo completo con `ValidationError` identificando el componente por nombre. `comanda.vue` (`availableCombos`) ya no ofrece un combo cuyo backend lo rechazaría. 3 tests nuevos (86'd, fuera de franja, regresión cero). | **DT-10** en este change, cerrada. |
| `DepositsUseCase.refund()` sin lock de concurrencia | **BLOQUEADA de framework (confirmado 2026-07-28).** `RepositoryAdapter<T>.update()` no acepta condición/WHERE adicional (sin CAS posible). `orm.transaction()` existe pero el adapter de Postgres hace `BEGIN` liso sin `SELECT...FOR UPDATE` ni isolation level — envolver `refund()` en una transacción NO cierra la carrera bajo READ COMMITTED, sería una falsa sensación de fix. Un campo `version` tampoco sirve sin que `update()` soporte `WHERE id=? AND version=?`. Fix real requiere una feature nueva en el framework (`update(id, data, {expect: Partial<T>})`) o SQL crudo puntual (prohibido). El test "race" sigue documentando `rejected.length === 0` como hallazgo real — no se falseó el gate. | **DT-11** en este change, marcada `blocked`. |

## Scope

### Cerradas
- ~~**DT-08**~~ **CERRADA** (2026-07-28) — ver tabla arriba.
- ~~**DT-10**~~ **CERRADA** (2026-07-28) — ver tabla arriba.

### Bloqueadas de framework (investigado 2026-07-28, no ejecutable sin tocar `arckode-framework`)
- **DT-07** Search de facturas O(n) — `RepositoryAdapter<T>` no expone `LIKE`/`ILIKE`, solo igualdad exacta. Forzarlo exigiría SQL crudo (regla dura prohibida) o un parche al framework. Propuesta mínima si se decide encarar: pedir al framework un operador `contains` en `filters` (feature request), no un workaround local.
- **DT-11** `DepositsUseCase.refund()` sin lock de concurrencia — `RepositoryAdapter<T>.update()` no soporta condición/WHERE adicional (sin CAS); el `orm.transaction()` del adapter Postgres no aísla con `SELECT...FOR UPDATE`, envolver en transacción no cierra la carrera. Propuesta mínima si se decide encarar: pedir al framework `update(id, data, {expect: Partial<T>})` que devuelva `null` si 0 filas afectadas.

### Out of Scope (bloqueado por decisión de negocio, no por código)
- **DT-09** Facturación electrónica real (DGII/DIAN/SAT) — requiere credenciales/certificados del país, decisión de negocio previa. Queda documentada, no implementada.
- WhatsApp Business API — ya trackeado en `match-misterplan`, bloqueado por creds Meta. No se duplica acá.

## Rollback plan
DT-08 (cerrada): revertir = `git revert` de los 3 archivos tocados (`payments/sockets.ts`,
`payments/service.ts`, `connectors/payments-accounting.ts`) + el fix de `recordDepositRelease` en
`accounting/usecases/auto-from-events.ts` — no requiere migración de datos (no se crearon columnas
ni tablas nuevas, solo se cablearon eventos ya declarados). DT-10 (cerrada): revertir = `git revert`
del commit — cambio acotado a `order-lines.ts` + `comanda.vue`, sin schema ni migración.
