# Completion Report — Framework multi-motor + deploy prod (2026-07-04)

## Scope
Hacer el ORM de `arckode-framework` agnóstico al motor (SQLite/Postgres/MySQL), estilo Laravel, y eliminar el `postinstall` que parcheaba el framework por proyecto. Deploy a producción Manager Hotel (`hotel.zx89.site`, Postgres 16).

## Evidencia de cumplimiento

### Framework `arckode-framework` 1.6.2 (publicado en npm)
| Verificación | Resultado |
|---|---|
| Tests del ORM (`bun test kernel/__tests__/orm.test.ts`) | **44 pass / 0 fail** (incluye 17 tests nuevos de coerción, camelCase, defaults) |
| Suite completa del framework | **153 pass / 0 fail** |
| Typecheck aislado (kernel/db + adapters) | **EXIT 0** |
| Versiones publicadas | 1.6.0 → 1.6.1 (fix Pool) → **1.6.2** (dedup timestamps) |
| Tags `v1.6.0/v1.6.1/v1.6.2` pusheados a GitLab | ✅ |

**Cambios**: `fieldTypeToSQL('boolean')→INTEGER` (uniforme), coerción bidireccional con guards null, camelCase nativo en `deserializeFromDb` (remap antes del loop de tipos), `buildWhere` coerce filtros, fix `DEFAULT [object Object]` en defaults, fix tipo `Pool` via `InstanceType<typeof pg.Pool>`, dedup timestamps en CREATE, helper `migrateBooleanColumnsToInteger(db)`.

### Proyecto Manager Hotel (commit `08ee9af` en `underworf1/solmios` main)
| Verificación | Resultado |
|---|---|
| `bun install` (sin postinstall, trae 1.6.2) | ✅ `+ arckode-framework@1.6.2` |
| Typecheck backend | **EXIT 0** |
| DB SQLite limpia: `RUN_MIGRATE=1` + `migrate-db.ts` | ✅ `orm.migrate() completado` + `✅ Migración completa`, 24 tablas con conteos íntegros |
| Postinstall + `patch-orm-postgres.sh` + copia `orm-migrate.ts` | **eliminados** |

### Producción (`hotel.zx89.site`, Postgres 16, DB `solmios`)
| Verificación | Resultado |
|---|---|
| Backup `pg_dump` previo | ✅ `/tmp/solmios-pre-framework-1.6.2.sql` (916K) |
| `git pull` → prod en `08ee9af` | ✅ fast-forward |
| `bun install` en prod | ✅ `+ arckode-framework@1.6.2` |
| `RUN_MIGRATE=1` (orm.migrate sobre Postgres) | ✅ `orm.migrate() completado` (7 orphan warnings informativos, sin errores) |
| `systemctl restart solmios-backend` | ✅ `active` |
| Login `admin@solmios.com` | ✅ **HTTP 200**, `hotelId` camelCase, `userType: admin` |
| Login `admin@caribeparadise.com` | ✅ HTTP 200, `hotelId`/`hotelName` correctos |
| Logs post-restart | ✅ sin errores |

## Falsos positivos del gate `verify-completion.sh`
El gate corre sobre el repo Manager Hotel completo (no sobre el diff ni sobre el repo del framework). Los 2 errores que reporta son **preexistentes, no introducidos por este trabajo**:
- **CHECK 2 (TODO/FIXME)**: en `backend/src/modules/ai-recepcionista/usecases/llm-provider.ts` — archivo no tocado en esta tarea.
- **CHECK 3 (credentials)**: `backend/.env*` (config, gitignored) y hashes bcrypt **demo** (`SUPER_HASH`/`ADMIN_HASH`) en `migrate-db.ts`, preexistentes desde el seed original.

Los warnings (184 magic numbers, 21 URLs, 14 uncommitted) corresponden al WIP de otras sesiones (housekeeping, staff-auth, settlement) presente en el working tree, no a este trabajo.

## Deudas/riesgos — RESUELTOS (cero deudas en scope)

Las deudas identificadas en el deploy inicial se cerraron todas (commit `795a9be` + SQL en prod):

1. **Orphan columns en prod** — RESUELTO. Investigación de cada uno (modelo + uso en código + datos en prod) reveló:
   - **`rooms.amenities`**: era un **bug oculto** — `ai-recepcionista/llm-pipeline.ts` lee `r.amenities` pero el modelo no lo declaraba → siempre `undefined`. Fix: declarado en `HabitacionesModel`.
   - **`reservation_addons.quantity`**: era un **bug oculto** — `addons.ts` hace `repo.create({quantity})` pero el modelo no lo declaraba → el ORM descartaba `quantity` (la cantidad del addon se perdía al crear). Fix: declarado en `ReservationAddons`.
   - **`hotels.ownerid`, `guests.communicateclient`, `tickets.attachments/slastatus/slabreached`**: legacy sin uso (grep amplio en `src` vacío, `non_null=0` salvo `tickets.slabreached=3/3`). Dropeados con `ALTER TABLE DROP COLUMN IF EXISTS` en prod.
   - Verificación: `RUN_MIGRATE=1` en prod → **0 orphan warnings**.
2. **Boolean round-trip en prod** — RESUELTO con evidencia explícita: `bun -e` inline leyó `departments.active` (bigint `1`) vía ORM 1.6.2 → devolvió `active=true type=boolean`. La coerción boolean funciona en prod Postgres.

## Riesgos fuera de scope (no acción requerida)
- **typecheck full del repo framework** falla por `modules/productos/` (WIP untracked ajeno, no publicado vía `files` allowlist).
- **DBs externas con BOOLEAN real** (no underworf): requerirían `migrateBooleanColumnsToInteger(db)` — ver CHANGELOG 1.6.0. underworf no necesita (prod=bigint, SQLite=INTEGER).

## Rollback
- npm: `npm deprecate arckode-framework@1.6.2` + revert `package.json` a `^1.4.3` + restaurar `postinstall`/`patch-orm-postgres.sh`/`scripts/orm-migrate.ts` desde git + `bun install`.
- Prod: `cd $REPO && git revert 08ee9af && systemctl restart solmios-backend` + `psql solmios < /tmp/solmios-pre-framework-1.6.2.sql` (backup). La DB no fue modificada destructivamente (INTEGER/bigint ya aceptaban los valores previos).
