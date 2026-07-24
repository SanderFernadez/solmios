// scripts/backfill-cash-register-pg.ts — Igual que backfill-cash-register.ts pero para
// PostgreSQL (prod). `register` es todo minúsculas, sin camelCase → no hay plegado de
// identificador que considerar (a diferencia de userType/hotelId).
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://solmios:solmios123@localhost:5432/solmios'
})

async function migrate() {
  const client = await pool.connect()
  try {
    const movs = await client.query(`UPDATE cash_movements SET register = 'reception' WHERE register IS NULL`)
    console.log(`✅ ${movs.rowCount} cash_movements con register=NULL → 'reception'`)

    const shifts = await client.query(`UPDATE cash_shifts SET register = 'reception' WHERE register IS NULL`)
    console.log(`✅ ${shifts.rowCount} cash_shifts con register=NULL → 'reception'`)

    console.log('✅ Backfill completado')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch(console.error)
