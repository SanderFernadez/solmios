// seeds/anuncios.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedAnuncios(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Anuncios de ejemplo'
    activo: true
    },
    {
    nombre: 'Anuncios de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Anuncios', item)))

  console.log('  ✓ Anuncios seeded: ' + items.length + ' items')
}
