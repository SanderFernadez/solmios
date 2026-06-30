// migrations/1782900000000_add_maintenance_timer_audit_photos.ts
// Agrega campos de timer, notas, fotos a maintenance + tabla de audit trail.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(db: MigrationRunner): Promise<void> {
  // Campos nuevos en maintenance
  await db.run(`ALTER TABLE "maintenance" ADD COLUMN "startTime" TEXT`)
  await db.run(`ALTER TABLE "maintenance" ADD COLUMN "endTime" TEXT`)
  await db.run(`ALTER TABLE "maintenance" ADD COLUMN "notes" TEXT`)
  await db.run(`ALTER TABLE "maintenance" ADD COLUMN "photos" TEXT DEFAULT '[]'`)

  // Tabla de audit trail
  await db.run(`CREATE TABLE IF NOT EXISTS "maintenance_audit" (
    id TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "timestamp" TEXT NOT NULL
  )`)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_maintenance_audit_order ON "maintenance_audit"("orderId")`)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_maintenance_audit_hotel ON "maintenance_audit"("hotelId")`)
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run(`ALTER TABLE "maintenance" DROP COLUMN "startTime"`)
  await db.run(`ALTER TABLE "maintenance" DROP COLUMN "endTime"`)
  await db.run(`ALTER TABLE "maintenance" DROP COLUMN "notes"`)
  await db.run(`ALTER TABLE "maintenance" DROP COLUMN "photos"`)
  await db.run(`DROP TABLE IF EXISTS maintenance_audit`)
}
