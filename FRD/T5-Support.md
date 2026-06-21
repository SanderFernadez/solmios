# FRD · T5 — Support / Soporte (Helpdesk)

**Transversal:** T5
**Nombre:** Soporte — Centro de Ayuda y Tickets
**Estado:** Implementado (parcial)
**Fecha:** 2026-06-19
**Pantalla:** `/panel/support`
**Frontend:** `frontend/src/pages/support/index.vue` (330 líneas)
**Backend:** Módulo `tickets` completo (model/service/controller/validators/sockets)
**Servicio frontend:** `OperationsService.tickets` (CRUD vía `makeCrud('tickets')`)
**Roles:** Todos los usuarios autenticados (sin `meta.requiresHotelAdmin`)

---

## 1. Propósito

Sistema de helpdesk/ticketing para que el personal del hotel reporte problemas técnicos, dudas de configuración, issues con integraciones, o solicite capacitación. Cada ticket tiene categoría, prioridad, estado, y un hilo de conversación.

---

## 2. Modelo de datos (fuente de verdad)

### 2.1 Schema de Tickets (`tickets` table)

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `id` | string (PK) | auto | UUID |
| `hotelId` | string | required | Hotel al que pertenece |
| `userId` | string | required | Creador del ticket |
| `subject` | string | required (min:2, max:200) | Asunto del ticket |
| `category` | string | `"technical"` | Categoría |
| `priority` | string | `"medium"` | Prioridad |
| `status` | string | `"open"` | Estado actual |
| `description` | text | — | Descripción detallada |
| `assignedTo` | string | — | Nombre de quien lo atiende |
| `messages` | json | `[]` | Hilo de conversación (array de mensajes) |
| `createdAt` | timestamp | auto | — |
| `updatedAt` | timestamp | auto | — |

### 2.2 Estados (`ticket.status`)

| Estado DB | Estado UI | Color badge |
|-----------|-----------|-------------|
| `open` / `abierto` | Abierto | orange/10 text-orange |
| `in_progress` / `en_progreso` | En Progreso | cyan/10 text-cyan |
| `resolved` / `resuelto` | Resuelto | teal/10 text-teal |
| `closed` / `cerrado` | Cerrado | surface text-text-muted |

> ⚠ **Nota:** El frontend mapea entre español (`ABIERTO`, `EN_PROGRESO`, `CERRADO`) e inglés (`open`, `in_progress`, `closed`) usando los maps `PRI_EN` y `EST_EN`. El backend almacena en español.

### 2.3 Prioridades (`ticket.priority`)

| Prioridad | Label UI | Color | Significado |
|-----------|----------|-------|-------------|
| `baja` | Baja | surface text-text-muted | Sugerencia o mejora |
| `media` / default | Normal | blue/10 text-blue | Duda o configuración |
| `alta` | Alta | orange/10 text-orange | Funcionalidad bloqueada |
| `urgente` | Urgente | red/10 text-red | Sistema caído o overbooking |

### 2.4 Categorías (`ticket.category`)

| Categoría | Color | Descripción |
|-----------|-------|-------------|
| Técnico | red/10 text-red | Bugs, errores de sistema |
| Integraciones | cyan/10 text-cyan | Channex, OTAs, conexiones externas |
| Facturación | navy/10 text-navy | Facturación electrónica (DGII, DIAN, SAT) |
| Configuración | purple/10 text-purple | Settings del sistema |
| Capacitación | teal/10 text-teal | Ayuda, tutoriales, onboarding |
| Sugerencia | gold/10 text-gold | Mejoras propuestas |
| Otro | — | No categorizado |

### 2.5 Estructura de un mensaje en `messages` (JSON)

```json
{
  "author": "Hotel Admin",
  "date": "19 jun., 14:30",
  "message": "Hola, necesito ayuda con..."
}
```

---

## 3. API Endpoints

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| `GET` | `/api/tickets?hotelId={id}` | autenticado | Lista tickets del hotel |
| `POST` | `/api/tickets` | autenticado | Crear ticket nuevo |
| `PUT` | `/api/tickets/:id` | autenticado | Actualizar ticket (estado, asignado, etc.) |
| `DELETE` | `/api/tickets/:id` | autenticado | Eliminar ticket |

### 3.1 Validación en backend

**Create:** `hotelId` (required), `userId` (required), `subject` (required, min:2, max:200), `category`, `priority`, `status`, `description`, `assignedTo`, `messages`

**Update:** `subject`, `category`, `priority`, `status`, `description`, `assignedTo`, `messages`

---

## 4. Frontend — Desglose del componente

### 4.1 Estructura de la página

| Sección | Líneas | Descripción |
|---------|--------|-------------|
| Header | 3–12 | Título "Soporte", botón "+ Nuevo Ticket" |
| Métricas | 14–20 | Grid de 4 cards: Abiertos, En Progreso, Resueltos, Total |
| Quick Links | 22–32 | 4 recursos: Guía Rápida, Video Tutoriales, Chat en Vivo, Email Directo |
| Filtros | 34–43 | Botones de filtro por estado + barra de búsqueda |
| Lista de tickets | 45–73 | Tabla con badge de prioridad, estado, categoría, asunto, fecha, respuestas |
| Modal Ver Ticket | 75–127 | Detalle completo: asunto, descripción, asignado, hilo de conversación |
| Modal Responder | 129–145 | Formulario de respuesta con textarea |
| Modal Nuevo Ticket | 147–184 | Formulario completo: categoría, prioridad, asunto, descripción, archivos adjuntos |

### 4.2 Estado reactivo

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `activeFilter` | `ref('all')` | Filtro de estado activo |
| `searchQuery` | `ref('')` | Texto de búsqueda |
| `showViewModal` | `ref(false)` | Modal de detalle abierto |
| `showReplyModal` | `ref(false)` | Modal de respuesta abierto |
| `showNewTicketModal` | `ref(false)` | Modal de nuevo ticket abierto |
| `selectedTicket` | `ref<any>({})` | Ticket seleccionado |
| `replyMessage` | `ref('')` | Texto de respuesta |
| `tickets` | `ref<any[]>([])` | Lista de tickets cargados |
| `newTicket` | `ref({category, priority, subject, description, files})` | Formulario de nuevo ticket |

### 4.3 Métricas computadas

| Métrica | Cálculo |
|---------|---------|
| Abiertos | `tickets.filter(t => t.status === 'Abierto').length` |
| En Progreso | `tickets.filter(t => t.status === 'En Progreso').length` |
| Resueltos | `tickets.filter(t => t.status === 'Resuelto').length` |
| Total | `tickets.length` |

### 4.4 Filtros disponibles

| Label | Valor | Filtra por |
|-------|-------|-----------|
| Todos | `all` | Sin filtro |
| Abiertos | `Abierto` | `status === 'Abierto'` |
| En Progreso | `En Progreso` | `status === 'En Progreso'` |
| Resueltos | `Resuelto` | `status === 'Resuelto'` |
| Cerrados | `Cerrado` | `status === 'Cerrado'` |

### 4.5 Búsqueda

Filtra por `subject` (case-insensitive) o por `id` (string match).

### 4.6 Quick Links (estáticos, hardcoded)

| Icono | Título | Descripción |
|-------|--------|-------------|
| 📖 | Guía Rápida | Aprende lo básico del sistema |
| 🎥 | Video Tutoriales | Paso a paso en video |
| 💬 | Chat en Vivo | Habla con soporte ahora |
| 📧 | Email Directo | soporte@arckode.com |

> ⚠ Los Quick Links son **hardcoded** y no apuntan a URLs reales. Son solo UI estática.

---

## 5. Decision Table

### 5.1 Acciones principales

| Trigger | Condición | Resultado | Modal/Toast (texto) | Errores | Notif F5 |
|---------|-----------|-----------|----------------------|---------|----------|
| Botón **"+ Nuevo Ticket"** | — | Abre modal form vacío | Modal `form`: "Nuevo Ticket de Soporte" | — | — |
| Botón **"Crear Ticket"** (form válido) | `subject` no vacío | POST ticket + cierra modal + recarga lista | **Hoy:** sin toast success (solo cierra y recarga). **Target:** Toast success "Ticket creado." | E1 "Asunto es obligatorio" · E6 "Sin conexión" | — |
| Botón **"Crear Ticket"** (sin asunto) | `subject` vacío | **No envía** (early return) | **Hoy:** silencioso (sin feedback). **Target:** Toast E1 o inline | — | — |
| Clic en fila de ticket | — | Abre **modal detail** con datos completos | Modal `detail`: prioridad, estado, fecha, asunto, descripción, asignado, conversación | — | — |
| Botón **"Responder"** (en modal detail) | `status !== 'Cerrado'` | Cierra modal detail → abre **modal reply** | Modal `form`: "Responder Ticket #N" | — | — |
| Botón **"Enviar"** (respuesta) | `replyMessage.trim()` tiene contenido | Agrega mensaje al array `replies` en memoria + cierra modal | **Hoy:** sin toast. **Target:** Toast success "Respuesta enviada." | — | — |
| Botón **"Enviar"** (respuesta vacía) | `replyMessage` vacío | **No envía** (early return, `trim()` check) | **Hoy:** silencioso. **Target:** Inline E1 "Escribí tu respuesta" | — | — |
| Botón **"Cerrar Ticket"** (en modal detail) | `status !== 'Cerrado'` | PUT ticket `status='cerrado'` + recarga lista | **Hoy:** alert en error. **Target:** Toast success "Ticket cerrado." | `alert(e.message)` en catch | — |
| Botón **"Cerrar"** (modal detail) | — | Cierra modal | — | — | — |
| Botón **"Cancelar"** (modal reply) | — | Cierra modal reply | — | — | — |
| Clic en backdrop (`@click.self`) | modal abierto | Cierra el modal | — | — | — |
| Filtro de estado | — | Filtra lista | — | — | — |
| Búsqueda por texto | — | Filtra por subject/id | — | — | — |

### 5.2 Formulario Nuevo Ticket — Campos

| Campo | Tipo | Opciones | Requerido | Validación |
|-------|------|----------|-----------|-----------|
| Categoría | select | Técnico, Integraciones, Facturación, Configuración, Capacitación, Sugerencia, Otro | Sí | — |
| Prioridad | select | Baja, Normal, Alta, Urgente | Sí (default: Normal) | — |
| Asunto | text | — | Sí | min 2, max 200 chars |
| Descripción | textarea | — | Sí (UI), NO validado en backend (sin required) | — |
| Archivos | file input (multiple) | PNG, JPG, PDF, LOG (máx 5MB) | No | Solo nombres guardados, sin upload real |

---

## 6. Flow — Crear Ticket

```mermaid
flowchart TD
    A([Clic "+ Nuevo Ticket"]) --> B[Abre modal form]
    B --> C[/Usuario completa form/]
    C --> D{subject vacío?}
    D -- sí --> D1[Sin feedback, return silencioso]
    D1 --> C
    D -- no --> E[POST /api/tickets]
    E --> F{HTTP 201?}
    F -- sí --> G[Cierra modal]
    G --> H[Recarga lista loadData()]
    H --> I[Toast success: Ticket creado]
    I --> J([Fin])
    F -- 400 --> K[E1 Toast: campo requerido]
    F -- 5xx --> L[E6 Toast: Sin conexión]
    L --> C
```

---

## 7. Flow — Responder Ticket

```mermaid
flowchart TD
    A([Clic "Responder"]) --> B[Cierra detail modal]
    B --> C[Abre modal reply]
    C --> D[/Escribe respuesta/]
    D --> E{respuesta vacía?}
    E -- sí --> E1[Sin feedback, return]
    E1 --> D
    E -- no --> F[Agrega mensaje a replies en memoria]
    F --> G[Toast success: Respuesta enviada]
    G --> H[Cierra modal reply]
    H --> I([Fin])
```

---

## 8. Flow — Cerrar Ticket

```mermaid
flowchart TD
    A([Clic "Cerrar Ticket"]) --> B[PUT /api/tickets/:id status=cerrado]
    B --> C{HTTP 200?}
    C -- sí --> D[Cierra modal detail]
    D --> E[Recarga lista loadData()]
    E --> F[Toast success: Ticket cerrado]
    F --> G([Fin])
    C -- error --> H["alert(e.message) ⚠ Hoy"]
    H --> I[Target: Toast E6]
```

---

## 9. Dependencias cross-módulo

| Módulo | Qué alimenta a T5 | Tipo |
|--------|-------------------|------|
| Tickets (módulo propio) | CRUD completo de tickets | Lectura/Escritura |
| Auth store | `hotelId`, `user.id`, `token` | Lectura |

> T5 es **autocontenido** — no depende de otros módulos de negocio. Solo usa auth para hotelId.

---

## 10. Gap analysis — Implementado vs Target

| # | Aspecto | Estado actual | Target | Ubicación |
|---|---------|--------------|--------|-----------|
| G1 | Toast success al crear | Sin toast (solo cierra modal + recarga) | Toast success "Ticket creado." | `support/index.vue:316-328` |
| G2 | Toast success al responder | Sin toast (solo cierra modal) | Toast success "Respuesta enviada." | `support/index.vue:282-290` |
| G3 | Error handling crear | `alert(e.message)` | Toast E6 "No se pudo crear el ticket." | `support/index.vue:328` |
| G4 | Error handling cerrar | `alert(e.message)` | Toast E6 "No se pudo cerrar el ticket." | `support/index.vue:297` |
| G5 | Validación crear | Solo valida `subject` (early return) | Inline E1 en subject + validación de categoría/descripción | `support/index.vue:314` |
| G6 | Validación responder | Solo valida `trim()` | Inline E1 "Escribí tu respuesta" | `support/index.vue:283` |
| G7 | Loading en botones | Sin loading state | Spinner + disabled en "Crear Ticket", "Enviar", "Cerrar Ticket" | — |
| G8 | Skeleton loading | Sin skeleton | Skeleton de filas de ticket | — |
| G9 | Quick Links | Hardcoded, sin URLs | Links reales a docs/help center | `support/index.vue:231-236` |
| G10 | Archivos adjuntos | Solo guarda nombres de archivo, sin upload | Upload real a S3/storage + preview | `support/index.vue:177,300-311` |
| G11 | Respuesta solo en memoria | `sendReply` agrega al array local, NO persiste | PUT ticket con nuevo mensaje en `messages` JSON | `support/index.vue:282-290` |
| G12 | Notificación al responder | Sin F5 | Notificación in-app al equipo de soporte | — |
| G13 | Filtro por categoría | No existe | Agregar filtro por categoría (solo por estado hoy) | — |
| G14 | Filtro por prioridad | No existe | Agregar filtro por prioridad | — |
| G15 | Paginación | No hay (muestra todos) | Paginación o scroll infinito si >50 tickets | — |

---

## 11. Checklist de verificación T5

### Data
- [ ] `GET /api/tickets` retorna lista de tickets del hotel
- [ ] `POST /api/tickets` crea ticket con campos requeridos
- [ ] `PUT /api/tickets/:id` actualiza ticket (ej: cambiar status)
- [ ] Mensajes (`messages`) se guardan como JSON array

### UI — Lista
- [ ] Métricas muestran conteos correctos por estado
- [ ] Filtros funcionan (Todos, Abiertos, En Progreso, Resueltos, Cerrados)
- [ ] Búsqueda filtra por subject/id
- [ ] Estado vacío muestra icono 🎫 + "No hay tickets"

### UI — Crear Ticket
- [ ] Modal form con todos los campos: categoría, prioridad, asunto, descripción, archivos
- [ ] Categoría tiene 7 opciones
- [ ] Prioridad tiene 4 opciones (default: Normal)
- [ ] Subject validado (requerido)
- [ ] Archivos adjuntos se agregan/eliminan del form
- [ ] Botón "Crear Ticket" envía POST

### UI — Ver Ticket
- [ ] Modal muestra: prioridad, estado, fecha, asunto, descripción, asignado
- [ ] Conversación se muestra con burbujas (autor vs soporte)
- [ ] Botón "Responder" (si no está cerrado)
- [ ] Botón "Cerrar Ticket" (si no está cerrado)

### UI — Responder
- [ ] Modal con textarea
- [ ] Botón "Enviar" agrega mensaje
- [ ] Botón "Cancelar" cierra sin enviar

### Feedback
- [ ] Toast success al crear ticket (⚠ NO implementado)
- [ ] Toast success al responder (⚠ NO implementado)
- [ ] Toast success al cerrar ticket (⚠ NO implementado)
- [ ] Toast error E6 en cada acción (⚠ hoy usa alert())
- [ ] Loading en botones de acción (⚠ NO implementado)

### Errores
- [ ] No hay `alert()` nativo del navegador (⚠ hay 2: crear + cerrar)
- [ ] Sin skeleton loading (⚠ gap)
- [ ] Sin paginación para listas grandes (⚠ gap)

---

*Documento generado desde código real: `frontend/src/pages/support/index.vue` + `backend/src/modules/tickets/`.*
