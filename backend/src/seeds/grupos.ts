// seeds/grupos.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedGrupos(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Grupos de ejemplo'
    activo: true
    },
    {
    nombre: 'Grupos de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Grupos', item)))

  console.log('  ✓ Grupos seeded: ' + items.length + ' items')
}
