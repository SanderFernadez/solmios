// scripts/add-user-type-pg.ts — Agrega campo userType a usuarios existentes (PostgreSQL)
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://solmios:solmios123@localhost:5432/solmios'
})

async function migrate() {
  const client = await pool.connect()
  try {
    // Agregar columna si no existe
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS "userType" VARCHAR(20) DEFAULT 'merchant'
    `)
    console.log('✅ Columna userType agregada (o ya existe)')

    // Actualizar super_admin → userType: 'admin'
    const result = await client.query(`UPDATE users SET "userType" = 'admin' WHERE role = 'super_admin'`)
    console.log(`✅ ${result.rowCount} usuarios super_admin actualizados a userType: admin`)

    // Todos los demás → userType: 'merchant'
    const result2 = await client.query(`UPDATE users SET "userType" = 'merchant' WHERE "userType" IS NULL OR "userType" = ''`)
    console.log(`✅ ${result2.rowCount} usuarios actualizados a userType: merchant`)

    console.log('✅ Migración completada')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch(console.error)
