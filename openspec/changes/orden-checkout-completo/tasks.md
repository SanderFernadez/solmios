# Tasks: orden-checkout-completo

## Fase 1 — Backend: comprobante siempre (#1)

- [ ] 1.1 En `settle-folio-at-checkout.ts`, leer `chargesTotal` del folio enriquecido.
  - AC: si `chargesTotal <= 0` → cerrar sin factura (comportamiento del folio vacío).
- [ ] 1.2 Cuando `chargesTotal > 0`, emitir factura vía `closeAndCreateInvoice` también en el
      branch de saldo 0.
  - AC: un check-out que salda el total devuelve `invoiceId`/`invoiceNumber` no nulos.
- [ ] 1.3 Test backend: `settleFolioAtCheckout` con pago total → factura `paid`; con folio
      sin cargos → sin factura; con saldo → factura `pending` (regresión).
  - AC: `bun test` verde.

## Fase 2 — Frontend: alta de consumos en check-out (#4)

- [ ] 2.1 Agregar en el modal de check-out (`checkin/index.vue`) un formulario de consumo
      (descripción, monto, categoría) que llama `FoliosService.charge`.
  - AC: postea el cargo y recarga el folio (saldo actualizado).
- [ ] 2.2 Validación cliente: monto > 0 y descripción no vacía; toast de error si no.
  - AC: no se postea un cargo inválido.

## Fase 3 — Frontend: guarda de deuda en check-out (#5)

- [ ] 3.1 En `confirmCheckout`/`doCheckout`, si `balance > 0` y no hay `settleMethod`,
      pedir confirmación con el monto de la deuda antes de proceder.
  - AC: sin confirmar no se hace check-out; confirmando sí.
- [ ] 3.2 El check-out saldado (balance 0 o método que cubre) NO pide confirmación extra.
  - AC: flujo sin fricción cuando no hay deuda.

## Fase 4 — Verificación end-to-end

- [ ] 4.1 `cd backend && bun run typecheck && bun test` (0 fallos).
- [ ] 4.2 `bun run node_modules/arckode-framework/bin/arckode.js analyze` → 0 violaciones.
- [ ] 4.3 `cd frontend && npx vue-tsc --noEmit` (0 errores en archivos tocados).
- [ ] 4.4 Run end-to-end en prod: crear reserva → check-in → agregar consumo desde check-in
      → check-out pagando total → verificar comprobante `paid` emitido → limpiar datos.
