// seeds/auditlog.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedAuditlog(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Auditlog de ejemplo'
    activo: true
    },
    {
    nombre: 'Auditlog de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Auditlog', item)))

  console.log('  ✓ Auditlog seeded: ' + items.length + ' items')
}
