// seeds/facturas.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedFacturas(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Facturas de ejemplo'
    activo: true
    },
    {
    nombre: 'Facturas de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Facturas', item)))

  console.log('  ✓ Facturas seeded: ' + items.length + ' items')
}
