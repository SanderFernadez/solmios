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
import type {
  EligibilityDTO, PartnerDTO, PartnerCommissionDTO, PartnerCommissionTierDTO,
  PartnerCertificationRequestDTO, MyPartnerDTO,
} from './types'

export class AliadosService {
  private readonly tiersUc: PartnerCommissionTiersUseCase

  constructor(
    private readonly partnersRepo: RepositoryAdapter<any>,
    private readonly commissionsRepo: RepositoryAdapter<any>,
    private readonly tiersRepo: RepositoryAdapter<PartnerCommissionTierDTO>,
    private readonly requestsRepo: RepositoryAdapter<any>,
    private readonly referralsRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly auth?: any,
  ) {
    this.tiersUc = new PartnerCommissionTiersUseCase(tiersRepo, auth)
  }

  // ── Hotel-side ──
  eligibility(hotelId: string): Promise<EligibilityDTO> {
    return checkEligibility(this.referralsRepo, this.partnersRepo, hotelId)
  }
  convert(hotelId: string): Promise<PartnerDTO> {
    return convertToAliado(this.partnersRepo, this.referralsRepo, hotelId)
  }
  me(hotelId: string): Promise<MyPartnerDTO> {
    return getMyPartner(this.partnersRepo, this.commissionsRepo, hotelId)
  }
  setPayoutMode(hotelId: string, mode: string): Promise<PartnerDTO> {
    return setPayoutMode(this.partnersRepo, hotelId, mode)
  }
  applyForCertification(hotelId: string, answers: Record<string, unknown>): Promise<PartnerCertificationRequestDTO> {
    return applyForCertification(this.requestsRepo, hotelId, answers)
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
