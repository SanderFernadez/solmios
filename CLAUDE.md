# ManagerHotel (SOLMI OS) — CLAUDE.md

## Stack
Bun (>=1.3) + Vue 3.5 + Vite 8 + Pinia 3 + Vue Router 5.1 + Tailwind CSS 4.3 + arckode-framework 1.4.3 + **DB multi-motor** (SQLite bun:sqlite/WAL en dev/staging · Postgres vía `pg` para producción, elegido por `DATABASE_URL`)

## Database — Migraciones y Seeders (estado real verificado 2026-07-04)

El schema se construye en **2 capas complementarias** que deben correrse en orden sobre DB limpia:

### Flujo de DB limpia (OBLIGATORIO — 2 pasos)
```bash
cd backend
# Paso 1 — crea tablas desde los modelos ORM (hotels, users, rooms, guests, reservations, + ~30 módulos).
#          system.init() registra modelos, ormMigrate hace CREATE TABLE IF NOT EXISTS, NO bindea puerto HTTP.
DATABASE_URL=postgres://... RUN_MIGRATE=1 bun run src/composition-root.ts   # Postgres
# o
DB_PATH=data/managerhotel.db RUN_MIGRATE=1 bun run src/composition-root.ts  # SQLite

# Paso 2 — seed demo + tablas EXTRA no-modeladas (packages, devices, announcements, api_keys,
#          audit_log, configuration, email_queue, groups, maintenance, tickets, notifications, ai_*).
bun run migrate-db.ts   # usa .env (DB_PATH o DATABASE_URL)
```

**Orden insaltable**: `migrate-db.ts` hace `seedBase()` (INSERT en hotels/users/...) ANTES de crear tablas extra, y NO crea las tablas base — las crea el ORM en el paso 1. Si lo corres solo sobre DB vacía → `no such table: hotels`.

### Scripts disponibles
| Script | Qué hace | Idempotente |
|--------|----------|-------------|
| `migrate-db.ts` (entry `bun run migrate`) | DDL tablas extra + seeds demo completos (24 tablas) | ✅ vía `exists()`/`COUNT(*)` + `ON CONFLICT` |
| `RUN_MIGRATE=1 composition-root.ts` | Crea tablas desde modelos ORM registrados | ✅ `CREATE TABLE IF NOT EXISTS` |
| `scripts/orm-migrate.ts` | `ormMigrate(db, models)` — copia minimizada del kernel (CREATE TABLE IF NOT EXISTS + indices) | ✅ |
| `scripts/seed-default-roles.ts` | Roles por defecto (permisos) | ✅ |
| `scripts/create-plans-table.ts` | Tabla `plans` (SaaS subscriptions) — Postgres | ✅ |
| `scripts/add-user-type-pg.ts` / `add-user-type.ts` | ALTER `users.userType` (admin/merchant) | ✅ `addColumnIfMissing` |
| `scripts/patch-orm-postgres.sh` | **postinstall** — parchea `node_modules/arckode-framework` para portabilidad Postgres (camelCase deserialize + tipo pool) | ✅ idempotente |

### Portabilidad Postgres (state)
- ✅ No queda SQL SQLite-only en `migrate-db.ts` (sin `PRAGMA`, sin `datetime('now')`, sin `AUTOINCREMENT`). Placeholders `?` → `$1,$2...` los convierte `PostgresAdapter` automáticamente.
- ✅ `addColumnIfMissing()` es portable (ignora `duplicate column` / `already exists`).
- ⚠️ **DEUDA bloqueante para producción Postgres**: el seeder pasa `1`/`0` a 3 columnas `BOOLEAN` creadas por el ORM (`departments.active`, `employee_profiles.active`, `coupons.active` — modelos `empleados`/`crm` declaran `type: 'boolean'`). El driver `pg` es estricto y rechaza integer→boolean. SQLite funciona porque no tiene tipo boolean nativo. Fix requiere decisión: cambiar esos modelos a `type: 'number'`, o normalizar booleanos en el adapter del framework, o pasar `true`/`false` desde el seeder.
- ✅ `configuration` garantiza `UNIQUE(hotelId, key)` vía `CREATE UNIQUE INDEX IF NOT EXISTS idx_configuration_hotel_key` (el modelo ORM solo declara `key: { indexed: true }`; sin este índice los UPSERTs `ON CONFLICT(hotelId, key)` del seeder fallan en DB nueva).

### Reglas de portabilidad (al tocar migraciones/seeder)
- TODO DDL en INGLÉS, sin funciones SQLite-only. Para "ahora" usar `new Date().toISOString()` inyectado por param (NO `DEFAULT datetime('now')`).
- Todo INSERT multi-motor: placeholders `?` (el adapter PG los convierte). Contar columnas vs `?` cuidadosamente.
- Booleanos en tablas del ORM: pasar `1`/`0` solo si el modelo es `type: 'number'`. Si es `type: 'boolean'`, Postgres rompe.
- Toda tabla con UPSERT `ON CONFLICT(col)` requiere `UNIQUE` constraint o `CREATE UNIQUE INDEX` explícito (el ORM no crea unique compuesto).

## Arquitectura
```
Manager Hotel/
├── backend/
│   ├── src/composition-root.ts   # ENTRY: System + ORM + 30 módulos
│   ├── src/shared/models.ts      # Modelos ORM compartidos (16 tablas)
│   ├── src/modules/              # 30 módulos: usuarios, hoteles, habitaciones, reservas, huespedes,
│   │                             #   facturas, housekeeping, mantenimiento, paquetes, grupos,
│   │                             #   operaciones, admin, canales, dispositivos, anuncios,
│   │                             #   attendance, payroll, cash, crm, marketing, etc.
│   ├── src/connectors/           # 9 conectores inter-módulo
│   ├── src/services/             # 13 servicios compartidos (email, currency, etc.)
│   └── data/managerhotel.db      # SQLite (gitignored)
├── frontend/src/
│   ├── pages/                    # 40 secciones (kebab-case.vue)
│   ├── services/                 # 45 servicios API
│   ├── composables/              # 5 composables (useCurrency, useToast, etc.)
│   ├── stores/                   # auth, dashboard, reservation, room (Pinia setup)
│   ├── layouts/                  # AdminLayout, SuperAdminLayout
│   ├── router/index.ts           # Guards: requiresHotelAuth / Admin / SuperAdmin
│   ├── components/               # ui/ + features/
│   └── types/index.ts            # Tipos centralizados
├── PRD.md                        # QUÉ (producto, 26 módulos, 6 suites)
├── ARCHITECTURE.md               # CÓMO (técnico real — leer al iniciar)
├── ANALISIS-MRPLAN.md            # Benchmarking vs MisterPlan CloudV2
├── PLAN-IMPLEMENTACION.md        # Plan de trabajo a nivel MisterPlan
├── FRD/                          # 35 specs funcionales por módulo
├── SPECS/                        # 6 specs detallados (M01, M02, M06, M13, M17, M23)
└── openspec/                     # SDD activo
```

## Lazy Loading — Skills por contexto

NO cargues todo de golpe. Carga SOLO lo que aplique a la tarea actual:

| Contexto | Cargar primero |
|----------|---------------|
| Backend (cualquier cambio en `backend/`) | `backend/node_modules/arckode-framework/skills/services/SKILL.md`, `backend/node_modules/arckode-framework/skills/orm/SKILL.md`, `backend/node_modules/arckode-framework/skills/auth/SKILL.md` |
| Módulo nuevo backend | `node_modules/arckode-framework/skills/helpers/SKILL.md` + `make:module` |
| Frontend (cualquier cambio en `frontend/`) | `~/.claude/skills/swarm/skills/ui-analyst/SKILL.md`, `~/.claude/skills/ui-designer/SKILL.md` |
| CRUD (frontend/backend) | `skills/crud` + `skills/api-client` (del studio raíz) |
| Auth / login | `skills/auth` (del studio raíz) |
| Pagos / Stripe | `skills/payments` (del studio raíz) |
| Base de datos / migraciones | `~/.claude/skills/database-qa/SKILL.md`, `~/.claude/skills/swarm/skills/db-architect/SKILL.md` |
| Diseño UI nuevo | Cargar antes el design system: `designs/index.html` del proyecto |
| Arranque de sesión | Leer `ARCHITECTURE.md` + `openspec/config.yaml` |
| Feature nueva en proyecto existente | Leer `backend/src/composition-root.ts` primero (entiende todo el sistema) |
| **Subir/sincronizar tareas a GitLab** | `~/.claude/skills/openspec-gitlab-sync/SKILL.md` (ver sección "GitLab Sync" abajo) |

## Memoria persistente — MemoryOne

**Proyecto en MemoryOne**: `arckode-studio`
**Convención de topic_key**: `manager-hotel/{category}/{domain}/{concept}`

### Al inicio de sesión
```
mem_context(project: "arckode-studio")
mem_search(query: "Manager Hotel", project: "arckode-studio")
```

### Al guardar
```
mem_save(
  title: "verbo + qué",
  type: "bugfix|decision|pattern|preference|discovery|config|implementation",
  project: "arckode-studio",
  scope: "project",
  topic_key: "manager-hotel/{category}/{domain}/{concept}",
  content: "**What**: ...\n**Why**: ...\n**Where**: ...\n**Learned**: ..."
)
```

### Al cerrar sesión
```
mem_session_summary(project: "arckode-studio", content: "## Goal\n...")
```

## SDD — Spec-Driven Development

**Modo**: `memoryone-openspec`
**Config**: `openspec/config.yaml`
**Cambio activo**: `match-misterplan` — 126 tasks, 10 fases, 0 completadas

Fases del cambio activo (en orden de dependencia):
```
F1 Foundation DB → F6 Settings → F3 Reservation Modal → F4 Planning
                                                              ↓
F5 TTLock → F6 Auto-Messages → F7 WhatsApp
F8 Pre-Checkin | F9 Payments [paralelo]
                                                              ↓
                                                          F10 Reports
```

Reglas SDD del proyecto (de `openspec/config.yaml`):
- Every new feature MUST reference its MisterPlan equivalent
- For risky changes, include rollback plan
- Specs: Given/When/Then + RFC 2119 + DB/API/UI sections REQUIRED
- Apply: `make:module` + `RepositoryAdapter<T>`, NEVER raw SQL in services
- Verify: `bun run typecheck` + `npx vue-tsc --noEmit` + `arckode analyze` (0 violations)
- Spanish for UI text, English for DB/API/code

## GitLab Sync — openspec-gitlab-sync (WORKFLOW PRINCIPAL DE TAREAS)

**Esto es con lo que se trabaja: las tareas de openspec se suben a GitLab como Issues y se delegan a otro profesional siguiendo un flujo de vida obligatorio.**

- **Skill**: `openspec-gitlab-sync` v3 → `~/.claude/skills/openspec-gitlab-sync/SKILL.md` (Claude Code) / `~/.config/opencode/skills/openspec-gitlab-sync/SKILL.md` (OpenCode)
- **CLI global**: `openspec-gitlab-sync` (instalado vía `bun link` en `~/projects/openspec-gitlab-sync`)
- **GitLab project**: `underworf1/solmios` → https://gitlab.com/underworf1/solmios/-/issues
- **Credenciales**: `GITLAB_TOKEN` + `GITLAB_PROJECT_ID` YA configurados en `~/.gitlab-env` (NUNCA pedir al usuario; hacer `source ~/.gitlab-env` antes de cada llamada)

### Ciclo de vida OBLIGATORIO (sin estado "open")

```
🔧 EN PROCESO  →  🧪 QA-DEV  →  📦 PREIMPLEMENTACION  →  🎨 QA-UI  →  ✅ IMPLEMENTACION
```

| Label workflow | Significado | Quién lo mueve |
|---------------|-------------|----------------|
| `workflow:en-proceso` | Se está trabajando | Dev asignado en GitLab |
| `workflow:qa-dev` | Dev verificó que funciona | Dev |
| `workflow:preimplementacion` | Listo para revisión final | Dev/Lead |
| `workflow:qa-ui` | Revisión visual/diseño | Designer/QA |
| `workflow:implementacion` | Desplegado/completado | Automático al marcar `[x]` + push |

### Flujo de delegación a otro profesional

1. Las tasks se definen en `openspec/changes/*/tasks.md`
2. `openspec-gitlab-sync push` las sube como Issues a GitLab con labels (`modulo:X`, `backend`/`frontend`, `F{fase}`, `match-misterplan`)
3. Cada Issue lleva TODO inline: schema DB, reglas, archivos, checks → el profesional lo resuelve
4. Al terminar, el profesional mueve el label a `workflow:qa-dev` (manual con curl, o re-sync)
5. Avanza por el ciclo hasta `workflow:implementacion`
6. **Prompt delegación listo** (en el SKILL.md): reemplazar `{ISSUE_NUM}` y pegar a cualquier IA/profesional

### Comandos
```bash
source ~/.gitlab-env                                      # SIEMPRE antes
openspec-gitlab-sync init                                 # Crea labels + milestones
openspec-gitlab-sync board                                # Tablero Kanban (5 columnas)
openspec-gitlab-sync push                                 # Sync tasks.md ↔ GitLab Issues
openspec-gitlab-sync push --verify                        # Solo Issues NO implementados (auto-marca [x] los hechos)
openspec-gitlab-sync verify                               # Analiza código vs tasks.md
openspec-gitlab-sync status                               # Cuántas en cada workflow
openspec-gitlab-sync pull                                 # Lista Issues agrupados por workflow
openspec-gitlab-sync report                               # Reporte de tiempos (openedAt → implementacionAt)
```

### Time tracking
El CLI registra `openedAt` (creación del Issue) y `implementacionAt` (marcar `[x]` + push). `report` calcula duración y promedio.

## Reglas del proyecto

### Backend (arckode-framework — OBLIGATORIO)
- **NUNCA SQL crudo en módulos** — todo por `OrmRepository<T>` (findMany/create/update/delete/count)
- **NUNCA ORM en services** — inyectar `OrmRepository<T>`, no el orm directo
- **NUNCA controller sin validación** — `validateSchema()` en POST/PUT/PATCH
- **NUNCA sin ownership check** — `auth.authenticate(...roles)` + `auth.assertOwnership()` post-findById
- **NUNCA server.ts suelto** — el entry es `composition-root.ts`
- **NUNCA import de otro módulo directo** — usar connector en `src/connectors/`
- `index.ts` de módulo es APPEND-ONLY
- `model.ts` (BD) ≠ `types.ts` (API) — separados
- `npm install arckode-framework` (desde npm, NO path local)
- `make:module X` genera estructura canónica — no crear módulos a mano

### Base de datos — ENGLISH ONLY (OBLIGATORIO)
- **TODAS** las tablas, columnas, y modelos en INGLÉS
- Multi-tenant por columna `hotelId` (NO schema-per-tenant)
- id = TEXT (UUID), timestamps = createdAt/updatedAt, booleanos = INTEGER (0/1)

### Frontend (Vue 3 — OBLIGATORIO)
- **SIEMPRE** `<script setup lang="ts">` + `<style scoped>`
- **NUNCA** `fetch()` en componentes → `XxxService.method()`
- **NUNCA** `<a href="/ruta">` interna → `<router-link to="/ruta">`
- **NUNCA** Options API en Pinia → `defineStore('x', () => { ... })` setup syntax
- **NUNCA** store importa `useRouter` → componente hace `router.push()`
- **NUNCA** service importa store → store orquesta service
- **NUNCA** `any` sin justificación → `unknown` + type guard
- Tipos centralizados en `types/index.ts`
- Naming: páginas kebab-case, componentes PascalCase, stores camelCase, services PascalCase+.service.ts

### Verificación (OBLIGATORIO antes de decir "listo")
```bash
# Backend — arckode analyze es GATE BLOQUEANTE (0 violaciones)
cd backend && bun run node_modules/arckode-framework/bin/arckode.js analyze   # → "✅ VÁLIDO"
cd backend && bun run typecheck && bun test

# Frontend
cd frontend && npx vue-tsc --noEmit && bun run build
```

> Si `arckode analyze` muestra ❌ violaciones, el backend **NO está terminado**.

### Multi-tenancy
- Single DB con columna `hotelId` en cada tabla
- Cada query filtra por `hotelId` (desde token o query param)
- Configuración: tabla `configuration` KV (por hotel + `platform`)

### Integraciones (estado real)
| Integración | Estado |
|-------------|--------|
| Channex (Channel Manager) | ✅ Conectado y funcionando |
| Stripe (pagos) | ✅ Integrado con links y deposits |
| TTLock (cerraduras) | ✅ Auto-generate/send/delete codes |
| Email (SMTP/Resend) | ✅ Integrado con auto-messages |
| WhatsApp Business API | ⚠️ Requiere credenciales Meta |
| Facturación electrónica | ⚠️ Stub (fiscal.ts), sin conector real |

### Módulos — Estado de producción
| Módulo | Estado | Último upgrade |
|--------|--------|----------------|
| facturas (billing) | ✅ 10/10 | `daa1326` |
| housekeeping | ✅ 10/10 | `6899df9` |
| reservas | ✅ 10/10 | `3064b88` |
| habitaciones | ✅ 10/10 | `daa1326` |
| huespedes | ✅ 9/10 | `ffe4ff3` |
| folios | ✅ 10/10 | — |
| payments | ✅ 9/10 | — |
| mantenimiento | ✅ 10/10 | `d3bdce5` |
| attendance | ✅ 9/10 | `45fd0d7` |
| payroll | ✅ 9/10 | — |
| cash | ✅ 9/10 | — |
| marketing | ✅ 9/10 | `95b88b6` |
| canales | ✅ 9/10 | `3c34292` |
| dispositivos | ✅ 9/10 | — |

### Deudas técnicas pendientes

| Deuda | Detalle | Fase |
|-------|---------|------|
| `composition-root` God File | 1642 líneas. Modularización parcial (shared/models.ts ✅). Quedan: endpoints custom, night-audit, settings, booking público. | Futuro |
| `validateSchema` descarta campos no del schema | El framework descarta campos no declarados. Los forms DEBEN usar el naming canónico. | — |
| WhatsApp integration | Requiere credenciales Meta Business para funcionar. | Futuro |
| Document scan webhook | Feature avanzada, no crítica para producción. | Futuro |

### Facturación — Endpoints
```
GET    /api/facturas              → List (paginated)
GET    /api/facturas/stats        → Dashboard stats
GET    /api/facturas/tax-report   → Reporte fiscal por período
GET    /api/facturas/:id          → Get by ID
GET    /api/facturas/:id/print    → HTML A4 imprimible (público)
POST   /api/facturas              → Create (múltiples items)
POST   /api/facturas/:id/pay      → Pay (partial/full)
POST   /api/facturas/:id/credit-note → Cancel + credit note
PUT    /api/facturas/:id          → Update
DELETE /api/facturas/:id          → Delete
```

### Facturación — Reglas
- Impuestos vienen de `configuration(key='taxes')` — NO hardcodear
- Hotel name viene de tabla `hotels` — NO hardcodear
- Moneda viene del invoice — NO hardcodear
- Items se guardan en `notes` como string descriptivo
- NCF se genera automáticamente si está configurado
- Invoice number: counter atómico en `configuration(key='invoice_counter_{hotelId}_{year}')`

### Credenciales demo
`admin@managerhotel.com`, `admin@caribeparadise.com`, `maria@caribeparadise.com` — todas `demo123`

### Ejecución
```bash
cd backend && bun run dev          # :3000
cd frontend && bun run dev         # :5173
cd backend && bun run migrate      # seed demo + tablas extra (requiere paso 1 RUN_MIGRATE antes en DB limpia — ver sección Database)
cd backend && bun run doctor       # health-check Channex
```
