// referrals/usecases/link-signup.ts — Vincula un alta nueva con el código de referido usado.
// Invocado por el connector subscriptions-referrals.ts, best-effort desde el lado del que
// llama (un fallo acá NUNCA puede voltear un alta ya creada). Acá adentro SÍ se valida en
// serio: un código inválido o un intento de auto-referido simplemente no crea nada, sin tirar.
import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { getReferralProgram } from './program-settings'

export interface LinkSignupDeps {
  referralCodesRepo: RepositoryAdapter<any>
  referralsRepo: RepositoryAdapter<any>
  configRepo: RepositoryAdapter<any>
  logger: Logger
}

export class LinkSignupUseCase {
  constructor(private readonly deps: LinkSignupDeps) {}

  async linkSignup(hotelId: string, code: string): Promise<void> {
    const { referralCodesRepo, referralsRepo, configRepo, logger } = this.deps
    const trimmed = String(code ?? '').trim()
    if (!trimmed) return

    const program = await getReferralProgram(configRepo)
    if (!program.enabled) {
      logger.info('linkSignup: programa desactivado, no se vincula', { hotelId, code: trimmed })
      return
    }

    const codeRow = (await referralCodesRepo.findMany({ code: trimmed }))[0] as any
    if (!codeRow) {
      logger.info('linkSignup: código de referido no existe (borrado/typo), se ignora', { hotelId, code: trimmed })
      return
    }

    const referrerHotelId = codeRow.hotelId
    // Anti-autoreferral: no debería poder pasar (hotelId es un hotel recién creado), pero
    // se valida igual — nunca confiar en que el llamador ya lo garantizó.
    if (referrerHotelId === hotelId) {
      logger.warn('linkSignup: auto-referido detectado, se ignora', { hotelId, code: trimmed })
      return
    }

    // Idempotencia: si por lo que sea el socket se dispara dos veces para la misma alta, no duplicar la fila.
    const already = await referralsRepo.findMany({ referredHotelId: hotelId })
    if (already.length > 0) return

    await referralsRepo.create({
      id: crypto.randomUUID(),
      referrerHotelId, referredHotelId: hotelId, code: trimmed,
      status: 'trial', activeSince: null, validatedAt: null,
    } as any)
    logger.info('Referido vinculado', { referrerHotelId, referredHotelId: hotelId, code: trimmed })
  }
}
