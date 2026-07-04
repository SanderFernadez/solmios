// reservas/service.ts — Facade publica del modulo. Casos de uso, sin HTTP ni imports de otros módulos.
// Depende de RepositoryAdapter<ReservasDTO> (no del ORM directo) — swapeable en composition-root.ts.
// Si supera 200 líneas -> extraer casos de uso a ./usecases/{caso}.ts.

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import type { ReservasDTO, CreateReservasDTO, UpdateReservasDTO, ReservasQuery, ReservasPaginated } from './types'
import type { ReservasSockets } from './sockets'
import { checkinValidation, checkoutValidation, executeCheckin } from './usecases/checkin'
import { NullEmailSender, type EmailSender } from '../../services/email-sender'
import { dispatchCreateEmail } from './usecases/reservation-notifications'
import { setGuaranteePin as setGuaranteePinUsecase, getGuaranteeHasPin as getGuaranteeHasPinUsecase, unlockGuaranteeCard as unlockGuaranteeCardUsecase } from './usecases/guarantee'
import { listReservations, getReservationById, createReservation, updateReservation, deleteReservation } from './usecases/crud'
import { getPreCheckinData as getPreCheckinDataUsecase, submitPreCheckin as submitPreCheckinUsecase } from './usecases/pre-checkin'
import { getExtendedDetail as getExtendedDetailUsecase, getAuditTrail as getAuditTrailUsecase } from './usecases/detail'
import { getBookingEngineDashboard as getBookingEngineDashboardUsecase } from './usecases/booking-engine'
import type { ReservasQueries } from './usecases/reservas-queries'

const MS_PER_DAY = 86_400_000

export class ReservasService {
  private sockets: ReservasSockets = {}
  private emailSender: EmailSender = new NullEmailSender()
  private messageLogRepo: RepositoryAdapter<any> | null = null
  setEmailDeps(es: EmailSender, r: RepositoryAdapter<any>): void { this.emailSender = es; this.messageLogRepo = r }
  private notifyDeps = () => ({ emailSender: this.emailSender, messageLogRepo: this.messageLogRepo, guestRepo: this.guestRepo, roomRepo: this.roomRepo, hotelRepo: this.hotelRepo, logger: this.logger })

  // Cross-module orchestration deps (set from composition-root)
  private orchestrationDeps: {
    pushAvailabilityToChannex?: (hotelId: string, roomId: string) => void
    sendCheckinEmail?: (deps: any, data: any) => Promise<void>
    dispatchLifecycleEmail?: (deps: any, data: any) => Promise<void>
    settleFolio?: (params: { reservationId: string; hotelId: string; guestId: string | null; roomId: string | null; settle?: { amount: number; method: string; reference?: string } | null }, user: any) => Promise<{ folioId: string; invoiceId: string | null; balance: number; amountPaid: number; invoiceNumber: string | null }>
  } = {}
  setOrchestrationDeps(deps: typeof ReservasService.prototype.orchestrationDeps): void {
    Object.assign(this.orchestrationDeps, deps)
  }

  constructor(
    private readonly repo: RepositoryAdapter<ReservasDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly auth: Auth,
    private readonly guestRepo: RepositoryAdapter<any>,
    private readonly roomRepo: RepositoryAdapter<any>,
    private readonly hotelRepo: RepositoryAdapter<any>,
    private readonly queries: ReservasQueries,
    private readonly blockRepo?: RepositoryAdapter<any>,
  ) {}

  // ACUMULA handlers — nunca pisa el anterior.
  // Si dos conectores registran el mismo evento, ambos corren en cadena (secuencial).
  // Para ejecucion paralela independiente -> usar EventBus en composition-root.ts.
  setSockets(s: Partial<ReservasSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]
      if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  async list(query: ReservasQuery, currentUser: { id: string; role: string; hotelId?: string }): Promise<ReservasPaginated> {
    return listReservations(this.repo, this.userRepo, this.cache, this.logger, query, currentUser)
  }

  async getById(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<ReservasDTO> {
    this.logger.info('Obteniendo reserva', { id, userId: currentUser.id })
    return getReservationById(this.repo, id, currentUser)
  }

  async create(dto: CreateReservasDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<ReservasDTO> {
    this.logger.info('Creando reserva', { userId: currentUser.id, roomId: dto.roomId })
    const item = await createReservation(this.repo, this.blockRepo, this.logger, this.cache, this.sockets, this.notifyDeps(), dto, currentUser)
    dispatchCreateEmail(this.notifyDeps(), dto, item)
    return item
  }

  async update(id: string, dto: UpdateReservasDTO, currentUser: { id: string; role: string; hotelId?: string }): Promise<ReservasDTO> {
    this.logger.info('Actualizando reserva', { id, userId: currentUser.id })
    return updateReservation(this.repo, this.logger, this.cache, this.sockets, id, dto, currentUser)
  }

  async delete(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<void> {
    this.logger.info('Eliminando reserva', { id, userId: currentUser.id })
    return deleteReservation(this.repo, this.logger, this.cache, this.sockets, id, currentUser)
  }

  // ── CHECK-IN ─────────────────────────────────────────────────────────────
  async checkin(id: string, user: any): Promise<any> {
    return checkinValidation(this.repo, id, user, this.auth)
  }

  async executeCheckin(r: any, user: any, deps: { orm: any; pushAvailabilityToChannex?: any; sendCheckinEmail?: any; logger?: any }): Promise<any> {
    const result = await executeCheckin(r, user, {
      orm: deps.orm,
      logger: deps.logger || this.logger,
      repo: this.repo,
      queries: this.queries,
    })
    return result
  }

  // ── CHECK-OUT ──────────────────────────────────────────────────────────
  async checkout(id: string, user: any): Promise<any> {
    return checkoutValidation(this.repo, id, user, this.auth)
  }

  async executeCheckout(r: any, user: any, deps: { orm: any; invalidateHousekeepingCache?: () => Promise<void>; pushAvailabilityToChannex?: any; dispatchLifecycleEmail?: any; logger?: any }): Promise<any> {
    const nowIso = new Date().toISOString()
    try {
      await this.queries.updateReservation(r.id, { status: 'checked_out', checkedOutAt: nowIso })
    } catch (e: any) {
      throw new Error(`Error interno al procesar check-out: ${e.message}`)
    }
    const log = deps.logger || this.logger
    this.queries.createAuditLog({ id: crypto.randomUUID(), entity: 'Reservations', entityId: r.id, action: 'checkout', userId: user.id, hotelId: r.hotelId, detail: JSON.stringify({ roomId: r.roomId, guestId: r.guestId, checkIn: r.checkIn, checkOut: r.checkOut }), createdAt: nowIso })
    await this.sockets.onReservationCheckedOut?.({ reservationId: r.id, roomId: r.roomId, hotelId: r.hotelId })
    return { ok: true, reservationId: r.id, status: 'checked_out' }
  }

  // ── SETTLEMENT (folio → invoice → payment) ─────────────────────────────
  async settleFolioForCheckout(reservation: any, settle: { amount: number; method: string; reference?: string } | null | undefined, user: any): Promise<any> {
    if (!this.orchestrationDeps.settleFolio) return null
    return this.orchestrationDeps.settleFolio({
      reservationId: reservation.id,
      hotelId: reservation.hotelId,
      guestId: reservation.guestId || null,
      roomId: reservation.roomId,
      settle: settle || null,
    }, user)
  }

  // ── PRE-CHECKIN (público) ──────────────────────────────────────────────
  async getPreCheckinData(hash: string): Promise<any> {
    return getPreCheckinDataUsecase(hash, this.hotelRepo, this.roomRepo, this.guestRepo, this.queries)
  }

  async submitPreCheckin(hash: string, body: any): Promise<void> {
    return submitPreCheckinUsecase(hash, body, this.queries, this.guestRepo)
  }

  // ── EXTENDED RESERVATION DETAIL ─────────────────────────────────────────
  async getExtendedDetail(id: string, currentUser: any): Promise<any> {
    return getExtendedDetailUsecase(this.repo, this.guestRepo, this.roomRepo, this.queries, id, currentUser)
  }

  // ── AUDIT TRAIL ────────────────────────────────────────────────────────
  async getAuditTrail(id: string, currentUser: any): Promise<any[]> {
    return getAuditTrailUsecase(this.repo, this.queries, id, currentUser)
  }

  // ── GUARANTEE CARD ──────────────────────────────────────────────────────
  async setGuaranteePin(user: any, body: any): Promise<{ success: boolean }> {
    return setGuaranteePinUsecase(this.queries, this.userRepo, user, body)
  }

  async getGuaranteeHasPin(user: any): Promise<{ hasPin: boolean }> {
    return getGuaranteeHasPinUsecase(this.queries, this.userRepo, user)
  }

  async unlockGuaranteeCard(reservationId: string, user: any, body: any): Promise<any> {
    return unlockGuaranteeCardUsecase(this.queries, this.repo, this.userRepo, reservationId, user, body, this.auth)
  }

  async getBookingEngineDashboard(user: any): Promise<any> {
    return getBookingEngineDashboardUsecase(this.queries, user)
  }
}
