# SOLMI OS Mobile — Documentación para construcción

App móvil del **personal del hotel (staff)**: limpieza (housekeeping) y mantenimiento.
Consume los **mismos endpoints REST** que el panel web — **no existe API paralela**.
Toda la lógica de negocio vive en el backend (arckode-framework); la app es un cliente más.

> Audiencia: desarrollador/IA que va a construir la app desde cero.
> Esta doc es **autosuficiente**: endpoints, DTOs, flujos, pantallas y estado de habilitación.

---

## Tabla de contenidos

- [Arquitectura](#arquitectura)
- [Stack recomendado](#stack-recomendado)
- [Autenticación](#autenticación)
- [Convenciones](#convenciones)
- [Estado de habilitación — LEER ANTES DE EMPEZAR](#estado-de-habilitación--leer-antes-de-empezar)
- [Módulos](#módulos)
- [Asimetría entre módulos](#asimetría-entre-módulos)
- [Cómo levantar el backend para dev](#cómo-levantar-el-backend-para-dev)

---

## Arquitectura

```
┌─────────────┐     HTTPS + JWT      ┌──────────────────────────┐
│  App Mobile │  ─────────────────▶  │  Backend arckode-framework│
│  (staff)    │   /api/housekeeping  │  (puerto 3000)            │
│             │   /api/mantenimiento │  SQLite (bun:sqlite, WAL) │
└─────────────┘                      └──────────────────────────┘
```

- **Sin estado en el servidor por cliente**: el JWT lleva `{id, role, hotelId, type}`. Cualquier request autenticada opera sobre el `hotelId` del token.
- **Multi-tenant**: cada registro tiene `hotelId`. El staff solo ve registros de **su** hotel (filtrado server-side por el token).
- **Un único login** para panel web y app: `POST /api/auth/login`.

---

## Stack recomendado

El equipo ya domina **Vue 3** (el panel web es Vue 3.5 + Vite + Pinia). Reutilizar ese conocimiento minimiza fricción.

| Stack | Pros | Contras | Recomendación |
|-------|------|---------|---------------|
| **Vue 3 + Capacitor** | Reusa 100% el stack y patrones del panel (Pinia, `<script setup>`, services). PWA + binarios nativos. | Performance nativo ligeramente menor a RN/Flutter. | ✅ **Recomendado** — menor costo, mismo equipo. |
| Ionic Vue | Componentes UI mobile listos sobre Vue+Capacitor. | Dependencia del design system de Ionic. | Si se quiere UI nativa rápida sin diseñar desde 0. |
| React Native / Expo | Mejor ecosistema móvil. | Stack distinto al panel → duplica conocimiento. | Solo si se prioriza binario 100% nativo. |

> Esta documentación es **agnóstica al stack**: todos los ejemplos son `fetch` + JSON, aplicables a cualquier cliente.

---

## Autenticación

### Login

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "maria@caribeparadise.com", "password": "demo123" }
```

**Response 200:**
```json
{
  "success": true,
  "data": { "token": "<JWT>" }
}
```

> ⚠ El token viene en **`data.token`**, no en la raíz.

### Uso del token

Todas las requests siguientes llevan el header:

```
Authorization: Bearer <JWT>
```

El JWT decodificado contiene: `{ id, role, hotelId, type }` — donde `id` es `users.id` (userId).

### Credenciales demo (dev)

| Email | Rol | Hotel |
|-------|-----|-------|
| `admin@managerhotel.com` | super_admin | (todos) |
| `admin@caribeparadise.com` | hotel_admin | Caribe Paradise |
| `maria@caribeparadise.com` | (demo) | Caribe Paradise |

Password: `demo123`

---

## Convenciones

### Base URL configurable

NUNCA hardcodear la URL del backend. Usar variable de entorno:

```ts
// Ejemplo Vue/Vite
const API_BASE_URL = import.meta.env.VITE_API_URL  // dev: http://localhost:3000
```

| Entorno | Valor |
|---------|-------|
| Dev local | `http://localhost:3000` |
| LAN (probar en celular real) | `http://<IP-LOCAL>:3000` |
| Producción | URL del deploy (HTTPS obligatorio) |

### Formato de errores

El backend usa las excepciones de arckode-framework. En fallo, HTTP ≠ 2xx y el body sigue el contrato del framework:

| HTTP | Código / clase | Cuándo |
|------|----------------|--------|
| `400` | `VALIDATION_ERROR` (`ValidationError`) | Body inválido, transición de estado inválida, límite excedido, mime no permitido |
| `401` | `AuthError` | Token ausente/inválido |
| `403` | `AuthError` | No autorizado (otro hotel, o no es el staff asignado) |
| `404` | `NotFoundError` | Recurso inexistente |
| `500` | `INTERNAL_ERROR` | Error inesperado |

La app debe leer `error.message` para mostrar feedback humano (los mensajes ya vienen en español: *"Asigna un empleado antes de iniciar la tarea"*, *"Solo se permiten imágenes"*, etc.).

### Fechas

Todas las fechas son **ISO 8601 UTC** (`2026-06-30T14:30:00.000Z`). El `duration` no se persiste: se calcula como `endTime - startTime` en runtime.

---

## Estado de habilitación — LEER ANTES DE EMPEZAR

> **Los endpoints YA existen y funcionan** para los roles admin (hotel_admin / receptionist / super_admin).
> Para que un **empleado de a pie** (rol `staff`) los use desde la app, falta **abrir el acceso** al rol staff.

### ¿Por qué no funciona hoy el login del staff?

El rol `staff` **no existe** en `backend/src/modules/usuarios/types.ts` (`UserRole`). Hoy solo hay: `super_admin | hotel_admin | receptionist`. Hasta que no se cree el rol `staff` y se asigne a usuarios-empleado, la app no puede autenticar personal.

### Pasos para habilitar la vía móvil (backend, ~1h, sin tocar endpoints)

**1. Crear el rol `staff`** en `backend/src/modules/usuarios/types.ts`:
```ts
export type UserRole = 'super_admin' | 'hotel_admin' | 'receptionist' | 'staff'
```

**2. Abrir los endpoints operativos al staff** — agregar `'staff'` a los `auth.authenticate(...)` correspondientes:
- Housekeeping: `start` / `complete` / `photos` en `backend/src/modules/housekeeping/index.ts` (marcados con `// FUTURE: agregar 'staff'`).
- Mantenimiento: `start` / `complete` / `notes` / `photos` / `audit` en `backend/src/modules/mantenimiento/index.ts`.

**3. Ownership por persona (seguridad):**
- **Housekeeping**: ✅ **ya implementado** (`assertAssignedStaff` en `usecases/timings.ts`). El staff solo opera tareas donde `task.staffId === su EmployeeProfile.id`. **Falta aplicarlo a `photos`** (hoy `photos` solo valida hotelId).
- **Mantenimiento**: ❌ **NO implementado**. Hoy el control es solo por `hotelId`. El campo `assignedTo` es un **string libre** (no es FK a `EmployeeProfile`). Para que un técnico solo vea/modifique SUS tickets, hay que construir el ownership equivalente al de housekeeping (linkeando `assignedTo` → `EmployeeProfile.id`). **Ver [mantenimiento.md → Ownership](./mantenimiento.md#ownership-y-seguridad).**

### Resumen de estado por módulo

| Módulo | Endpoints | Login staff | Ownership por persona |
|--------|-----------|-------------|----------------------|
| Housekeeping | ✅ listos | ❌ falta rol `staff` | ✅ start/complete listos · ⚠ photos falta |
| Mantenimiento | ✅ listos | ❌ falta rol `staff` | ❌ **falta construir** |

---

## Módulos

- 📄 [**Housekeeping**](./housekeeping.md) — limpieza de habitaciones (timer, checklist, fotos, stats).
- 📄 [**Mantenimiento**](./mantenimiento.md) — tickets de reparación (timer, notas, fotos before/after, audit, stats).

---

## Asimetría entre módulos

Los dos módulos **no son simétricos**. Esto impacta el diseño de la app:

| Aspecto | Housekeeping | Mantenimiento |
|---------|--------------|---------------|
| **Fotos** | base64 en JSON body | **multipart/form-data** |
| **Método start/complete** | `PUT /:id/start`, `PUT /:id/complete` | `POST /:id/start`, `POST /:id/complete` |
| **Ownership por persona** | ✅ `staffId` = `EmployeeProfile.id` | ❌ solo `hotelId`; `assignedTo` libre |
| **Estados** | 4 (`pending`/`in_progress`/`completed`/`inspected`) | 5 (`open`/`in_progress`/`waiting`/`resolved`/`closed`) |
| **Checklist** | ✅ `cleaningItems[]` (array) | ❌ no tiene |
| **Categorías** | `type` (cleaning) | `category` (plomería, electricidad, etc.) |
| **Audit trail** | ❌ | ✅ `/api/mantenimiento/:id/audit` |
| **Stats** | por staff | agregadas del hotel |

> No asumir que lo que aplica a uno aplica al otro. Leer cada doc.

---

## Cómo levantar el backend para dev

```bash
cd backend
bun run dev          # arranca en :3000 (con --hot reload)
```

Para probar desde un **celular real** en la misma red, exponer el backend en la IP LAN (no `localhost`) y usar esa URL en `VITE_API_URL` de la app.

### Smoke test rápido (login + listar tareas)

```bash
# 1. Login → obtener token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@caribeparadise.com","password":"demo123"}' \
  | jq -r '.data.token')

# 2. Listar housekeeping del hotel
curl -s http://localhost:3000/api/housekeeping \
  -H "Authorization: Bearer $TOKEN" | jq .
```
