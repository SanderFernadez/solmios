// subscriptions/usecases/create-portal-session.ts — El hotel gestiona su método de pago.
// Requiere que ya exista un Customer de Stripe (creado en el primer checkout); si el hotel
// nunca pagó, no hay portal que abrir.
import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'
import { StripeService } from '../../../services/stripe-service'

export interface CreatePortalDeps {
  subscriptionsRepo: RepositoryAdapter<any>
  logger: Logger
}

export interface CreatePortalResult {
  url: string
}

export async function createPortalSession(
  deps: CreatePortalDeps,
  hotelId: string,
  origin: string,
): Promise<CreatePortalResult> {
  const { subscriptionsRepo, logger } = deps
  if (!hotelId) throw new ValidationError('Falta el hotel')

  const sub = (await subscriptionsRepo.findMany({ hotelId }))[0] as any
  if (!sub?.stripeCustomerId) {
    throw new ValidationError('Este hotel todavía no tiene una cuenta de facturación en Stripe. Suscribite primero.')
  }

  const stripe = await StripeService.getClient()
  if (!stripe) throw new ValidationError('Stripe no está configurado en la plataforma')

  const base = origin.replace(/\/$/, '')
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${base}/panel/suscripcion`,
  })

  logger.info('Portal de facturación creado', { hotelId })
  return { url: session.url }
}
