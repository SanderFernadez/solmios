// seeds/empleados.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedEmpleados(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Empleados de ejemplo'
    activo: true
    },
    {
    nombre: 'Empleados de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Empleados', item)))

  console.log('  ✓ Empleados seeded: ' + items.length + ' items')
}
