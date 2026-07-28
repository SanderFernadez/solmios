# Change Proposal: deudas-tecnicas-pendientes

## Summary

Trackear formalmente las deudas técnicas que quedaban sueltas en la tabla "Deudas técnicas" del
`CLAUDE.md` del proyecto, y que **siguen reales tras verificar contra el código actual** (2026-07-24).
Dos de las cuatro filas candidatas resultaron ya resueltas en sesiones previas (el `CLAUDE.md` estaba
desactualizado, corregido en este mismo cambio) — quedan **2 deudas de ejecución + 1 bloqueada**.

## Motivation

El usuario pidió "crear las tareas de las deudas técnicas" para dejar de tenerlas como una nota en un
markdown y pasarlas a algo accionable/trackeable con el mismo proceso SDD que usa el resto del proyecto.

Antes de crear tareas para algo que YA no es cierto, se verificó cada fila candidata contra el código:

| Fila del CLAUDE.md | Estado real verificado | Acción |
|---|---|---|
| `electronic_invoicing.enabled` inalcanzable | **Ya resuelto.** `settings/index.vue` (tab Facturación electrónica) ya persiste el config como objeto `{enabled,...}`, no como array. No queda ningún seed/escritura vieja. | Corregido en `CLAUDE.md` (marcado ✅ RESUELTO), sin tarea. |
| PC-4 Service Worker desactivado | **Ya resuelto.** Commit `5857848` (#369 #370 #222) reactivó el SW con network-first + bypass `/api/*`. Código verificado en `frontend/public/sw.js` + `main.ts`. | Corregido en `CLAUDE.md` (marcado ✅ RESUELTO), sin tarea. |
| Search de facturas O(n) | **Sigue real.** `list-invoices.ts` (marcador `DT-07` ya en el código) trae toda la tabla del hotel y filtra en JS cuando hay `?search=`. | **DT-07** en este change. |
| Depósitos = ledger desconectado | **RESUELTO (2026-07-28, opción mínima viable).** `PaymentsService.createDeposit/refundDeposit/releaseDeposit` emiten `onDepositCreated/onDepositRefunded/onDepositReleased`; `connectors/payments-accounting.ts` los asienta como pasivo real (DR Bancos/CR Depósitos de Huéspedes) vía `recordDeposit`/`recordDepositRelease` — funciones que YA existían sin cablear. De paso se corrigió un bug preexistente en `recordDepositRelease` (`refundAmount ?? amount` nunca caía al fallback porque `refundAmount` tiene default 0, no `undefined`). Stripe real (hold con `capture_method:manual`) queda fuera, tal como se decidió. | **DT-08 cerrada** en este change. |
| Facturación electrónica (stub) | **Sigue real, pero bloqueada.** `fiscal.ts` tiene la estructura (`FiscalAdapter`) lista, pero el `stubFiscalAdapter` solo simula — implementarlo de verdad requiere credenciales/certificados de la autoridad fiscal del país (DGII para RD), igual que WhatsApp requiere creds Meta. No es trabajo de código puro. | **DT-09** en este change, marcada `blocked` (decisión de negocio: ¿qué país/autoridad priorizar?). |
| Combo POS no valida disponibilidad de sus componentes | **Nueva, aceptada 2026-07-27 en `carta-experiencia-avanzada`.** `order-lines.ts` (`addComboLine`) explota un combo en header+componentes sin chequear `item.available` ni la franja horaria (F6) de cada componente — un combo con un componente 86'd o fuera de horario se sigue vendiendo igual. Documentada como decisión de alcance (v1 simple), no un bug no detectado. | **DT-10** en este change. |
| `DepositsUseCase.refund()` sin lock de concurrencia | **Nueva, hallada por QA adversarial de DT-08 (2026-07-28).** Read-then-write sin lock optimista: dos refunds concurrentes sobre el mismo depósito leen el mismo `refundAmount` antes de que ninguno escriba, así que AMBOS pasan la validación de "no exceder el disponible" con su propia cuenta — test `deposits.test.ts` ("race", hallazgo NO resuelto) lo confirma con `rejected.length === 0`. Preexistente, no introducido por DT-08. | **DT-11** en este change. |

## Scope

### In Scope
- **DT-07**: mover el filtro `search` de facturas de JS a `WHERE` del repositorio (o a un índice/full-text si el adapter lo permite), preservando el contrato actual (`data/total/pages` sobre el conjunto filtrado completo, no solo la página cruda).
- ~~**DT-08**~~ **CERRADA** (2026-07-28) — ver tabla arriba.

### Out of Scope (bloqueado, no ejecutable ahora)
- **DT-09** Facturación electrónica real (DGII/DIAN/SAT) — requiere credenciales/certificados del país, decisión de negocio previa. Queda documentada, no implementada.
- **DT-10** Combo no valida disponibilidad de componentes — aceptada como deuda de alcance (`carta-experiencia-avanzada`, R2 de `design.md`), no bloqueada por nada externo; se implementa cuando el usuario decida priorizarla (agregar `assertAvailability` por componente en `addComboLine`, mismo criterio que ya usa el camino de ítem suelto).
- **DT-11** `DepositsUseCase.refund()` sin lock de concurrencia — arreglarla de verdad exige lock optimista (version field + compare-and-swap) o transacción atómica en el repo; no bloqueada por nada externo, es trabajo de diseño+código cuando se priorice.
- WhatsApp Business API — ya trackeado en `match-misterplan`, bloqueado por creds Meta. No se duplica acá.

## Rollback plan
DT-07 es un cambio acotado a un usecase, sin migración de schema destructiva. Revertir = `git revert`
del commit del sprint. DT-08 (cerrada): revertir = `git revert` de los 3 archivos tocados
(`payments/sockets.ts`, `payments/service.ts`, `connectors/payments-accounting.ts`) + el fix de
`recordDepositRelease` en `accounting/usecases/auto-from-events.ts` — no requiere migración de datos
(no se crearon columnas ni tablas nuevas, solo se cablearon eventos ya declarados).
