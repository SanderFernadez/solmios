// seeds/payments.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedPayments(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Payments de ejemplo'
    activo: true
    },
    {
    nombre: 'Payments de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Payments', item)))

  console.log('  ✓ Payments seeded: ' + items.length + ' items')
}
