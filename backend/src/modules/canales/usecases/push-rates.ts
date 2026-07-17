import type { CanalesDTO } from '../types'

interface PushRatesDeps {
  getConfig: (hotelId: string) => Promise<CanalesDTO | undefined>
  findMany: (model: string, query: any) => Promise<any[]>
  pushSeasonalRates: (
    cfg: CanalesDTO | undefined,
    rates: Array<{ roomType: string; season: string; basePrice: number; percentage: number; closed?: number; minStay?: number; maxStay?: number }>,
    seasons: Array<{ name: string; startDate?: string; endDate?: string }>,
  ) => Promise<{ pushed: number; skipped: number }>
}

/**
 * Lee las tarifas del hotel y las empuja a Channex por temporada. Elige UNA tarifa por (roomType, season):
 * prefiere el override del canal pedido sobre la base, y dentro del mismo origen la de mayor ocupación
 * (la primaria/per_room). El push va a los rate plans de la propiedad (Channex los distribuye a los canales).
 */
export async function pushSeasonalRatesToChannex(
  deps: PushRatesDeps,
  hotelId: string,
  channel?: string,
): Promise<{ pushed: number; skipped: number }> {
  const [cfg, allRates, seasons] = await Promise.all([
    deps.getConfig(hotelId),
    deps.findMany('RoomRates', { hotelId }),
    deps.findMany('Seasons', { hotelId }),
  ])
  const wanted = channel || ''
  const byKey = new Map<string, any>()
  for (const r of allRates) {
    if (r.channel !== wanted && r.channel) continue // solo el canal pedido + la base
    const k = `${r.roomType}|${r.season}`
    const cur = byKey.get(k)
    const better = !cur
      || (r.channel === wanted && cur.channel !== wanted)
      || (r.channel === cur.channel && Number(r.occupancy) > Number(cur.occupancy))
    if (better) byKey.set(k, r)
  }
  return deps.pushSeasonalRates(cfg, [...byKey.values()], seasons)
}
