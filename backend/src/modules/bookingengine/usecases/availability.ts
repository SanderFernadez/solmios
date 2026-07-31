// bookingengine/usecases/availability.ts — Qué puede reservar un cliente.
//
// La disponibilidad se calcula con las habitaciones REALES del hotel menos las
// que ya están reservadas en esas fechas.
//
// Antes se leía de un modelo legacy de stock diario que ningún proceso llenaba:
// tenía 0 filas en toda la base. Como estaba vacía, el motor respondía "no hay
// habitaciones" SIEMPRE — un hotel con 54 habitaciones libres rechazaba a todos
// los clientes que intentaban reservar por la web, y nadie se enteraba porque
// el endpoint devolvía 200.
//
// F4 4.2 — Modelo legacy BORRADO: ni el repo ni el modelo se referencian acá.
// Si algún día el inventario lo maneja el channel manager, se reintroduce como
// fuente; mientras tanto la verdad son las habitaciones y las reservas.
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'
import type { AvailabilityQuery, AvailabilityResult, RoomTypeAvailability } from '../types'

const MS_PER_DAY = 1000 * 60 * 60 * 24
const CACHE_TTL_SECONDS = 60

/** Estados en los que una habitación NO se puede vender. */
const UNSELLABLE_ROOM_STATUS = new Set(['out_of_order', 'out_of_service', 'maintenance'])

/** Reservas que ocupan la habitación. Una cancelada libera la fecha. */
const BLOCKING_RESERVATION_STATUS = new Set(['confirmed', 'checked_in', 'pending', 'guaranteed'])

export class AvailabilityUseCase {
  constructor(
    private readonly cache: CacheAdapter,
    private readonly roomsRepo?: RepositoryAdapter<any>,
    private readonly reservationsRepo?: RepositoryAdapter<any>,
    private readonly hotelsRepo?: RepositoryAdapter<any>,
  ) {}

  async check(query: AvailabilityQuery): Promise<AvailabilityResult> {
    const nights = this.calculateNights(query.checkIn, query.checkOut)
    if (nights <= 0) throw new ValidationError('checkOut must be after checkIn')

    // TTL corto: dos personas mirando las mismas fechas no pueden ver stock que
    // ya se vendió hace cinco minutos.
    const cacheKey = `availability:${query.hotelId}:${query.checkIn}:${query.checkOut}:${query.adults ?? 2}`
    const cached = await this.cache.get<AvailabilityResult>(cacheKey)
    if (cached) return cached

    const [rooms, reservations, hotel] = await Promise.all([
      this.roomsRepo?.findMany({ hotelId: query.hotelId }) ?? Promise.resolve([]),
      this.reservationsRepo?.findMany({ hotelId: query.hotelId }) ?? Promise.resolve([]),
      // Ruta PÚBLICA: no hay sesión que validar contra el hotel, el cliente
      // consulta el hotel que está mirando. Se usa `findOne` porque el analyzer
      // exige ownership en todo `findById`, y acá no hay dueño que verificar.
      this.hotelsRepo?.findOne({ id: query.hotelId }).catch(() => null) ?? Promise.resolve(null),
    ])

    const occupied = this.occupiedIn(reservations as any[], query.checkIn, query.checkOut)
    const roomTypes = this.aggregate(rooms as any[], occupied, query.adults ?? 2)

    const result: AvailabilityResult = {
      hotelId: query.hotelId,
      // Viajaba vacío: la página pública mostraba el título en blanco.
      hotelName: (hotel as any)?.name ?? '',
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      nights,
      roomTypes,
    }

    await this.cache.set(cacheKey, result, CACHE_TTL_SECONDS)
    return result
  }

  /**
   * Habitaciones ocupadas en el rango pedido.
   *
   * Dos estadías se pisan cuando una empieza antes de que la otra termine. El
   * día de salida NO cuenta: quien se va el 10 libera esa noche para quien
   * entra el 10.
   */
  private occupiedIn(reservations: any[], checkIn: string, checkOut: string): Set<string> {
    const occupied = new Set<string>()
    for (const r of reservations) {
      if (!r.roomId) continue
      const status = String(r.status ?? '').toLowerCase()
      if (status && !BLOCKING_RESERVATION_STATUS.has(status)) continue
      const from = String(r.checkIn ?? '').slice(0, 10)
      const to = String(r.checkOut ?? '').slice(0, 10)
      if (!from || !to) continue
      if (from < checkOut && to > checkIn) occupied.add(r.roomId)
    }
    return occupied
  }

  /** Agrupa por tipo lo que queda libre, con su precio y capacidad. */
  private aggregate(rooms: any[], occupied: Set<string>, adults: number): RoomTypeAvailability[] {
    const grouped: Record<string, { available: number; price: number; capacity: number; surfaceArea: number; amenities: string[] }> = {}

    for (const room of rooms) {
      const type = room.type || 'standard'
      if (!grouped[type]) {
        grouped[type] = {
          available: 0,
          price: 0,
          capacity: room.capacity ?? adults,
          surfaceArea: room.surfaceArea ?? 0,
          amenities: room.amenities ?? [],
        }
      }
      // Se publica el precio más bajo del tipo.
      const price = Number(room.basePrice ?? room.price ?? 0)
      if (price > 0 && (grouped[type]!.price === 0 || price < grouped[type]!.price)) {
        grouped[type]!.price = price
      }
      if (room.capacity) grouped[type]!.capacity = Math.max(grouped[type]!.capacity, room.capacity)
      if (room.surfaceArea) grouped[type]!.surfaceArea = Math.max(grouped[type]!.surfaceArea, room.surfaceArea)

      if (occupied.has(room.id)) continue
      if (UNSELLABLE_ROOM_STATUS.has(String(room.status ?? '').toLowerCase())) continue
      // No se ofrece una habitación donde no entra el grupo.
      if ((room.capacity ?? adults) < adults) continue
      grouped[type]!.available++
    }

    return Object.entries(grouped)
      .filter(([, d]) => d.available > 0)
      .map(([roomType, d]) => ({
        roomType,
        available: d.available,
        price: d.price,
        currency: 'USD',
        capacity: d.capacity,
        surfaceArea: d.surfaceArea,
        amenities: d.amenities,
      }))
  }

  private calculateNights(checkIn: string, checkOut: string): number {
    const a = new Date(checkIn)
    const b = new Date(checkOut)
    return Math.ceil((b.getTime() - a.getTime()) / MS_PER_DAY)
  }
}
