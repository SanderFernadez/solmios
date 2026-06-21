// seeds/habitaciones.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedHabitaciones(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Habitaciones de ejemplo'
    activo: true
    },
    {
    nombre: 'Habitaciones de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Habitaciones', item)))

  console.log('  ✓ Habitaciones seeded: ' + items.length + ' items')
}
