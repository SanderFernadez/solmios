# Tasks — Deudas técnicas pendientes

Dos deudas reales verificadas contra código (2026-07-24) + una bloqueada documentada. Cada sprint:
implementar → gates (`arckode analyze` 0 violaciones · `bun test` · typecheck) → QA adversarial →
commit quirúrgico.

## DT-07 — Search de facturas: mover filtro a WHERE del repo

### DT-07.1 — Diagnóstico + diseño
- [ ] 1.1 Confirmar qué adapters soportan filtro parcial (`LIKE`/`ILIKE`) sin SQL crudo en el módulo:
      `RepositoryAdapter<T>` de arckode-framework — ¿expone algún operador `contains`/`like` en
      `findMany`/`paginate`, o hay que pedirlo al framework? Si el framework NO lo soporta hoy,
      documentar como bloqueado-de-framework en vez de forzar SQL crudo (regla dura: nunca SQL
      crudo en services/usecases).
- [ ] 1.2 Si el adapter soporta filtro parcial: diseñar el cambio en `list-invoices.ts` — el filtro
      de `search` (invoiceNumber/guest/notes) debe ir al `filters` que recibe `repo.paginate()`, no
      aplicarse post-fetch. Ojo: `guest` no es columna de `facturas` (viene de `enrichInvoicesBatch`
      cruzando con `guests`/`reservas`) — ese cruce no se puede resolver con un WHERE simple sobre
      `invoices`. Definir qué campos SÍ se pueden mover a WHERE (invoiceNumber, notes) y cuáles
      quedan en memoria pero acotados (ej: solo sobre la página ya paginada + un fallback).

### DT-07.2 — Implementación
- [ ] 2.1 Mover a `WHERE` los campos resolubles en la tabla `invoices` directamente.
- [ ] 2.2 Si `guest` no es resoluble sin cruce, decidir con evidencia: ¿vale la pena mantener el
      O(n) actual SOLO para ese campo (ya está acotado por hotel, no es global), o sacar `guest` del
      search y que el usuario busque por número/nota? **No implementar sin confirmar con el usuario
      cuál preferencia UX** — este es un trade-off de producto, no solo técnico.
- [ ] 2.3 Mantener el contrato de respuesta (`data/total/pages/hasNext/hasPrev`) idéntico — no romper
      el frontend que consume `FacturasService.list({search})`.
- [ ] 2.4 Tests: search por invoiceNumber/notes vía WHERE (verificar que no trae toda la tabla —
      se puede instrumentar contando llamadas a `findMany` sin filtro vs con filtro en el mock del
      repo). Regresión: paginación de resultados de búsqueda sigue funcionando.

### DT-07.3 — QA + gate
- [ ] 3.1 QA adversarial: ¿el WHERE es case-insensitive como el `.toLowerCase()` actual? ¿maneja
      substrings igual? ¿el operador del adapter es portable SQLite↔Postgres?
- [ ] 3.2 Gate: `arckode analyze` 0 violaciones · `bun test` · typecheck.

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

## DT-11 — `DepositsUseCase.refund()` sin lock de concurrencia (hallada en QA de DT-08)

Read-then-write sin protección: dos `refund()` concurrentes sobre el mismo depósito leen el mismo
`refundAmount` antes de que cualquiera escriba, así que ambos pasan la validación de "no exceder lo
disponible" con su propia cuenta. Confirmado con test (`deposits.test.ts`, caso "race").

- [ ] 11.1 Diseñar el lock: version field (optimistic locking, `update` condicional por
      `WHERE id=? AND version=?`) o releer+comparar dentro de una transacción si el
      `RepositoryAdapter<T>` del framework soporta transacciones — confirmar primero qué expone el
      framework antes de diseñar (puede requerir pedirlo como feature si no existe).
- [ ] 11.2 Aplicar el mismo criterio a `release()` (mismo patrón read-then-write).
- [ ] 11.3 Test: el caso "race" de `deposits.test.ts` debe pasar a exigir `rejected.length >= 1`
      como invariante (hoy documenta `=== 0` como hallazgo).
- [ ] 11.4 Gate: `arckode analyze` 0 violaciones · `bun test` · typecheck.

## DT-09 — Facturación electrónica real (BLOQUEADA, no ejecutar sin decisión)
- [ ] 9.1 Requiere: elegir país/autoridad a integrar primero (DGII República Dominicana es el mercado
      primario del proyecto, per seeds `hotel@solmios.com`), conseguir credenciales/certificados de
      esa autoridad. Sin esto, no hay código que escribir — `stubFiscalAdapter` es un placeholder
      correcto hasta que exista una cuenta real con la DGII (o la autoridad que se decida).
- [ ] 9.2 Cuando haya credenciales: implementar `FiscalAdapter.issue()` real reemplazando
      `stubFiscalAdapter`, sin tocar `nextNcf()`/`buildNcf()` (ya correctos).

## DT-10 — Combo POS no valida disponibilidad de sus componentes

Origen: `openspec/changes/carta-experiencia-avanzada/design.md` (riesgo R2), aceptada explícitamente
como deuda de alcance de esa v1, no arreglada a medias ni bloqueada por nada externo — se puede
implementar en cualquier momento que se decida priorizarla.

### DT-10.1 — Diagnóstico + diseño
- [ ] 10.1 Confirmar el estado actual: `backend/src/modules/restaurant/usecases/order-lines.ts`
      (`addComboLine`) NO llama `isWithinAvailabilityWindow` ni chequea `item.available` sobre
      ningún componente del combo al explotarlo en `combo_header`+`combo_component` — solo el
      camino de ítem suelto (`addLine` con `menuItemId`) tiene ese chequeo (línea ~220).
- [ ] 10.2 Diseñar el chequeo: por cada componente resuelto del combo, aplicar el MISMO criterio que
      ya usa el ítem suelto (`item.available !== 0` Y `isWithinAvailabilityWindow(item, new Date())`)
      ANTES de crear ninguna fila — si un componente falla, rechazar el combo completo con
      `ValidationError` 400 (no vender un combo "a medias" con un componente inventado).
- [ ] 10.3 Definir el mensaje de error: debe identificar QUÉ componente está agotado/fuera de horario
      (ej. `"{componentName}" no está disponible ahora mismo` — no un genérico "combo no disponible"
      que oculte cuál de los N componentes falló).

### DT-10.2 — Implementación
- [ ] 20.1 Agregar el chequeo en `addComboLine` (`order-lines.ts`), reusando
      `isWithinAvailabilityWindow` de `order-totals.ts` (sin duplicar la lógica).
- [ ] 20.2 Frontend: `comanda.vue` (`availableCombos`) debe filtrar también por disponibilidad de
      TODOS sus componentes, no solo por `combo.available !== 0` (hoy solo chequea eso) — para no
      mostrar en la lista un combo que el backend va a rechazar al agregarlo.
- [ ] 20.3 Tests: combo con un componente 86'd → 400, combo no se crea; combo con un componente
      fuera de franja horaria → 400; combo con todos los componentes disponibles → sigue
      funcionando igual que hoy (regresión cero).

### DT-10.3 — QA + gate
- [ ] 30.1 QA adversarial: componente que sale de disponibilidad ENTRE la carga de la lista y el
      click de agregar (race de UI) — el backend debe seguir siendo la fuente de verdad, el rechazo
      del servidor no debe romper la UI (mostrar el error, no crashear).
- [ ] 30.2 Gate: `arckode analyze` 0 violaciones · `bun test` · typecheck.
