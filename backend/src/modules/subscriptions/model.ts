// subscriptions/model.ts — La suscripción del HOTEL a la plataforma.
//
// Ojo con la confusión: los otros módulos de pagos cobran al HUÉSPED por su
// estadía. Esto es lo otro: lo que el hotel le paga a la plataforma para poder
// usar el sistema.
//
// Antes esto no existía: el hotel solo tenía un `plan` de texto y un `status`
// que no se consultaba en ningún lado, así que la pantalla de "Suscripciones"
// del super-admin mostraba hoteles con un precio calculado de memoria. Sin
// fechas no hay vencimiento posible, y sin vencimiento no hay negocio.
import type { ORM, ModelDefinition } from 'arckode-framework'

export const SubscriptionsModel: ModelDefinition = {
  table: 'subscriptions',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    /** `plans.id`. Durante el trial ya se sabe qué plan está probando. */
    planId: { type: 'string' },
    /**
     * trialing  — está en los días de prueba
     * active    — pagando
     * past_due  — el cobro falló, todavía no se cortó
     * expired   — se venció el trial y nunca pagó
     * canceled  — dado de baja
     */
    status: { type: 'string', required: true, default: 'trialing' },
    /** Fin de la prueba gratis (ISO). Pasada esta fecha se bloquea el acceso. */
    trialEndsAt: { type: 'string' },
    /** Fin del período pago en curso (ISO). */
    currentPeriodEnd: { type: 'string' },
    canceledAt: { type: 'string' },
    /** Identificadores de la cuenta Stripe de la PLATAFORMA (no la del hotel). */
    stripeCustomerId: { type: 'string' },
    stripeSubscriptionId: { type: 'string' },
  },
}

export function registerSubscriptionModels(orm: ORM): void {
  orm.define('Subscriptions', SubscriptionsModel)
}
