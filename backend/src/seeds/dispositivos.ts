// seeds/dispositivos.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedDispositivos(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Dispositivos de ejemplo'
    activo: true
    },
    {
    nombre: 'Dispositivos de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Dispositivos', item)))

  console.log('  ✓ Dispositivos seeded: ' + items.length + ' items')
}
