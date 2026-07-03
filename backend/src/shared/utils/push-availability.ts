import type { Logger } from 'arckode-framework'

export function createPushAvailability(resolveModule: <T>(name: string) => T | null, logger: Logger): (hotelId: string, roomId: string) => void {
  return (hotelId: string, roomId: string): void => {
    const canales = resolveModule<{ pushAvailabilityByRoom: (h: string, r: string) => Promise<{ pushed: boolean }> }>('canales')
    if (!canales?.pushAvailabilityByRoom) return
    void canales.pushAvailabilityByRoom(hotelId, roomId).catch((e: unknown) =>
      logger.warn('pushAvailability Channex falló', { hotelId, roomId, error: String(e) }),
    )
  }
}
