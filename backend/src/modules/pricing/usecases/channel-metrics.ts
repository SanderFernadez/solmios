export async function getChannelMetrics(orm: any, hotelId: string): Promise<any[]> {
  const reservations = await orm.findMany('Reservations', { hotelId }) as any[]
  const rooms = await orm.findMany('Rooms', { hotelId }) as any[]
  const byChannel: Record<string, { count: number; revenue: number; nights: number }> = {}
  for (const r of reservations) {
    const ch = r.channel || 'direct'
    if (!byChannel[ch]) byChannel[ch] = { count: 0, revenue: 0, nights: 0 }
    byChannel[ch].count++; byChannel[ch].revenue += r.totalAmount || 0
    const ci = new Date(String(r.checkIn).slice(0, 10)).getTime()
    const co = new Date(String(r.checkOut).slice(0, 10)).getTime()
    byChannel[ch].nights += co > ci ? Math.round((co - ci) / 86400000) : 0
  }
  return Object.entries(byChannel).map(([channel, data]) => ({
    channel, bookings: data.count, revenue: data.revenue,
    adr: data.nights > 0 ? Math.round(data.revenue / data.nights) : 0,
    revpar: rooms.length > 0 ? Math.round(data.revenue / rooms.length) : 0,
    avgStay: data.count > 0 ? (data.nights / data.count).toFixed(1) : '0',
  }))
}
