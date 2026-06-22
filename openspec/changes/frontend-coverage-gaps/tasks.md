# Tasks: frontend-coverage-gaps

> **Reglas**: Cada task es independiente. Cada tarea tiene criterio de aceptación observable (comando o check). Marcar con `[x]` solo tras verificar.

---

## 🔴 FC-A — Categoría A: Endpoints backend vivos sin consumidores

### FC-A1 — Decidir destino del módulo `apikeys`
**Estado**: 🔍 Requiere decisión del usuario
**Módulo afectado**: `backend/src/modules/apikeys/` + frontend

- [x] **FC-A1.1** Confirmar con usuario: ¿apikeys se expone para integraciones (Stripe webhooks, Channex, etc.) o se deprecate?
  - **Opción A (exponer)**: continuar con FC-A1.2-A1.5
  - **Opción B (deprecate)**: marcar módulo como deprecated, no exponer en frontend, cerrar la task
- [x] **FC-A1.2** Crear `frontend/src/services/Apikeys.service.ts` con CRUD (`list`, `create`, `revoke`)
- [x] **FC-A1.3** Crear página `frontend/src/pages/api-keys/index.vue` (solo super_admin)
- [x] **FC-A1.4** Registrar ruta `/panel/api-keys` en `router/index.ts` con guard `requiresSuperAdmin`
- [x] **FC-A1.5** Añadir entrada en `super-admin` layout/nav

**Criterio de aceptación**:
```bash
# Tras implementar
cd backend && bun run node_modules/arckode-framework/bin/arckode.js analyze  # → ✅ VÁLIDO
cd frontend && npx vue-tsc -b  # → 0 errores
# Manual: login como super_admin → ver link "API Keys" → crear + revocar token
```

---

### FC-A2 — Unificar `auditlog` (eliminar duplicación)
**Estado**: 🔍 Requiere decisión del usuario
**Conflicto**: `backend/src/modules/auditlog/` expone `/api/auditlog`, pero `composition-root.ts:582` expone `/api/admin/audit`. `super-admin/audit.vue` usa solo el segundo.

- [x] **FC-A2.1** Decidir cuál queda:
  - **Opción A**: Queda el módulo `/api/auditlog`. Borrar `/api/admin/audit` de composition-root y migrar `Platform.service.audit()` a usar `/auditlog`.
  - **Opción B**: Queda `/api/admin/audit` (es cross-module). Borrar módulo `auditlog` (peligroso — lo usan otros módulos internamente).
- [x] **FC-A2.2** Tras decisión, hacer el cleanup del perdedor
- [x] **FC-A2.3** Actualizar `Platform.service.audit()` o crear `Auditlog.service` según corresponda
- [x] **FC-A2.4** Verificar que `super-admin/audit.vue` sigue funcionando

**Criterio de aceptación**:
```bash
cd backend && bun run typecheck  # 0 errores propios
cd backend && bun test  # 88/88 pass
# Manual: super-admin → Auditoría → ver eventos auditados reales (login, reservas creadas, etc.)
```

---

## 🟡 FC-B — Categoría B: Solo accesible vía super-admin

### FC-B1 — Exponer `anuncios` para hotel-admin
**Estado**: 🟡 Pendiente — requiere aclarar scope con usuario

- [x] **FC-B1.1** Confirmar: ¿hotel-admin necesita ver anuncios internos del sistema (mantenimientos programados, nuevas features, etc.)?
- [x] **FC-B1.2** Si sí → crear `frontend/src/services/Announcements.service.ts`
- [x] **FC-B1.3** Si sí → crear componente `AnnouncementBanner.vue` para mostrar en `AdminLayout` (banner superior dismissible)
- [x] **FC-B1.4** Persistir "leídos" en `Configuration` (key `read_announcements`) para no mostrar 2 veces

**Criterio de aceptación**:
```bash
# Manual: login como hotel-admin → ver banner con anuncios activos → poder cerrar
# Backend: GET /api/anuncios debe devolver los dirigidos al hotel (no solo globales)
```

---

### FC-B2 — Permitir hotel-admin gestionar roles de su equipo
**Estado**: 🟡 Pendiente — validación de seguridad crítica

- [x] **FC-B2.1** Verificar que backend `/api/roles` filtra por `hotelId` (multi-tenant). **GATE BLOQUEANTE** — si no filtra, NO exponer.
- [x] **FC-B2.2** Crear `frontend/src/services/Roles.service.ts` con método `list(hotelId)`
- [x] **FC-B2.3** Crear página `frontend/src/pages/team/index.vue` (lista de usuarios del hotel + su rol)
- [x] **FC-B2.4** Modal para cambiar rol de un usuario (receptionist ↔ hotel_admin) — sin permitir auto-degradarse
- [x] **FC-B2.5** Registrar ruta `/panel/team` con guard `requiresHotelAuth + hotel_admin`
- [x] **FC-B2.6** Añadir entrada en `AdminLayout` nav

**Criterio de aceptación**:
```bash
# GATE seguridad: GET /api/roles?hotelId=X no debe devolver roles de otro hotel
curl -H "Authorization: Bearer <token-hotel-A>" http://localhost:3001/api/roles?hotelId=hotel-B
# → debe devolver [] o 403
# Manual: hotel-admin → Equipo → ver usuarios de su hotel → cambiar rol
```

---

## 🟠 FC-C — Categoría C: Módulos con service pero SIN página propia

### FC-C1 — Vista propia "Folios Abiertos / In-House"
**Estado**: 🟢 Ready — services ya existen

- [x] **FC-C1.1** Crear página `frontend/src/pages/folios/index.vue`
- [x] **FC-C1.2** Sección "In-House" — reservas con status `checked_in` y su folio abierto
- [x] **FC-C1.3** Para cada folio: lista de cargos (habitación, extras, servicios), total, botón "Cerrar folio"
- [x] **FC-C1.4** Modal "Agregar cargo" (category, description, amount, quantity)
- [x] **FC-C1.5** Botón "Postear cargos habitación" masivo (invoca `/api/folios/audit/post-room-charges`)
- [x] **FC-C1.6** Registrar ruta `/panel/folios` con guard `requiresHotelAuth + hotel_admin`
- [x] **FC-C1.7** Integrar con Facturas: botón "Generar factura" al cerrar folio (ya existe `/api/folios/:id/invoice`)

**Criterio de aceptación**:
```bash
# Manual: crear reserva → check-in → ir a Folios → ver folio abierto → agregar cargo → cerrar → generar factura
cd frontend && npx vue-tsc -b  # 0 errores
```

---

### FC-C2 — Centro de notificaciones (bell icon + bandeja)
**Estado**: 🔴 Crítico — UX fundamental faltante
**Endpoints disponibles**: `/api/notificaciones` (CRUD)

- [x] **FC-C2.1** Crear `frontend/src/services/Notifications.service.ts` (list, markAsRead, markAllAsRead, delete)
- [x] **FC-C2.2** Crear `frontend/src/components/features/core-pms/NotificationBell.vue` (icono con badge de no-leídas)
- [x] **FC-C2.3** Dropdown al click: lista últimas 10, agrupadas por tipo (reserva, pago, housekeeping, sistema)
- [x] **FC-C2.4** Botones: "Marcar leídas todas", "Ver todas" → va a página dedicada
- [x] **FC-C2.5** Crear `frontend/src/pages/notifications/index.vue` (bandeja completa con filtros)
- [x] **FC-C2.6** Integrar `NotificationBell.vue` en `AdminLayout.vue` (header, al lado del avatar)
- [x] **FC-C2.7** Polling cada 30s para refresh badge (o WebSocket cuando esté disponible)
- [x] **FC-C2.8** Backend: verificar que eventos disparan `notificaciones.create()` (reserva nueva, check-in, pago recibido) — si no, añadir connectors

**Criterio de aceptación**:
```bash
# Manual: trigger evento (crear reserva) → ver badge +1 en bell → click → ver notificación → marcar leída → badge desaparece
cd frontend && npx vue-tsc -b  # 0 errores
```

---

## 🔵 FC-D — Categoría D: Nuevos endpoints sin página de gestión

### FC-D1 — Historial de envíos (message-logs)
**Estado**: 🟢 Ready — endpoint existe en composition-root

- [x] **FC-D1.1** Crear `frontend/src/services/MessageLogs.service.ts` (list con filtros: reservationId, status, dateRange)
- [x] **FC-D1.2** Crear página `frontend/src/pages/message-logs/index.vue`
- [x] **FC-D1.3** Tabla: fecha, reserva (link), tipo (email/whatsapp), destinatario, estado (sent/failed/pending), respuesta
- [x] **FC-D1.4** Filtros: por tipo, por estado, por rango fechas, buscar por guest
- [x] **FC-D1.5** Export CSV
- [x] **FC-D1.6** Registrar ruta `/panel/message-logs` con guard `requiresHotelAuth`

**Criterio de aceptación**:
```bash
# Manual: enviar auto-message → ir a Historial → ver registro → filtrar por "failed" → ver errores
```

---

### FC-D2 — Gestión de links de pago (payment-requests)
**Estado**: 🟢 Ready — service Payments.service existe

- [x] **FC-D2.1** Crear página `frontend/src/pages/payments/index.vue`
- [x] **FC-D2.2** Tabla: reserva, monto, moneda, estado (pending/paid/expired/cancelled), enviado a, enviado vía, fecha
- [x] **FC-D2.3** Filtros: por estado, por fecha, buscar por guest
- [x] **FC-D2.4** Acciones por fila: "Reenviar link" (email/whatsapp), "Marcar pagado" (manual), "Cancelar"
- [x] **FC-D2.5** Botón "Nuevo link de pago" → modal (seleccionar reserva + monto)
- [x] **FC-D2.6** Estadísticas top: pendiente total, cobrado este mes, expirados
- [x] **FC-D2.7** Registrar ruta `/panel/payments` con guard `requiresHotelAuth`

**Criterio de aceptación**:
```bash
# Manual: crear link desde modal reserva → ir a Payments → verlo pendiente → reenviar por WhatsApp → marcar pagado manual
```

---

### FC-D3 — CRUD de plantillas WhatsApp
**Estado**: 🟢 Ready — service Whatsapp.service existe

- [x] **FC-D3.1** Crear página `frontend/src/pages/whatsapp-templates/index.vue`
- [x] **FC-D3.2** Lista de plantillas: nombre, body (preview truncado), categoría, activa
- [x] **FC-D3.3** Modal crear/editar: name, body (textarea con hint de variables `{guest_name}` etc.), category (select), isActive (toggle)
- [x] **FC-D3.4** Botón "Probar" → abre WhatsApp Web con datos demo (`wa.me` link)
- [x] **FC-D3.5** Variables disponibles en tooltip: `{guest_name}`, `{checkin_date}`, `{room_number}`, `{total_amount}`, etc.
- [x] **FC-D3.6** Registrar ruta `/panel/whatsapp-templates` con guard `requiresHotelAuth`

**Criterio de aceptación**:
```bash
# Manual: crear plantilla "Bienvenida" con variables → activar → verla disponible en modal reserva
```

---

## 🟢 FC-E — Categoría E: Refactor anti-patrón http directo

### FC-E1 — `auto-messages` usar `AutoMessages.service`
**Estado**: 🟢 Trivial — service ya existe

- [x] **FC-E1.1** En `pages/auto-messages/index.vue`, reemplazar 4 `http.get/post/put/delete('/auto-messages...')` por `AutoMessagesService.list/create/update/remove`
- [x] **FC-E1.2** Eliminar import de `http` si ya no se usa
- [x] **FC-E1.3** Verificar comportamiento idéntico (CRUD sigue funcionando)

**Criterio de aceptación**:
```bash
cd frontend && grep -E "http\.(get|post|put|delete)" src/pages/auto-messages/index.vue
# → debe devolver 0 resultados
cd frontend && npx vue-tsc -b  # 0 errores
# Manual: CRUD auto-messages funciona igual que antes
```

---

### FC-E2 — `cerraduras` usar `TTLock.service`
**Estado**: 🟢 Trivial — service ya existe

- [x] **FC-E2.1** En `pages/cerraduras/index.vue`, reemplazar 7 `http.get/put/delete('/ttlock/...')` por métodos de `TTLockService`
- [x] **FC-E2.2** Eliminar import de `http`
- [x] **FC-E2.3** Verificar comportamiento idéntico

**Criterio de aceptación**:
```bash
cd frontend && grep -E "http\.(get|post|put|delete)" src/pages/cerraduras/index.vue
# → debe devolver 0 resultados
cd frontend && npx vue-tsc -b  # 0 errores
```

---

### FC-E3 — Crear services faltantes para páginas con anti-patrón
**Estado**: 🟢 Bajo effort — 3 services simples

- [x] **FC-E3.1** Crear `frontend/src/services/Gastos.service.ts` (CRUD contra `/gastos`)
- [x] **FC-E3.2** Refactorizar `pages/gastos/index.vue` para usar `GastosService` (2 llamadas)
- [x] **FC-E3.3** Crear `frontend/src/services/Opiniones.service.ts` (CRUD contra `/opiniones`)
- [x] **FC-E3.4** Refactorizar `pages/opiniones/index.vue` para usar `OpinionesService` (4 llamadas)
- [x] **FC-E3.5** Crear `frontend/src/services/Caja.service.ts` (CRUD contra `/caja`)
- [x] **FC-E3.6** Refactorizar `pages/caja/index.vue` para usar `CajaService` (3 llamadas)
- [x] **FC-E3.7** `booking-widget` y `pre-checkin` son PÚBLICOS (sin auth) — pueden quedar con `http` directo o tener `Public.service.ts`. Decision: dejar como están (no rompen patrón porque son públicos).

**Criterio de aceptación**:
```bash
cd frontend && grep -lE "http\.(get|post|put|delete)" src/pages/{gastos,opiniones,caja}/index.vue 2>/dev/null
# → debe devolver 0 resultados
cd frontend && npx vue-tsc -b  # 0 errores
```

---

## 📊 Resumen ejecutivo

| ID | Gap | Categoría | Prioridad | Effort | Bloqueantes |
|---|---|---|---|---|---|
| FC-A1 | apikeys | A | 🔻 Baja | Bajo | Decisión usuario |
| FC-A2 | auditlog duplicado | A | 🔻 Baja | Bajo | Decisión usuario |
| FC-B1 | anuncios hotel-admin | B | 🔻 Baja | Bajo | Decisión usuario |
| FC-B2 | roles hotel-admin | B | 🟡 Media | Medio | Security check |
| FC-C1 | Folios vista propia | C | 🟡 Media | Medio | — |
| **FC-C2** | **Notificaciones (bell + bandeja)** | C | 🔴 **Crítica** | Medio | — |
| FC-D1 | Message-logs historial | D | 🟢 Baja | Bajo | — |
| FC-D2 | Payment-requests gestión | D | 🟡 Media | Bajo | — |
| FC-D3 | WhatsApp templates CRUD | D | 🟡 Media | Bajo | — |
| FC-E1 | Refactor auto-messages | E | 🟢 Trivial | Muy bajo | — |
| FC-E2 | Refactor cerraduras | E | 🟢 Trivial | Muy bajo | — |
| FC-E3 | Services gastos/opiniones/caja | E | 🟢 Bajo | Bajo | — |

**Total tasks**: 14 tickets, 62 sub-tareas.

---

## 🎯 Orden recomendado de ejecución

### Sprint 1 — Quick wins (1 día)
1. **FC-E1** + **FC-E2** — Refactor anti-patrón (trivial, mejora consistencia)
2. **FC-E3** — Services faltantes (3 services chicos)
3. **FC-D3** — WhatsApp templates CRUD (página simple)

### Sprint 2 — UX crítica (2-3 días)
4. **FC-C2** — Notificaciones bell + bandeja (impacto UX más alto)
5. **FC-C1** — Folios vista propia
6. **FC-D2** — Payment-requests gestión

### Sprint 3 — Decisiones y cleanup (1 día)
7. **FC-A1, FC-A2, FC-B1** — Requieren input del usuario (juntar en 1 sesión de preguntas)
8. **FC-B2** — Roles (precede security check del backend)

### Sprint 4 — Cierre (1 día)
9. **FC-D1** — Message-logs historial (útil para debug)
10. Verificación final + actualizar `state.yaml`

**Total estimado**: ~5-7 días de trabajo efectivo.

---

## 🔍 Verificación final (GATE)

Tras completar todas las tasks:

- [ ] **GATE-1** `cd backend && bun run node_modules/arckode-framework/bin/arckode.js analyze` → ✅ VÁLIDO
- [ ] **GATE-2** `cd backend && bun run typecheck` → 0 errores propios
- [ ] **GATE-3** `cd backend && bun test` → 88+/88+ pass
- [ ] **GATE-4** `cd frontend && npx vue-tsc -b` → 0 errores
- [ ] **GATE-5** `cd frontend && npx vite build` → built sin errores
- [ ] **GATE-6** Cobertura backend → frontend: 100% de módulos con endpoints únicos están expuestos (excepto los explícitamente deprecados)
- [ ] **GATE-7** Anti-patrón `http.get/post/put/delete` directo en páginas: 0 ocurrencias (excepto páginas públicas booking-widget, pre-checkin, landing)
- [ ] **GATE-8** Actualizar `state.yaml` con `status: done` y `tasks_done: 62`
- [ ] **GATE-9** Commit con mensaje `feat(frontend): close coverage gaps - all backend modules exposed`
