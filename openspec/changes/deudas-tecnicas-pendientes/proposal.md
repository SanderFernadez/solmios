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
| Depósitos = ledger desconectado | **Sigue real.** `payments/usecases/deposits.ts` — `create/refund/release` son mutaciers de estado puras (`stripePaymentId: ''` siempre), no tocan Stripe ni la tabla `payments`. | **DT-08** en este change. |
| Facturación electrónica (stub) | **Sigue real, pero bloqueada.** `fiscal.ts` tiene la estructura (`FiscalAdapter`) lista, pero el `stubFiscalAdapter` solo simula — implementarlo de verdad requiere credenciales/certificados de la autoridad fiscal del país (DGII para RD), igual que WhatsApp requiere creds Meta. No es trabajo de código puro. | **DT-09** en este change, marcada `blocked` (decisión de negocio: ¿qué país/autoridad priorizar?). |

## Scope

### In Scope
- **DT-07**: mover el filtro `search` de facturas de JS a `WHERE` del repositorio (o a un índice/full-text si el adapter lo permite), preservando el contrato actual (`data/total/pages` sobre el conjunto filtrado completo, no solo la página cruda).
- **DT-08**: conectar el ciclo de vida de depósitos (`create`/`refund`/`release`) a un cobro real — como mínimo, que un depósito capturado en efectivo/tarjeta cree un registro en `payments` (ledger real) y que `refund` revierta ese registro. Stripe real (capturar con `payment_intent` + `capture_method: manual`) queda como sub-tarea si el usuario decide integrarlo end-to-end.

### Out of Scope (bloqueado, no ejecutable ahora)
- **DT-09** Facturación electrónica real (DGII/DIAN/SAT) — requiere credenciales/certificados del país, decisión de negocio previa. Queda documentada, no implementada.
- WhatsApp Business API — ya trackeado en `match-misterplan`, bloqueado por creds Meta. No se duplica acá.

## Rollback plan
Ambas tareas (DT-07, DT-08) son cambios acotados a un usecase cada una, sin migración de schema
destructiva. Revertir = `git revert` del commit de cada sprint. DT-08 si conecta Stripe real, requiere
probar en modo test antes de producción (mismo criterio que el webhook de Stripe ya en prod).
