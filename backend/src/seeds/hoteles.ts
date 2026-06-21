// seeds/hoteles.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedHoteles(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Hoteles de ejemplo'
    activo: true
    },
    {
    nombre: 'Hoteles de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Hoteles', item)))

  console.log('  ✓ Hoteles seeded: ' + items.length + ' items')
}
