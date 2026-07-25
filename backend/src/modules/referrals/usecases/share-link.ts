// referrals/usecases/share-link.ts — Código propio + link del hotel, y "Mis referidos"
// (PLAN-REFERIDOS.md §7). Get-or-create: el código se genera la PRIMERA vez que el hotel
// pide su link, no en el signup (que es el código del OTRO hotel).
import type { RepositoryAdapter } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import { ReferralTiersUseCase } from './tiers'
import type { MyReferralsDTO, ReferralDTO, ReferralCreditDTO, ReferralTierDTO } from '../types'

export interface ShareLinkDeps {
  referralCodesRepo: RepositoryAdapter<any>
  referralsRepo: RepositoryAdapter<any>
  referralCreditsRepo: RepositoryAdapter<any>
  referralTiersRepo: RepositoryAdapter<any>
  hotelsRepo: RepositoryAdapter<any>
}

const MAX_ATTEMPTS = 5

/** Minúsculas, sin acentos, solo [a-z0-9-]. Recorta a 20 chars para que el código no sea gigante. */
function slugify(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos (é→e, ñ→n)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20) || 'hotel'
}

function shortSuffix(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 4)
}

export class ShareLinkUseCase {
  constructor(private readonly deps: ShareLinkDeps) {}

  private baseUrl(): string {
    return (process.env.PUBLIC_URL || '').replace(/\/$/, '')
  }

  async getOrCreateCode(hotelId: string): Promise<string> {
    const { referralCodesRepo, hotelsRepo } = this.deps
    const existing = (await referralCodesRepo.findMany({ hotelId }))[0] as any
    if (existing) return existing.code

    const hotel = await hotelsRepo.findById(hotelId)
    if (!hotel) throw new NotFoundError('Hotel no encontrado')
    const base = slugify((hotel as any).name || 'hotel')

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const code = `${base}-${shortSuffix()}`
      const taken = (await referralCodesRepo.findMany({ code }))[0]
      if (taken) continue
      await referralCodesRepo.create({ id: crypto.randomUUID(), hotelId, code } as any)
      return code
    }
    // Extremadamente improbable con 4 hex chars de entropía por intento, pero sin loop infinito.
    const fallbackCode = `${base}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
    await referralCodesRepo.create({ id: crypto.randomUUID(), hotelId, code: fallbackCode } as any)
    return fallbackCode
  }

  async me(hotelId: string): Promise<MyReferralsDTO> {
    const { referralsRepo, referralCreditsRepo, referralTiersRepo, hotelsRepo } = this.deps
    const code = await this.getOrCreateCode(hotelId)

    const referrals = (await referralsRepo.findMany({ referrerHotelId: hotelId })) as ReferralDTO[]
    const withNames = await Promise.all(referrals.map(async (r) => {
      const referred = await hotelsRepo.findById(r.referredHotelId)
      return { ...r, referredHotelName: (referred as any)?.name ?? '—' }
    }))

    const credits = (await referralCreditsRepo.findMany({ referrerHotelId: hotelId })) as ReferralCreditDTO[]
    const totalMonthsEarned = credits
      .filter((c) => c.status === 'released')
      .reduce((sum, c) => sum + Number(c.monthsGranted || 0), 0)

    const validatedCount = referrals.filter((r) => r.status === 'validated').length
    const tiers = ((await referralTiersRepo.findMany({})) as ReferralTierDTO[]).sort((a, b) => a.fromCount - b.fromCount)
    const nextTier = tiers.find((t) => t.fromCount > validatedCount)
    const referralsUntilNextTier = nextTier ? nextTier.fromCount - validatedCount : null

    return {
      code,
      shareLink: `${this.baseUrl()}/r/${code}`,
      referrals: withNames,
      credits,
      totalMonthsEarned,
      nextTierMonths: nextTier?.monthsGranted ?? null,
      referralsUntilNextTier,
    }
  }
}
