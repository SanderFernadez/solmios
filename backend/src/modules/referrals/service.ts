import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import { getReferralProgram, setReferralProgram } from './usecases/program-settings'
import { ReferralTiersUseCase } from './usecases/tiers'
import { LinkSignupUseCase } from './usecases/link-signup'
import { ShareLinkUseCase } from './usecases/share-link'
import { getReferralMetrics } from './usecases/metrics'
import type { ReferralProgram, MyReferralsDTO, ReferralMetricsDTO, ReferralTierDTO } from './types'

export class ReferralsService {
  private readonly tiersUc: ReferralTiersUseCase
  private readonly linkSignupUc: LinkSignupUseCase
  private readonly shareLinkUc: ShareLinkUseCase

  constructor(
    private readonly referralCodesRepo: RepositoryAdapter<any>,
    private readonly referralsRepo: RepositoryAdapter<any>,
    private readonly referralCreditsRepo: RepositoryAdapter<any>,
    private readonly referralTiersRepo: RepositoryAdapter<ReferralTierDTO>,
    private readonly hotelsRepo: RepositoryAdapter<any>,
    private readonly configRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly auth?: any,
  ) {
    this.tiersUc = new ReferralTiersUseCase(referralTiersRepo, auth)
    this.linkSignupUc = new LinkSignupUseCase({ referralCodesRepo, referralsRepo, configRepo, logger })
    this.shareLinkUc = new ShareLinkUseCase({ referralCodesRepo, referralsRepo, referralCreditsRepo, referralTiersRepo, hotelsRepo })
  }

  // ── Acción pública (consumida por el connector subscriptions-referrals.ts) ──
  linkSignup(hotelId: string, code: string): Promise<void> {
    return this.linkSignupUc.linkSignup(hotelId, code)
  }

  // ── Admin ──
  getProgram(): Promise<ReferralProgram> {
    return getReferralProgram(this.configRepo)
  }
  updateProgram(patch: Partial<ReferralProgram>): Promise<ReferralProgram> {
    return setReferralProgram(this.configRepo, patch)
  }
  listTiers(): Promise<{ data: ReferralTierDTO[]; total: number }> {
    return this.tiersUc.list()
  }
  createTier(body: any): Promise<ReferralTierDTO> {
    return this.tiersUc.create(body)
  }
  updateTier(id: string, body: any, user?: any): Promise<ReferralTierDTO> {
    return this.tiersUc.update(id, body, user)
  }
  deleteTier(id: string, user?: any): Promise<void> {
    return this.tiersUc.remove(id, user)
  }
  getMetrics(): Promise<ReferralMetricsDTO> {
    return getReferralMetrics({ referralsRepo: this.referralsRepo, referralCreditsRepo: this.referralCreditsRepo, hotelsRepo: this.hotelsRepo })
  }

  // ── Merchant ──
  myReferrals(hotelId: string): Promise<MyReferralsDTO> {
    return this.shareLinkUc.me(hotelId)
  }

  // ── Público ──
  async resolveCode(code: string): Promise<{ referrerHotelName: string }> {
    const codeRow = (await this.referralCodesRepo.findMany({ code: String(code ?? '').trim() }))[0] as any
    if (!codeRow) throw new NotFoundError('Código de referido no encontrado')
    // Endpoint público sin auth (GET /api/public/referrals/resolve): el código es por diseño
    // un lookup abierto para cualquiera con el link, no hay "dueño" que proteger — es
    // exactamente lo que el visitante anónimo de /r/:code necesita ver.
    // @ignore IDOR_RISK
    const hotel = await this.hotelsRepo.findById(codeRow.hotelId)
    if (!hotel) throw new NotFoundError('Código de referido no encontrado')
    return { referrerHotelName: (hotel as any).name }
  }
}
