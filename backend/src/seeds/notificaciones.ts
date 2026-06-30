// seeds/notificaciones.ts — gestionado por 000-bootstrap o migrate-db.ts
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'
export async function seedData(_orm: SeedOrm): Promise<void> {
  console.log('  ✓ notificaciones: skip (datos en 000-bootstrap / migrate-db.ts)')
}
