// seeds/housekeeping.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedHousekeeping(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Housekeeping de ejemplo'
    activo: true
    },
    {
    nombre: 'Housekeeping de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Housekeeping', item)))

  console.log('  ✓ Housekeeping seeded: ' + items.length + ' items')
}
