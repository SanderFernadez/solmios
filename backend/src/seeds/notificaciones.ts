// seeds/notificaciones.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedNotificaciones(orm: SeedOrm): Promise<void> {
  const items = [
    {
    nombre: 'Notificaciones de ejemplo'
    activo: true
    },
    {
    nombre: 'Notificaciones de ejemplo 2'
    activo: true
    },
  ]

  await Promise.all(items.map(item => orm.create('Notificaciones', item)))

  console.log('  ✓ Notificaciones seeded: ' + items.length + ' items')
}
