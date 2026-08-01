// ensure-module-overrides-unique.ts — Garantiza UNIQUE(hotelId, moduleKey) en hotel_module_overrides.
// CUÁNDO CORRER: tras `RUN_MIGRATE=1 bun run src/composition-root.ts` en una DB nueva (el ORM crea
// la tabla con CREATE TABLE IF NOT EXISTS; este script le agrega el UNIQUE compuesto que el ORM no soporta).
// El ORM (arckode-framework) NO crea UNIQUE compuesto (mismo patrón que configuration UNIQUE(hotelId,key),
// resuelto con CREATE UNIQUE INDEX explícito en migrate-db.ts). Acá hacemos lo mismo para overrides.
//
// Portabilidad PG/SQLite:
//  - Las columnas FÍSICAS en Postgres son minúsculas (el ORM crea las columnas SIN comillas y PG pliega
//    los identificadores a minúsculas: hotelId→hotelid, moduleKey→modulekey). Usamos los nombres físicos
//    minúsculos en el DDL para que el índice apunte a las columnas reales, igual que create-plans-table.ts.
//  - SQLite es case-insensitive en identificadores, así que los nombres minúsculos también aplican.
//  - IF NOT EXISTS → idempotente, seguro correr múltiples veces.
//
// Este script es DDL crudo (como los otros en backend/scripts/), permitido por CLAUDE.md (la regla
// "NUNCA SQL crudo" aplica a services/usecases; los scripts de migración son la excepción explícita).
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://solmios:solmios123@localhost:5432/solmios',
})

async function ensureUniqueIndex() {
  const client = await pool.connect()
  try {
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_hotel_module_overrides_hotel_module
         ON hotel_module_overrides (hotelid, modulekey)`,
    )
    console.log('✅ UNIQUE index idx_hotel_module_overrides_hotel_module asegurado (hotelid, modulekey)')

    const { rows } = await client.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_hotel_module_overrides_hotel_module'`,
    )
    if (rows.length > 0) {
      console.log(`✅ Verificado: ${rows[0].indexname} presente en PG`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

ensureUniqueIndex().catch((err) => {
  console.error('❌ Falló ensure-module-overrides-unique:', err)
  process.exit(1)
})
