import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { SignupUseCase, type SignupInput, type SignupResult } from './usecases/signup'
import { SubscriptionAccess, type AccessResult } from './usecases/access'
import { hashPassword } from '../usuarios/usecases/password'

export class SubscriptionsService {
  private readonly signupUc: SignupUseCase
  private readonly accessUc: SubscriptionAccess

  constructor(
    private readonly subscriptionsRepo: RepositoryAdapter<any>,
    private readonly hotelsRepo: RepositoryAdapter<any>,
    usersRepo: RepositoryAdapter<any>,
    rolesRepo: RepositoryAdapter<any>,
    private readonly plansRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
  ) {
    this.signupUc = new SignupUseCase({
      hotelsRepo, usersRepo, rolesRepo, subscriptionsRepo, hashPassword,
    })
    this.accessUc = new SubscriptionAccess(subscriptionsRepo, hotelsRepo)
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
    }
  }
}
