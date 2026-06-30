# Housekeeping Mobile — Spec para construcción

Limpieza de habitaciones. El personal (camarista/mucama) ve **sus tareas asignadas**, marca inicio/fin con timer, completa un checklist, y sube fotos de evidencia.

> Prerrequisito: leer [README.md](./README.md) (auth, base URL, estado de habilitación).

---

## Flujo del personal (día típico)

```
Login → ver MIS tareas pendientes → abrir tarea → Iniciar (timer arranca)
       → tachar items del checklist → subir fotos → Completar (timer detiene)
```

El camarista **solo ve y opera las tareas donde `staffId` = su `EmployeeProfile.id`** (ownership A7, ya implementado en backend).

---

## Pantallas sugeridas

| # | Pantalla | Datos | Endpoints |
|---|----------|-------|-----------|
| 1 | **Login** | email + password | `POST /api/auth/login` |
| 2 | **Mis tareas** (lista) | tabs: Pendientes / En progreso / Terminadas | `GET /api/housekeeping?staffId={miProfileId}&status={status}` |
| 3 | **Detalle de tarea** | habitación, tipo, prioridad, checklist, notas, fotos, timer en vivo | `GET /api/housekeeping/:id` |
| 4 | **Acciones inline** | Iniciar / Subir foto / Completar | `PUT /:id/start`, `POST /:id/photos`, `PUT /:id/complete` |

> El timer `in_progress` debe **actualizarse en vivo** cada 60s (calcular `now - startTime`). Patrón ya usado en el panel web (`useNow` composable con cleanup en `onUnmounted`).

---

## Resolución del profile del staff

⚠ El `id` del JWT (`users.id`) **NO** es igual al `staffId` de la tarea (`EmployeeProfile.id`). Para listar "mis tareas" la app necesita el `EmployeeProfile.id` del usuario logueado:

```
GET /api/empleados?userId={jwt.id}   →  obtener profile.id
GET /api/housekeeping?staffId={profile.id}&status=pending
```

> Si no existe un endpoint directo `GET /api/empleados/profile/me`, filtrar por `userId` en el listado de empleados y tomar el `.id`. Documentar este mapeo en la app.

---

## Endpoints

Prefijo: `/api/housekeeping`. Auth: `Authorization: Bearer <token>`.

| Método | Ruta | Roles hoy | Roles objetivo (app) | Qué hace |
|--------|------|-----------|----------------------|----------|
| `GET` | `/api/housekeeping` | hotel_admin, receptionist, super_admin | + `staff` | Lista paginada con filtros |
| `GET` | `/api/housekeeping/stats` | hotel_admin, super_admin | — (solo admin) | Estadísticas por staff |
| `GET` | `/api/housekeeping/:id` | hotel_admin, receptionist, super_admin | + `staff` | Una tarea |
| `POST` | `/api/housekeeping` | hotel_admin, receptionist, super_admin | — (solo admin) | Crear tarea |
| `PUT` | `/api/housekeeping/:id` | hotel_admin, super_admin | + `staff` (parcial: checklist, notas) | Actualizar |
| `DELETE` | `/api/housekeeping/:id` | hotel_admin, super_admin | — (solo admin) | Eliminar |
| `PUT` | `/api/housekeeping/:id/start` | hotel_admin, receptionist, super_admin | **+ `staff`** | Iniciar (timer) |
| `PUT` | `/api/housekeeping/:id/complete` | hotel_admin, receptionist, super_admin | **+ `staff`** | Completar |
| `POST` | `/api/housekeeping/:id/photos` | hotel_admin, receptionist, super_admin | **+ `staff`** | Subir foto (base64) |
| `DELETE` | `/api/housekeeping/:id/photos` | hotel_admin, receptionist, super_admin | + `staff` | Borrar foto |

> "Roles objetivo (app)" = los que hay que agregar cuando se habilite el rol `staff`. Los marcados `— (solo admin)` no se abren al staff (crear/eliminar/stats son del admin).

---

## State machine

```
pending ──start──▶ in_progress ──complete──▶ completed ──inspect──▶ inspected
   ▲                    │                         │
   │                    └────── (reopen) ─────────┘
   └──────────── (reopen from inspected) ─────────┘
```

| Desde | Hacia permitidos |
|-------|------------------|
| `pending` | `in_progress` |
| `in_progress` | `completed` |
| `completed` | `inspected`, `pending` |
| `inspected` | `pending` |

**Reglas operativas:**
- `start` requiere que la tarea tenga `staffId` asignado → si no, `400 "Asigna un empleado antes de iniciar la tarea"`.
- `complete` requiere `startTime` → si no, `400 "La tarea no fue iniciada"`.
- `start`/`complete` validan ownership A7: el staff solo opera **su** tarea (`task.staffId === su EmployeeProfile.id`).

---

## DTOs

### `HousekeepingDTO` (response)

```ts
interface HousekeepingDTO {
  id: string
  roomId: string
  hotelId: string
  staffId?: string                  // EmployeeProfile.id del asignado
  type?: 'full_cleaning' | 'quick_cleaning' | 'deep_cleaning' | 'inspection' | 'maintenance'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  status?: 'pending' | 'in_progress' | 'completed' | 'inspected'
  notes?: string
  assignedDate?: string             // ISO
  completedDate?: string            // ISO
  cleaningItems?: { name: string; done: boolean }[]
  startTime?: string                // ISO — seteado por start()
  endTime?: string                  // ISO — seteado por complete()
  photos?: PhotoEvidence[]
  createdAt: string
  updatedAt: string
}

interface PhotoEvidence {
  url: string
  path: string
  name: string
  size: number
  mimeType: string                  // siempre image/*
  uploadedAt: string
}
```

### Query params (`GET /api/housekeeping`)

```ts
{
  hotelId?: string
  status?: 'pending' | 'in_progress' | 'completed' | 'inspected'
  type?: string
  priority?: string
  roomId?: string
  staffId?: string                  // ← filtrar "mis tareas"
  search?: string
  page?: number                     // default 1
  limit?: number                    // default 20
}
```

### Response paginada

```ts
{ data: HousekeepingDTO[], total: number, page?: number, limit?: number, pages?: number }
```

---

## Fotos — IMPORTANTE: base64, no multipart

Housekeeping sube fotos como **base64 dentro del body JSON** (el router de arckode-framework no propaga `req.files`). Distinto de Mantenimiento (que sí usa multipart).

```http
POST /api/housekeeping/:id/photos
Authorization: Bearer <token>
Content-Type: application/json

{
  "file": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

**Reglas (validadas server-side):**
- `mimeType` debe empezar con `image/` → si no, `400 "Solo se permiten imágenes como evidencia"`.
- Máximo **20 fotos por tarea** → la 21ª: `400 "Límite de 20 fotos por tarea alcanzado"`.
- Body limit: **10 MB** (las fotos base64 inflan ~33%; cubre imágenes reales de hasta ~7 MB).

**Cliente (ejemplo):**
```ts
async function uploadPhoto(taskId: string, file: File) {
  const base64 = await fileToDataUrl(file)  // File → data:image/...;base64,...
  const res = await fetch(`${API_BASE_URL}/api/housekeeping/${taskId}/photos`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: base64 }),
  })
  if (!res.ok) throw new Error((await res.json()).error?.message)
  return res.json()
}
```

---

## Flujos clave (secuencia de llamadas)

### 1. Ver mis tareas pendientes
```
GET  /api/empleados?userId={jwt.id}          →  profile.id
GET  /api/housekeeping?staffId={profile.id}&status=pending
```

### 2. Iniciar una tarea
```
PUT  /api/housekeeping/{taskId}/start        →  status=in_progress, startTime=<now>
```
Requiere `staffId` asignado + ser el dueño (A7).

### 3. Marcar items del checklist
```
PUT  /api/housekeeping/{taskId}
Body: { cleaningItems: [{ name: "Cambiar toallas", done: true }, ...] }
```

### 4. Subir foto de evidencia
```
POST /api/housekeeping/{taskId}/photos
Body: { file: "data:image/jpeg;base64,..." }
```

### 5. Completar la tarea
```
PUT  /api/housekeeping/{taskId}/complete     →  status=completed, endTime=<now>, completedDate=<now>
```

---

## Ownership y seguridad

| Check | Estado | Detalle |
|-------|--------|---------|
| Token válido + hotelId correcto | ✅ | Todas las rutas (`auth.authenticate`) |
| Tarea pertenece a mi hotel | ✅ | `existing.hotelId === currentUser.hotelId` |
| **Soy el staff asignado** (start/complete) | ✅ **A7 listo** | `assertAssignedStaff` compara `EmployeeProfile.id` (vía `userId`) con `task.staffId` |
| **Soy el staff asignado** (photos) | ⚠ **falta** | Hoy `photos` solo valida hotelId. Hay que aplicarle `assertAssignedStaff` |

> El admin (`hotel_admin`/`receptionist`/`super_admin`) **siempre pasa** el ownership A7 — puede operar cualquier tarea de su hotel. El check solo restringe al rol `staff`.

---

## Edge cases a manejar en la app

| Caso | Comportamiento backend | UX sugerida |
|------|------------------------|-------------|
| Iniciar tarea sin staffId | `400 "Asigna un empleado..."` | El admin asigna; el staff no debería ver tareas sin asignar (filtrar por `staffId=yo`) |
| Completar tarea sin haber iniciado | `400 "...no fue iniciada"` | Bloquear botón Completar si `status !== 'in_progress'` |
| Transición inválida (ej. pending→completed directo) | `400 "Transición de estado inválida"` | Forzar el flujo start→complete |
| Foto nº 21 | `400 "Límite de 20 fotos..."` | Deshabilitar botón subir al llegar a 20 |
| Subir archivo no-imagen | `400 "Solo se permiten imágenes"` | Filtrar en el picker de archivos (`accept="image/*"`) |
| Sin conexión | — | Queuear acciones offline y reintentar al reconectar (acciones idempotentes: re-`start` de una ya iniciada es seguro gracias a la state machine) |

---

## Stats (solo admin — el staff no las ve)

```http
GET /api/housekeeping/stats?from=2026-06-01&to=2026-06-30
```

```ts
// StaffStats[] — agregado por staffId
interface StaffStats {
  staffId: string
  completed: number
  avgDurationMs: number
  totalDurationMs: number
}
```

La app de staff **no consume este endpoint** (rol `staff` no tiene acceso). Es del panel admin.
