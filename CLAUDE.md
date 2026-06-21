# ManagerHotel (SOLMI OS) — CLAUDE.md

## Stack
Bun (>=1.3) + Vue 3.5 + Vite 8 + Pinia 3 + Vue Router 5.1 + Tailwind CSS 4.3 + arckode-framework 1.4.3 + SQLite (bun:sqlite, WAL)

## Arquitectura
```
Manager Hotel/
├── backend/
│   ├── src/composition-root.ts   # ENTRY: System + ORM (19 modelos) + 12 módulos
│   ├── src/modules/              # 21 módulos: usuarios, hoteles, habitaciones, reservas, huespedes,
│   │                             #   facturas, housekeeping, mantenimiento, paquetes, grupos,
│   │                             #   operaciones, admin, canales, dispositivos, anuncios, etc.
│   ├── src/connectors/           # Solo delegación inter-módulo (vía sockets)
│   └── data/managerhotel.db      # SQLite (gitignored)
├── frontend/src/
│   ├── pages/                    # 21 secciones (kebab-case.vue)
│   ├── services/                 # 12+ *.service.ts (API calls)
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
| Channex (Channel Manager) | staging conectado (server.ts legacy) |
| Pagos (Stripe/Mercado Pago) | solo config en DB, sin conector activo |
| Facturación electrónica | solo config en DB, sin conector activo |
| TTLock (cerraduras) | no implementado (dependencia externa requerida) |
| WhatsApp Business API | no implementado (dependencia externa requerida) |

### Credenciales demo
`admin@managerhotel.com`, `admin@caribeparadise.com`, `maria@caribeparadise.com` — todas `demo123`

### Ejecución
```bash
cd backend && bun run dev          # :3001
cd frontend && bun run dev         # :5173
cd backend && bun run migrate      # seed one-off
cd backend && bun run doctor       # health-check Channex
```
