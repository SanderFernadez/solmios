// bookingengine/usecases/analytics.ts — Analytics y funnel de conversión (F4 4.1 / D13).
//
// El funnel de conversión se alimenta de `tracking_events` (tabla del módulo server-tracking).
// Orden canónico del funnel (spec design.md D13):
//   view → search → select → upsell → form → pay → confirm
//
// Anti-patrón cross-module: bookingengine NO importa nada de server-tracking. El repo se
// construye desde `index.ts` sobre el modelo global `TrackingEvent` (registrado por
// server-tracking en `composition-root.ts`) — mismo patrón que ya usamos para Rooms,
// Reservations, Hotels, etc. Solo vamos a leer `event`/`createdAt`, sin tocar tipos ajenos.
//
// KPIs históricos (totalSearches, totalBookings, conversionRate, totalRevenue,
// averageBookingValue) se siguen computando desde `conversion_events` (la tabla legacy que
// llena `POST /api/public/events` y el auto-fire `booking_created` post-createBooking).
// Migrar esos KPIs a tracking_events es alcance de otra fase — F4 solo reemplaza el stub
// `topRoomTypes:[]` (que devolvía vacío) por el funnel real.
import type { RepositoryAdapter } from 'arckode-framework'
import type { ConversionEventDTO, CreateConversionEventDTO, BookingAnalytics, FunnelStep } from '../types'
import { inDateRange } from '../../../shared/usecases/date-range'

/** Orden y etiquetas del funnel (spec design.md D13). */
const FUNNEL_STEPS: ReadonlyArray<{ step: string; label: string }> = [
  { step: 'view', label: 'Vista de landing' },
  { step: 'search', label: 'Búsqueda de fechas' },
  { step: 'select', label: 'Habitación seleccionada' },
  { step: 'upsell', label: 'Upsell añadido' },
  { step: 'form', label: 'Form de huésped' },
  { step: 'pay', label: 'Redirect a Stripe' },
  { step: 'confirm', label: 'Reserva confirmada' },
]

/** Shape mínimo que necesitamos leer de tracking_events (sin importar el tipo del otro módulo). */
interface TrackingEventRow {
  event: string
  createdAt?: string
}

export class AnalyticsUseCase {
  constructor(
    private readonly eventsRepo: RepositoryAdapter<ConversionEventDTO>,
    /**
     * Repo sobre `TrackingEvent` para el funnel (F4 4.1). Opcional: si no se cablea
     * (tests viejos, módulo server-tracking deshabilitado), el funnel devuelve 0 en
     * todos los steps en lugar de crashear. El service siempre lo pasa en prod.
     */
    private readonly trackingRepo?: RepositoryAdapter<TrackingEventRow>,
  ) {}

  async track(dto: CreateConversionEventDTO): Promise<ConversionEventDTO> {
    const saved = await this.eventsRepo.create(dto as any)
    // F4 4.1 (D13) — Dual-write: además de persistir en conversion_events (back-compat),
    // escribimos el equivalente en tracking_events con target='internal' para que el funnel
    // tenga el step. Si la escritura falla (repo sin cablear, modelo no registrado), NO
    // rompemos el track público — el evento ya quedó en conversion_events y el fire client-side
    // igual cuenta para Meta/GA4. El funnel solo pierde 1 fila (mejor que un 500 al huésped).
    if (this.trackingRepo) {
      try {
        await this.trackingRepo.create({
          hotelId: dto.hotelId,
          event: dto.event,
          target: 'internal',
          status: 'sent',
          timestamp: new Date().toISOString(),
          meta: {
            sessionId: dto.sessionId,
            roomType: dto.roomType,
            amount: dto.amount,
            source: dto.source,
            utmSource: dto.utmSource,
            utmMedium: dto.utmMedium,
            utmCampaign: dto.utmCampaign,
            device: dto.device,
            country: dto.country,
          },
        } as any)
      } catch {
        // Silencioso: el funnel es best-effort, el evento ya está en conversion_events.
      }
    }
    return saved
  }

  async getAnalytics(hotelId: string, from?: string, to?: string): Promise<BookingAnalytics> {
    // El rango se acota en memoria: el ORM no bindea `{ $gte }` (ver shared/usecases/date-range).
    const [allEvents, allTracking] = await Promise.all([
      this.eventsRepo.findMany({ hotelId }),
      this.trackingRepo?.findMany({ hotelId }) ?? Promise.resolve([]),
    ])

    const events = inDateRange(allEvents, 'createdAt', from, to)
    const trackingRows = inDateRange(allTracking as TrackingEventRow[], 'createdAt', from, to)

    const searches = events.filter((e: ConversionEventDTO) => e.event === 'search').length
    const bookings = events.filter((e: ConversionEventDTO) => e.event === 'booking_created').length
    const revenue = events
      .filter((e: ConversionEventDTO) => e.event === 'booking_created')
      .reduce((sum: number, e: ConversionEventDTO) => sum + (e.amount ?? 0), 0)

    return {
      totalSearches: searches,
      totalBookings: bookings,
      conversionRate: searches > 0 ? (bookings / searches) * 100 : 0,
      totalRevenue: revenue,
      averageBookingValue: bookings > 0 ? revenue / bookings : 0,
      funnel: this.buildFunnel(trackingRows),
    }
  }

  /**
   * Construye el funnel con drop-off entre steps.
   *
   * `dropOff` = % del step actual que avanzó al siguiente (count_siguiente / count_actual * 100).
   * Si count_actual = 0, dropOff = 0 (no hubo tráfico en este step → no hay conversión que medir).
   * Último step (confirm) → dropOff = null (no hay step siguiente).
   */
  private buildFunnel(rows: TrackingEventRow[]): FunnelStep[] {
    const counts: Record<string, number> = {}
    for (const r of rows) {
      const key = String(r.event ?? '').toLowerCase()
      if (!key) continue
      counts[key] = (counts[key] ?? 0) + 1
    }

    return FUNNEL_STEPS.map((s, i) => {
      const count = counts[s.step] ?? 0
      const isLast = i === FUNNEL_STEPS.length - 1
      if (isLast) {
        return { step: s.step, label: s.label, count, dropOff: null }
      }
      const nextCount = counts[FUNNEL_STEPS[i + 1]!.step] ?? 0
      const dropOff = count > 0 ? Math.round((nextCount / count) * 100) : 0
      return { step: s.step, label: s.label, count, dropOff }
    })
  }
}
