// seeds/tickets.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedTickets(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Tickets de ejemplo'
    activo: true
    },
    {
    nombre: 'Tickets de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Tickets', item)))

  console.log('  ✓ Tickets seeded: ' + items.length + ' items')
}
