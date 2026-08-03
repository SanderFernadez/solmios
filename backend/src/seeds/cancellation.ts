// seeds/cancellation.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedCancellation(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Cancellation de ejemplo'
    activo: true
    },
    {
    nombre: 'Cancellation de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Cancellation', item)))

  console.log('  ✓ Cancellation seeded: ' + items.length + ' items')
}
