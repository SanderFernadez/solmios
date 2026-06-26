// seeds/bookingengine.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedBookingengine(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Bookingengine de ejemplo'
    activo: true
    },
    {
    nombre: 'Bookingengine de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Bookingengine', item)))

  console.log('  ✓ Bookingengine seeded: ' + items.length + ' items')
}
