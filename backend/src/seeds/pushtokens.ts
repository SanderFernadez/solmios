// seeds/pushtokens.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedPushtokens(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Pushtokens de ejemplo'
    activo: true
    },
    {
    nombre: 'Pushtokens de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Pushtokens', item)))

  console.log('  ✓ Pushtokens seeded: ' + items.length + ' items')
}
