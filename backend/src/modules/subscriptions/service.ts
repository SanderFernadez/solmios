import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { SignupUseCase, type SignupInput, type SignupResult } from './usecases/signup'
import { SubscriptionAccess, type AccessResult } from './usecases/access'
import { OnboardingUseCase, type OnboardingStatus } from './usecases/onboarding'
import { hashPassword } from '../usuarios/usecases/password'
import { createCheckoutSession, type CreateCheckoutResult } from './usecases/create-checkout-session'
import { createPortalSession, type CreatePortalResult } from './usecases/create-portal-session'
import { processSubscriptionWebhook } from './usecases/handle-stripe-event'

export class SubscriptionsService {
  private readonly signupUc: SignupUseCase
  private readonly onboardingUc: OnboardingUseCase
  private readonly accessUc: SubscriptionAccess

  constructor(
    private readonly subscriptionsRepo: RepositoryAdapter<any>,
    private readonly hotelsRepo: RepositoryAdapter<any>,
    usersRepo: RepositoryAdapter<any>,
    rolesRepo: RepositoryAdapter<any>,
    private readonly plansRepo: RepositoryAdapter<any>,
    roomsRepo: RepositoryAdapter<any>,
    ratesRepo: RepositoryAdapter<any> | undefined,
    private readonly logger: Logger,
    channelsRepo?: RepositoryAdapter<any>,
  ) {
    this.signupUc = new SignupUseCase({
      hotelsRepo, usersRepo, rolesRepo, subscriptionsRepo, hashPassword,
    })
    this.accessUc = new SubscriptionAccess(subscriptionsRepo, hotelsRepo)
    this.onboardingUc = new OnboardingUseCase({ roomsRepo, usersRepo, ratesRepo, hotelsRepo, channelsRepo })
  }

  /** Cablea el correo de verificación del alta (#421). Lo llama el bootstrap de email. */
  setEmailDeps(sender: any, appUrl?: string): void {
    this.signupUc.setEmailDeps(sender, appUrl || '')
  }

  signup(input: SignupInput): Promise<SignupResult> {
    return this.signupUc.signup(input)
  }

  /** ¿Este hotel puede trabajar hoy? Lo usan el login y el guard de las rutas. */
  checkAccess(hotelId: string): Promise<AccessResult> {
    return this.accessUc.check(hotelId)
  }

  /**
   * Planes para la landing y el registro. Solo lo público: sin `limits` ni
   * `modules`, que son detalle interno de cómo se aplica el plan.
   */
  async publicPlans(): Promise<any[]> {
    const plans = await this.plansRepo.findMany({ isActive: 1 })
    return plans
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((p: any) => ({
        id: p.id, name: p.name, slug: p.slug, price: p.price,
        currency: p.currency, description: p.description, features: p.features ?? [],
      }))
  }

  /** Qué le falta configurar al hotel para poder trabajar. */
  onboarding(hotelId: string): Promise<OnboardingStatus> {
    return this.onboardingUc.status(hotelId)
  }

  /** Estado para mostrarle al hotel cuánto le queda o qué tiene que pagar. */
  async statusOf(hotelId: string): Promise<any> {
    const access = await this.accessUc.check(hotelId)
    const sub = (await this.subscriptionsRepo.findMany({ hotelId }))[0]
    return {
      status: sub?.status ?? 'none',
      trialEndsAt: sub?.trialEndsAt ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      planId: sub?.planId ?? '',
      allowed: access.allowed,
      reason: access.reason ?? null,
      daysLeft: access.daysLeft ?? null,
      // Sin esto el frontend no puede decidir si mostrar "Gestionar método de pago"
      // (requiere un Customer de Stripe ya creado, es decir: pagó al menos una vez).
      hasStripeCustomer: !!sub?.stripeCustomerId,
    }
  }

  /** Suscribirse a un plan: Checkout Session de Stripe (cuenta de PLATAFORMA). */
  createCheckout(hotelId: string, planId: string, origin: string): Promise<CreateCheckoutResult> {
    return createCheckoutSession(
      { subscriptionsRepo: this.subscriptionsRepo, hotelsRepo: this.hotelsRepo, plansRepo: this.plansRepo, logger: this.logger },
      hotelId, planId, origin,
    )
  }

  /** Gestionar método de pago / ver facturas: Billing Portal de Stripe. */
  createPortal(hotelId: string, origin: string): Promise<CreatePortalResult> {
    return createPortalSession({ subscriptionsRepo: this.subscriptionsRepo, logger: this.logger }, hotelId, origin)
  }

  /** Webhook de la cuenta de PLATAFORMA (checkout/renovación/cancelación de la suscripción SaaS). */
  handlePlatformWebhook(rawBody: string | Buffer, signature: string) {
    return processSubscriptionWebhook({ subscriptionsRepo: this.subscriptionsRepo, logger: this.logger }, rawBody, signature)
  }
}
