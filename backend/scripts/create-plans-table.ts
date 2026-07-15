import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://solmios:solmios123@localhost:5432/solmios'
})

async function migrate() {
  const client = await pool.connect()
  try {
    // `plans`/`amenities_catalog` ya existen como modelos ORM compartidos
    // (src/shared/models.ts → Plans/AmenitiesCatalog, registrados por
    // registerSharedModels en composition-root). El ORM crea las columnas SIN
    // comillas, así que Postgres las pliega a minúsculas (isActive→isactive,
    // sortOrder→sortorder) y el framework remapea camelCase↔lowercase al leer/escribir.
    // Este script NO pasa por el ORM (usa `pg` crudo), así que debe usar los
    // mismos nombres físicos (minúsculas) — antes usaba comillas con camelCase,
    // lo que rompía contra la tabla ya creada por el ORM (columna "isActive"
    // no existe, la física es "isactive"). CREATE TABLE IF NOT EXISTS queda
    // como red de seguridad si este script corriera antes que el ORM.
    await client.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE,
        price REAL NOT NULL,
        currency TEXT DEFAULT 'USD',
        description TEXT,
        features TEXT DEFAULT '[]',
        limits TEXT DEFAULT '{}',
        isactive INTEGER DEFAULT 1,
        sortorder INTEGER DEFAULT 0,
        createdat TEXT,
        updatedat TEXT
      )
    `)
    console.log('✅ Tabla plans creada')

    // Seed default plans
    const plans = [
      ['plan-starter', 'Starter', 'starter', 49, 'USD', 'Para hoteles pequeños', JSON.stringify(['30 habitaciones', '2 usuarios']), JSON.stringify({rooms:30,users:2}), 1, 0],
      ['plan-professional', 'Professional', 'professional', 99, 'USD', 'Para hoteles en crecimiento', JSON.stringify(['100 habitaciones', '6 usuarios']), JSON.stringify({rooms:100,users:6}), 1, 1],
      ['plan-enterprise', 'Enterprise', 'enterprise', 199, 'USD', 'Para hoteles grandes', JSON.stringify(['Habitaciones ilimitadas', 'Usuarios ilimitados']), JSON.stringify({rooms:9999,users:9999}), 1, 2],
    ]

    for (const [id, name, slug, price, currency, desc, features, limits, active, sort] of plans) {
      await client.query(
        `INSERT INTO plans (id, name, slug, price, currency, description, features, limits, isactive, sortorder)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [id, name, slug, price, currency, desc, features, limits, active, sort]
      )
    }
    console.log('✅ Plans seed completado')

    // Create amenities_catalog if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS amenities_catalog (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        label TEXT NOT NULL,
        category TEXT DEFAULT 'interior',
        icon TEXT,
        isactive INTEGER DEFAULT 1,
        sortorder INTEGER DEFAULT 0,
        createdat TEXT,
        updatedat TEXT
      )
    `)
    console.log('✅ Tabla amenities_catalog creada')

    console.log('✅ Migración completada')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch(console.error)
