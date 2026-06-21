// seeds/paquetes.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedPaquetes(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Paquetes de ejemplo'
    activo: true
    },
    {
    nombre: 'Paquetes de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Paquetes', item)))

  console.log('  ✓ Paquetes seeded: ' + items.length + ' items')
}
