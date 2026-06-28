// seeds/ai-gerente.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedAiGerente(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'AiGerente de ejemplo'
    activo: true
    },
    {
    nombre: 'AiGerente de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('AiGerente', item)))

  console.log('  ✓ AiGerente seeded: ' + items.length + ' items')
}
