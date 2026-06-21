// seeds/roles.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedRoles(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Roles de ejemplo'
    activo: true
    },
    {
    nombre: 'Roles de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Roles', item)))

  console.log('  ✓ Roles seeded: ' + items.length + ' items')
}
