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

## DT-08 — Depósitos: conectar el ledger real

### DT-08.1 — Diseño (requiere decisión de alcance del usuario)
- [ ] 1.1 Presentar 2 opciones y que el usuario elija antes de tocar código:
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
- [ ] 1.2 Confirmar con el usuario cuál opción implementar (A es 1 sprint, B es varios y depende de
      Stripe funcionando en el hotel).

### DT-08.2 — Implementación (según lo decidido en 1.1)
- [ ] 2.1 Conectar `create`/`refund`/`release` al mecanismo elegido.
- [ ] 2.2 Si (A): connector `payments-caja`/`payments-accounting` ya existentes deben reaccionar al
      nuevo `payment` tipo `deposit` igual que a cualquier otro pago — no duplicar lógica.
- [ ] 2.3 Si (B): manejar el webhook de Stripe para el estado del `PaymentIntent` (requires_capture,
      canceled, succeeded) — reusar la infraestructura de `payments-webhooks.ts` existente.
- [ ] 2.4 Tests: crear depósito → aparece en caja/payments (si A) o crea PaymentIntent con hold (si
      B); refund revierte correctamente; release no cobra nada.

### DT-08.3 — QA + gate
- [ ] 3.1 QA adversarial: doble-refund, refund > monto disponible, release de un depósito ya
      reembolsado, race entre refund y release concurrentes.
- [ ] 3.2 Gate: `arckode analyze` 0 violaciones · `bun test` · typecheck.

## DT-09 — Facturación electrónica real (BLOQUEADA, no ejecutar sin decisión)
- [ ] 9.1 Requiere: elegir país/autoridad a integrar primero (DGII República Dominicana es el mercado
      primario del proyecto, per seeds `hotel@solmios.com`), conseguir credenciales/certificados de
      esa autoridad. Sin esto, no hay código que escribir — `stubFiscalAdapter` es un placeholder
      correcto hasta que exista una cuenta real con la DGII (o la autoridad que se decida).
- [ ] 9.2 Cuando haya credenciales: implementar `FiscalAdapter.issue()` real reemplazando
      `stubFiscalAdapter`, sin tocar `nextNcf()`/`buildNcf()` (ya correctos).
