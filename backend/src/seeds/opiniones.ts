// seeds/opiniones.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedOpiniones(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Opiniones de ejemplo'
    activo: true
    },
    {
    nombre: 'Opiniones de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Opiniones', item)))

  console.log('  ✓ Opiniones seeded: ' + items.length + ' items')
}
