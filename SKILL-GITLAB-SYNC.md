---
name: openspec-gitlab-sync
description: >
  Sincroniza tareas de openspec con GitLab Issues siguiendo un ciclo de vida OBLIGATORIO
  EN PROCESO → QA-DEV → PREIMPLEMENTACION → QA-UI → IMPLEMENTACION.
  Con verificación de código (auto-detecta tareas ya implementadas) y tracking de tiempos.
  Instalable globalmente: `openspec-gitlab-sync push --verify`.
  Trigger: "gitlab sync", "subir tareas", "sincronizar openspec", "openspec gitlab",
  "ciclo de vida", "workflow", "reporte de tiempos", "sync tasks", "crear issues".
license: MIT
metadata:
  author: phantom
  version: "3.0"
  requires:
    - GITLAB_TOKEN (pre-configurado en ~/.gitlab-env, no pedir al usuario)
    - GITLAB_PROJECT_ID (pre-configurado en ~/.gitlab-env, no pedir al usuario)
---

# openspec-gitlab-sync Skill v3

## Propósito

CLI global que sincroniza tareas de openspec (`openspec/changes/*/tasks.md`) con GitLab Issues,
siguiendo un **ciclo de vida obligatorio** con tracking de tiempos.

Instalación global:
```bash
cd ~/projects/openspec-gitlab-sync && bun link
# Ahora disponible como `openspec-gitlab-sync` en cualquier directorio
# Credenciales YA configuradas en ~/.gitlab-env (source antes de usar)
```

## Ciclo de vida (OBLIGATORIO — sin "open")

Cada Issue debe pasar por TODOS estos estados. No existe workflow:open porque GitLab
ya tiene el estado "opened" nativo — sería redundante.

```
🔧 EN PROCESO  →  🧪 QA-DEV  →  📦 PREIMPLEMENTACION  →  🎨 QA-UI  →  ✅ IMPLEMENTACION
```

| Label workflow | Significado | Quién mueve |
|---------------|-------------|-------------|
| `workflow:en-proceso` | Se está trabajando | Dev |
| `workflow:qa-dev` | Auditoría 0→100 pasada (ver abajo) | Dev |
| `workflow:preimplementacion` | Listo para revisión final | Dev/Lead |
| `workflow:qa-ui` | Revisión visual/diseño | Designer/QA |
| `workflow:implementacion` | Desplegado/completado | Automático (push con [x]) |

## QA-DEV — Auditoría 0→100 (OBLIGATORIO antes de mover a qa-dev)

QA-DEV NO es "el código compila". Es una auditoría completa de arquitectura, patrones,
seguridad, calidad de tests y conformidad con el framework. Si algo falla, la tarea
vuelve a `en-proceso` hasta corregirlo.

### 1. ARQUITECTURA (0 violaciones = GATE BLOQUEANTE)

```bash
# Backend — arckode analyze ES BLOQUEANTE. Si muestra ❌, NO se mueve a qa-dev.
cd backend && bun run node_modules/arckode-framework/bin/arckode.js analyze
# Debe mostrar: "✅ VÁLIDO — 0 violations"
```

El analyzer verifica:
- No hay SQL crudo en módulos (`orm.findMany()` no puede estar en service/index.ts directamente)
- No hay ORM directo en services (solo RepositoryAdapter<T> inyectado)
- No hay imports entre módulos (solo vía connectors)
- index.ts de cada módulo es APPEND-ONLY
- model.ts (BD) y types.ts (API) están separados
- Todos los POST/PUT/PATCH tienen validateSchema()
- Todos los endpoints tienen auth.authenticate() con roles
- Métodos POST/PUT/PATCH con ownership lo validan con auth.assertOwnership()

### 2. PATRONES DEL FRAMEWORK

Verificar manualmente que el código nuevo sigue estos patrones:

**Backend:**
- [ ] Service extiende patrón Service-Repository (repo inyectado, no importado como global)
- [ ] Controller solo orquesta: valida input → llama service → retorna { status, body }
- [ ] DTOs en `types.ts`, schemas en `validators/schema.ts`
- [ ] Nombres en inglés para DB/API/código
- [ ] UUID para todos los IDs (TEXT, no INTEGER)
- [ ] Multi-tenant: toda query filtra por hotelId
- [ ] Timestamps: createdAt/updatedAt en todos los modelos

**Frontend:**
- [ ] `<script setup lang="ts">` + `<style scoped>` en todo .vue nuevo
- [ ] Sin `fetch()` ni `axios` directo en componentes → XxxService.method()
- [ ] Sin `<a href="/ruta">` interna → `<router-link to="/ruta">`
- [ ] Sin Options API en Pinia → `defineStore('x', () => { ... })` setup syntax
- [ ] Store no importa `useRouter` → componente hace `router.push()`
- [ ] Service no importa store → store orquesta service
- [ ] Sin `any` sin justificación → `unknown` + type guard
- [ ] Tipos centralizados en `types/index.ts`

### 3. TESTS — QUE REALMENTE PRUEBEN ALGO

NO se aceptan tests vacíos o que solo verifican "1+1=2". Cada test debe:

**Service tests:**
- [ ] Arrange-Act-Assert claro (3 bloques visibles)
- [ ] Prueba el happy path completo (datos válidos → resultado esperado)
- [ ] Prueba al menos 2 edge cases (datos inválidos, estados inconsistentes, límites)
- [ ] Prueba reglas de negocio (ej: no doble checkin, moneda válida, % en rango)
- [ ] Usa el repo real o mock verificado — no mock que siempre devuelve `{}`
- [ ] Verifica side effects: ¿se creó el registro? ¿se actualizó el status? ¿se logueó?

**Ejecutar:**
```bash
cd backend && bun test
# Debe pasar 100%. Si algún test falla → NO se mueve a qa-dev.
```

### 4. TYPECHECK (0 errores)

```bash
cd backend && bun run typecheck   # 0 errores
cd frontend && npx vue-tsc --noEmit   # 0 errores
```

### 5. SEGURIDAD

- [ ] Todo endpoint nuevo tiene `auth.authenticate('rol1', 'rol2')` con roles correctos
- [ ] Endpoints que modifican datos verifican propiedad: `auth.assertOwnership(item.hotelId, user.hotelId)`
- [ ] No se retornan passwords, tokens, ni secrets en responses
- [ ] No hay secretos hardcodeados (buscar `"sk-`, `"Bearer`, `password: "`, `secret: "`)
- [ ] Inputs validados con schema (no confiar en "el frontend ya valida")
- [ ] Rate limiting en endpoints públicos (si aplica)

### 6. VERIFICACIÓN CRUZADA CONTRA EL ISSUE

- [ ] Lo implementado cubre TODOS los puntos del `📋 Qué hay que hacer` en el Issue
- [ ] Si el Issue menciona archivos específicos (`composition-root.ts:536`), se usaron esos archivos
- [ ] Si el Issue menciona reglas de negocio con mensajes E2, se implementaron con esos mensajes exactos
- [ ] Si el Issue menciona Toast/notificaciones, se implementaron en el frontend
- [ ] Nada se dejó "para después" — lo que dice el Issue es lo mínimo

### 7. VEREDICTO

Solo se mueve a `qa-dev` si:
- `arckode analyze` → ✅ VÁLIDO (0 violations)
- `bun test` → 100% pasan
- `bun run typecheck` → 0 errores
- `npx vue-tsc --noEmit` → 0 errores
- Checklist manual (patrones, seguridad, Issue) → TODO ✅

Si algo falla → corregir y repetir. No hay atajos.

## Time tracking

El CLI registra automáticamente **openedAt** (cuando se crea el Issue) y
**implementacionAt** (cuando marcas `[x]` y haces push). El comando `report`
calcula duración y promedio entre estos dos timestamps.

## Comandos

```bash
openspec-gitlab-sync init              # Crea labels + milestones
openspec-gitlab-sync board             # Crea tablero Kanban con 5 columnas
openspec-gitlab-sync push              # Sync tasks.md ↔ GitLab Issues
openspec-gitlab-sync push --verify     # Solo Issues realmente no implementados
openspec-gitlab-sync verify            # Analiza código vs tasks.md
openspec-gitlab-sync status            # Cuántas en cada workflow
openspec-gitlab-sync pull              # Lista Issues agrupados por workflow
openspec-gitlab-sync report            # Reporte de tiempos
```

## push --verify

El flag `--verify` corre el verification engine ANTES de crear Issues. Si detecta
que una tarea ya está implementada en el código real, automáticamente:
- La marca como `[x]` en tasks.md
- Cierra el Issue en GitLab si existe
- La salta durante el push

## Verification Engine

El CLI tiene verificadores integrados para tareas conocidas. Busca evidencia en:
- Existencia de archivos (módulos, páginas, servicios)
- Strings clave en composition-root.ts
- Dependencias en package.json

## Labels

| Categoría | Labels |
|-----------|--------|
| **Prioridad** | `priority:crítica` · `urgente` · `alta` · `normal` · `baja` |
| **Tipo** | `type:bug` · `feature` · `improvement` · `doc` · `testing` · `refactor` |
| **Tamaño** | `size:XS` · `S` · `M` · `L` · `XL` |
| **Fase** | `F1-Foundation` · `F2-Settings` · etc |
| **Cambio** | `match-misterplan` (automático desde el directorio) |

## Uso diario en ManagerHotel

```bash
# 1. Marcar tarea como completada en tasks.md
#    - [x] 4.3.1 Create block dialog

# 2. Sincronizar (con verificación opcional)
openspec-gitlab-sync push

# 3. Ver estado del ciclo
openspec-gitlab-sync status

# 4. Ver tiempos
openspec-gitlab-sync report
```

## Repositorio

```
https://gitlab.com/underworf/openspec-gitlab-sync
```

---

## Prompt para IAs — Cómo delegar una tarea

Copiá y pegá esto a cualquier IA (OpenCode, Claude, Copilot, etc.) reemplazando `{ISSUE_NUM}`:

```
Sos un developer en ManagerHotel. Vas a implementar este Issue de GitLab:

URL: https://gitlab.com/underworf1/solmios/-/issues/{ISSUE_NUM}
Proyecto: /home/phantom/Documents/proyectos/arckode-studio2/projects/Manager Hotel
Stack: Bun + Vue 3.5 + arckode-framework + SQLite + Tailwind CSS 4

ANTES DE EMPEZAR:
1. Leé CLAUDE.md para entender la arquitectura y reglas del proyecto
2. Leé el Issue de GitLab — tiene TODO inline: schema DB, reglas, archivos, checks
3. El Issue tiene labels que te dicen:
   - modulo:X     → qué módulo tocar (reservas, auto-messages, checkin, email...)
   - backend/frontend → en qué lado trabajar
   - F11          → la fase del plan

REGLAS OBLIGATORIAS:
- Backend: NUNCA SQL crudo → usá OrmRepository<T>
- Backend: NUNCA ORM en services → inyectá el repo
- Backend: TODO endpoint lleva auth.authenticate()
- Frontend: NUNCA fetch() en componentes → usá XxxService.method()
- Frontend: SIEMPRE <script setup lang="ts"> + <style scoped>
- DB: TODAS tablas, columnas y modelos en INGLÉS
- UI: texto en ESPAÑOL

AL TERMINAR, mové el label así:
```bash
source ~/.gitlab-env && openspec-gitlab-sync push
```
O manualmente con curl (el token está en ~/.gitlab-env):
```bash
source ~/.gitlab-env
curl --request PUT \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "https://gitlab.com/api/v4/projects/underworf1%2Fsolmios/issues/{ISSUE_NUM}" \
  --data-urlencode "labels=match-misterplan,F{PHASE},modulo:{MOD},backend,workflow:qa-dev"
```

VERIFICACIÓN:
```bash
cd backend && bun run typecheck
cd frontend && npx vue-tsc --noEmit
```
```

### Ejemplo real para Issue #66

```
URL: https://gitlab.com/underworf1/solmios/-/issues/66
Proyecto: /home/phantom/Documents/proyectos/arckode-studio2/projects/Manager Hotel

RESUMEN: Enviar email de confirmación al huésped cuando se hace check-in.
LABELS: match-misterplan, F11, modulo:reservas, backend

AL TERMINAR:
curl .../issues/66 --data "labels=match-misterplan,F11,modulo:reservas,backend,workflow:qa-dev"
```
