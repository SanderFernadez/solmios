// seeds/gastos.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedGastos(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Gastos de ejemplo'
    activo: true
    },
    {
    nombre: 'Gastos de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Gastos', item)))

  console.log('  ✓ Gastos seeded: ' + items.length + ' items')
}
