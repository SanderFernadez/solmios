// seeds/landing.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedLanding(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Landing de ejemplo'
    activo: true
    },
    {
    nombre: 'Landing de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Landing', item)))

  console.log('  ✓ Landing seeded: ' + items.length + ' items')
}
