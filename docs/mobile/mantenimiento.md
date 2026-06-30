# Mantenimiento Mobile — Spec para construcción

Tickets de reparación/mantenimiento. El técnico ve los tickets (idealmente los suyos), marca inicio/fin con timer, agrega notas, sube fotos **before/after/during**, y consulta el historial de auditoría.

> Prerrequisito: leer [README.md](./README.md) (auth, base URL, estado de habilitación).
> ⚠ **Este módulo NO es simétrico a Housekeeping.** Leer [Asimetría](./README.md#asimetría-entre-módulos).

---

## Flujo del técnico (día típico)

```
Login → ver tickets abiertos → abrir ticket → Iniciar (timer arranca)
       → foto "antes" → trabajar → nota → foto "después" → Completar (timer detiene)
```

---

## Pantallas sugeridas

| # | Pantalla | Datos | Endpoints |
|---|----------|-------|-----------|
| 1 | **Login** | email + password | `POST /api/auth/login` |
| 2 | **Tickets** (lista) | filtros: estado / categoría / prioridad; tabs: Abiertos / En progreso / En espera | `GET /api/mantenimiento?status={s}&category={c}` |
| 3 | **Detalle de ticket** | título, descripción, categoría, prioridad, costo est., fotos b/a/d, notas, timer en vivo | `GET /api/mantenimiento/:id` |
| 4 | **Historial** (audit) | línea de tiempo de cambios | `GET /api/mantenimiento/:id/audit` |
| 5 | **Acciones inline** | Iniciar / Nota / Foto / Completar | `POST /:id/start`, `PUT /:id/notes`, `POST /:id/photos`, `POST /:id/complete` |

> El timer `in_progress` debe actualizarse en vivo cada 60s (`now - startTime`). Mismo patrón que Housekeeping.

---

## Endpoints

Prefijo: `/api/mantenimiento`. Auth: `Authorization: Bearer <token>`.

| Método | Ruta | Roles hoy | Roles objetivo (app) | Qué hace |
|--------|------|-----------|----------------------|----------|
| `GET` | `/api/mantenimiento` | hotel_admin, receptionist, super_admin | + `staff` | Lista paginada con filtros |
| `GET` | `/api/mantenimiento/:id` | hotel_admin, receptionist, super_admin | + `staff` | Un ticket |
| `POST` | `/api/mantenimiento` | hotel_admin, receptionist, super_admin | — (solo admin) | Crear ticket |
| `PUT` | `/api/mantenimiento/:id` | hotel_admin, super_admin | + `staff` (parcial: notas) | Actualizar |
| `DELETE` | `/api/mantenimiento/:id` | hotel_admin, super_admin | — (solo admin) | Eliminar |
| `POST` | `/api/mantenimiento/:id/start` | hotel_admin, receptionist, super_admin | **+ `staff`** | Iniciar (timer) |
| `POST` | `/api/mantenimiento/:id/complete` | hotel_admin, receptionist, super_admin | **+ `staff`** | Completar (cierra) |
| `PUT` | `/api/mantenimiento/:id/notes` | hotel_admin, receptionist, super_admin | **+ `staff`** | Agregar notas del técnico |
| `POST` | `/api/mantenimiento/:id/photos` | hotel_admin, receptionist, super_admin | **+ `staff`** | Subir foto (**multipart**) |
| `GET` | `/api/mantenimiento/:id/audit` | hotel_admin, receptionist, super_admin | **+ `staff`** | Historial de auditoría |
| `GET` | `/api/mantenimiento/stats` | hotel_admin, receptionist, super_admin | — (solo admin) | Estadísticas del hotel |

> **Diferencia con Housekeeping**: aquí `start`/`complete` son **`POST`**, no `PUT`. Y existe `/notes` y `/audit` propias.

---

## State machine

```
        start            complete
  open ────────▶ in_progress ──────────▶ closed
   ▲                 │                     │
   │     (waiting)   ▼                     │
   │             waiting                   │
   │                 │                     │
   └─── reopen ──────┴─────────────────────┘
```

Matriz de transiciones (validada en `usecases/timings.ts`):

| Desde | Hacia permitidos |
|-------|------------------|
| `open` | `in_progress`, `closed` |
| `in_progress` | `waiting`, `closed` |
| `waiting` | `in_progress`, `closed` |
| `resolved` | `closed`, `open` |
| `closed` | `open` (reopen) |

**Operaciones de alto nivel:**
- `POST /:id/start`: solo desde `open` → setea `status: 'in_progress'`, `startTime: <now>`.
- `POST /:id/complete`: valida transición a `closed` → setea `status: 'closed'`, `endTime: <now>`, `resolvedDate: <now>`. Body opcional `{ notes }`.
- `PUT /:id` con `status` en el body: pasa por la misma validación de transición.

> `complete` no exige `startTime` (a diferencia de Housekeeping). Pero sin `startTime`+`endTime`, el ticket no entra en el cálculo de `avgResolutionHours`.

---

## DTOs

### `MantenimientoDTO` (response)

```ts
interface MantenimientoDTO {
  id: string
  hotelId: string
  roomId?: string
  roomNumber?: string
  title: string                     // min 2, max 200
  description?: string              // max 2000
  category?: MaintenanceCategory    // default 'general'
  priority?: MaintenancePriority    // default 'medium'
  status?: MaintenanceStatus        // default 'open'
  assignedTo?: string               // ⚠ string LIBRE, no FK a EmployeeProfile
  estimatedCost?: number            // default 0
  reportedDate?: string             // ISO
  resolvedDate?: string             // ISO — seteado por complete()
  startTime?: string                // ISO — seteado por start()
  endTime?: string                  // ISO — seteado por complete()
  notes?: string
  photos?: MaintenancePhoto[]
  createdAt: string
  updatedAt: string
}

type MaintenanceCategory = 'general' | 'plumbing' | 'electrical' | 'hvac'
  | 'furniture' | 'appliance' | 'structural' | 'pest_control'
  | 'carpentry' | 'painting' | 'electronics'

type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent'

type MaintenanceStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'

interface MaintenancePhoto {
  url: string
  path: string
  type: 'before' | 'after' | 'during'
  uploadedBy: string                // userId
  uploadedAt: string               // ISO
}
```

### Query params (`GET /api/mantenimiento`)

```ts
{
  hotelId?: string                  // solo super_admin; demás usan el del token
  status?: MaintenanceStatus
  category?: MaintenanceCategory
  priority?: MaintenancePriority
  roomId?: string
  search?: string                   // busca en título/descripción
  sortBy?: string                   // default por createdAt
  sortOrder?: 'asc' | 'desc'
  page?: number                     // default 1, min 1
  limit?: number                    // default 20, min 1, max 100
}
```

### Response paginada

```ts
{
  data: MantenimientoDTO[],
  pagination: {
    page: number, limit: number, total: number,
    totalPages: number, hasNext: boolean, hasPrev: boolean,
  }
}
```

### `MaintenanceAuditDTO` (`GET /:id/audit`)

```ts
interface MaintenanceAuditDTO {
  id: string
  orderId: string                   // FK al ticket
  hotelId: string
  userId: string
  action: 'created' | 'status_change' | 'assignment'
        | 'notes_added' | 'photo_added' | 'priority_change' | 'cost_updated'
  oldValue?: string
  newValue?: string
  timestamp: string                 // ISO
}
```

---

## Fotos — MULTIPART/form-data (distinto de Housekeeping)

Mantenimiento **sí** usa `multipart/form-data` (no base64). Dos campos: `file` (binario) + `type` (string).

```http
POST /api/mantenimiento/:id/photos
Authorization: Bearer <token>
Content-Type: multipart/form-data; boundary=...

(file: <binario>, type: "before")
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `file` | binary | ✅ | Imagen |
| `type` | string | ❌ | `"before"` / `"after"` / `"during"` — default `"during"` |

**Reglas (validadas server-side):**
- `mimeType` debe empezar con `image/`.
- Máximo **20 fotos por ticket**.
- Body limit: **10 MB**.
- Requiere `StorageService` configurado en el backend → si no, `500 "StorageService no configurado"` (error de infra, no de la app).

**Cliente (ejemplo):**
```ts
async function uploadPhoto(ticketId: string, file: File, type: 'before' | 'after' | 'during') {
  const form = new FormData()
  form.append('file', file)
  form.append('type', type)
  const res = await fetch(`${API_BASE_URL}/api/mantenimiento/${ticketId}/photos`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },  // NO setear Content-Type: el browser pone el boundary
    body: form,
  })
  if (!res.ok) throw new Error((await res.json()).error?.message)
  return res.json()
}
```

> ⚠ **No** setear `Content-Type` manualmente con FormData: el cliente HTTP debe generar el `boundary`. Si se hardcodea, el multipart se rompe.

---

## Flujos clave (secuencia de llamadas)

### 1. Ver tickets abiertos
```
GET /api/mantenimiento?status=open
```
> Nota ownership: hoy no hay filtro "mis tickets" porque `assignedTo` es libre. Ver [Ownership](#ownership-y-seguridad).

### 2. Iniciar un ticket
```
POST /api/mantenimiento/{ticketId}/start   →  status=in_progress, startTime=<now>
```

### 3. Subir foto "antes"
```
POST /api/mantenimiento/{ticketId}/photos   (multipart: file + type=before)
```

### 4. Agregar nota del técnico
```
PUT /api/mantenimiento/{ticketId}/notes
Body: { "notes": "Cambiada válvula de agua caliente" }
```
> `PUT /notes` **reemplaza** el campo `notes` (no hace append). Si se quiere histórico, usar `/audit`.

### 5. Subir foto "después"
```
POST /api/mantenimiento/{ticketId}/photos   (multipart: file + type=after)
```

### 6. Completar (cerrar)
```
POST /api/mantenimiento/{ticketId}/complete
Body: { "notes": "Reparación finalizada y probada" }   (notes opcional)
→  status=closed, endTime=<now>, resolvedDate=<now>
```

### 7. Ver historial del ticket
```
GET /api/mantenimiento/{ticketId}/audit   →  MaintenanceAuditDTO[]
```

---

## Ownership y seguridad

⚠ **Este es el gap más importante del módulo para la app.**

| Check | Estado | Detalle |
|-------|--------|---------|
| Token válido + hotelId correcto | ✅ | Todas las rutas (`auth.authenticate`) |
| Ticket pertenece a mi hotel | ✅ | `assertOwnership` (`ticket.hotelId === currentUser.hotelId`) |
| **Soy el técnico asignado** | ❌ **NO implementado** | `assignedTo` es un **string libre** (max 100), NO un FK a `EmployeeProfile`. No hay autorización por persona hoy. |

### Qué construir para habilitar ownership por técnico

Hoy cualquier staff con acceso a `/api/mantenimiento` (cuando se habilite el rol) vería **todos los tickets del hotel**. Para restringir a "mis tickets", hay 2 caminos:

1. **Linkear `assignedTo` a `EmployeeProfile.id`** (como `staffId` en housekeeping) + implementar `assertAssignedTechnician` análogo a `assertAssignedStaff` en `start`/`complete`/`notes`/`photos`.
2. **Filtrar client-side** por `assignedTo` igual al nombre/id del técnico (frágil: `assignedTo` es texto libre, no confiable para seguridad).

> **Recomendado**: opción 1 (server-side). Es la única segura. Hasta que no se haga, la app de mantenimiento **no debe exponer** al staff el listado completo sin filtrado server-side confiable.

---

## Edge cases a manejar en la app

| Caso | Comportamiento backend | UX sugerida |
|------|------------------------|-------------|
| `start` de un ticket no-`open` | `400 "Transición..."` (ej. ya `in_progress`) | Bloquear botón Iniciar si `status !== 'open'` |
| `complete` con transición inválida (ej. `open` directo a `closed` sin `start`) | `open → closed` **sí** está permitido → cierra igual | Mostrar confirmación si cierra sin timer |
| `PUT /notes` sin `notes` en body | `400 VALIDATION_ERROR` | Validar input antes de enviar |
| Foto nº 21 | `400 "Límite de 20 fotos..."` | Deshabilitar botón al llegar a 20 |
| Subir no-imagen | `400 "...imágenes"` | Filtrar en el picker (`accept="image/*"`) |
| Multipart sin boundary correcto | `400` / parse falla | No hardcodear `Content-Type` con FormData |
| `StorageService no configurado` | `500` | Es error de infra del backend; reportar al admin, no al usuario |
| Reabrir ticket cerrado | `PUT /:id { status: 'open' }` (closed→open permitido) | Acción de admin, no del staff |

---

## Stats (solo admin — el staff no las ve)

```http
GET /api/mantenimiento/stats
```

```ts
{
  total: number
  open: number
  inProgress: number
  waiting: number
  closed: number                    // incluye 'resolved'
  avgResolutionHours: number        // solo tickets con startTime+endTime, redondeado a 1 decimal
  totalCost: number                 // suma de estimatedCost
  unassigned: number                // tickets sin assignedTo y no cerrados
}
```

La app de staff **no consume este endpoint**. Es del panel admin.

---

## Diferencias resumidas vs Housekeeping

| | Housekeeping | Mantenimiento |
|---|---|---|
| Método start/complete | `PUT` | `POST` |
| Fotos | base64 JSON | **multipart/form-data** |
| Foto con fase (before/after) | ❌ | ✅ `type` |
| Checklist `cleaningItems` | ✅ | ❌ |
| Audit trail | ❌ | ✅ `/audit` |
| Ownership por persona | ✅ listo | ❌ **falta construir** |
| Estados | 4 | 5 (con `waiting` y `resolved`) |
