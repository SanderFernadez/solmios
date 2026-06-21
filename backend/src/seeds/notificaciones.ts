// seeds/notificaciones.ts — Datos de prueba
import type { SeedOrm } from 'arckode-framework/cli/commands/db-seed'

export async function seedNotificaciones(orm: SeedOrm): Promise<void> {
  const items = [
    {
      hotelId: 'h1',
      type: 'system',
      title: 'Bienvenido a SOLMI OS',
      message: 'Tu sistema de gestión hotelera está listo.',
      read: 0,
      sent: 1,
      channel: 'in_app',
    },
    {
      hotelId: 'h1',
      type: 'reservation',
      title: 'Nueva reserva recibida',
      message: 'Reserva de Juan Pérez del 15 al 20 de julio.',
      read: 0,
      sent: 1,
      channel: 'in_app',
    },
  ]

  await Promise.all(items.map(item => orm.create('Notifications', item)))

  console.log('  ✓ Notificaciones seeded: ' + items.length + ' items')
}
