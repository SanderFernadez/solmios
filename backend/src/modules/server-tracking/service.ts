// server-tracking/service.ts — Facade del módulo (F3, spec server-tracking).
//
// Responsabilidades:
//  - `fireAll(reservationId)`: dispara Meta CAPI + GA4-SS para una reserva confirmada.
//  - `fireTest(hotelId, reservationId?)`: evento de TEST para "Send test event" del admin.
//  - `listEvents(query, hotelId)`: historial para auditoría (spec.md "Ver historial").
//
// NO sabe de HTTP ni de hashes. Delega los fires a usecases/{fire-all,meta-capi,ga4-ss}.ts.
// NO importa de otros módulos: le pasamos los repos por constructor (Dependency Inversion).
//
// Anti-patrón ORM (mem 1805): TODO campo persistido por el service/DTO/usecase está
// declarado en `model.ts`. tracking_events.target y status son REQUIRED → siempre seteados.
import type { RepositoryAdapter, Logger, CacheAdapter } from 'arckode-framework'
import type {
  TrackingEventDTO, CreateTrackingEventDTO, FireResult, TestFireResult,
  ReservationTrackingData, TrackingFetcher,
} from './types'
import type { ServerTrackingSockets } from './sockets'
import { fireMetaConversion, type MetaCapiDeps } from './usecases/meta-capi'
import { fireGa4Conversion, type Ga4SSDeps } from './usecases/ga4-ss'
import {
  fireAll as fireAllUsecase, loadReservationData as loadData, loadReservationDataForUser,
  type FireAllDeps,
} from './usecases/fire-all'

export interface ServerTrackingServiceDeps extends FireAllDeps {}

export interface EventsQuery {
  reservationId?: string
  target?: string
  status?: string
  limit?: number
}

const DEFAULT_LIST_LIMIT = 50
const MAX_LIST_LIMIT = 100

export class ServerTrackingService {
  private sockets: ServerTrackingSockets = {}

  constructor(
    private readonly trackingRepo: RepositoryAdapter<TrackingEventDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly deps: ServerTrackingServiceDeps,
  ) {}

  setSockets(_s: Partial<ServerTrackingSockets>): void {
    this.sockets = { ...this.sockets, ..._s }
  }

  /** Carga datos de la reserva + guest. Delega al usecase (spec.md data necesaria para fires). */
  async loadReservationData(reservationId: string): Promise<ReservationTrackingData | null> {
    return loadData(reservationId, this.deps)
  }

  /**
   * Dispara ambos fires (Meta + GA4) en paralelo para una reserva confirmada. Trigger del
   * connector `bookingengine-tracking` post-confirm del webhook Stripe. Best-effort: nunca lanza.
   */
  async fireAll(reservationId: string): Promise<{ meta: FireResult; ga4: FireResult; data: ReservationTrackingData | null }> {
    return fireAllUsecase(reservationId, this.trackingRepo, this.deps, this.logger)
  }

  /**
   * Dispara un evento de TEST a Meta + GA4. Sin reserva real (payload sintético, value:0,
   * sin PII) salvo que se pase `reservationId`. Para el botón "Send test event" del admin.
   */
  async fireTest(hotelId: string, reservationId?: string): Promise<TestFireResult> {
    let data: ReservationTrackingData
    if (reservationId) {
      const loaded = await loadReservationDataForUser(reservationId, hotelId, this.deps)
      if (!loaded) throw new Error('Reserva no encontrada para el test-fire')
      data = loaded
    } else {
      data = {
        reservationId: `test-${crypto.randomUUID()}`,
        hotelId, roomId: 'test-room',
        totalAmount: 0, currency: 'USD',
        guestEmail: null, guestPhone: null,
        marketingAccepted: false, // test nunca manda PII real
        anonymousId: null,
      }
    }
    const metaDeps: MetaCapiDeps = { configRepo: this.deps.configRepo, fetcher: this.deps.fetcher, timeoutMs: this.deps.timeoutMs }
    const ga4Deps: Ga4SSDeps = { configRepo: this.deps.configRepo, fetcher: this.deps.fetcher, timeoutMs: this.deps.timeoutMs }
    const meta = await fireMetaConversion(data, this.trackingRepo, metaDeps, this.logger)
    const ga4 = await fireGa4Conversion(data, this.trackingRepo, ga4Deps, this.logger)
    return { meta, ga4 }
  }

  /** Lista events para auditoría (spec.md "Persistencia de eventos para auditoría"). Multi-tenant. */
  async listEvents(query: EventsQuery, hotelId: string): Promise<TrackingEventDTO[]> {
    const filters: Record<string, unknown> = { hotelId }
    if (query.reservationId) filters.reservationId = query.reservationId
    if (query.target) filters.target = query.target
    if (query.status) filters.status = query.status
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT)
    const result = await this.trackingRepo.paginate(filters, { offset: 0, limit })
    return result.data
  }

  /** Crea un evento interno del funnel (F4). NO dispara HTTP. */
  async trackInternal(dto: CreateTrackingEventDTO): Promise<TrackingEventDTO> {
    return this.trackingRepo.create(dto as Omit<TrackingEventDTO, 'id'>)
  }
}
