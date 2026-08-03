import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { checkEligibility } from './usecases/eligibility'
import { convertToAliado } from './usecases/convert-to-aliado'
import { PartnerCommissionTiersUseCase } from './usecases/commission-tiers'
import { setPayoutMode } from './usecases/payout-mode'
import { markPaid } from './usecases/mark-commission-paid'
import { getMyPartner } from './usecases/my-partner'
import {
  applyForCertification, listCertificationRequests, approveCertification, rejectCertification,
} from './usecases/certification'
import {
  listMyReferredHotels, updateReferredHotelBasics, assertCertifiedActivePartner, assertReferredAndValidated,
  type ReferredHotelSummaryDTO,
} from './usecases/hotel-support'
import type {
  EligibilityDTO, PartnerDTO, PartnerCommissionDTO, PartnerCommissionTierDTO,
  PartnerCertificationRequestDTO, MyPartnerDTO,
} from './types'

/** Payload mínimo para escalar — el shape real (CreateFeedbackPinDTO) lo define el módulo
 *  feedback; acá solo lo que aliados necesita mandar, wireado por el connector. */
export type EscalateHandler = (payload: { hotelId: string; comment: string; userId?: string }) => Promise<unknown>

export class AliadosService {
  private readonly tiersUc: PartnerCommissionTiersUseCase
  private escalateHandler: EscalateHandler | null = null

  constructor(
    private readonly partnersRepo: RepositoryAdapter<any>,
    private readonly commissionsRepo: RepositoryAdapter<any>,
    private readonly tiersRepo: RepositoryAdapter<PartnerCommissionTierDTO>,
    private readonly requestsRepo: RepositoryAdapter<any>,
    private readonly referralsRepo: RepositoryAdapter<any>,
    private readonly hotelsRepo: RepositoryAdapter<any>,
    private readonly hotelMediaRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly auth?: any,
  ) {
    this.tiersUc = new PartnerCommissionTiersUseCase(tiersRepo, auth)
  }

  /** Wireado por connectors/aliados-feedback.ts — aliados no importa feedback directo (REGLA #12). */
  setEscalateHandler(fn: EscalateHandler): void {
    this.escalateHandler = fn
  }

  // ── Hotel-side ──
  eligibility(hotelId: string): Promise<EligibilityDTO> {
    return checkEligibility(this.referralsRepo, this.partnersRepo, hotelId)
  }
  convert(hotelId: string): Promise<PartnerDTO> {
    return convertToAliado(this.partnersRepo, this.referralsRepo, hotelId)
  }
  me(hotelId: string): Promise<MyPartnerDTO> {
    return getMyPartner(this.partnersRepo, this.commissionsRepo, this.hotelsRepo, hotelId)
  }
  setPayoutMode(hotelId: string, mode: string): Promise<PartnerDTO> {
    return setPayoutMode(this.partnersRepo, hotelId, mode)
  }
  applyForCertification(hotelId: string, answers: Record<string, unknown>): Promise<PartnerCertificationRequestDTO> {
    return applyForCertification(this.requestsRepo, hotelId, answers)
  }

  // ── #559: soporte de Aliado Certificado a sus hoteles referidos ──
  private hotelSupportDeps() {
    return {
      partnersRepo: this.partnersRepo, referralsRepo: this.referralsRepo,
      hotelsRepo: this.hotelsRepo, hotelMediaRepo: this.hotelMediaRepo,
    }
  }
  myReferredHotels(hotelId: string): Promise<ReferredHotelSummaryDTO[]> {
    return listMyReferredHotels(this.hotelSupportDeps(), hotelId)
  }
  updateReferredHotel(hotelId: string, targetHotelId: string, patch: Record<string, unknown>): Promise<ReferredHotelSummaryDTO> {
    return updateReferredHotelBasics(this.hotelSupportDeps(), hotelId, targetHotelId, patch)
  }
  async escalate(hotelId: string, targetHotelId: string, comment: string, userId?: string): Promise<void> {
    const deps = this.hotelSupportDeps()
    await assertCertifiedActivePartner(deps, hotelId)
    await assertReferredAndValidated(deps, hotelId, targetHotelId)
    if (!this.escalateHandler) throw new Error('Escalamiento a soporte no disponible (connector sin wirear)')
    await this.escalateHandler({
      hotelId: targetHotelId,
      comment: `[Escalado por Aliado Certificado ${hotelId}] ${comment}`,
      userId,
    })
  }

  // ── Admin ──
  listPartners(): Promise<{ data: PartnerDTO[]; total: number }> {
    return this.partnersRepo.findMany({}).then((data) => ({ data: data as PartnerDTO[], total: (data as any[]).length }))
  }
  listCertificationRequests(): Promise<{ data: PartnerCertificationRequestDTO[]; total: number }> {
    return listCertificationRequests(this.requestsRepo)
  }
  approveCertification(id: string, reviewedBy: string): Promise<PartnerDTO> {
    return approveCertification(this.requestsRepo, this.partnersRepo, id, reviewedBy)
  }
  rejectCertification(id: string, reviewedBy: string): Promise<PartnerCertificationRequestDTO> {
    return rejectCertification(this.requestsRepo, id, reviewedBy)
  }
  listTiers(): Promise<{ data: PartnerCommissionTierDTO[]; total: number }> {
    return this.tiersUc.list()
  }
  replaceTiers(items: any[], user?: any): Promise<PartnerCommissionTierDTO[]> {
    return this.tiersUc.replaceAll(items, user)
  }
  markCommissionPaid(id: string): Promise<PartnerCommissionDTO> {
    return markPaid(this.commissionsRepo, id)
  }
}
