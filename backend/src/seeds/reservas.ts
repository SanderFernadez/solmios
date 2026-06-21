// seeds/reservas.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedReservas(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Reservas de ejemplo'
    activo: true
    },
    {
    nombre: 'Reservas de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Reservas', item)))

  console.log('  ✓ Reservas seeded: ' + items.length + ' items')
}
