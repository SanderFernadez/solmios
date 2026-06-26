// seeds/marketing.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedMarketing(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Marketing de ejemplo'
    activo: true
    },
    {
    nombre: 'Marketing de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Marketing', item)))

  console.log('  ✓ Marketing seeded: ' + items.length + ' items')
}
