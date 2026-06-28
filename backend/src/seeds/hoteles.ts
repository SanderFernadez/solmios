// seeds/hoteles.ts — Demo hotels (idempotente via 000-bootstrap)
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'
export async function seedHoteles(_orm: SeedOrm): Promise<void> {
  console.log('  ✓ Hoteles: gestionado por 000-bootstrap')
}
