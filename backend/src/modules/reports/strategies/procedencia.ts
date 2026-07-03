import type { ReportStrategy, ReportContext } from './types'

export class ProcedenciaStrategy implements ReportStrategy {
  readonly type = 'procedencia'

  execute(ctx: ReportContext) {
    const guestById = new Map(ctx.guests.map((g: any) => [g.id, g]))
    const byCountry: Record<string, { guests: number; revenue: number }> = {}
    const byChannel: Record<string, { count: number; revenue: number }> = {}
    for (const r of ctx.reservations) {
      const g = guestById.get(r.guestId)
      const country = g?.nationality || g?.country || 'Desconocido'
      if (!byCountry[country]) byCountry[country] = { guests: 0, revenue: 0 }
      byCountry[country].guests += 1
      byCountry[country].revenue += r.totalAmount || 0
      const ch = r.channel || 'direct'
      if (!byChannel[ch]) byChannel[ch] = { count: 0, revenue: 0 }
      byChannel[ch].count += 1
      byChannel[ch].revenue += r.totalAmount || 0
    }
    return {
      type: this.type, from: ctx.from, to: ctx.to,
      byCountry: Object.entries(byCountry).map(([country, v]) => ({ country, ...v })).sort((a, b) => b.guests - a.guests),
      byChannel: Object.entries(byChannel).map(([channel, v]) => ({ channel, ...v })).sort((a, b) => b.count - a.count),
    }
  }
}
