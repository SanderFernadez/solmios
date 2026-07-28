// migrations/1785210608553_create_hotelmedia.ts — DESHABILITADO.
//
// Este proyecto NO usa el sistema de migraciones del CLI (los archivos sueltos en
// `migrations/`). El schema vive en los `orm.define(...)` de cada módulo, y
// `RUN_MIGRATE=1 composition-root.ts` los sincroniza con `ormMigrate` (CREATE TABLE
// IF NOT EXISTS + ADD COLUMN). El archivo se deja como no-op para no romper un futuro
// `arckode db-migrate` que lo descubra por convención. NO borrar: si se quiere
// eliminar, hacerlo en un commit separado.
import type { MigrationRunner } from 'arckode-framework/cli/commands/db-migrate'

export async function up(_db: MigrationRunner): Promise<void> {
  // Intencionalmente vacío. La tabla `hotel_media` la crea ormMigrate desde
  // `registerHotelMediaModels(orm)` (ver modules/hotelmedia/model.ts).
}

export async function down(db: MigrationRunner): Promise<void> {
  await db.run('DROP TABLE IF EXISTS hotel_media')
}
