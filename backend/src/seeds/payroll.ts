// seeds/payroll.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedPayroll(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Payroll de ejemplo'
    activo: true
    },
    {
    nombre: 'Payroll de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Payroll', item)))

  console.log('  ✓ Payroll seeded: ' + items.length + ' items')
}
