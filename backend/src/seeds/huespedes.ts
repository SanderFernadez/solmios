// seeds/huespedes.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedHuespedes(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Huespedes de ejemplo'
    activo: true
    },
    {
    nombre: 'Huespedes de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Huespedes', item)))

  console.log('  ✓ Huespedes seeded: ' + items.length + ' items')
}
