# Tasks — Deudas técnicas pendientes

Estado final (2026-07-28): DT-08 y DT-10 cerradas · DT-07 y DT-11 bloqueadas de framework (investigado,
requeriría SQL crudo prohibido o una feature nueva del framework) · DT-09 bloqueada por decisión de
negocio · DT-12 nueva, documentada, no bloqueante. Cada sprint ejecutado: implementar → gates
(`arckode analyze` 0 violaciones · `bun test` · typecheck) → QA adversarial → commit quirúrgico.
DT-13 nueva (2026-07-29) — mitigada en prod, código muerto pendiente de borrar.
DT-14 a DT-19 nuevas (2026-07-29) — halladas al re-auditar `mapa-modulos.html` conexión por
conexión contra el código real (no contra la prosa del mapa, que en 2 casos estaba stale — ver
fixes de `usuarios`/`capacitacion` en el mismo commit). Todas verificadas con grep antes de
crearlas, ninguna es una suposición.

## DT-19 — Capacitación completada no pesa en el score de desempeño (#321) — ✅ CERRADA (2026-07-29)

Hallada al re-auditar el nodo `capacitacion` del mapa (2026-07-29). El connector
`capacitacion-empleados` (`onEnrollmentCompleted`) deja un documento `training` en el expediente
del empleado — pero `empleados/usecases/auto-evaluation.ts` (el motor de scoring #321, que SÍ
tiene una fórmula real y ponderada: productividad + calidad + puntualidad + asistencia +
mantenimiento, renormalizada si falta data) **no referencia capacitación/training en ningún
lado** (`grep -rn "training\|capacitacion" auto-evaluation.ts` → 0 hits). Un curso completado no
sube ni baja el score de nadie, solo queda como registro histórico.

- [x] 19.1 Decidido: capacitación pasa a ser un criterio más de la fórmula (peso 15, menor que
      maintenance/30 por ser señal de desarrollo, no productividad operativa dura). Un empleado
      sin cursos en el período no se ve afectado (renormalización).
- [x] 19.2 Nuevo criterio `training` en `auto-evaluation.ts` (mismo patrón que `maintenanceScore`):
      score = promedio de la nota (0-100) de los cursos completados en el período; sin
      completados o sin nota cargada → `hasData:false`. Nuevo `capacitacion/usecases/stats.ts`
      (`getStaffStats`) + connector `empleados-capacitacion.ts` (join por `profile.id`, NO
      `profile.userId` — `capacitacion.employeeId` ya es `EmployeeProfile.id`).
- [x] 19.3 Gate: `arckode analyze` ✅ VÁLIDO · `bun test` 2533/2533 (5 tests nuevos) · typecheck
      backend limpio. Sin migración de DB. Commit `9c08650`, pusheado a `main`.

## DT-18 — Marketing: cron de auto-messages no es event-driven

Hallada al re-auditar el nodo `marketing` (2026-07-29). Confirmado en
`composition-root.ts:630-631` + `marketing/service.ts:148`: el cron corre cada 1h
(`AUTO_MESSAGES_TICK_MS`) y evalúa la condición completa (`checkIn=today AND status=confirmed`,
etc.) sobre TODAS las reservas — no se dispara puntualmente por el evento real
(checkin/checkout/booking confirmado). Riesgo: un auto-mensaje puede salir hasta 1h después del
evento que lo motiva, o evaluar de más en cada corrida.

- [ ] 18.1 Decidir alcance: ¿mover los triggers de `auto_messages` con `triggerType='event'` a
      connectors reales (ej. `reservas-marketing.ts` escuchando `onReservationConfirmed`), dejando
      el cron solo para los de `triggerType='cron'` (recordatorios por fecha, no por evento)?
- [ ] 18.2 Si se decide: nuevo connector + filtrar el cron para que NO reprocese los que ya
      pasaron a ser event-driven (evitar doble envío).
- [ ] 18.3 Gate: `arckode analyze` + `bun test` + typecheck.

## DT-17 — Auditlog sin vista de lectura desde el panel del hotel

Hallada al re-auditar el nodo `auditlog` (2026-07-29). Confirmado: `frontend/src/router/index.ts`
no tiene ninguna ruta `auditoria`/`audit-log` bajo `/panel/*` — solo `/admin/*` (plataforma) puede
leer el log. Un `hotel_admin` no tiene forma de ver quién borró qué en su propio hotel.

- [ ] 17.1 Decidir: ¿el hotel_admin debería ver su propio audit log (filtrado por su hotelId), o
      es intencional que solo la plataforma lo audite (para que un hotel_admin comprometido no
      pueda "limpiar" el rastro de sus propias acciones sensibles)? Esto es una decisión de
      seguridad, no solo de producto — dar visibilidad podría ir en contra del propósito original
      del audit log (trazabilidad ANTE el hotel, no solo para el hotel).
- [ ] 17.2 Si se decide exponerlo: página `frontend/src/pages/auditoria/index.vue` (solo-lectura)
      + endpoint que filtre por `hotelId` del JWT (nunca cross-tenant).
- [ ] 17.3 Gate: `arckode analyze` + `bun test` + typecheck.

## DT-16 — Tesorería: `bank_accounts.currentBalance` nunca se recalcula post-creación — ✅ CERRADA (2026-07-29)

Hallada al re-auditar el nodo `tesoreria` (2026-07-29). Confirmado en
`treasury/usecases/bank.ts:42`: `currentBalance` se setea UNA vez al crear la cuenta
(`currentBalance: opening`) y ningún otro código del módulo lo vuelve a tocar. La liquidez real
que ve el hotelero (cash flow, AR/AP) se computa aparte leyendo `payments`/`expenses`
directamente (mismo patrón que `reports`, sin duplicar datos) — así que el dato mostrado en
pantalla es correcto, pero la COLUMNA `currentBalance` de la cuenta bancaria queda
permanentemente desactualizada si alguien la consulta directo (ej. un reporte futuro, un export,
una integración externa).

- [x] 16.1 Decidido: SÍ recalcular (no sacar el campo — se usa en el listado de cuentas del
      panel). `currentBalance = openingBalance + suma firmada de todos los movimientos
      importados` (ya vienen firmados: +entrada/−salida).
- [x] 16.2 `recalcBalance()` en `bank.ts`, disparado al importar movimientos (solo si entró
      alguno nuevo) y al editar `openingBalance` de la cuenta.
- [x] 16.3 Gate: `arckode analyze` ✅ VÁLIDO · `bun test` 2536/2536 (3 tests nuevos) · typecheck
      backend limpio. Sin migración (columna ya existía). Commit `d7d4e83`, pusheado a `main`.

## DT-15 — Cash: diferencia de arqueo del turno no genera asiento contable — ✅ CERRADA (2026-07-29)

Hallada al re-auditar el nodo `contabilidad` (2026-07-29). Confirmado: no existía ningún connector
`cash-accounting`. Cuando `cash/usecases/reconcile.ts` detectaba un sobrante o faltante al
cerrar un turno de caja, esa diferencia quedaba registrada en `cash_shifts`/`cash_movements` pero
**nunca generaba un asiento en la contabilidad de doble entrada** — el libro mayor no reflejaba el
descuadre real de caja.

- [x] 15.1 Diseñado sin crear cuentas nuevas: el plan de 36 ya tenía `4.3.01 Otros Ingresos`
      (sin uso hasta ahora, perfecto para el sobrante) y `5.3.01 Gastos Administrativos`
      (`ACC.GASTO_ADMIN`, ya usado por gastos sin categoría propia, reusado para el faltante).
      Faltante: DR Gasto Administrativo / CR Caja. Sobrante: DR Caja / CR Otros Ingresos.
- [x] 15.2 Connector `cash-accounting.ts` (mismo molde que `payments-accounting.ts`): escucha
      `caja.onShiftClosed` — el shift ya trae `difference` calculado y persistido por
      `closeShift` ANTES de emitir el socket, no hizo falta tocar el módulo `cash`.
      `recordCashDifference` en `accounting/usecases/auto-from-events.ts` hace no-op si
      `difference === 0`.
- [x] 15.3 Test (`accounting/tests/service.test.ts`): faltante → asiento correcto, sobrante →
      asiento correcto, arqueo cuadrado (difference=0) → sin asiento. 3/3 verdes.
- [x] 15.4 Gate: `arckode analyze` ✅ VÁLIDO (0 violaciones) · `bun test` 2528/2528 · typecheck
      backend limpio. Sin migración de DB (reusa tablas y cuentas ya seedeadas). Commit `8c96a62`,
      pusheado a `main`.

## DT-14 — Admin (plataforma) sin vista de P&L consolidado cross-hotel

Hallada al re-auditar el nodo `admin` (2026-07-29). Confirmado: `super-admin/consolidated.vue`
(PC-2.2) da KPIs operacionales por hotel (MRR, ocupación, ADR, reservas del mes) pero NINGUNA
vista agrega ingresos−gastos−neto (P&L real) across todos los hoteles de la plataforma — solo
existe P&L POR hotel (dentro de `contabilidad`, aislado por `hotelId`). Un super_admin no tiene
forma de ver la rentabilidad consolidada de la plataforma completa desde un solo lugar.

- [ ] 14.1 Decidir alcance: ¿el P&L consolidado suma los P&L de contabilidad de cada hotel (solo
      para hoteles con el módulo `accounting` activo), o es un cálculo aparte más simple
      (revenue−gastos desde `reports`, sin depender de que el hotel tenga contabilidad activada)?
- [ ] 14.2 Si se decide: nuevo usecase en `admin/usecases/` que agregue por hotel y sume, página
      `super-admin/pnl-consolidado.vue` (o extender `consolidated.vue`).
- [ ] 14.3 Gate: `arckode analyze` + `bun test` + typecheck.

## DT-13 — Endpoint público viejo con IDOR sigue en el código, "seguro" por casualidad

Hallada al verificar `solmi-direct-booking` F0 task 0.14 (2026-07-29). `GET /api/public/bookings/:id`
(`bookingengine/index.ts:173-184`) expone cualquier reserva por UUID sin ownership check — es el
endpoint que 0.14 reemplazó por `GET /api/public/reservations/:id?token=X` (HMAC), pero el viejo
NUNCA se borró: queda vivo detrás del flag `useUnifiedBookingFlow()` (`usecases/unified-flow.ts`),
cuyo default en prod es `false` (IDOR **activo**) salvo `BOOKING_USE_UNIFIED_FLOW=true` explícito —
por diseño ("prod queda en flujo viejo hasta activarlo explícito", rollback plan de F0 0.12).

**El bug real**: nadie seteó `NODE_ENV` en el `.env`/systemd de prod, así que
`process.env.NODE_ENV !== 'production'` daba `true` — el flag quedaba en `true` (seguro) por la
AUSENCIA de una variable, no por una decisión explícita. Cualquier setup futuro de `NODE_ENV=production`
(práctica estándar) habría reactivado el IDOR en silencio.

**Mitigado en prod 2026-07-29**: se agregó `BOOKING_USE_UNIFIED_FLOW=true` explícito al `.env` de
prod. Verificado post-restart: `GET /api/public/bookings/:id` → **410 Gone** (ya no depende de que
`NODE_ENV` quede sin setear).

- [ ] 13.1 Borrar el branch muerto completo: el `if (useUnifiedBookingFlow())` + el código detrás
      (`controller.getBooking`/`createCheckoutSession` para el flujo plural) en
      `bookingengine/index.ts` y `controller.ts`. El flag y `unified-flow.ts` dejan de tener
      motivo de existir una vez borrado (nada vuelve a leer `BOOKING_USE_UNIFIED_FLOW`).
      **No se hizo en esta pasada**: el módulo `bookingengine` está siendo editado activamente
      por otra sesión en paralelo (wallet-pass/tracking/abandon-recovery tocan archivos
      cercanos) — tocarlo ahora arriesga un conflicto de merge en vivo.
- [ ] 13.2 Gate: `arckode analyze` (el repo sin uso de un flag muerto no debería violar nada,
      pero confirmar) + `bun test` + typecheck, ambos lados.

## DT-12 — Factura standalone (sin folio) no devenga ingreso automáticamente

Hallada en verificación de `contabilidad-tesoreria` (2026-07-28). `recordFolioCharge`
(`accounting/usecases/auto-from-events.ts:71-87`) asienta el devengo (DR Clientes / CR Ingresos +
ITBIS) al postear un cargo de FOLIO — pero una factura creada vía `POST /api/facturas` sin folio
(standalone) no tiene conector `facturas-accounting.ts` equivalente: solo se asienta el COBRO
(DR Caja/CR Clientes) al pagarla, nunca el devengo. Eso dejaría un crédito fantasma en la cuenta
Clientes si existiera una factura así.

**Verificado sin impacto actual**: `SELECT count(*) FROM invoices WHERE reservationid IS NULL AND
type='invoice'` → **0** en prod. El único flujo real usado es folio→factura
(`close-and-create-invoice.ts`), que ya devenga correctamente vía el folio antes de facturarse.

- [ ] 12.1 Decidir: ¿una factura standalone debe devengar al CREARSE (`POST /api/facturas`) o al
      EMITIRSE/confirmarse? Depende de si el producto permite facturas standalone en estado
      `draft` (sin devengar) — chequear `facturas/usecases/create-invoice.ts` y el flujo real de UI.
- [ ] 12.2 Si se decide devengar al crear: nuevo conector `connectors/facturas-accounting.ts` +
      función `recordInvoiceIssued` en `auto-from-events.ts` (mismo patrón que `recordFolioCharge`:
      DR Clientes / CR Ingresos (neto) / CR ITBIS por pagar, derivando el neto del total para que
      SIEMPRE cuadre).
- [ ] 12.3 Test: crear factura standalone → asiento de devengo; pagarla → asiento de cobro; Clientes
      neteado a 0 (sin doble conteo con `recordPaymentCompleted`).
- [ ] 12.4 Gate: `arckode analyze` 0 violaciones · `bun test` · typecheck.

## DT-07 — Search de facturas: mover filtro a WHERE del repo — ⛔ BLOQUEADA DE FRAMEWORK (investigado 2026-07-28)

### DT-07.1 — Diagnóstico + diseño
- [x] 1.1 Confirmado contra `node_modules/arckode-framework/kernel/db/types.ts:52-64`:
      `RepositoryAdapter<T>.findMany/paginate/count` solo acepta `filters?: Record<string, unknown>`
      — **igualdad exacta**, sin ningún operador `contains`/`like`/`ilike`. `list-invoices.ts:56-59`
      ya documenta esto en comentario explícito. **No hay diff que aplicar** sin violar la regla
      dura "nunca SQL crudo en services/usecases" o sin parchear el framework (mismo criterio que
      el patch de Postgres del proyecto, fuera de alcance de este change). Es una limitación real
      del framework, no un bug de implementación — el código actual, acotado por `hotelId` antes de
      escanear, es la única implementación válida disponible hoy.
- [x] 1.2 No aplica (bloqueado antes de llegar a esta decisión de UX).

### DT-07.2 — Implementación
No ejecutable. Ver 1.1.

### DT-07.3 — QA + gate
No aplica — nada que verificar sobre un cambio que no se hizo. Si en el futuro el framework agrega
un operador `contains`/`like`, reabrir esta tarea desde 1.2.

## DT-08 — Depósitos: conectar el ledger real ✅ CERRADA (2026-07-28, opción A mínima viable)

Usuario eligió (A). Implementado SIN crear un `payment` genérico tipo `deposit` (como decía 1.1
originalmente) — en su lugar se cablearon `onDepositCreated/onDepositRefunded/onDepositReleased`
(ya declarados en `PaymentsSockets`, sin usar) a `recordDeposit`/`recordDepositRelease` (ya
escritas en `accounting/usecases/auto-from-events.ts`, sin cablear). Es más correcto contablemente:
un depósito es un PASIVO (Depósitos de Huéspedes), no un ingreso — mezclarlo en `payments` con
`recordPaymentCompleted` (que asume "cobro") habría requerido lógica extra para no contarlo como
venta. `recordPaymentCompleted` ya tenía el guard `type !== 'charge' → return`, confirmando que
el propio código anticipaba este camino separado.

**Archivos tocados**: `payments/sockets.ts` (+`onDepositRefunded`), `payments/service.ts`
(createDeposit/refundDeposit/releaseDeposit/releaseHeldDepositsByReservation emiten los 3 eventos;
refundDeposit sintetiza el DELTA de la operación como `{amount:delta, refundAmount:0}`, no el
`refundAmount` acumulado — evita doble-conteo en refunds parciales sucesivos),
`connectors/payments-accounting.ts` (cablea los 3 eventos), `accounting/usecases/auto-from-events.ts`
(**bug preexistente corregido**: `recordDepositRelease` usaba `refundAmount ?? amount`, pero
`refundAmount` tiene default `0` — nunca `null`/`undefined` — así que el fallback NUNCA se
disparaba; el caso más común, liberar sin refund previo, quedaba sin asentar. Fórmula corregida a
`amount - refundAmount`, el REMANENTE en custodia).

**Tests nuevos**: `payments/tests/service.test.ts` (+5), `connectors/tests/financieros-connectors.test.ts`
(+4, incluye el caso "release tras refund parcial asienta el remanente, no el original"),
`payments/tests/deposits.test.ts` (nuevo, 7 tests, QA adversarial completo de 3.1).

**Gate verde**: `arckode analyze` 0 violaciones, `bun test` 2116/2116 (0 fail), typecheck sin
errores nuevos (9 baseline preexistentes ajenos en `scripts/e2e/`).

### DT-08.1 — Diseño (requiere decisión de alcance del usuario)
- [x] 1.1 Presentar 2 opciones y que el usuario elija antes de tocar código:
      **(A) Mínimo viable**: al `create()` un depósito con método `cash`/`card` ya cobrado por otro
      medio, crear un `payment` tipo `deposit` en la tabla `payments` (ledger real, aparece en caja/
      contabilidad); `refund()`/`release()` revierten ese `payment`. NO usa Stripe hold real — el
      depósito se sigue registrando manualmente como hoy, pero al menos DEJA RASTRO en el dinero real.
      **(B) Stripe real (manual capture)**: `create()` abre un `PaymentIntent` con
      `capture_method: 'manual'` (autoriza sin cobrar) vía `StripeUseCase` (ya existe, usado en
      `charge-card.ts` para cobros normales — necesita extenderse, hoy solo hace Checkout Sessions
      auto-capture). `release()` cancela el intent (libera el hold sin cobrar). Un
      "cobro" real de la garantía sería un `capture` parcial/total. Bloqueado por: el hotel necesita
      pasarela Stripe configurada (`stripe.isConfigured`), y el flujo de garantía con hold real es
      material nuevo no probado en este proyecto — mayor riesgo, más alcance.
- [x] 1.2 Confirmar con el usuario cuál opción implementar (A es 1 sprint, B es varios y depende de
      Stripe funcionando en el hotel). **Elegida: (A).**

### DT-08.2 — Implementación (según lo decidido en 1.1)
- [x] 2.1 Conectar `create`/`refund`/`release` al mecanismo elegido — vía eventos + asiento contable
      directo (pasivo), no vía un `payment` genérico (ver nota arriba, más correcto contablemente).
- [x] 2.2 `connectors/payments-accounting.ts` reacciona a los 3 eventos de depósito — no duplica
      lógica, reusa `recordDeposit`/`recordDepositRelease` ya escritas.
- [ ] 2.3 Si (B): no aplica — no elegida.
- [x] 2.4 Tests: crear depósito → dispara asiento (DR Bancos/CR Depósitos de Huéspedes); refund
      revierte solo su delta; release no cobra nada (amount no cambia, solo status/releasedAt).

### DT-08.3 — QA + gate
- [x] 3.1 QA adversarial (`deposits.test.ts`): doble-refund (rechaza el 2º si excede lo disponible) ✅,
      refund > monto disponible en un intento ✅, release de un depósito ya released ✅, refund de un
      depósito ya released/fully_refunded ✅, release no cobra nada ✅. **Race entre refunds
      concurrentes: HALLADA, NO resuelta** — `refund()` no tiene lock optimista (read-then-write),
      dos refunds simultáneos pasan ambos sin rechazo. Documentado como test que confirma el
      comportamiento real (no lo esconde) y trackeado como **DT-11** (preexistente, no introducido
      por este cambio — fuera del alcance "mínimo viable").
- [x] 3.2 Gate: `arckode analyze` 0 violaciones · `bun test` 2116/2116 · typecheck sin errores nuevos.

## DT-11 — `DepositsUseCase.refund()` sin lock de concurrencia — ⛔ BLOQUEADA DE FRAMEWORK (investigado 2026-07-28)

Read-then-write sin protección: dos `refund()` concurrentes sobre el mismo depósito leen el mismo
`refundAmount` antes de que cualquiera escriba, así que ambos pasan la validación de "no exceder lo
disponible" con su propia cuenta. Confirmado con test (`deposits.test.ts`, caso "race").

- [x] 11.1 Confirmado contra el framework: `RepositoryAdapter<T>.update(id, data)` NO acepta
      condición/WHERE adicional — sin CAS posible por esta interfaz. `orm.transaction()` SÍ existe
      y se usa en el proyecto (`accounting/journal-entry.ts`, `habitaciones/batch-create.ts`,
      `reservas/checkin.ts`), pero `adapters/postgres.ts:64-81` hace `BEGIN` liso, sin
      `SELECT...FOR UPDATE` ni isolation level configurable — bajo READ COMMITTED (default),
      envolver `refund()` en una transacción NO cierra la carrera (dos transacciones concurrentes
      igual leen `refundAmount=0` antes de que ninguna haga commit). Sería una falsa sensación de
      fix, no un fix real. Un campo `version` tampoco sirve sin que `update()` soporte
      `WHERE id=? AND version=?` — la interfaz no lo permite.
- [ ] 11.2 No ejecutable sin una de estas dos cosas: (a) feature nueva en `arckode-framework`
      (`update(id, data, {expect: Partial<T>})` → `WHERE id=? AND expect.k=v...`, `null` si 0 filas
      afectadas) — pedir como feature request al framework; o (b) SQL crudo puntual para ese único
      UPDATE condicional — prohibido por regla dura del proyecto. Ninguna disponible hoy.
- [x] 11.3 El test "race" de `deposits.test.ts` SIGUE documentando `rejected.length === 0` como
      hallazgo real (no se cambió a `>= 1` — hacerlo sin haber arreglado nada falsificaría el gate).
- [ ] 11.4 No aplica — nada que verificar sobre un cambio que no se hizo. Reabrir cuando el framework
      exponga (a) o el proyecto decida asumir el riesgo con (b).

## DT-09 — Facturación electrónica real (BLOQUEADA, no ejecutar sin decisión)
- [ ] 9.1 Requiere: elegir país/autoridad a integrar primero (DGII República Dominicana es el mercado
      primario del proyecto, per seeds `hotel@solmios.com`), conseguir credenciales/certificados de
      esa autoridad. Sin esto, no hay código que escribir — `stubFiscalAdapter` es un placeholder
      correcto hasta que exista una cuenta real con la DGII (o la autoridad que se decida).
- [ ] 9.2 Cuando haya credenciales: implementar `FiscalAdapter.issue()` real reemplazando
      `stubFiscalAdapter`, sin tocar `nextNcf()`/`buildNcf()` (ya correctos).

## DT-10 — Combo POS no valida disponibilidad de sus componentes ✅ CERRADA (2026-07-28)

Origen: `openspec/changes/carta-experiencia-avanzada/design.md` (riesgo R2), aceptada explícitamente
como deuda de alcance de esa v1.

### DT-10.1 — Diagnóstico + diseño
- [x] 10.1 Confirmado: `addComboLine` no chequeaba disponibilidad de componentes (solo `addLine`
      con `menuItemId` suelto lo hacía).
- [x] 10.2 Chequeo aplicado: por cada componente resuelto, `item.available !== 0` Y
      `isWithinAvailabilityWindow(item, new Date())` ANTES de crear cualquier fila (header incluido)
      — se resuelven y validan TODOS los componentes primero (`resolvedComponents`), recién después
      se crea el header y las filas de componente reusando el `item` ya fetcheado (sin refetch).
- [x] 10.3 Mensaje de error identifica el componente: `"${item.name}" no está disponible ahora
      mismo` / `"${item.name}" no está disponible en este horario`.

### DT-10.2 — Implementación
- [x] 20.1 `backend/src/modules/restaurant/usecases/order-lines.ts` (`addComboLine`): loop de
      resolución+validación separado del loop de creación, reusa `isWithinAvailabilityWindow` de
      `order-totals.ts` sin duplicar lógica.
- [x] 20.2 `frontend/src/pages/restaurante/comanda.vue` (`availableCombos`): ahora cruza
      `combo.items` contra `items.value` (Map por id) y exige `available !== 0 && availableNow !==
      false` en TODOS los componentes, además de `combo.available !== 0`.
- [x] 20.3 Tests nuevos en `order-lines-combos.test.ts` (+3, reloj fijo para el caso de franja
      horaria): componente 86'd → 400 sin crear filas; componente fuera de franja → 400 sin crear
      filas; todos disponibles → regresión cero (16/16 tests del archivo pasan).

### DT-10.3 — QA + gate
- [x] 30.1 QA adversarial: el rechazo es responsabilidad EXCLUSIVA del backend (fuente de verdad);
      el frontend solo evita ofrecer combos que el backend rechazaría, pero si la disponibilidad
      cambia entre el fetch de la lista y el click, el backend igual rechaza con `ValidationError`
      (400 limpio, no crashea la UI — mismo mecanismo que ya usan los errores de `addLine`).
- [x] 30.2 Gate: `arckode analyze` ✅ VÁLIDO (0 violaciones) · `bun test src/modules/restaurant/`
      186/186 · `bun run tsc --noEmit` sin errores en restaurant · `vue-tsc -b` frontend limpio.
