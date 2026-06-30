# ARCHITECTURE.md — ManagerHotel (SOLMI OS)

**Versión**: 2.0 · **Última actualización**: 2026-06-18 · **Stack**: Vue 3 + arckode-framework + SQLite

> Documentación viva que refleja el sistema **real** que está implementado y funcionando.

---

## 1. Visión General

PMS hotelero (Property Management System) multi-tenant para hoteles independientes de LATAM. Backend construido con **arckode-framework** (patrón Composition Root + módulos con `RepositoryAdapter<T>`), frontend SPA en Vue 3, y base de datos SQLite.

```
┌─────────────────────────────────────────────────────┐
│                FRONTEND (Vue 3 + Vite)               │
│   pages/ (21 secciones) · services/ (13) · stores (4)│
│   Router con guards por rol · Pinia · Tailwind v4    │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (Vite proxy → :3000)
┌──────────────────────┴──────────────────────────────┐
│            BACKEND (arckode-framework)                │
│   composition-root.ts → System → 12 módulos           │
│   cada módulo: contrato + RepositoryAdapter<T>        │
│   Auth JWT (HMAC-SHA256) · passwords bcrypt           │
└──────────────────────┬──────────────────────────────┘
                       │ SqliteAdapter (WAL)
┌──────────────────────┴──────────────────────────────┐
│              SQLite (data/managerhotel.db)            │
│   19 tablas · multi-tenant por columna hotelId        │
│   tabla configuracion (KV por hotel + plataforma)     │
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
| Backend | arckode-framework | ^1.4.3 | System + ORM + Auth + Router + NodeServer |
| DB | SQLite | (bun:sqlite) | Single-file, WAL, foreign keys |
| Runtime | Bun | >=1.3 | JS/TS runtime (NO Node.js) |

**No se usan**: PostgreSQL, Redis, BullMQ, NestJS. La documentación anterior los mencionaba pero no están implementados.

---

## 3. Estructura del Proyecto (real)

```
Manager Hotel/
├── backend/
│   ├── composition-root.ts        # ENTRY: System + ORM.define(19 modelos) + 12 módulos
│   ├── modules-framework/         # Módulos arckode-framework (RepositoryAdapter<T>)
│   │   ├── helpers.ts             # ok/created/error, getAuth, requireAuth, hotelOf
│   │   ├── auth.ts                # login + me (bcrypt + JWT)
│   │   ├── hoteles.ts             # CRUD hoteles + settings
│   │   ├── habitaciones.ts        # CRUD habitaciones
│   │   ├── reservas.ts            # CRUD reservas
│   │   ├── huespedes.ts           # CRM huéspedes
│   │   ├── facturacion.ts         # facturas/pagos/folios
│   │   ├── housekeeping.ts        # tareas de limpieza
│   │   ├── mantenimiento.ts       # órdenes de mantenimiento
│   │   ├── paquetes.ts            # paquetes & upsells
│   │   ├── grupos.ts              # reservas de grupo
│   │   ├── operaciones.ts         # dashboard, reports, planning, night-audit, checkin, booking-engine, channels, listas, configuration, roles
│   │   └── admin.ts               # super-admin: hoteles, usuarios, analytics, suscripciones, audit, monitoring, anuncios
│   ├── server.ts                  # [LEGACY] backend standalone anterior — fallback, NO es el entry
│   ├── migrate-db.ts              # migración one-off: crea tablas + seed
│   ├── doctor.ts                  # health-check de Channex
│   ├── data/managerhotel.db       # SQLite (gitignored)
│   └── package.json               # dev/start → composition-root.ts
├── frontend/
│   ├── src/
│   │   ├── pages/                 # 21 secciones (dashboard, reservations, rooms, guests, billing, reports, housekeeping, maintenance, night-audit, groups, settings, support, booking-engine, checkin, packages, planning, channel-manager, devices, auth, landing, super-admin/)
│   │   ├── services/              # http.ts (unwrap envelope) + 12 *.service.ts
│   │   ├── stores/                # auth, dashboard, reservation, room (Pinia setup)
│   │   ├── layouts/               # AdminLayout, SuperAdminLayout
│   │   ├── router/index.ts        # guards: requiresHotelAuth / requiresHotelAdmin / requiresSuperAdmin
│   │   ├── types/index.ts         # tipos centralizados
│   │   └── styles/main.css        # Tailwind v4 tokens
│   └── vite.config.ts             # proxy /api → http://localhost:3000
├── PRD.md                         # producto (QUÉ)
├── ARCHITECTURE.md                # este archivo (CÓMO)
├── modules.md                     # catálogo de los 26 módulos de producto
└── SPECS/                         # specs detallados (M01, M02, M06, M13, M17, M23)
```

---

## 4. Arquitectura del Backend (arckode-framework)

### Composition Root (`composition-root.ts`)

Patrón canónico del framework: configuración → adapters → System → módulos → start.

```typescript
const config = new ConfigStore()
config.define({ PORT: {type:'number', default:'3000'}, JWT_SECRET: {type:'string', required:true}, ... })
config.load(process.env)

const dbAdapter = new SqliteAdapter({ path: './data/managerhotel.db', wal: true, foreignKeys: true })
await dbAdapter.connect()
const orm = new ORM(dbAdapter)

// 19 modelos via orm.define('Model', { table, fields, timestamps })
orm.define('Habitacion', { table: 'habitaciones', fields: { id:{type:'string',required:true}, numero:{type:'string',required:true}, ... } })

const auth = new Auth(jwtTokenAdapter, JWT_SECRET, logger, '24h', '7d')
const system = new System({ config, container: new Container(), logger, orm, router: new Router(), http: new NodeServer(PORT, logger), cache: new MemoryCache(), auth })

system.addModule(HabitacionesModule())   // ... 12 módulos
await system.start()
```

### Módulos (patrón repetible)

Cada módulo define un contrato y registra rutas usando `RepositoryAdapter<T>` (sin SQL crudo):

```typescript
export const HabitacionesModule = () => createModule({
  name: 'habitaciones', version: '1.0.0', description: 'CRUD de habitaciones',
  contract: { name:'habitaciones', version:'1.0.0', description:'...', actions:['list','create','update'], events:[], tables:['habitaciones'], dependencies:['auth'], rules:['RepositoryAdapter<T>'] },
  create(deps) {
    const repo = new OrmRepository<any>(deps.orm, 'Habitacion')
    deps.router.get('/api/habitaciones', async (req) => { ... repo.findMany(filters) ... })
    return { repo }
  },
})
```

### Reglas del framework (obligatorias)

- **Controller → service → repo**: el controlador solo orquesta; la lógica usa `RepositoryAdapter<T>`.
- **Sin ORM en servicios**: se inyecta `OrmRepository<T>`, nunca el ORM directo.
- **Models con `orm.define`**: un modelo por tabla, campos tipados.
- **Sin SQL crudo en módulos**: todo vía `OrmRepository` (findMany/create/update/delete/count).
- **Auth**: `requireAuth(req)` valida JWT; `deps.auth.createToken({id, role})` emite tokens.

---

## 5. Base de Datos (SQLite — 21 tablas, EN INGLÉS)

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
- **Stores** (Pinia setup syntax): `auth`, `dashboard`, `reservation`, `room`. Orquestan servicios; el componente hace `router.push()`.
- **Pages**: 21 secciones, cada una carga datos en `onMounted` desde el servicio correspondiente. Cero datos mock inline.
- **Convenciones**: `<script setup lang="ts">`, `<style scoped>`, `<router-link>` para rutas internas, `defineStore('x', () => {...})`.

---

## 9. Integraciones Externas

| Integración | Estado | Dónde |
|-------------|--------|-------|
| Channex (Channel Manager) | staging conectado | `server.ts` (legacy) — pendiente migrar a módulo framework |
| Pagos (Stripe/Mercado Pago) | configuración en DB | sin conector activo |
| Facturación electrónica (DGII/DIAN/SAT...) | configuración en `configuracion` | sin conector activo |

> A diferencia de la documentación anterior, **no hay** conectores de WhatsApp, ni BullMQ, ni Redis. Solo Channex está integrado (en el backend legacy).

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
| SQLite | PostgreSQL | Suficiente para el alcance actual, single-file, sin infra |
| hotelId column | Schema-per-tenant | Más simple, SQLite no tiene schemas |
| Bun | Node.js | Runtime del studio, más rápido, `bun:sqlite` nativo |
| Envelope framework | Respuestas planas | Convención de arckode, {success,data,meta} |
| server.ts legacy | borrar | Se mantiene como referencia/fallback hasta migrar Channex |
