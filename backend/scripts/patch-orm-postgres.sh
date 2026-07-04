#!/usr/bin/env bash
# patch-orm-postgres.sh — Parchea arckode-framework para portabilidad Postgres.
# Se ejecuta via postinstall (package.json) para que persista tras bun install.
# Fix permanente de ambos issues deberia ir al repo arckode-framework (underworf1).
set -e

echo "[patch-orm] aplicando parches de portabilidad Postgres a arckode-framework..."

python3 - <<'PYEOF'
# --- Parche 1: orm-utils.ts deserializeFromDb (mapeo camelCase lowercase) ---
# El ORM mapea createdat->createdAt pero NO hotelid->hotelId, isdemo->isDemo.
# En SQLite (case-insensitive) no se nota; en Postgres rompe. Extiende el mapeo a
# TODAS las columnas camelCase del modelo.
f1 = "node_modules/arckode-framework/kernel/db/orm-utils.ts"
try:
    s = open(f1).read()
    if "PATCH Postgres portability" in s:
        print("[patch-orm] orm-utils.ts ya parcheado (deserialize camelCase)")
    else:
        marker = "  return result as ModelResult"
        patch = """  // PATCH Postgres portability: mapear columnas lowercase -> campos camelCase del modelo.
  for (const field of Object.keys(def.fields)) {
    const lower = field.toLowerCase()
    if (lower !== field && lower in result && !(field in result)) {
      result[field] = result[lower]
      delete result[lower]
    }
  }
  return result as ModelResult"""
        cnt = s.count(marker)
        assert cnt == 1, f"orm-utils: esperaba 1 marker 'return result as ModelResult', encontro {cnt}"
        s = s.replace(marker, patch, 1)
        open(f1, "w").write(s)
        print("[patch-orm] orm-utils.ts parcheado (deserialize camelCase)")
except FileNotFoundError:
    print("[patch-orm] orm-utils.ts no encontrado, skip")

# --- Parche 2: postgres.ts tipo del pool (TS2709: Pool como namespace) ---
# @types/pg 8.20 con moduleResolution:bundler estructura Pool como namespace,
# entonces `private pool!: PgPool` da TS2709 "Cannot use namespace as a type".
# El runtime funciona (new pg.Pool() ok); es solo type-check. Tipo any temporal
# hasta que el framework resuelva el patron de import upstream.
f2 = "node_modules/arckode-framework/adapters/postgres.ts"
try:
    s = open(f2).read()
    if "fix temporal hasta upstream" in s:
        print("[patch-orm] postgres.ts ya parcheado (pool tipo any)")
    else:
        s = s.replace("import pg, { type Pool as PgPool } from 'pg'", "import pg from 'pg'")
        s = s.replace(
            "private pool!: PgPool",
            "private pool!: any  // type any: @types/pg 8.20 estructura Pool como namespace (TS2709); fix temporal hasta upstream",
        )
        open(f2, "w").write(s)
        print("[patch-orm] postgres.ts parcheado (pool tipo any)")
except FileNotFoundError:
    print("[patch-orm] postgres.ts no encontrado, skip")

print("[patch-orm] done")
PYEOF
