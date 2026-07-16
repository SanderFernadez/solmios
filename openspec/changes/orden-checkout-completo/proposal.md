# Change Proposal: orden-checkout-completo

## Summary

Cerrar tres huecos del ciclo de vida de una orden (reserva → estadía → cobro) detectados
al correr el flujo **end-to-end en producción** el 2026-07-16. El motor del PMS funciona,
pero tres comportamientos hacen que la "orden completa" no cierre de forma correcta desde
el panel del hotel admin:

| # | Hueco | Impacto operativo |
|---|-------|-------------------|
| 1 | Pagar el total en el check-out **no emite comprobante** | Una estadía saldada al 100% no deja factura para el huésped |
| 4 | No se pueden **cargar consumos desde la pantalla de check-in** | Room service / minibar solo se cargan en `/folios` (fricción) |
| 5 | El check-out **no avisa si el huésped se va con deuda** | Se cierra la orden con saldo abierto sin alerta |

Equivalente MisterPlan: el checkout de un PMS estándar (MisterPlan/Cloudbeds) **siempre**
produce un comprobante de la cuenta y bloquea/avisa ante saldo pendiente; el desk puede
cargar consumos sobre el folio del huésped in-house sin cambiar de pantalla.

## Motivation

Evidencia `file:line` del run end-to-end:

**#1 — check-out sin factura al pagar el total.**
`backend/src/shared/usecases/settle-folio-at-checkout.ts:53-62`: si tras el pago `balance <= 0`,
llama `folios.close(folio.id)` y retorna `invoiceId: null`. Solo el branch con saldo (`:68`)
emite factura vía `closeAndCreateInvoice`. Resultado verificado: un checkout que salda $205
cerró el folio con `invoiceId: null` — sin comprobante.

**#4 — sin alta de cargos en `/checkin`.**
`frontend/src/pages/checkin/index.vue` muestra el folio en el modal de check-out
(`:461-484`) pero no tiene acción para agregar cargos; el alta vive solo en
`frontend/src/pages/folios/index.vue` (`FoliosService.charge`, `Folios.service.ts:63`).

**#5 — check-out con deuda sin aviso.**
`frontend/src/pages/checkin/index.vue:965-972` (`doCheckout`): si `balance > 0` y no hay
`settleMethod`, arma `settle = null` y hace el check-out igual. El botón (`:514`) está
habilitado sin importar el saldo → el huésped sale con deuda sin confirmación.

## Scope

- **IN**: emitir comprobante siempre que haya cargos (aunque el saldo sea 0); alta de
  consumos desde el modal de check-out; confirmación explícita al cerrar con saldo pendiente.
- **OUT** (documentado como follow-up, requiere dependencias externas):
  - Cobro real de tarjeta por Stripe en el mostrador (Stripe Terminal / card-on-file).
  - Facturación electrónica NCF/DGII (stub `facturas/usecases/fiscal.ts`, requiere credenciales).

## Rollback plan

- **#1** es una sola función (`settle-folio-at-checkout.ts`). Rollback = restaurar el branch
  `balance <= 0 → folios.close()`. Sin cambios de schema ni datos: revertir el commit alcanza.
- **#4 / #5** son cambios de frontend en una sola vista. Revertir `checkin/index.vue`.
- No hay migraciones ni cambios de contrato de API (se reutiliza `POST /folios/:id/charges`).

## Riesgos

- **#1**: crear factura sobre un folio pagado NO vuelve a mover dinero — `closeAndInvoice`
  hereda `amountPaid = paymentsTotal` (`close-and-invoice.ts:91`) y NO llama a `facturas.pay()`.
  Riesgo residual: si el hotel tiene tasa de impuesto configurada y los cargos vienen con
  `taxes:0`, la factura recalcula impuesto sobre el subtotal y podría quedar `pending`
  (gap pre-existente del manejo de impuestos del folio, NO introducido acá). Con tasa 0 el
  comprobante queda `paid`.
- **Folio sin cargos** (roomRate 0, sin extras): NO se emite comprobante (nada que facturar)
  → se conserva el cierre sin factura para ese caso.
