// seeds/canales.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedCanales(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Canales de ejemplo'
    activo: true
    },
    {
    nombre: 'Canales de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Canales', item)))

  console.log('  ✓ Canales seeded: ' + items.length + ' items')
}
