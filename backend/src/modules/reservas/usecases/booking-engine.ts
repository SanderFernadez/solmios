import type { ReservasQueries } from './reservas-queries'

export async function getBookingEngineDashboard(queries: ReservasQueries, user: any): Promise<any> {
  let hotelId = user?.hotelId
  if (!hotelId || hotelId === 'platform') {
    const hotels = await queries.findHotels(); const first: any = hotels[0]
    hotelId = first?.id
  }
  const hotel = await queries.findHotelById(hotelId)
  const roomTypes = await queries.findRoomsByHotel(hotelId)
  const res = await queries.findReservationsByHotel(hotelId)
  const directas = res.filter((r: any) => r.channel === 'direct' || r.channel === 'whatsapp').length
  const revenueDirecta = res.filter((r: any) => r.channel === 'direct' || r.channel === 'whatsapp').reduce((s: number, r: any) => s + (r.totalAmount || 0), 0)
  return { hotel, roomTypes, total: roomTypes?.length || 0, directas, revenueDirecta, totalReservas: res.length, comisionesAhorradas: Math.round(revenueDirecta * 0.15) }
}
