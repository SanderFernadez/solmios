// seeds/usuarios.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedUsuarios(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Usuarios de ejemplo'
    activo: true
    },
    {
    nombre: 'Usuarios de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Usuarios', item)))

  console.log('  ✓ Usuarios seeded: ' + items.length + ' items')
}
