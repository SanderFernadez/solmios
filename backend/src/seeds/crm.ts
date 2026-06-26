// seeds/crm.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedCrm(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Crm de ejemplo'
    activo: true
    },
    {
    nombre: 'Crm de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Crm', item)))

  console.log('  ✓ Crm seeded: ' + items.length + ' items')
}
