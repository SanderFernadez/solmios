// scripts/add-user-type-pg.ts — Agrega campo userType a usuarios existentes (PostgreSQL)
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://solmios:solmios123@localhost:5432/solmios'
})

async function migrate() {
  const client = await pool.connect()
  try {
    // `userType` ya es un campo del modelo ORM `Users` (src/modules/usuarios/model.ts).
    // El ORM crea la columna sin comillas → Postgres la pliega a minúsculas (usertype).
    // Este script usa `pg` crudo (no pasa por el ORM), así que debe apuntar al mismo
    // nombre físico: quotear "userType" acá crearía una SEGUNDA columna huérfana
    // ("userType" ≠ usertype para Postgres) que el resto de la app nunca lee — ver
    // "Anti-patrón ORM" en CLAUDE.md.
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS usertype VARCHAR(20) DEFAULT 'merchant'
    `)
    console.log('✅ Columna userType agregada (o ya existe)')

    // Actualizar super_admin → userType: 'admin'
    const result = await client.query(`UPDATE users SET usertype = 'admin' WHERE role = 'super_admin'`)
    console.log(`✅ ${result.rowCount} usuarios super_admin actualizados a userType: admin`)

    // Todos los demás → userType: 'merchant'
    const result2 = await client.query(`UPDATE users SET usertype = 'merchant' WHERE usertype IS NULL OR usertype = ''`)
    console.log(`✅ ${result2.rowCount} usuarios actualizados a userType: merchant`)

    console.log('✅ Migración completada')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch(console.error)
