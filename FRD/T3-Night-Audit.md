# FRD · T3 — Night Audit (Cierre Nocturno)

> **Pantalla transversal.** Cruza M01 (reservas), M13 (folios), M23 (facturación), M07 (housekeeping). Documenta el cierre diario operacional del hotel: no-shows, check-outs automáticos, facturación de noches, reporte de auditoría y bloqueo del día cerrado.
>
> Todo lo documentado acá está **extraído del código real** de `frontend/src/pages/night-audit/index.vue`, `services/Operations.service.ts` y `backend/src/composition-root.ts` (líneas 185-263). La columna "Gap" marca lo que hoy NO cumple el modelo canónico y la mayoría son **STUBs** (maquetado sin lógica real).

**Módulo:** T3 — Night Audit (Cierre Nocturno)
**Pantallas cubiertas:** Night Audit (`/panel/night-audit`) — vista Actividad + vista Reporte
**Servicios frontend:** `Operations.service.ts` → `nightAudit(hotelId)`
**Servicios backend:** `GET /api/night-audit` · `POST /api/folios/audit/post-room-charges` · módulos `folios`, `facturas`, `auditlog`
**Rol requerido:** `hotel_admin` · `super_admin` (definido en `composition-root.ts:185,238`)

---

## 1. Modelo de datos (fuente de verdad)

### 1.1 Endpoints existentes y su alcance

| Endpoint | Línea | Tipo | ¿Qué hace REALMENTE? | ¿Mutación? |
|----------|-------|------|----------------------|------------|
| `GET /api/night-audit` | `composition-root.ts:185-220` | **READ-ONLY** | Calcula métricas en vivo (ocupación, ingresos, ADR, RevPAR, contadores). **No persiste snapshot.** | ❌ No |
| `POST /api/folios/audit/post-room-charges` | `composition-root.ts:238-263` | **BATCH REAL** | Postea tarifa de habitación (`room.basePrice`) a folios de reservas in-house. Marca cargo con `source: 'night_audit'`. | ✅ Sí |
| `POST /api/folios/:id/invoice` | `composition-root.ts:222-235` | **CIERRE DE FOLIO** | Cierra folio → genera factura vinculada. (Transversal, invocable desde audit.) | ✅ Sí |

### 1.2 Respuesta de `GET /api/night-audit` (campos reales devueltos)

```ts
{
  fecha: string,                    // today()
  ocupacion: number,                // % occupied/total
  habitacionesOcupadas: number,
  habitacionesTotales: number,
  ingresosHabitaciones: number,     // revenueHoy = Σ totalAmount donde checkIn=hoy
  ingresosServicios: number,        // Σ deposit (¡fuente dudosa!)
  impuestos: number,                // revenueHoy * 0.18 (hardcodeado 18%)
  totalDia: number,                 // ingresosHabitaciones + ingresosServicios
  checkins: number,                 // checkIn=hoy Y status=confirmed
  checkouts: number,                // checkOut=hoy Y status=confirmed  ⚠ BUG (ver §7.3)
  noShows: number,                  // checkIn=hoy Y status=pending
  cancelaciones: number,            // TODAS las canceladas (no solo hoy)
  nochesVendidas: number,           // Σ status=confirmed
  adr: number, revpar: number, adrAyer: number,
  pagosRecibidos: number, pagosPendientes: number, depositos: number,
  reembolsos: 0,                    // hardcodeado
}
```

### 1.3 Modelo de datos TARGET (HOY INEXISTENTE — hay que crearlo)

| Entidad | Tabla | Campos | Estado | Notas |
|---------|-------|--------|--------|-------|
| **DayClose** (cierre del día) | `day_closes` | `id`, `hotelId`, `date` (fecha cerrada), `closedBy`, `closedAt`, `status` (`open`/`closed`), `reportSnapshot` (JSON) | ❌ **NO EXISTE** | Necesario para bloquear re-apertura y persistir el snapshot del día. |
| **AuditReport** (reporte persistido) | `audit_reports` | `id`, `hotelId`, `date`, `metrics` (JSON con la respuesta de §1.2), `generatedBy`, `generatedAt` | ❌ **NO EXISTE** | Hoy el reporte se recalcula en vivo; no queda historia. |
| **No-show** (mutación de reserva) | reusa `Reservations.status` | nuevo valor `no_show` | ❌ **NO EXISTE** | Hoy `noShows` solo CUENTA reservas `pending`; no las muta. |

### 1.4 Reserva — estados relevantes para el audit (`Reservations.status`)

| Estado | Relevancia Night Audit | ¿Mutado por audit hoy? |
|--------|------------------------|------------------------|
| `pending` | Candidato a no-show si `checkIn < hoy` | ❌ No (solo se cuenta) |
| `confirmed` | In-house si `checkIn ≤ hoy ≤ checkOut` → recibe cargo de noche | ✅ Sí (vía `post-room-charges`) |
| `checked_in` | Candidato a check-out automático si `checkOut = hoy` | ❌ No (ver §7.2) |
| `checked_out` | Cerrado hoy | ❌ No se procesa |
| `cancelled` | Excluido | — |
| `no_show` (TARGET) | Resultado de procesar no-shows | ❌ No existe el estado |

---

## 2. Pantalla — Night Audit (`/panel/night-audit`)

Cabecera: título "Night Audit". Toolbar con 2 toggles de vista ("Actividad" / "Reporte") + 2 botones de acción. Grid de 5 stats. Vista Actividad: 4 tarjetas (Movimientos de Hoy, Estado de Habitaciones, Alertas Pendientes, Resumen Financiero). Vista Reporte: métricas ADR/RevPAR + resúmenes check-ins/pagos.

> ⚠ **La barra de progreso "Night Audit en Progreso" es COSMÉTICA** (`index.vue:296-309`): un `setInterval` que incrementa `currentStep` cada 1.5s durante 8 pasos. **No llama a ningún endpoint de cierre.** Al terminar, sólo cambia `activeView` a `'report'`.

### 2.1 Decision Table (triggers REALES del código)

| Trigger (texto EXACTO) | Condición / Estado previo | Resultado | Modal/Toast (texto literal) | Errores posibles | Notif F5 |
|------------------------|---------------------------|-----------|------------------------------|------------------|----------|
| Toggle **"Actividad" / "Reporte"** | — | Cambia `activeView` (sin recargar datos) | — | — | — |
| **"▶ Iniciar Night Audit"** (`index.vue:19`) |任何时候 | **STUB:** arranca `setInterval` cosmético de 8 pasos (1.5s c/u). **NO llama API.** Al terminar → `activeView='report'` | **❌ HOY:** Ninguno (silencioso). **✅ TARGET:** Toast success "Cierre del día iniciado." + Modal warning con checklist de pendientes | **E2 (target):** folios abiertos · check-outs pendientes · día ya cerrado | **TARGET:** F5 a todos los módulos: "Día {fecha} cerrado" |
| **"📄 Último Reporte"** (`index.vue:22`) | — | Cambia `activeView='report'` (mismo que toggle) | — | — | — |
| `onMounted` → `OperationsService.nightAudit(hotelId)` (`index.vue:290-294`) | carga de página | GET `/api/night-audit`, llena `auditData` | — | **❌ HOY:** `catch { /* vacío */ }` traga el error → pantalla queda en ceros sin feedback. **✅ TARGET:** Alert F4 roja + botón "Reintentar" | E6 (target) | — |
| **"🖨 Imprimir"** (`index.vue:163`) | vista Reporte | **STUB:** sin handler `@click` — botón decorativo | — | — | — |
| **"📧 Enviar"** (`index.vue:164`) | vista Reporte | **STUB:** sin handler `@click` — botón decorativo | — | — | — |

### 2.2 Decision Table TARGET (la que DEBE existir cuando se implemente el cierre real)

> Estos son los **labels canónicos** que el FRD define para el botón principal, hoy colapsados en el único botón "▶ Iniciar Night Audit".

| Trigger (label EXACTO target) | Condición / Estado previo | Resultado | Modal/Toast | Errores | Notif F5 |
|-------------------------------|---------------------------|-----------|-------------|---------|----------|
| **"Procesar No-Shows"** | existen reservas `pending` con `checkIn < hoy` | Cada reserva `pending` → `no_show`. Libera habitación asociada si estaba bloqueada. | Toast success: "{n} no-shows procesados." | E2 "No se pudieron procesar los no-shows: día ya cerrado" · E6 | F5 a Channel Mgr (M02): "Liberar inventario de {n} no-shows" · F5 a Billing (M13): "Aplicar cargo de no-show a {huésped}" |
| **"Procesar Check-outs Automáticos"** | reservas `checked_in` con `checkOut = hoy` y folio balance = 0 | Cada una → `checked_out`, hab → `dirty` | Toast success: "{n} check-outs automáticos." + caja ⚠ "Las habitaciones pasarán a limpieza" | E2 "Hay {n} folios con saldo pendiente — resolver antes de cerrar" | F5 Housekeeping (M07): "Crear {n} tareas de limpieza" |
| **"Facturar Noches"** (invoca `POST /api/folios/audit/post-room-charges`) | reservas in-house (`confirmed`, `checkIn ≤ hoy ≤ checkOut`) | Postea `room.basePrice` a cada folio con `source:'night_audit'` | Toast success: "{posted} cargos de habitación posteados." | E6 "Sin conexión" · E2 "Folio in-house sin habitación asignada" | F5 Billing (M13): "{posted} folios actualizados" |
| **"Cerrar Día"** (acción crítica, peligro) | 0 folios abiertos · 0 check-outs pendientes · día NO cerrado aún | Crea `DayClose` con `status='closed'`, persiste `reportSnapshot`, bloquea operaciones del día | Modal **danger** "¿Cerrar el día {fecha}? Esta acción es irreversible. Se bloquearán check-ins/out y cargos de ese día." (carga 1.5s anti-clic) → Toast success "Día {fecha} cerrado." | E2 "El día {fecha} ya está cerrado" · E2 "No se puede cerrar: {n} folios abiertos" · E3 "Sin permiso" | F5 a TODOS los admin: "Día {fecha} cerrado por {user}" |
| **"Reabrir Día"** (excepcional, super_admin) | día `status='closed'` | `DayClose.status='open'`, registra en `audit_log` | Modal **warning** "Reabrir el día {fecha} queda registrado en auditoría." | E3 "Solo super_admin puede reabrir" | F5 a super_admin: "Día {fecha} reabierto por {user}" |

### 2.3 Pasos del audit (labels EXACTOS del código, `index.vue:267-276`)

> ⚠ Estos 8 pasos existen **solo como strings en el array `auditSteps`** — no hay lógica asociada a cada uno. El `setInterval` los "completa" uno por uno sin distinguirlos.

1. Verificar disponibilidad de habitaciones
2. Procesar check-outs pendientes
3. Actualizar tarifas nocturnas
4. Calcular impuestos del día
5. Generar reporte de ingresos
6. Verificar pagos pendientes
7. Actualizar estados de habitaciones
8. Generar reporte final

---

## 3. Flow — Night Audit completo (TARGET)

```mermaid
flowchart TD
    A([Usuario clic 'Cerrar Día']) --> B{¿Día ya cerrado?<br/>DayClose.status}
    B -- sí --> X1[E2 Toast: 'El día {fecha} ya está cerrado']
    B -- no --> C[Abre Modal danger con checklist]
    C --> D{¿Pendientes críticos?}
    D -- folios abiertos --> X2[E2 Toast: '{n} folios con saldo pendiente']
    D -- check-outs sin hacer --> X3[E2 Toast: '{n} check-outs pendientes']
    D -- todo OK --> E[Usuario confirma, espera 1.5s]
    E --> F["Paso 1: Procesar No-Shows<br/>pending+checkIn<hoy → no_show"]
    F --> G["Paso 2: Procesar Check-outs Automáticos<br/>checked_in+checkOut=hoy → checked_out"]
    G --> H["Paso 3: Facturar Noches<br/>POST /api/folios/audit/post-room-charges"]
    H --> I["Paso 4: Persistir snapshot<br/>DayClose.status=closed + reportSnapshot"]
    I --> J["Paso 5: Bloquear día<br/>check-ins/out y cargos del día bloqueados"]
    J --> K[Toast success: 'Día {fecha} cerrado.']
    K --> L["F5 a TODOS los módulos:<br/>M01 reservas · M13 folios · M23 facturación · M07 housekeeping"]
    L --> M([Fin])
    F -- fallo --> X4[E6 Toast: Sin conexión]
    G -- folio con saldo --> X2
    H -- 5xx --> X5[E6 Toast: Sin conexión + Reintentar]
    I -- 409 --> X6[E5 Modal: otro admin cerró el día, recargar?]
```

### 3.1 Tabla de pasos numerada (respaldo del flow)

| # | Paso | Endpoint real | Mutación | Estado HOY |
|---|------|---------------|----------|------------|
| 0 | Validar pendientes | — (validación cliente+servidor) | — | ❌ No implementado |
| 1 | Procesar No-Shows | `PATCH /api/reservas/:id` (bulk, TARGET) | `pending → no_show` | ❌ **STUB** (solo se cuentan) |
| 2 | Procesar Check-outs Automáticos | `PATCH /api/reservas/:id` (bulk, TARGET) | `checked_in → checked_out`, `room → dirty` | ❌ **STUB** |
| 3 | Facturar Noches | `POST /api/folios/audit/post-room-charges` (`composition-root.ts:238`) | postea cargo `source:'night_audit'` | ✅ **REAL** |
| 4 | Persistir snapshot del día | `POST /api/day-closes` (TARGET) | crea `DayClose` | ❌ **No existe el endpoint ni el modelo** |
| 5 | Bloquear día cerrado | middleware que lea `DayClose` (TARGET) | bloquea ops de esa fecha | ❌ **No existe** |
| 6 | Generar/Imprimir reporte | — | — | ❌ Botones "Imprimir"/"Enviar" sin handler |

---

## 4. Consecuencias cross-módulo (eventos que dispara Night Audit)

| Acción en T3 | Módulo afectado | Efecto | Notificación F5 | Estado HOY |
|--------------|-----------------|--------|-----------------|------------|
| Procesar No-Shows | M01 — PMS Central | Reservas `pending` vencidas → `no_show` (canceladas operacionalmente). Libera habitación. | "N no-shows procesados" → Recepción | ❌ No implementado |
| Procesar No-Shows | M02 — Channel Manager | Liberar inventario en OTAs de las no-shows | "Sincronizar inventario — liberar {canal}" | ❌ No implementado |
| Procesar No-Shows | M13 — Folios/Billing | Aplicar cargo de no-show (política del hotel) al folio | "Aplicar cargo no-show a {huésped}" | ❌ No implementado |
| Procesar Check-outs Automáticos | M01 — PMS Central | `checked_in → checked_out` | — | ❌ No implementado |
| Procesar Check-outs Automáticos | M07 — Housekeeping | Crear tareas de limpieza, hab → `dirty` | "Hab {n} necesita limpieza" | ❌ No implementado |
| Facturar Noches | M13 — Folios | Posteo de `room.basePrice` en folios in-house (`source:'night_audit'`) | "{posted} folios actualizados" | ✅ **Implementado** (`composition-root.ts:238-263`) |
| Facturar Noches | M23 — Facturación | Acumula base imponible para facturas del día | — | ✅ Implícito (cargos en folio alimentan factura) |
| Cerrar Día | M01 — PMS Central | Bloquea check-ins/out con fecha del día cerrado | "Día {fecha} cerrado" → Recepción | ❌ No implementado |
| Cerrar Día | M13 — Folios | Nadie puede abrir/modificar folios del día cerrado | — | ❌ No implementado |
| Cerrar Día | Audit Log (`auditlog` module) | Registra `action='day_close'`, `entity='DayClose'`, `detail` con snapshot | — | ❌ No implementado (el módulo `auditlog` existe pero el audit no escribe en él) |
| Reabrir Día | Audit Log | Registro explícito con usuario y timestamp | F5 a super_admin | ❌ No implementado |

---

## 5. Reglas de negocio a validar en backend (E2)

El backend debe rechazar (HTTP 400 `BUSINESS_RULE`) estas situaciones al intentar **Cerrar Día**, y el frontend mostrar el Toast E2 correspondiente:

1. **Día ya cerrado** → "El día {fecha} ya está cerrado. Usá 'Reabrir Día' si necesitás modificarlo."
2. **Folios abiertos con saldo** → "No se puede cerrar el día: {n} folios tienen saldo pendiente. Cobrá o anulá antes."
3. **Check-outs pendientes** (reservas `checked_in` con `checkOut < hoy`) → "No se puede cerrar el día: {n} huéspedes sin check-out."
4. **Reservas sin check-in vencidas** (auto-no-show) → si el hotel tiene política de no-show automático, mutar `pending` → `no_show` ANTES de cerrar; si no, bloquear el cierre con "Hay {n} reservas sin check-in. ¿Procesar no-shows primero?".
5. **Cierre fuera de ventana horaria** (opcional, por configuración del hotel) → "El cierre del día solo se permite entre {horaInicio} y {horaFin}."
6. **Postear cargos a folio cerrado** → "No se puede postear el cargo de noche: el folio {id} está cerrado." (Ya existe validación análoga en `folios/service.ts:120,143,166`: `if (folio.status !== 'open') throw new ValidationError`.)

### 5.1 Reglas de permisos (E3)

| Acción | Rol mínimo | Línea backend |
|--------|-----------|---------------|
| Ver reporte (`GET /api/night-audit`) | `hotel_admin`, `super_admin` | `composition-root.ts:185` |
| Facturar noches (`POST /api/folios/audit/post-room-charges`) | `hotel_admin`, `super_admin` | `composition-root.ts:238` |
| Cerrar Día (TARGET) | `hotel_admin` | — |
| Reabrir Día (TARGET) | `super_admin` únicamente | — |

---

## 6. Gap analysis (file:line) — qué del cierre diario existe REALMENTE

| # | Componente del cierre | ¿Existe? | Dónde | Veredicto |
|---|----------------------|----------|-------|-----------|
| G1 | Reporte de métricas en vivo (ocupación, ADR, RevPAR, ingresos) | ✅ | `composition-root.ts:185-220` | **REAL** pero read-only, recalcula cada vez |
| G2 | Posteo de tarifa de noche a folios in-house | ✅ | `composition-root.ts:238-263` | **REAL** y funcional |
| G3 | Botón "Iniciar Night Audit" | ⚠ STUB | `index.vue:19,296-309` | **COSMÉTICO** — `setInterval` sin API |
| G4 | Procesamiento real de no-shows (`pending → no_show`) | ❌ | — | **NO EXISTE** (solo se cuentan en `composition-root.ts:198`) |
| G5 | Check-outs automáticos (`checked_in → checked_out`) | ❌ | — | **NO EXISTE** |
| G6 | Modelo `DayClose` / bloqueo de día cerrado | ❌ | — | **NO EXISTE** (no hay tabla ni endpoint) |
| G7 | Snapshot persistido del reporte | ❌ | — | **NO EXISTE** (se pierde al recalcular) |
| G8 | Validación E2 de folios abiertos antes de cerrar | ❌ | — | **NO EXISTE** a nivel cierre (sí existe a nivel folio individual en `folios/service.ts:120`) |
| G9 | Escritura en `auditlog` al cerrar día | ❌ | módulo `auditlog/` existe pero el audit no lo invoca | **NO CONECTADO** |
| G10 | Vista Reporte: "Imprimir" / "Enviar" | ❌ STUB | `index.vue:163-164` | botones sin `@click` |
| G11 | Frontend espera `arrivosPendientes` / `salidasPendientes` | ❌ MISMATCH | `index.vue:281-282` los lee, pero backend `composition-root.ts:203-219` NO los devuelve → lista "Movimientos de Hoy" siempre vacía |
| G12 | `roomStatuses` y `alerts` poblados | ❌ STUB | `index.vue:286,288` — `ref<any[]>([])` vacíos, nunca se llenan | tarjetas siempre vacías |
| G13 | Manejo de error al cargar | ❌ | `index.vue:290-294` — `catch { /* vacío */ }` traga errores | pantalla silenciosa en ceros |
| G14 | Toast success al terminar el audit | ❌ | `index.vue:296-309` | **NO HAY feedback** |
| G15 | Estado loading en botón "Iniciar Night Audit" | ❌ | `index.vue:19` | sin `disabled` ni spinner |
| G16 | Modal danger de confirmación antes de cerrar | ❌ | — | **NO EXISTE** |
| G17 | Conteo de `checkouts` | ⚠ BUG | `composition-root.ts:197` cuenta `status='confirmed'` con `checkOut=hoy`, no `status='checked_out'` | mal etiquetado |

**Resumen de cobertura real:** de los 6 hitos del cierre diario (no-shows, check-outs automáticos, facturación de noches, reporte, bloqueo del día, auditoría), **solo 2 existen**: reporte en vivo (G1) y facturación de noches (G2). El botón principal es decorativo (G3).

---

## 7. Bugs e inconsistencias detectadas

### 7.1 Frontend consume campos que el backend no devuelve (G11)
`index.vue:281-282` itera `auditData.arrivosPendientes` y `auditData.salidasPendientes`, pero `composition-root.ts:203-219` no los retorna. Resultado: la tarjeta "Movimientos de Hoy" está siempre vacía aunque haya movimiento real.

### 7.2 Frontend tiene tarjetas siempre vacías (G12)
`index.vue:286` (`roomStatuses = ref<any[]>([])`) y `index.vue:288` (`alerts = ref<any[]>([])`) nunca se asignan con datos. Las tarjetas "Estado de Habitaciones" y "Alertas Pendientes" renderizan vacío para siempre.

### 7.3 Backend cuenta check-outs mal (G17)
`composition-root.ts:197`:
```ts
const checkoutsHoy = res.filter((r) => r.checkOut === hoy && r.status === 'confirmed').length
```
Cuenta reservas **confirmadas** que vencen hoy, no las que **ya salieron** (`status='checked_out'`). El número reportado como "Check-outs realizados" en realidad es "Check-outs programados pendientes".

### 7.4 `cancelaciones` no filtra por fecha (composition-root.ts:199)
Cuenta TODAS las cancelaciones históricas del hotel, no las de hoy. infla el reporte.

### 7.5 `ingresosServicios` usa `deposit` como proxy (composition-root.ts:195)
`revenueServicios = Σ r.deposit` — mezcla depósitos de seguridad con ingresos por servicios. Conceptualmente incorrecto.

### 7.6 Impuesto hardcodeado al 18% (composition-root.ts:208)
`impuestos: Math.round(revenueHoy * 0.18)` — no usa `taxRateFor(configRepo, hotelId)` como sí hace el módulo de folios (`folios/service.ts:125`). Inconsistente con la configuración por hotel.

---

## 8. Checklist de verificación T3

Estado actual vs. target. Marcar cuando se cumpla.

### Reporte (vista Actividad + Reporte)
- [ ] Reemplazar `catch { /* vacío */ }` por Alert F4 roja + "Reintentar" (G13)
- [ ] Backend devolver `arrivosPendientes` / `salidasPendientes` (G11)
- [ ] Poblar `roomStatuses` desde `GET /api/rooms?byStatus=1` (G12)
- [ ] Poblar `alerts` con folios abiertos + check-outs pendientes (G12)
- [ ] Corregir conteo de checkouts: `status='checked_out'` (G17)
- [ ] Filtrar `cancelaciones` por `updatedAt=hoy` (§7.4)
- [ ] Reemplazar proxy `ingresosServicios` por suma real de cargos `category!='room'` (§7.5)
- [ ] Usar `taxRateFor(configRepo, hotelId)` en vez de `*0.18` hardcodeado (§7.6)
- [ ] Skeleton mientras carga `nightAudit` (F6)

### Cierre del día (TARGET — hoy STUB)
- [ ] Crear modelo `DayClose` (tabla `day_closes`) (G6)
- [ ] Endpoint `POST /api/day-closes` que orqueste los 5 pasos del flow §3
- [ ] Endpoint `POST /api/day-closes/:date/reopen` (solo `super_admin`) (§5.1)
- [ ] Implementar "Procesar No-Shows" → `pending → no_show` (G4)
- [ ] Implementar "Procesar Check-outs Automáticos" → `checked_in → checked_out` (G5)
- [ ] Validación E2 de folios abiertos antes de cerrar (G8)
- [ ] Validación E2 de "día ya cerrado" (regla §5.1)
- [ ] Middleware que bloquee check-ins/out/cargos del día cerrado (G6)
- [ ] Conectar escritura al módulo `auditlog` al cerrar/reabrir (G9)
- [ ] Persistir `reportSnapshot` en `DayClose` (G7)
- [ ] Botón "Imprimir" con `window.print()` o export PDF (G10)
- [ ] Botón "Enviar" → envío por email al admin (G10)

### Feedback canónico (F1-F6)
- [ ] Botón "Cerrar Día" con Modal danger + carga 1.5s anti-clic
- [ ] Caja ⚠ con consecuencias cross-módulo en el modal de cierre
- [ ] Toast success al cerrar día
- [ ] Toast error E2 (folios abiertos / día cerrado / check-outs pendientes)
- [ ] Estado loading en "Iniciar Night Audit" / "Cerrar Día" (F6)
- [ ] Notificación F5 a módulos afectados al cerrar

---

## 9. Pendiente de documentar en T3 (próximas iteraciones)

- [ ] Política de no-show por hotel (¿cargo fijo? ¿% de la primera noche? ¿libre?) — configurable
- [ ] Ventana horaria permitida para cerrar día (¿solo madrugada? ¿cualquier hora?)
- [ ] Cierre con arrears (saldos negativos) — ¿permitir o bloquear?
- [ ] Reporte fiscal (NCF / e-CF R.D.) derivado del snapshot del día
- [ ] Multi-hotel: ¿un admin cierra todos sus hoteles a la vez o uno por uno?
- [ ] Auditoría de re-aperturas: cuántas veces se reabrió un día y por quién

---

*Este documento sigue el molde de `M01-PMS-Central.md` y las convenciones de `00-MASTER.md` (F1-F6, E1-E7, Decision Table, Flow Mermaid). Cuando se implemente el cierre real, actualizar §2.1, §2.2 y §6 para reflejar el código.*
