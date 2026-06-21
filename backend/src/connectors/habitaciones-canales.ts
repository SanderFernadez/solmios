// connectors/habitaciones-canales.ts — Conector entre módulos
// Cuando se actualiza una habitación, delega el push de tarifa al módulo canales (Channex).
// Los conectores solo wirean (CLAUDE #3): la decisión de empujar o no la tarifa
// vive en CanalesService.pushRate. Nunca importar módulos entre sí (regla del framework).

import type { ConnectorContext } from 'arckode-framework'

export function habitacionesCanalesConnector(ctx: ConnectorContext): void {
  const habitaciones = ctx.resolveModule<{ setSockets: (s: any) => void }>('habitaciones')
  const canales = ctx.resolveModule<{ pushRate: (hotelId: string, roomType: string, precio: number) => Promise<{ pushed: boolean }> }>('canales')

  habitaciones.setSockets({
    onHabitacionesUpdated: async (habitacion: any) =>
      canales.pushRate(habitacion.hotelId, habitacion.type, Number(habitacion.basePrice)),
  })
}
