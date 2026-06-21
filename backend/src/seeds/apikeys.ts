// seeds/apikeys.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedApikeys(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Apikeys de ejemplo'
    activo: true
    },
    {
    nombre: 'Apikeys de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Apikeys', item)))

  console.log('  ✓ Apikeys seeded: ' + items.length + ' items')
}
