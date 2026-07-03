#!/usr/bin/env bash
# patch-orm-postgres.sh — Parchea arckode-framework para portabilidad Postgres.
# El ORM (deserializeFromDb) mapea createdat->createdAt pero NO hotelid->hotelId, isdemo->isDemo.
# En SQLite (case-insensitive) no se nota; en Postgres rompe. Este parche extiende el mapeo a
# TODAS las columnas camelCase del modelo. Fix permanente deberia ir al repo arckode-framework.
# Se ejecuta via postinstall para que persista tras bun install.
set -e
F="node_modules/arckode-framework/kernel/db/orm-utils.ts"
if [ ! -f "$F" ]; then
  echo "[patch-orm] orm-utils.ts no encontrado, skip"
  exit 0
fi
if grep -q "PATCH Postgres portability" "$F"; then
  echo "[patch-orm] ya aplicado"
  exit 0
fi
python3 - <<'PYEOF'
f = "node_modules/arckode-framework/kernel/db/orm-utils.ts"
s = open(f).read()
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
assert s.count(marker) == 1, f"esperaba 1 marker 'return result as ModelResult', encontro {s.count(marker)}"
s = s.replace(marker, patch, 1)
open(f, "w").write(s)
print("[patch-orm] parche deserializeFromDb aplicado")
PYEOF
