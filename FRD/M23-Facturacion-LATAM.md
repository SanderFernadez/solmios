# FRD · M23 — Facturación Electrónica LATAM

> **Módulo fiscal.** Documenta la emisión de comprobantes con NCF/secuencia, la (futura) submission a 6 autoridades LATAM, anulaciones y notas de crédito. Extraído del código real de `backend/src/modules/facturas/`, `composition-root.ts` y `frontend/src/pages/billing/`.
> Todo lo documentado acá se contrasta con el código real. La columna "Gap" marca lo que NO cumple el modelo canónico y/o el SPEC `M23-electronic-invoicing.spec.md`.

**Módulo:** M23 — Facturación Electrónica LATAM
**Pantallas cubiertas:** Facturación (`/panel/billing`) → tabs "Facturas", "Pagos", "Folios" (sección facturación del módulo billing compartido)
**Servicios frontend:** `Billing.service.ts` (`list`/`create`/`pay`/`update`), `Folios.service.ts` (`closeAndInvoice`)
**Servicios backend:** módulo `facturas` (`FacturasService`), ruta cross-módulo `POST /api/folios/:id/invoice` en `composition-root.ts`
**Modelos backend:** `invoices` (tabla), `Configuration` (config fiscal de tasas), `Guests`, `Reservations`, `Rooms`, `Users`

---

## 0. Scope y solapamiento con M13

M23 y **M13 (Folios & Billing)** comparten la **misma pantalla** (`/panel/billing`), el **mismo módulo backend** (`facturas`) y el **mismo modelo de datos** (`invoices`).

| Aspecto | Lo cubre M13 (cobros/folios) | Lo cubre M23 (fiscal/compliance) |
|---------|------------------------------|----------------------------------|
| Folios, cargos, saldos | ✅ Sí | ❌ No |
| Registrar pago / métodos | ✅ Sí | ❌ No |
| Generación de **NCF / secuencia** | ❌ No | ✅ Sí (este doc) |
| Cálculo de impuestos | ❌ No | ✅ Sí (este doc) |
| Envío a autoridad fiscal (DGII/DIAN/...) | ❌ No | ✅ Sí (este doc — **HOY STUB**) |
| Anulación fiscal / nota de crédito | ❌ No | ✅ Sí (este doc — **HOY NO IMPLEMENTADO**) |
| Libro de ventas / reportes fiscales | ❌ No | ✅ Sí (este doc — **HOY NO IMPLEMENTADO**) |

> **Regla de lectura:** cuando una fila diga "ver M13", el comportamiento real (cargo/pago/folio) está documentado en `M13-*.md`. Acá se documenta **el lado fiscal**: NCF, impuesto, país, autoridad, anulación, nota de crédito.

---

## 1. Modelo de datos (fuente de verdad)

### 1.1 Tabla `invoices` — `facturas/model.ts`

| Campo | Tipo | Default | Significado | Origen código |
|-------|------|---------|-------------|---------------|
| `id` | string (req) | — | UUID del comprobante | `model.ts:7` |
| `hotelId` | string (req, indexed) | — | Multi-tenant | `model.ts:9` |
| `reservationId` | string | — | Reserva origen | `model.ts:8` |
| `guestId` | string | — | Huésped | `model.ts:10` |
| `invoiceNumber` | string (req) | — | Nº visible (`INV-2026-0001`, `PAY-…`, `CHG-…`) | `model.ts:11` · gen en `service.ts:93-98` |
| `type` | string | `"invoice"` | `invoice` \| `payment` \| `folio` \| `receipt` \| `credit_note` | `types.ts:6` · `model.ts:12` |
| `amount` | number (req) | — | **TOTAL** (subtotal + impuestos) | `model.ts:13` · `types.ts:21` |
| `taxes` | number | `0` | Monto de impuesto | `model.ts:14` |
| `currency` | string | `"USD"` | Moneda ISO | `model.ts:15` |
| `status` | string | `"pending"` | ver §1.3 | `model.ts:16` · `types.ts:7` |
| `issueDate` | string (req) | — | Fecha emisión (YYYY-MM-DD) | `model.ts:17` |
| `dueDate` | string | — | Vencimiento | `model.ts:18` |
| `notes` | text | — | Notas / desglose | `model.ts:19` |
| **`ncf`** | string | — | **NCF / CFDI / CUFE** (HOY: cadena prefabricada) | `model.ts:20` · gen en `service.ts:94` |
| `paymentMethod` | string | — | Método de pago | `model.ts:21` |
| `fileUrl` | string | — | URL del PDF/XML | `model.ts:22` |
| `createdAt`/`updatedAt` | timestamp | auto | — | `model.ts:24` |

### 1.2 Campos derivados (no viven en DB — `usecases/billing.ts`)

| Campo | Cálculo | Código |
|-------|---------|--------|
| `subtotal` | `amount - taxes` (round 2) | `billing.ts:90` |
| `taxRate` | `taxes / subtotal × 100` (round 2); `0` si subtotal ≤ 0 | `billing.ts:91` |
| `guest` | resuelto desde `Guests.name` por `guestId` | `billing.ts:64-69` |
| `room` | resuelto vía `reservationId → roomId → Rooms.number` | `billing.ts:72-80` |
| `items[]` | desglose desde `notes` si aplica (frontend) | `billing.service.ts:75` |

### 1.3 Estados (`status`) — **DISCREPANCIA con SPEC**

| Estado código real | Significado | Color badge UI | Es fiscalmente final? |
|-------------------|-------------|----------------|----------------------|
| `draft` | Borrador | — (no mostrado) | No |
| `pending` | Emitida, sin cobrar | gold | No |
| `paid` | Cobrada | teal | Sí |
| `overdue` | Vencida (sin cobro) | coral | No |
| `cancelled` | Anulada (soft, vía `update`) | — (no mostrado) | Sí |

> ⚠ **GAP #1 — Enum de estado NO coincide con el SPEC.** El SPEC (`M23-electronic-invoicing.spec.md:67`) define `pending \| sent \| accepted \| rejected \| voided`. El **código real** (`types.ts:7`) define `pending \| paid \| overdue \| cancelled \| draft`. **No existe** `sent`/`accepted`/`rejected`/`voided`. La UI (`billing/index.vue:492-494`) además solo renderiza 3 labels: Pagada/Pendiente/Vencida.

### 1.4 Tipos (`type`) — `types.ts:6`

`invoice` · `payment` · `folio` · `receipt` · `credit_note`

> ⚠ **GAP #2 — `credit_note` existe como tipo pero NO hay endpoint, UI ni lógica que lo genere.** El SPEC exige "notas de crédito referencian siempre la factura original" — en el modelo **no hay FK a la factura original**.

### 1.5 Las 6 autoridades LATAM (definidas en SPEC, **NO en código**)

| País | Autoridad | Sistema SPEC | Formato SPEC | ¿Implementado en código? |
|------|-----------|--------------|--------------|--------------------------|
| Rep. Dominicana | DGII | e-NCF | XML + QR | ❌ **NO** |
| Colombia | DIAN | Facturación Electrónica | XML UBL 2.1 | ❌ **NO** |
| México | SAT | CFDI | XML CFDI 4.0 | ❌ **NO** |
| Perú | SUNAT | Facturación Electrónica | XML UBL 2.1 | ❌ **NO** |
| Chile | SII | DTE | XML | ❌ **NO** |
| Argentina | AFIP/ARCA | Factura Electrónica | XML WSFE | ❌ **NO** |

> ⚠ **GAP #3 — Ninguna autoridad está implementada.** No existe campo `country` en `model.ts`, ni cliente HTTP a DGII/DIAN/SAT/etc., ni generación de XML, ni firma digital, ni QR, ni webhooks (`/webhooks/dgii`, `/webhooks/dian` del SPEC no existen). El campo `ncf` se rellena con una cadena local prefabricada (ver §6). **M23 hoy es un emisor de facturas internas con etiqueta "NCF", no facturación electrónica real.**

### 1.6 Config fiscal (`Configuration`) — `usecases/billing.ts:10-19`

La tasa de impuesto se lee de la tabla `Configuration` con key `taxes` (fallback `impuestos`), esperando un array `{ tasa \| rate, activo \| active }`. Se **suman** las activas. Si no hay config o falla → tasa `0`.

> ⚠ **GAP #4 — No hay config por país.** Una sola tasa agregada por hotel; no existe modelo `TaxConfig` por país como pide el SPEC (`taxId` RNC/RFC/RUT, `resolution`, `sequenceType`).

---

## 2. Pantalla — Facturación (`/panel/billing`) → sección facturación

Cabecera: título **"Facturación"**, subtítulo **"Pagos, facturación electrónica LATAM y folios"**. Stats: Ingresos del Mes · Cobrado Hoy · Pendiente · **Facturas Emitidas** (count). Tabs: **"📄 Facturas"** · "💳 Pagos" · "🏨 Folios" (estos dos últimos se documentan en M13).

### 2.1 Decision Table — Tab Facturas (lado fiscal)

| Trigger (texto exacto) | Condición / Estado previo | Resultado | Modal/Toast (texto literal) | Errores (E-códigos) | Notif F5 |
|------------------------|---------------------------|-----------|------------------------------|---------------------|----------|
| Filtro `<select>`: **Todas / Pagadas / Pendientes / Vencidas** | — | Filtra `invoices.value` por `status` (cliente, sin recargar) | — | — | — |
| Clic en fila de factura | existe `inv` | Abre **modal detail** "Factura #{{number}}" con: Estado, Huésped, Habitación, Detalle (items), Subtotal, Impuestos ({{taxRate}}%), Total | Modal `detail` lg | — | — |
| En el modal, si `viewInvoice.eInvoice` truthy (= `ncf` existe) | `inv.ncf` set | Muestra **caja teal**: "✅ Factura Electrónica Enviada" + "NCF: {ncf}" | Caja informativa | — | — |
| Botón **"Ver"** (cyan, fila) | — | Igual que clic en fila → abre modal detail | Modal `detail` | — | — |
| Botón **"Cobrar"** (teal, fila; solo si `status='pending'`) | `inv.status='pending'` | Abre **modal "Registrar Pago"** precargado con `guest` y `amount=total` | Modal `form` md | — | — |
| Botón **"Registrar Pago"** (header) → "+ Nuevo Pago" | — | Abre **modal "Registrar Pago"** vacío | Modal `form` md | — | — |
| **"Confirmar Pago"** (modal) con `amount ≤ 0` o sin guest | validación cliente | **HOY:** `alert('Datos incompletos')`. **TARGET:** F3 inline + E1 | — | E1 (hoy roto) | — |
| **"Confirmar Pago"** (modal) válido | monto > 0 | Llama `BillingService.pay(id, {method, amount, reference, notes})` → backend marca factura `paid` + crea registro `type='payment'`. Recarga lista. | **HOY:** sin toast (solo recarga). **TARGET:** Toast success F1 "Pago registrado." | E6 "Sin conexión" · E2 "Factura ya pagada" (no validado) | — |
| Botón **"Exportar"** (header) | — | **HOY:** botón sin handler (no hace nada). **TARGET:** exportar libro de ventas / CSV | — | — | — |

### 2.2 Decision Table — Tab Folios → acción fiscal **"Cerrar y Facturar"**

| Trigger | Condición | Resultado | Modal/Toast (texto literal) | Errores | Notif F5 |
|---------|-----------|-----------|------------------------------|---------|----------|
| Botón **"Cerrar y Facturar"** (cyan, folio `status='open'`) | folio abierto, con saldo | **HOY:** `confirm("¿Cerrar el folio de {guest} y generar factura por ${total}?")` → `FoliosService.closeAndInvoice(id)` → `POST /api/folios/:id/invoice` → backend cierra folio + `facturas.create({type:'invoice', amount: subtotal})` → genera `invoiceNumber` + **NCF prefabricado**. **TARGET:** Modal `warning` + caja ⚠ "⚠ Se generará factura con NCF y se enviará a la autoridad fiscal." | **HOY:** `alert("Folio cerrado y factura generada: {num}")`. **TARGET:** Toast success F1 "Factura {num} emitida (NCF {ncf})." | E2 "Folio sin saldo" (no validado) · E6 "Sin conexión" · **E6 authority** (no aplica: sin envío real) | — |
| Badge **"✓ Facturado"** | `folio.status='closed' && folio.invoiceId` | Solo label, no acción | — | — | — |

> ⚠ **GAP #5 — "Factura Electrónica Enviada" es engañoso.** `billing/index.vue:451` deriva `eInvoice = d.ncf ? 'NCF: ${d.ncf}' : null` y la caja teal dice literalmente **"Factura Electrónica Enviada"** (`billing/index.vue:254`). Como el NCF se asigna siempre localmente sin envío real (§6), el texto afirma un envío que **no ocurre**.

> ⚠ **GAP #6 — Anti-patrones de feedback.** `confirm()` y `alert()` nativos en `billing/index.vue:586` (confirm de cerrar folio), `:591` (alert éxito), `:532/:559` (pago), `:574/:582` (cargo). Deben ser F2/F1 canónicos.

### 2.3 Lo que NO existe en la UI (aunque el SPEC lo pide)

- ❌ Botón **"Anular"** factura (no hay acción de anulación fiscal)
- ❌ Botón **"Nota de crédito"** (el `type='credit_note'` no se genera en ningún flujo)
- ❌ Pantalla de **configuración fiscal** por país (RNC/RFC/RUT, resolución, secuencia)
- ❌ Pantalla de **libro de ventas** / **resumen de impuestos** / dashboard de cumplimiento
- ❌ Visualización de **XML / QR / estado en autoridad** (sent/accepted/rejected)
- ❌ Selector de **país** de facturación

---

## 3. Flow — Emitir factura electrónica (vía "Cerrar y Facturar")

```mermaid
flowchart TD
    A([Usuario clic "Cerrar y Facturar"]) --> B{HOY: confirm nativo<br/>TARGET: Modal warning + caja ⚠}
    B -- cancela --> Z([Fin, sin acción])
    B -- confirma --> C[FoliosService.closeAndInvoice<br/>POST /api/folios/:id/invoice]
    C --> D[folio.close → summary.subtotal]
    D --> E[facturas.create type=invoice<br/>amount = subtotal]
    E --> F{type = invoice?}
    F -- sí --> G[taxRateFor config 'taxes/impuestos']
    G --> H[applyTax base, rate<br/>→ taxes, total]
    H --> I[nextNumber INV-YYYY-XXXX]
    I --> J["ncf = NCF-{invoiceNumber}<br/>(LOCAL, no autoridad)"]
    F -- no --> K[invoiceNumber = PAY/CHG- timestamp]
    J --> L[repo.create invoices]
    K --> L
    L --> M[folios.setInvoice folio.invoiceId]
    M --> N{HTTP 201?}
    N -- sí --> O[HOY: alert 'Folio cerrado y factura generada'<br/>TARGET: Toast success 'Factura {num} emitida (NCF {ncf})']
    O --> P[Recarga lista]
    P --> Q{Envío a autoridad?}
    Q -- HOY: NO EXISTE --> R([Fin — factura interna])
    N -- 5xx/timeout --> X1[E6 Toast: Sin conexión]
    N -- 400 business --> X2[E2 Toast: regla fiscal violada]
    Q -- TARGET FUTURO --> S[Generar XML país<br/>Firmar + enviar a DGII/DIAN/...]
    S --> T{Respuesta autoridad?}
    T -- accepted --> U[status=accepted<br/>guardar externalId + QR]
    T -- rejected --> X3[E2 Toast: Rechazada por autoridad]
    T -- caída --> X4["E6 Toast: Autoridad no responde<br/>encolar reintento (SPEC: máx 3)"]
```

**Notación del flow:** `[ ]` acción · `{ }` decisión · `(( ))` fin · `-- E2 -->` rama de error etiquetada. El tramo `S→X4` (envío real a autoridad) **no está implementado hoy**; se documenta como target.

### Tabla de pasos (alternativa sin Mermaid)

| # | Paso | Estado del sistema después | Código |
|---|------|----------------------------|--------|
| 1 | Clic "Cerrar y Facturar" + confirm | sin cambios | `billing/index.vue:585` |
| 2 | `POST /api/folios/:id/invoice` | — | `Folios.service.ts:65` |
| 3 | `folios.close(id)` + `summary(id)` | `folio.status='closed'` | `composition-root.ts:225-226` |
| 4 | `facturas.create({type:'invoice', amount: subtotal})` | — | `composition-root.ts:228-232` |
| 5 | `taxRateFor` + `applyTax` → `taxes`, `total` | impuesto calculado | `service.ts:89-92` · `billing.ts:10-25` |
| 6 | `nextNumber` → `INV-2026-0001` | invoiceNumber asignado | `service.ts:108-116` |
| 7 | `ncf = 'NCF-${invoiceNumber}'` | **NCF local prefabricado** | `service.ts:94` |
| 8 | `repo.create` | fila en `invoices`, `status='pending'` | `service.ts:102` |
| 9 | `folios.setInvoice` | `folio.invoiceId` set | `composition-root.ts:233` |
| 10 | (SKIP) envío a autoridad | **no implementado** | — |

---

## 4. Flow — Anular factura / Nota de crédito

```mermaid
flowchart TD
    A([Usuario quiere anular factura]) --> B{Existe flujo de anulación?}
    B -- HOY: NO --> C[Solo vía update status=cancelled<br/>o delete físico - sin UI]
    C --> D[No genera nota de crédito<br/>No avisa a autoridad]
    D --> X1([Fin — GAP: anulación fiscal ausente])
    B -- TARGET --> E[Botón "Anular" en modal factura]
    E --> F{status actual?}
    F -- draft/pending --> G[Modal danger: "¿Anular factura {num}?"]
    F -- paid/accepted --> H["Modal warning: requiere Nota de Crédito<br/>⚠ Genera NC que referencia esta factura"]
    G --> I[Generar XML de anulación<br/>Enviar a autoridad]
    H --> J[Crear invoice type=credit_note<br/>amount negativo, ref a original]
    J --> I
    I --> K{Autoridad acepta?}
    K -- sí --> L["status=voided/cancelled<br/>guardar externalId"]
    L --> M[Toast success: Factura anulada]
    K -- no --> X2[E2 Toast: Autoridad rechazó anulación]
    K -- caída --> X3[E6 Toast: Sin conexión con autoridad]
```

> ⚠ **GAP #7 — Anulación fiscal y nota de crédito NO implementadas.** No hay endpoint `/void` ni `/credit-note` (rutas en `index.ts:48-53` son solo `index/show/store/pay/update/destroy`). El `type='credit_note'` está declarado en `types.ts:6` pero **nadie lo crea**. Anular hoy equivale a `update({status:'cancelled'})` (soft, sin aviso fiscal) o `DELETE` (físico) — ambos sin UI expuesta y **sin efecto en la autoridad**. El SPEC exige "no se puede anular una factura aceptada sin generar nota de crédito" — no se cumple.

---

## 5. Consecuencias cross-módulo

| Acción origen | → M23 (este módulo) | Efecto | Notificación F5 |
|---------------|---------------------|--------|-----------------|
| **Check-out confirmado (M01)** | Emisión de factura | `M01` dispara generación de folio; al cerrar folio se genera factura con NCF | "Generar folio de {huésped}" (hoy) → TARGET "Factura {num} emitida" |
| **Cerrar folio (M13)** | Emisión de factura | `POST /api/folios/:id/invoice` → `facturas.create` | — (hoy) |
| **Night audit (M13)** | Posteo de cargos a folios | No emite factura directa; acumula saldo para facturación posterior | — |
| Factura emitida (M23) | → M13 (Folios) | `folio.invoiceId` set, `folio.status='closed'`, badge "✓ Facturado" | — |
| Factura anulada (M23, futuro) | → M13 | Reabrir/recrear folio si corresponde | — |
| Pago registrado (M13) | → M23 | `facturas.pay` crea registro `type='payment'` vinculado | — |

---

## 6. Reglas de negocio a validar en backend (E2)

El backend debe rechazar (HTTP 400 `BUSINESS_RULE`) estas situaciones. Estado **HOY** marcado.

| # | Regla | Texto target del Toast E2 | ¿Implementada hoy? | Evidencia código |
|---|-------|----------------------------|--------------------|------------------|
| 1 | **NCF duplicado** (misma secuencia ya usada) | "El NCF {ncf} ya fue emitido." | ❌ **NO** — no hay chequeo de unicidad de `ncf` | `service.ts:88-94` |
| 2 | **Secuencia agotada** (rango DGII/DIAN terminado) | "Secuencia de NCF agotada. Solicitar nuevo rango a la autoridad." | ❌ **NO** — no hay rango ni control de límite | `service.ts:108-116` |
| 3 | **Cliente sin identificación fiscal** (RUT/RFC/RNC) en país que la exige | "Faltan datos fiscales del huésped (RNC/RFC/RUT)." | ❌ **NO** — no hay campo país ni validación | `validators/schema.ts:5-19` |
| 4 | **País no soportado** (fuera de los 6 LATAM) | "País {country} no soportado para facturación electrónica." | ❌ **NO** — no hay campo país | `model.ts:6-23` |
| 5 | **Monto negativo** en factura | "El monto de la factura no puede ser negativo." | ❌ **NO** — schema solo valida `type:number` | `validators/schema.ts:7` |
| 6 | **Anular factura ya aceptada sin nota de crédito** | "No se puede anular: generar nota de crédito primero." | ❌ **NO** — no hay anulación | — |
| 7 | **Nota de crédito sin factura original** | "La nota de crédito debe referenciar una factura." | ❌ **NO** — no hay FK a original | `model.ts:6-23` |
| 8 | **Autoridad rechaza el comprobante** | "La autoridad fiscal rechazó la factura: {motivo}." | ❌ **NO** — no hay envío | — |
| 9 | **Secuencia con huecos** (prevención) | "La secuencia no puede tener huecos." | ⚠ **Parcial** — `nextNumber` usa `count+1`, raza posible ante concurrencia | `service.ts:108-116` |

> **Lo único realmente validado hoy:** `validateSchema(CreateFacturasSchema, ...)` requiere `hotelId` y `amount` (numérico) (`validators/schema.ts:6-7`). Todo lo demás fiscal **no se valida**.

### Cómo se genera el NCF hoy (detalle)

`service.ts:88-94` — cuando `type='invoice'` y no viene `ncf`:

```
invoiceNumber = nextNumber(hotelId, 'INV')   // "INV-2026-0001"  (count-based)
ncf           = `NCF-${invoiceNumber}`        // "NCF-INV-2026-0001"  (cadena local)
```

`nextNumber` (`service.ts:108-116`) hace `all.length + 1` sobre `repo.findMany({hotelId})` — **no es una secuencia persistente ni atómica**; dos emisiones concurrentes pueden generar el mismo número (E2 #1 y #9 latentes).

---

## 7. Gap analysis (archivo:línea)

| # | Gap | Severidad | Evidencia |
|---|-----|-----------|-----------|
| 1 | Enum de `status` del SPEC (`sent/accepted/rejected/voided`) **no existe** en código | BLOCKER | `types.ts:7` vs `spec:67` |
| 2 | `type='credit_note'` declarado pero **nunca generado**; sin FK a factura original | BLOCKER | `types.ts:6` · `model.ts:6-23` |
| 3 | **Ninguna de las 6 autoridades** (DGII/DIAN/SAT/SUNAT/SII/AFIP) tiene cliente/implementación | BLOCKER | grep global: 0 hits fuera del SPEC |
| 4 | No hay campo `country` ni `TaxConfig` por país | BLOCKER | `model.ts:6-23` |
| 5 | No hay `xmlBase64`, `qrCode`, `externalId`, `sentAt`, `acceptedAt` en el modelo | BLOCKER | `model.ts:6-23` |
| 6 | NCF es **cadena prefabricada local** (`NCF-{invoiceNumber}`), no secuencia de autoridad | BLOCKER | `service.ts:94` |
| 7 | `nextNumber` es `count+1` (raza, no atómico, no persistente) | HIGH | `service.ts:108-116` |
| 8 | No hay endpoint `/void`, `/credit-note`, `/sequences`, `/daily-book`, `/tax-summary`, `/config`, ni webhooks | BLOCKER | `index.ts:48-53` |
| 9 | No hay botón **"Anular"** ni **"Nota de crédito"** en la UI | BLOCKER | `billing/index.vue` (tabs/acciones) |
| 10 | No hay pantalla de **configuración fiscal** ni **libro de ventas** | HIGH | sin vista en `frontend/src/pages/` |
| 11 | Caja UI "**Factura Electrónica Enviada**" afirma envío que no ocurre | HIGH (UX/legal) | `billing/index.vue:250-258` · `:451` |
| 12 | Validación: no rechaza monto negativo, ni NCF duplicado, ni datos fiscales faltantes | HIGH | `validators/schema.ts:5-19` |
| 13 | `confirm()` / `alert()` nativos en lugar de F2/F1 canónicos | MED | `billing/index.vue:586,591,532,559,574,582` |
| 14 | Botón **"Exportar"** sin handler | LOW | `billing/index.vue:10` (sin `@click`) |
| 15 | `loadData` silencia errores con `catch { /* vacío }` | MED | `billing/index.vue:462` |

---

## 8. Checklist de verificación M23

Estado actual vs. target. Marcar cuando se cumpla.

### Emisión / NCF
- [ ] NCF real por país (DGII e-NCF, DIAN CUFE, SAT CFDI, SUNAT, SII DTE, AFIP WSFE) — hoy STUB
- [ ] Secuencia persistente y atómica (no `count+1`) — hoy raza
- [ ] Detección de NCF duplicado (E2 #1)
- [ ] Alerta de secuencia agotada (E2 #2)
- [ ] Estados `sent/accepted/rejected/voided` además de los de cobranza
- [ ] Generación de XML + firma + QR por país

### Configuración fiscal
- [ ] Pantalla de config fiscal por país (RNC/RFC/RUT + resolución + secuencia)
- [ ] Modelo `TaxConfig` (SPEC) separado de `Configuration`
- [ ] Selector de país de facturación en el hotel

### Anulación / Nota de crédito
- [ ] Botón "Anular" en modal factura (modal `danger` o `warning`)
- [ ] Endpoint `POST /api/facturas/:id/void` con envío a autoridad
- [ ] Generación de `type='credit_note'` referenciando factura original
- [ ] Bloqueo de anulación de aceptada sin NC (regla SPEC #2)

### UI / Feedback (canónico 00-MASTER)
- [ ] Reemplazar `confirm()` de "Cerrar y Facturar" por modal `warning` + caja ⚠
- [ ] Reemplazar `alert()` de éxito por Toast success F1
- [ ] Reemplazar `alert('Datos incompletos')` por F3 inline (E1)
- [ ] Loading F6 en "Confirmar Pago" y "Cerrar y Facturar"
- [ ] Corregir texto "Factura Electrónica Enviada" (mentira hasta que exista envío real)
- [ ] Estados vacíos de Facturas con ilustración + CTA
- [ ] Skeleton al cargar lista

### Reportes
- [ ] Libro de ventas diario/mensual (`GET /invoicing/daily-book`)
- [ ] Resumen de impuestos por período
- [ ] Dashboard de cumplimiento fiscal
- [ ] Botón "Exportar" funcional

### Cross-módulo
- [ ] F5 a Billing/Admin al emitir factura
- [ ] F5 al anular → M13 (reabrir folio si aplica)
- [ ] Reintentos automáticos (SPEC: máx 3) ante caída de autoridad (E6)
- [ ] Cola de facturación para alta demanda

---

## 9. Pendiente de documentar en M23 (próximas iteraciones)

- [ ] Detalle por país: mapeo campo-a-campo del XML (DGII vs DIAN vs SAT…)
- [ ] Webhooks de callback por autoridad (`/webhooks/dgii`, `/webhooks/dian`)
- [ ] Retención de IVA/ISR automática por país (SPEC #7)
- [ ] Firmado digital (certificados, PAC para SAT)
- [ ] Respaldo/recuperación de secuencias (SPEC secuencias #4)
- [ ] Matriz de permisos: ¿quién puede emitir/anular? (¿`hotel_admin` sí, `receptionist` no?)

---

*Documento generado leyendo código real. Donde dice "HOY STUB / NO IMPLEMENTADO", el código no lo soporta. Reglas de feedback y códigos F1–F6 / E1–E7 definidos en `00-MASTER.md`.*
