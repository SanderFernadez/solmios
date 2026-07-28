# Change Proposal: billing-money-consolidation

## Summary

El dinero del hotel se registra hoy en **cinco lugares distintos**, sin una fuente de verdad. La
consecuencia medida (no teórica): **un cobro en efectivo hecho desde `/panel/billing` nunca entra al
arqueo de caja ni a la conciliación bancaria.**

Esta propuesta consolida todo movimiento de dinero en la tabla `payments`, que ya existe, ya tiene las
columnas correctas (`invoiceId`, `folioId`, `method`, `stripePaymentId`, `reference`) y ya está
conectada a caja y a conciliación.

## Motivation

### Evidencia — reproducido en local (2026-07-08, SQLite, copia de `data/managerhotel.db`)

Turno de caja abierto. Se factura $200 + 20% impuesto = $240 y se cobra **en efectivo**:

```
POST /api/facturas            → INV-2026-0005, amount 240, status pending
POST /api/facturas/{id}/pay   → { method: "cash", amount: 240 }   → status paid ✅

ANTES   cash_movements = 1   payments = 3
DESPUÉS cash_movements = 1   payments = 3     ← el dinero NO existe para la caja
```

Lo único que se escribió fueron dos filas en `invoices`:

| invoiceNumber | type | amount | status | paymentMethod |
|---|---|---|---|---|
| PAY-1783561682673 | payment | 240 | paid | cash |
| INV-2026-0005 | invoice | 240 | paid | cash |

**Control** — el mismo cobro ($240, efectivo) por el módulo `payments`:

```
POST /api/payments  → { type: charge, method: cash, amount: 240, status: completed }
ANTES   cash_movements = 1
DESPUÉS cash_movements = 2     ← la caja SÍ lo registra
```

El connector `payments-caja` funciona. Lo que está roto es que `facturas.pay()` no pasa por él:
escribe su propio comprobante `type:'payment'` dentro de `invoices` y no emite ningún evento.

### Las cinco fuentes de verdad del dinero

| Consumidor | Lee de | Consecuencia |
|---|---|---|
| Facturación (`/panel/billing`) | `invoices` | — |
| Arqueo de caja | `payments` (vía connector) | **no ve los cobros de facturas** |
| Conciliación bancaria | `payments` | **no ve los cobros de facturas** |
| Reportes | `reservations.totalAmount` | reporta lo *pactado*, no lo *cobrado* |
| Saldo del folio | `folio_charges` (`kind='payment'`) | libro auxiliar, correcto |

### Daños concretos

1. **El arqueo de caja no cuadra.** Efectivo cobrado en facturación no entra al turno.
2. **La conciliación bancaria es incompleta.** `payments/usecases/reconciliation.ts` cruza el extracto
   contra `payments`; un cobro con tarjeta hecho desde facturación nunca aparece.
3. **No se puede reembolsar.** `payments.refundPayment()` exige `stripePaymentId`. Un cobro registrado
   en `invoices` no tiene forma de devolverse por el flujo existente.
4. **Se pierde el método de pago.** `invoices.paymentMethod` es **una sola columna**: si el huésped paga
   mitad tarjeta y mitad efectivo, el segundo pago pisa al primero.
5. **El doble conteo puede volver.** Hoy los ingresos son correctos porque `usecases/stats.ts` filtra
   `type === 'invoice'`. Depende de que cada dev nuevo se acuerde del filtro. Ver commit `37af3ca`.

### Tipos muertos

`InvoiceType` declara `'folio'` y `'receipt'`. **Ninguna línea del backend ni del frontend crea filas con
esos tipos** — sobreviven en el enum, en `validators/schema.ts` y en el `TYPE_MAP` del frontend.

## Scope

### In Scope

1. **`facturas.pay()` registra el pago en `payments`** vía connector `facturas-payments`, en vez de
   crear un comprobante `type:'payment'` dentro de `invoices`. Esto cierra el agujero de caja y el de
   conciliación de una sola vez, porque `payments` ya emite `onPaymentCompleted`.
2. **`folios.applyPayment()` registra el pago en `payments`.** La línea en `folio_charges` se mantiene:
   es el libro auxiliar que calcula el saldo del folio, y es correcta. Lo que falta es el asiento del
   dinero.
3. **Migración de datos** — las filas `invoices.type = 'payment'` existentes se mueven a `payments`,
   preservando `invoiceId`, método, monto y fecha. Idempotente, con verificación de sumas.
4. **Limpieza del enum** — `InvoiceType` queda en `'invoice' | 'credit_note'`.
5. **El tab "Pagos" del frontend** lee de `/api/payments`, no de `/facturas?type=payment`.

### Out of Scope

- Unificar la fuente de los **reportes** (`reservations.totalAmount` → `payments`). Es un cambio de
  semántica de producto (¿ingreso proyectado o cobrado?) que necesita decisión del dueño, no una
  migración técnica. Se documenta como deuda.
- Facturación electrónica real (`usecases/fiscal.ts` sigue siendo stub).
- El NCF que se emite siempre. Se arregla aparte — bloquea el borrado de borradores.

## Risk & Rollback

**Riesgo: alto.** Toca la tabla `invoices` en producción, donde ya hay filas `type='payment'`.

Mitigaciones:
- La migración **copia** a `payments`; no borra de `invoices` hasta una segunda fase verificada.
- El script compara la suma total de dinero antes y después, y aborta si difiere en un centavo.
- Dedup por `reference` + `invoiceId` para poder correrla dos veces sin duplicar.

**Rollback:** las filas migradas llevan `metadata.migratedFrom = 'invoices'`. Revertir es
`DELETE FROM payments WHERE metadata->>'migratedFrom' = 'invoices'` y volver el código al commit previo.
Los datos originales en `invoices` no se tocan en esta fase.

## Success Criteria

- Cobrar una factura en efectivo incrementa `cash_movements` en el turno abierto.
- Cobrar una factura con tarjeta la hace aparecer en la conciliación bancaria.
- Un cobro parcial con tarjeta + otro en efectivo quedan como dos filas en `payments` con su método.
- `getFacturasStats` sigue dando los mismos números (los ingresos no cambian de valor).
- `arckode analyze` sin violaciones; tests verdes; suma de dinero pre-migración == post-migración.
