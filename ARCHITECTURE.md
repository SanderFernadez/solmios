# ARCHITECTURE.md — ManagerHotel (SOLMI OS)

**Versión**: 2.1 · **Última actualización**: 2026-07-16 · **Stack**: Vue 3.5 + arckode-framework 1.6.3 + DB multi-motor (SQLite dev / PostgreSQL prod)

> Documentación viva que refleja el sistema **real** que está implementado y funcionando.

---

## 1. Visión General

PMS hotelero (Property Management System) multi-tenant para hoteles independientes de LATAM. Backend construido con **arckode-framework** (patrón Composition Root + módulos con `RepositoryAdapter<T>`), frontend SPA en Vue 3, y base de datos **multi-motor**: SQLite (bun:sqlite/WAL) en desarrollo y PostgreSQL (`pg`) en producción, elegido por `DATABASE_URL`.

```
┌─────────────────────────────────────────────────────┐
│                FRONTEND (Vue 3 + Vite)               │
│   pages/ (~52 secciones) · services/ (~53) · stores (6)│
│   Router con guards por rol · Pinia · Tailwind v4    │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (Vite proxy → :3000)
┌──────────────────────┴──────────────────────────────┐
│            BACKEND (arckode-framework 1.6.3)          │
│   composition-root.ts → System + ORM → ~47 módulos    │
│   cada módulo: contrato + RepositoryAdapter<T>        │
│   connectors/ inter-módulo · services/ compartidos    │
│   Auth JWT (HMAC-SHA256) · passwords bcrypt           │
└──────────────────────┬──────────────────────────────┘
                       │ SqliteAdapter (WAL) / PostgresAdapter
┌──────────────────────┴──────────────────────────────┐
│   DB multi-motor: SQLite (dev) / PostgreSQL (prod)   │
│   ~40 tablas · multi-tenant por columna hotelId       │
│   tabla configuration (KV por hotel + plataforma)     │
└────────────────────────────────────────────────────── ┘
```

---

## 2. Stack Técnico (real, desde package.json)

| Capa | Tecnología | Versión | Propósito |
|------|-----------|---------|-----------|
| UI | Vue 3 | ^3.5 | Framework reactivo (`<script setup lang="ts">`) |
| Build | Vite | ^8.0 | Dev server + bundler (proxy `/api` → :3000) |
| Estado | Pinia | ^3.0 | Stores con setup syntax |
| Router | Vue Router | ^5.1 | SPA con guards por rol |
| CSS | Tailwind CSS | ^4.3 | Utility-first (`@theme` tokens) |
| Backend | arckode-framework | ^1.6.3 | System + ORM + Auth + Router + NodeServer |
| DB (dev) | SQLite | (bun:sqlite) | Single-file, WAL, foreign keys |
| DB (prod) | PostgreSQL | (`pg`) | Elegido por `DATABASE_URL`; remap camelCase↔lowercase nativo en fw 1.6.2+ |
| Runtime | Bun | >=1.3 | JS/TS runtime (NO Node.js) |

**En producción se usa PostgreSQL** (adapter elegido por `DATABASE_URL`). **No se usan**: Redis, BullMQ, NestJS.

---

## 3. Estructura del Proyecto (real)

```
Manager Hotel/
├── backend/
│   └── src/
│       ├── composition-root.ts    # ENTRY ÚNICO: config → infra → 47 módulos → 64 connectors → start
│       ├── modules/               # ~47 módulos aislados, estructura canónica del framework
│       │   ├── habitaciones/       # cada módulo:
│       │   │   ├── index.ts        #   createModule() + registro de rutas con guards de permiso (APPEND-ONLY)
│       │   │   ├── controller.ts   #   orquesta req/res, valida con validateSchema()
│       │   │   ├── service.ts      #   lógica de negocio, recibe OrmRepository<T> inyectado
│       │   │   ├── model.ts        #   orm.define() de las tablas del módulo (BD)
│       │   │   ├── types.ts        #   DTOs de la API (≠ model.ts)
│       │   │   ├── validators/     #   schemas de validación (POST/PUT/PATCH)
│       │   │   ├── sockets.ts      #   puertos que expone el módulo a los connectors
│       │   │   ├── usecases/       #   casos de uso complejos extraídos del service
│       │   │   └── tests/          #   bun test
│       │   ├── reservas/  huespedes/  facturas/  folios/  payments/  cash/  gastos/
│       │   ├── housekeeping/  mantenimiento/  habitaciones/  huespedes/  grupos/
│       │   ├── ttlock/  canales/  bookingengine/  payment-requests/  payment-gateways/
│       │   ├── usuarios/  roles/  staff-auth/  hoteles/  admin/  dashboard/  reports/
│       │   ├── empleados/  payroll/  attendance/  reclutamiento/  capacitacion/  activos/
│       │   ├── ai-recepcionista/  ai-gerente/  crm/  marketing/  messages/  pushtokens/
│       │   └── notificaciones/  auditlog/  apikeys/  dispositivos/  anuncios/  tickets/
│       │       feedback/  opiniones/  paquetes/  amenities/  pricing/  reembolsos/
│       ├── connectors/            # ~64 conectores inter-módulo (delegan vía sockets, sin lógica)
│       │   │                      #   ~40 son *-auditlog (rastro de borrados/acciones sensibles)
│       │   ├── reservas-folios-settlement.ts  folios-facturas.ts  facturas-payments.ts
│       │   ├── payments-caja.ts  gastos-caja.ts  bookingengine-payments.ts
│       │   ├── reservas-ttlock.ts  reservas-housekeeping.ts  housekeeping-mantenimiento.ts …
│       ├── services/              # servicios compartidos (no atados a un módulo)
│       │   ├── stripe-service.ts  ttlock-client.ts  fcm-client.ts  email-service.ts
│       │   ├── currency.ts  guest-language.ts  notification-renderer.ts …
│       │   └── payment-gateway/   # registry + stripe-gateway + payment-events
│       ├── shared/
│       │   ├── models.ts          # registerSharedModels(orm) — modelos ORM compartidos
│       │   ├── permissions.ts     # hasPermission, getRolePermissions (mapa de permisos)
│       │   ├── middlewares/        # security-headers, rate-limit
│       │   ├── utils/             # hotel-of, safe-parse, push-availability, resolve-tenant …
│       │   ├── usecases/          # crons/casos transversales (night-audit-cron …)
│       │   └── validators/
│       ├── infrastructure/
│       │   ├── auth/              # hotel-auth, create-permission-guard, require-permission,
│       │   │                      #   require-user-type, load-permissions
│       │   ├── stripe-config.ts   # resolver de API key de Stripe
│       │   ├── email-bootstrap.ts # setup de EmailService + worker
│       │   ├── health.ts          # ruta pública /api/health
│       │   └── storage/           # s3-adapter (Backblaze B2, S3-compatible)
│       ├── migrations/  seeds/    # DDL/seed
│       ├── migrate-db.ts          # tablas extra no-modeladas + seed demo (bun run migrate)
│       ├── data/managerhotel.db   # SQLite dev (gitignored)
│       └── package.json           # dev/start → src/composition-root.ts
├── frontend/
│   └── src/
│       ├── pages/                 # ~52 secciones (kebab-case.vue), cargan datos en onMounted
│       ├── services/              # http.ts (unwrap envelope) + ~53 *.service.ts
│       ├── stores/                # 6 stores Pinia (auth, dashboard, feedback, housekeeping,
│       │                          #   reservation, room) — setup syntax
│       ├── components/  composables/  data/
│       ├── layouts/               # AdminLayout, SuperAdminLayout
│       ├── router/index.ts        # guards por rol/permiso
│       ├── types/index.ts         # tipos centralizados
│       └── styles/main.css        # Tailwind v4 tokens
├── PRD.md · ARCHITECTURE.md       # producto (QUÉ) · este archivo (CÓMO)
├── FRD/ · SPECS/ · openspec/      # specs detallados + SDD
└── ...
```

> **No existe `server.ts`.** El único entry point es `backend/src/composition-root.ts`. Cualquier
> referencia a un backend "legacy standalone" es obsoleta: fue eliminado y toda la funcionalidad
> (incluido Channex) vive dentro de los módulos y connectors del framework.

---

## 4. Arquitectura del Backend (arckode-framework)

### Composition Root (`src/composition-root.ts`)

Entry ÚNICO. Solo hace: config → infra (DB/auth/router/storage) → registrar módulos → registrar connectors → `start()`. Sin endpoints inline ni lógica de negocio. El adapter de DB se elige por `DATABASE_URL` (**multi-motor**):

```typescript
// Multi-motor: DATABASE_URL → Postgres, sino SQLite (DB_PATH). Mismo binario, dev y prod.
const db = process.env.DATABASE_URL
  ? new PostgresAdapter({ connectionString: process.env.DATABASE_URL })
  : new SqliteAdapter({ path: process.env.DB_PATH || './data/managerhotel.db', wal: true, foreignKeys: true })
await db.connect()
const orm = new ORM(db)
registerSharedModels(orm)              // modelos ORM compartidos (shared/models.ts)

const auth   = new HotelAuth(jwtTokenAdapter, JWT_SECRET, logger, JWT_EXPIRES, JWT_REFRESH_EXPIRES)
const system = new System({ config, container, logger, orm, router, http: new NodeServer(PORT, logger), cache, auth })

// Cada módulo se instancia y se registra en el System (~47 en total)
const mods = [ HabitacionesModule(), ReservasModule(), HuespedesModule(), FacturasModule(),
               HousekeepingModule({ storage, videoStorage: s3Adapter }), /* … */ ]
for (const m of mods) system.addModule(m as any)

// Los connectors cablean interacciones entre módulos (~64), delegando por sockets
system.addConnector('reservas-folios-settlement', reservasFoliosSettlementConnector)
system.addConnector('folios-facturas', foliosFacturasConnector)   // orden importa: puertos inyectados
// … ~40 *-auditlog para rastro de borrados/acciones sensibles

await system.start()   // (RUN_MIGRATE=1 → system.init() + orm.migrate() sin bindear el puerto)
```

Cada módulo **registra sus propios modelos** (`registerXModels(orm)` dentro del `create()`), no en el composition-root. Los modelos compartidos van en `shared/models.ts`. Si un módulo es dueño de un modelo, **NO** se define también en `shared` (el último `orm.define` gana y descarta campos del anterior).

### Módulos (estructura canónica)

Cada módulo se genera con `arckode make:module` y sigue la estructura `index/controller/service/model/types/validators/sockets/usecases/tests`. El `index.ts` arma la cadena **controller → service → repo** e inyecta un `OrmRepository<T>` (nunca el ORM directo), y registra rutas con **guards de permiso**:

```typescript
export function HabitacionesModule() {
  return createModule({
    name: 'habitaciones', version: '2.0.0', description: 'Rooms inventory with multi-tenancy',
    contract: { /* actions, events, tables:['rooms'], rules:['Ownership check required'] */ },
    create({ logger, orm, cache, router, auth }) {
      registerHabitacionesModels(orm)                              // model.ts → orm.define('Rooms', …)
      const repo    = new OrmRepository<HabitacionesDTO>(orm, 'Rooms')
      const service = new HabitacionesService(repo, log, cache, userRepo, auth, orm)
      const controller = new HabitacionesController(service, log)

      const guard = createPermissionGuard(auth, new OrmRepository<any>(orm, 'Roles'))
      router.get   ('/api/habitaciones',     guard('rooms', 'view'),   (req) => controller.index(req))
      router.get   ('/api/habitaciones/:id', guard('rooms', 'view'),   (req) => controller.show(req))
      router.post  ('/api/habitaciones',     guard('rooms', 'create'), (req) => controller.store(req))
      router.put   ('/api/habitaciones/:id', guard('rooms', 'edit'),   (req) => controller.update(req))
      router.delete('/api/habitaciones/:id', guard('rooms', 'delete'), (req) => controller.destroy(req))
      return service
    },
  })
}
```

### Reglas del framework (obligatorias — GATE `arckode analyze`)

- **Controller → service → repo**: el controller orquesta y valida; el service tiene la lógica; el acceso a datos es vía `OrmRepository<T>`. El controller nunca toca el ORM.
- **Sin ORM en servicios**: se inyecta `OrmRepository<T>`, nunca el ORM directo (excepto transacciones puntuales que reciben `orm`).
- **`model.ts` (BD) ≠ `types.ts` (API)**: los modelos ORM viven en `model.ts`; los DTOs de la API en `types.ts`.
- **Sin SQL crudo en módulos**: todo vía `OrmRepository` (findMany/create/update/delete/count).
- **Ownership + permisos**: rutas protegidas con `createPermissionGuard(...)` (`module:action`) y `requireUserType('merchant'|'admin')`; todo `findById` requiere `auth.assertOwnership()` después (el analyzer lo detecta y bloquea).
- **Cross-module solo por connectors**: un módulo NUNCA importa a otro directo; se cablea con un connector en `src/connectors/` que delega vía sockets (sin lógica propia).
- **`index.ts` es APPEND-ONLY**: no se sacan exports.

---

## 5. Base de Datos (multi-motor SQLite/PostgreSQL — ~40 tablas, EN INGLÉS)

Multi-tenant por **columna `hotelId`** (NO schema-per-tenant). Configuración key-value en tabla `configuration`.
**TODAS las tablas y columnas están en INGLÉS** (estándar universal de software).

| Tabla | Modelo | Propósito |
|-------|--------|-----------|
| users | User | Cuentas (super_admin, hotel_admin, receptionist) |
| hotels | Hotel | Tenants |
| rooms | Room | Inventario de cuartos |
| reservations | Reservation | Reservas |
| guests | Guest | CRM huéspedes |
| invoices | Invoice | Facturación |
| roles | Role | Roles y permisos |
| housekeeping | Housekeeping | Limpieza |
| maintenance | Maintenance | Órdenes de trabajo |
| packages | Package | Upsells |
| groups | Group | Reservas grupales |
| devices | Device | Sesiones activas |
| announcements | Announcement | Comunicados plataforma |
| api_keys | ApiKey | Credenciales API |
| audit_log | AuditLog | Auditoría |
| tickets | Ticket | Soporte |
| notifications | Notification | Notificaciones |
| configuration | Configuration | Config KV (hotel + `platform`) |
| channel_config | ChannelConfig | Sync Channex por hotel |
| reviews | Review | Opiniones de huéspedes |
| expenses | Expense | Tracking de gastos |

**Convención**: id `TEXT` (UUID), `createdAt`/`updatedAt` (timestamps), booleanos como `INTEGER` (0/1). Nombres de tablas y columnas **OBLIGATORIAMENTE en INGLÉS**.

---

## 6. API (40 endpoints)

Base: `/api/...` (sin versión ni tenant-slug en la ruta; el tenant viene del token/query `hotelId`).

### Envelope de respuesta (arckode-framework)
```json
// objeto único
{ "success": true, "data": { ... }, "meta": null }
// lista (el framework aplana {data:[], total})
{ "success": true, "data": [ ... ], "meta": { "pagination": { "total": 18 } } }
// error
{ "success": false, "data": null, "error": { "code": "ERROR", "message": "..." } }
```

### Endpoints por módulo

| Método | Ruta | Módulo |
|--------|------|--------|
| POST | `/api/auth/login`, GET `/api/auth/me` | auth |
| GET | `/api/hoteles`, `/api/hoteles/:id` | hoteles |
| GET/POST | `/api/habitaciones`, PUT `/api/habitaciones/:id` | habitaciones |
| GET/POST | `/api/reservas` | reservas |
| GET/POST | `/api/huespedes` | huespedes |
| GET | `/api/facturacion` | facturacion |
| GET | `/api/housekeeping`, `/api/mantenimiento`, `/api/paquetes`, `/api/grupos` | (cada uno) |
| GET | `/api/dashboard`, `/api/reports`, `/api/planning`, `/api/night-audit`, `/api/checkin`, `/api/booking-engine`, `/api/channels` | operaciones |
| GET | `/api/dispositivos`, `/api/anuncios`, `/api/api-keys`, `/api/audit-log`, `/api/tickets`, `/api/notificaciones`, `/api/roles` | operaciones |
| GET | `/api/configuracion/:clave`, GET `/api/settings`, PUT `/api/settings/hotel` | hoteles/operaciones |
| GET | `/api/admin/hoteles`, `/api/admin/users`, `/api/admin/analytics`, `/api/admin/subscriptions`, `/api/admin/audit`, `/api/admin/monitoring`, `/api/admin/announcements` | admin |

---

## 7. Autenticación y Roles

- **JWT** firmado con HMAC-SHA256 (vía `arckode-framework/adapters/jwt`). Payload: `{id, role, type:'access'}`. TTL 24h.
- **Passwords** hasheados con **bcrypt** (`Bun.password.hash/verify`). Migración lazy de legacy plaintext.
- **Roles**: `super_admin` (plataforma, `/admin/*`), `hotel_admin` (hotel, `/panel/*`), `receptionist` (limitado).
- Guards en `frontend/src/router/index.ts` redirigen según rol.

---

## 8. Frontend (Vue 3)

- **Servicios** (`services/`): cada uno llama al backend via `http.ts` y mapea campos español(backend)↔inglés(tipos). `http.ts` desempaqueta el envelope del framework y reconstruye `{data, total}` de la paginación.
- **Stores** (Pinia setup syntax): 6 stores — `auth`, `dashboard`, `feedback`, `housekeeping`, `reservation`, `room`. Orquestan servicios; el componente hace `router.push()`.
- **Pages**: ~52 secciones, cada una carga datos en `onMounted` desde el servicio correspondiente. Cero datos mock inline.
- **Convenciones**: `<script setup lang="ts">`, `<style scoped>`, `<router-link>` para rutas internas, `defineStore('x', () => {...})`.

---

## 9. Integraciones Externas

| Integración | Estado | Dónde |
|-------------|--------|-------|
| Channex (Channel Manager) | conectado | módulo `canales` + connector `booking-channex` |
| Stripe (pagos) | conectado | módulo `payments`/`payment-requests` + `services/stripe-service.ts` |
| TTLock (cerraduras) | conectado | módulo `ttlock` + `services/ttlock-client.ts` |
| Email (SMTP/Resend) | conectado | `infrastructure/email-bootstrap.ts` + `services/email-service.ts` |
| WhatsApp Business API | ⚠️ requiere creds Meta | — |
| Facturación electrónica (DGII/DIAN/SAT...) | ⚠️ stub, sin conector fiscal | `configuration` |

> **No hay** BullMQ ni Redis. Toda integración vive dentro de módulos/connectors del framework (no hay backend legacy).

---

## 10. Multi-Tenancy

Estrategia real: **single database con columna `hotelId`** por tabla. Cada query filtra por `hotelId` (desde query param o el primer hotel). La tabla `configuracion` guarda config por hotel (clave-valor JSON) y por plataforma (`hotelId = 'platform'`).

---

## 11. Ejecución

```bash
# Backend (arckode-framework) en :3000
cd backend && bun run dev          # → composition-root.ts

# Frontend (Vite) en :5173
cd frontend && bun run dev

# Migración / seed (one-off)
cd backend && bun run migrate

# Health-check Channex
cd backend && bun run doctor
```

**Credenciales demo** (passwords hasheados bcrypt): `admin@managerhotel.com`, `admin@caribeparadise.com`, `maria@caribeparadise.com` — todas `demo123`.

---

## 12. Decisiones Arquitectónicas

| Decisión | Alternativa | Justificación |
|----------|-------------|---------------|
| arckode-framework | NestJS / Express suelto | Estándar de Arckode Studio, predecible, RepositoryAdapter |
| DB multi-motor (SQLite dev / PG prod) | Solo Postgres | SQLite sin infra en dev; Postgres en prod. Adapter elegido por DATABASE_URL |
| hotelId column | Schema-per-tenant | Más simple, portable entre SQLite y Postgres |
| Bun | Node.js | Runtime del studio, más rápido, `bun:sqlite` nativo |
| Envelope framework | Respuestas planas | Convención de arckode, {success,data,meta} |
| Entry único `composition-root.ts` | server.ts suelto | El framework prohíbe server.ts; todo módulo/connector se cablea acá (no hay backend legacy) |
| Cross-module por connectors | import directo entre módulos | Aislamiento: un módulo no conoce a otro, delega vía sockets |
