// payments/usecases/deposits.ts — Deposit and guarantee management

import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { DepositDTO, CreateDepositDTO, RefundDepositDTO } from '../types'
import { withLock } from '../../../shared/utils/async-lock'

export class DepositsUseCase {
  constructor(
    private readonly depositRepo: RepositoryAdapter<DepositDTO>,
    private readonly logger: Logger,
    private readonly auth?: Auth,
    private readonly userRepo?: RepositoryAdapter<any>,
  ) {}

  private async assertOwnership(resourceHotelId: string, userId?: string, userRole?: string): Promise<void> {
    if (!this.auth || !this.userRepo || !userId) return
    const me = await this.userRepo.findById(userId)
    this.auth.assertOwnership(resourceHotelId, (me as any)?.hotelId ?? '', userRole || '', 'super_admin')
  }

  async create(dto: CreateDepositDTO): Promise<DepositDTO> {
    if (dto.amount <= 0) throw new ValidationError('Deposit amount must be positive')
    
    return this.depositRepo.create({
      hotelId: dto.hotelId,
      reservationId: dto.reservationId ?? null,
      guestId: dto.guestId ?? null,
      roomId: dto.roomId ?? null,
      amount: dto.amount,
      currency: dto.currency ?? 'USD',
      status: 'held',
      paymentMethod: dto.paymentMethod ?? 'card',
      stripePaymentId: '',
      holdReason: dto.holdReason ?? 'reservation_guarantee',
      releasedAt: null,
      refundAmount: 0,
      notes: dto.notes ?? '',
    } as any)
  }

  async getById(id: string, userId?: string, userRole?: string): Promise<DepositDTO> {
    const deposit = await this.depositRepo.findById(id)
    if (!deposit) throw new NotFoundError('Deposit not found')
    await this.assertOwnership(deposit.hotelId, userId, userRole)
    return deposit
  }

  async list(hotelId: string, status?: string): Promise<DepositDTO[]> {
    const filters: Record<string, any> = { hotelId }
    if (status) filters.status = status
    return this.depositRepo.findMany(filters)
  }

  async refund(id: string, dto: RefundDepositDTO, userId?: string, userRole?: string): Promise<DepositDTO> {
    // DT-11: lock por deposit id — sin esto, dos refund() concurrentes leen el mismo
    // `refundAmount` viejo, ambos pasan la validación de "no excede el depósito" y ambos
    // escriben, aplicando el reembolso dos veces. El lock serializa read+write dentro de
    // este proceso (ver shared/utils/async-lock.ts para el alcance real de la garantía).
    return withLock(`deposit:${id}`, async () => {
      const deposit = await this.getById(id, userId, userRole)

      if (deposit.status === 'released' || deposit.status === 'fully_refunded') {
        throw new ValidationError('Deposit already released or fully refunded')
      }

      const refundAmount = dto.amount ?? (deposit.amount - deposit.refundAmount)
      const totalRefunded = deposit.refundAmount + refundAmount

      if (totalRefunded > deposit.amount) {
        throw new ValidationError(`Refund amount ($${refundAmount}) exceeds available deposit ($${deposit.amount - deposit.refundAmount})`)
      }

      const newStatus = totalRefunded >= deposit.amount ? 'fully_refunded' : 'partially_refunded'

      this.logger.info('Refunding deposit', { id, amount: refundAmount, totalRefunded })

      return this.depositRepo.update(id, {
        refundAmount: totalRefunded,
        status: newStatus,
        notes: dto.reason ? `${deposit.notes}\nRefund: ${dto.reason}`.trim() : deposit.notes,
      } as any) as Promise<DepositDTO>
    })
  }

  async release(id: string, userId?: string, userRole?: string): Promise<DepositDTO> {
    // DT-11: mismo lock y misma key que refund() — un release() y un refund() concurrentes
    // sobre el mismo depósito también deben serializarse (comparten el read-then-write).
    return withLock(`deposit:${id}`, async () => {
      const deposit = await this.getById(id, userId, userRole)

      if (deposit.status === 'released') {
        throw new ValidationError('Deposit already released')
      }

      this.logger.info('Releasing deposit', { id })

      return this.depositRepo.update(id, {
        status: 'released',
        releasedAt: new Date().toISOString(),
      } as any) as Promise<DepositDTO>
    })
  }

  /**
   * Libera TODOS los depósitos 'held' de una reserva al hacer check-out sin incidencias.
   * Lo dispara el connector `reservas-deposits`: antes el hold quedaba colgando hasta acción
   * manual (los endpoints /refund y /release existían pero nada los llamaba en el checkout).
   * Best-effort por depósito: un fallo aislado no frena a los demás. `onReleased` deja que el
   * service audite cada liberación (el puerto de audit vive en el service). Solo toca 'held':
   * un 'partially_refunded' implica intervención manual previa y se resuelve a mano.
   */
  async releaseHeldByReservation(reservationId: string, onReleased?: (d: DepositDTO) => Promise<void> | void): Promise<DepositDTO[]> {
    const deposits = await this.depositRepo.findMany({ reservationId, status: 'held' })
    const released: DepositDTO[] = []
    for (const d of deposits) {
      try {
        const updated = await this.release(d.id)
        await onReleased?.(updated)
        released.push(updated)
      } catch (e) {
        this.logger.warn('release de depósito en checkout falló', { id: d.id, error: (e as Error).message })
      }
    }
    if (released.length > 0) this.logger.info('Depósitos liberados en checkout', { reservationId, count: released.length })
    return released
  }

  async autoReleaseByCheckOut(reservationId: string, delayHours = 48): Promise<DepositDTO[]> {
    const deposits = await this.depositRepo.findMany({
      reservationId,
      status: 'held',
    })

    const released: DepositDTO[] = []
    for (const deposit of deposits) {
      const createdAt = new Date(deposit.createdAt)
      const holdExpiry = new Date(createdAt.getTime() + delayHours * 3600000)
      if (new Date() >= holdExpiry) {
        const updated = await this.release(deposit.id)
        released.push(updated)
      }
    }

    return released
  }

  async getByReservation(reservationId: string): Promise<DepositDTO[]> {
    return this.depositRepo.findMany({ reservationId })
  }

  /**
   * F5 plan #627 — Marca/libera depósitos 'held' de una reserva cancelada.
   *
   * Decisión basada en los montos del cálculo de penalidad (F2 socket onReservationCancelled):
   *   - penalty 0% (cancellationFee=0, refundAmount>0) → release (devuelve garantía completa).
   *   - penalty parcial → refund proporcional de cada depósito held (marca refundAmount pendiente).
   *   - penalty 100% o non-refundable → no-op (el depósito queda held, el hotel retiene).
   *
   * Best-effort por depósito: un fallo aislado no frena a los demás.
   * // TODO #627: refund real de Stripe pendiente (CLAUDE.md:294) — esto solo MARCA los registros.
   */
  async markHeldForCancellation(
    reservationId: string,
    refundAmount: number,
    cancellationFee: number,
    onMarked?: (d: DepositDTO, action: 'released' | 'refunded') => Promise<void> | void,
  ): Promise<DepositDTO[]> {
    const deposits = await this.depositRepo.findMany({ reservationId, status: 'held' })
    if (deposits.length === 0) return []

    // 0% penalty → release todo (mismo camino que checkout: devuelve garantía sin retener).
    //
    // NO se exige `refundAmount > 0`: los montos de la penalidad se calculan sobre
    // `reservations.deposit`, mientras que el hold vive en la tabla `deposits`. Son dos cosas
    // distintas y no siempre coinciden — una reserva que llega de una OTA no trae `deposit`
    // (el feed de Channex no lo manda), pero el hotel igual puede haberle tomado una garantía.
    // Con la condición vieja ese hold quedaba retenido para siempre pese a que la penalidad era
    // CERO, que es justamente decir "el hotel no retiene nada". Si no hay holds, el `return []`
    // de arriba ya cortó.
    if (cancellationFee === 0) {
      return this.releaseHeldByReservation(reservationId, async (d) => {
        await onMarked?.(d, 'released')
      })
    }

    // 100% penalty o non-refundable → no-op. El depósito queda held (el hotel retiene).
    // TODO #627: refund real de Stripe pendiente (CLAUDE.md:294).
    if (refundAmount <= 0) return []

    // Penalty parcial: refund proporcional de cada depósito held.
    // ratio = refundAmount / (refundAmount + cancellationFee) = fracción a devolver.
    const total = refundAmount + cancellationFee
    const ratio = total > 0 ? refundAmount / total : 0
    const result: DepositDTO[] = []
    for (const d of deposits) {
      try {
        const perDepositRefund = Math.round(d.amount * ratio * 100) / 100
        if (perDepositRefund > 0) {
          const updated = await this.refund(d.id, { amount: perDepositRefund })
          await onMarked?.(updated, 'refunded')
          result.push(updated)
        }
      } catch (e) {
        this.logger.warn('refund de depósito en cancelación falló', { id: d.id, error: (e as Error).message })
      }
    }
    if (result.length > 0) this.logger.info('Depósitos marcados para refund en cancelación', { reservationId, count: result.length })
    return result
  }
}
