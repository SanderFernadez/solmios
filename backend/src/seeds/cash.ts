// seeds/cash.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedCash(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Cash de ejemplo'
    activo: true
    },
    {
    nombre: 'Cash de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Cash', item)))

  console.log('  ✓ Cash seeded: ' + items.length + ' items')
}
