// bookingengine/usecases/public-booking.ts — Flujo unificado de reserva pública.
//
// Crea la reserva pending en `Reservations` (NO en `public_bookings`) + guest + (F0 0.16)
// dispara el createCheckoutSession de Stripe. El widget recibe `{reservationId, accessToken,
// checkoutUrl}` y redirige a la URL de Stripe (off-site).
//
// F0 0.16 — Aceptación de `promoCode` y `upsells`:
//   Es un HOOK para F2 (task 2.5) — los campos se aceptan en el body y se persisten en la
//   reserva (`promoCode`, `notes` con detalle de upsells) pero NO se validan contra el schema
//   completo (eso viene en F2 con el módulo promo-codes y el modelo Upsell). La idea es que
//   cuando F2 cablee el widget unificado, el backend ya tenga dónde meter esos campos sin
//   romper el contrato de hoy. El monto que se cobra sigue siendo `room.basePrice * nights`
//   (sin descuento ni upsells sumados) — F2 2.5 es quien cambia eso.
//
// Robustez F0 (pagos en prod, spec booking-unification §"PRECAUCIÓN CRÍTICA"):
//   Si `gw.createCharge` falla (hotel sin Stripe configurado, gateway caído, error de red,
//   secret inválido), la reserva SE CREA igual con status='pending' y se devuelve 201 con
//   `checkoutUrl: null` + `paymentError: <mensaje>`. El huésped al menos tiene su reserva; el
//   panel la muestra como "pendiente de pago". NO tirar 500: rompería la creación de reserva
//   por un problema de Stripe, que es una dependencia opcional por hotel.

import { safeParse } from '../../../shared/utils/safe-parse'

export interface UpsellItem {
  id: string
  quantity: number
}

/**
 * Contrato mínimo del service que necesita el usecase. Es una interfaz (NO la clase concreta)
 * para que los tests puedan mockearlo sin instanciar el `BookingengineService` real.
 */
export interface PublicBookingStripeDeps {
  /**
   * Crea la Checkout Session sobre `Reservations`. Lanza si la reserva no existe o el hotel
   * no tiene pasarela. El usecase atrapa para degradar graceful (ver robustez F0).
   */
  createReservationCheckout(
    reservationId: string,
    amount: number,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ id: string; url: string; payment_status: string }>
}

export interface PublicBookingLogger {
  warn(msg: string, meta?: any): void
  error(msg: string, meta?: any): void
}

export async function getPublicBookingBySlug(orm: any, slug: string, query: any): Promise<any> {
  const hotels = await orm.findMany('Hotels', {}) as any[]
  const hotel = hotels.find((h: any) => h.name?.toLowerCase().replace(/\s+/g, '-') === slug || h.id === slug)
  if (!hotel) return { status: 404, body: { error: 'Hotel no encontrado' } }

  const rooms = await orm.findMany('Rooms', { hotelId: hotel.id }) as any[]
  let available = rooms.filter((r: any) => r.status === 'disponible' || r.status === 'available')

  if (query.checkIn && query.checkOut) {
    const hotelRes = await orm.findMany('Reservations', { hotelId: hotel.id }) as any[]
    const overlap = new Set(hotelRes
      .filter((r: any) => r.status !== 'cancelled' && r.status !== 'no_show' && r.checkIn < query.checkOut && r.checkOut > query.checkIn)
      .map((r: any) => r.roomId))
    available = available.filter((r: any) => !overlap.has(r.id))
  }

  const roomIds = new Set(rooms.map((r: any) => r.id))
  const amsRaw = ((await orm.findMany('RoomAmenities', {})) as any[]).filter((a: any) => roomIds.has(a.roomId) && a.isActive !== false)
  const amsByRoom = new Map<string, string[]>()
  for (const a of amsRaw) {
    if (!amsByRoom.has(a.roomId)) amsByRoom.set(a.roomId, [])
    amsByRoom.get(a.roomId)!.push(a.amenityKey)
  }

  const byType = new Map<string, any[]>()
  for (const r of available) {
    const key = r.type || 'standard'
    if (!byType.has(key)) byType.set(key, [])
    byType.get(key)!.push({ id: r.id, number: r.number, name: r.name, basePrice: r.basePrice, capacity: r.capacity })
  }
  const roomTypes = Array.from(byType.entries()).map(([type, items]) => ({
    type, count: items.length, price: items[0].basePrice, rooms: items,
    amenities: amsByRoom.get(items[0].id) || [],
  }))
  return { status: 200, body: { hotel: { id: hotel.id, name: hotel.name, slug: hotel.name?.toLowerCase().replace(/\s+/g, '-') }, roomTypes } }
}

/**
 * Crea la reserva pública y dispara el createCheckoutSession.
 *
 * @param orm            ORM del framework (mockeable en tests).
 * @param body           Body del POST `/api/public/booking`.
 * @param pushAvailability Callback opcional para invalidar cache de disponibilidad.
 * @param auth           Wrapper de auth (solo para assertOwnership del room).
 * @param stripe         (F0 0.16) Servicio que crea la Checkout Session. Si no se pasa, la
 *                       reserva se crea igual sin intentar cobro (compat con callers viejos
 *                       como `reservas/tests/ownership.test.ts` que no pasan este arg).
 * @param logger         (F0 0.16) Logger para avisar si Stripe falla (no rompe el flujo).
 * @param stripeUrls     (F0 0.16) URLs de success/cancel. Si no se pasan, no se intenta cobro.
 *                       El controller las arma desde el referer/host del request en F0 wiring.
 */
export async function createPublicBookingDirect(
  orm: any,
  body: any,
  pushAvailability?: (hotelId: string, roomId: string) => void,
  auth?: any,
  stripe?: PublicBookingStripeDeps,
  logger?: PublicBookingLogger,
  stripeUrls?: { successUrl: string; cancelUrl: string },
): Promise<any> {
  const {
    hotelId, roomId, guestName, guestEmail, guestPhone,
    checkIn, checkOut, adults, children: kids,
    // F0 0.16 — Hooks para F2 (task 2.5): promoCode + upsells. Aceptados, persistidos, pero
    // sin validación completa de schema todavía. El monto a cobrar sigue siendo
    // room.basePrice * nights; F2 2.5 es quien cambia el cálculo.
    promoCode,
    upsells,
  } = body

  if (!hotelId || !roomId || !guestName || !guestEmail || !checkIn || !checkOut) {
    return { status: 400, body: { error: 'Campos requeridos: hotelId, roomId, guestName, guestEmail, checkIn, checkOut' } }
  }
  if (checkIn >= checkOut) return { status: 400, body: { error: 'checkIn debe ser anterior a checkOut' } }

  const room = await orm.findById('Rooms', roomId) as any
  if (!room) return { status: 404, body: { error: 'Habitación no encontrada' } }
  // No hay usuario: el motor es público. La habitación tiene que ser del hotel del formulario.
  // Iba `assertOwnership(room, { hotelId })` — dos objetos, `===` siempre false: toda reserva daba 403.
  if (auth) auth.assertOwnership(room.hotelId, hotelId)

  const overlapping = (await orm.findMany('Reservations', { roomId })) as any[]
  const hasOverlap = overlapping.some((r: any) =>
    r.status !== 'cancelled' && r.status !== 'no_show' && r.checkIn < checkOut && r.checkOut > checkIn)
  if (hasOverlap) return { status: 409, body: { error: 'Habitación no disponible en esas fechas' } }

  const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
  const totalAmount = (room.basePrice || 0) * nights

  // Notas enriquecidas si hay promo/upsells (F2 los persistirá en campos propios; por ahora
  // viven en `notes` para que el recepcionista los vea en el panel).
  const notesParts: string[] = ['Reserva desde widget público']
  if (promoCode) notesParts.push(`Promo: ${promoCode}`)
  if (Array.isArray(upsells) && upsells.length > 0) {
    const summary = upsells.map((u: UpsellItem) => `${u.id}×${u.quantity || 1}`).join(', ')
    notesParts.push(`Upsells: ${summary}`)
  }

  const guest = await orm.create('Guests', {
    id: crypto.randomUUID(), hotelId, name: guestName, email: guestEmail, phone: guestPhone || '',
    documentType: 'passport', documentNumber: '', nationality: '', address: '',
  })
  // F0 0.13 — AccessToken público (UUID). Solo el flujo público lo setea; las reservas
  // creadas desde `/api/panel/reservas` NO lo reciben → `accessToken=null` → 404 en el
  // endpoint público (anti-enumeración IDOR, spec booking-unification D4).
  const reservation = await orm.create('Reservations', {
    id: crypto.randomUUID(), hotelId, roomId, guestId: guest.id,
    checkIn, checkOut, status: 'pending', source: 'direct',
    adults: adults || 1, children: kids || 0, totalAmount, deposit: 0,
    notes: notesParts.join(' | '),
    accessToken: crypto.randomUUID(),
    // F0 0.16 — Hook F2: persistimos el promoCode sin validarlo todavía. Upsells van en
    // `notes` (arriba) porque no hay campo propio hasta F2 task 2.3.
    promoCode: promoCode || undefined,
  })

  pushAvailability?.(hotelId, roomId)

  // F0 0.16 — Cableo del checkoutUrl. ROBUSTEZ: si Stripe falla (no configurado, gateway
  // caído), la reserva SE CREÓ igual. Devolvemos 201 con checkoutUrl:null + paymentError.
  // El huésped al menos tiene su reserva; el panel la ve como "pending".
  let checkoutUrl: string | null = null
  let paymentError: string | null = null
  if (stripe && stripeUrls) {
    try {
      const session = await stripe.createReservationCheckout(
        reservation.id, totalAmount, stripeUrls.successUrl, stripeUrls.cancelUrl,
      )
      checkoutUrl = session.url || null
    } catch (e: any) {
      // NO relanzar — robustez F0. La reserva ya está creada; lo peor que podemos hacer es
      // tirar 500 y que el huésped crea que la reserva no se hizo (cuando sí se hizo).
      paymentError = e?.message || 'payment_gateway_unavailable'
      logger?.warn(
        `Reserva ${reservation.id} creada pero Stripe falló — checkoutUrl null, paymentError="${paymentError}"`,
        { hotelId, reservationId: reservation.id },
      )
    }
  }

  return {
    status: 201,
    body: {
      reservation, guest,
      // F0 0.16 — Contrato nuevo (spec booking-unification API). `checkoutUrl` SIEMPRE está:
      // null cuando no se intentó cobro (sin stripe deps / sin URLs) o cuando Stripe falló.
      // `paymentError` solo se incluye si realmente hubo un error de pasarela (para que el
      // frontend pueda mostrarlo al huésped o logearlo).
      checkoutUrl,
      ...(paymentError !== null ? { paymentError } : {}),
    },
  }
}
