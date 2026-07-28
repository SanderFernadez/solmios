# Tasks — Deudas técnicas pendientes

Estado final (2026-07-28): DT-08 y DT-10 cerradas · DT-07 y DT-11 bloqueadas de framework (investigado,
requeriría SQL crudo prohibido o una feature nueva del framework) · DT-09 bloqueada por decisión de
negocio. Cada sprint ejecutado: implementar → gates (`arckode analyze` 0 violaciones · `bun test` ·
typecheck) → QA adversarial → commit quirúrgico.

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
