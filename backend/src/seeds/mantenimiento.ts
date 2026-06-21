// seeds/mantenimiento.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedMantenimiento(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Mantenimiento de ejemplo'
    activo: true
    },
    {
    nombre: 'Mantenimiento de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Mantenimiento', item)))

  console.log('  ✓ Mantenimiento seeded: ' + items.length + ' items')
}
