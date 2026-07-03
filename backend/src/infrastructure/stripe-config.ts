import { StripeService } from '../services/stripe-service'
import { OrmRepository } from 'arckode-framework'

export function configureStripe(orm: any): void {
  StripeService.setConfigResolver(async (hotelId) => {
    if (!hotelId) return null
    const rows = await orm.findMany('Configuration', { hotelId, key: 'stripe_config' }) as any[]
    const v = rows[0]?.value
    let cfg: any = v
    if (typeof v === 'string') { try { cfg = JSON.parse(v) } catch { cfg = null } }
    return cfg || null
  })
}
