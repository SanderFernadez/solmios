import type { RepositoryAdapter } from 'arckode-framework'
import { taxRateFor } from './billing'

/**
 * Tasa fiscal vigente del hotel del usuario.
 *
 * Usa la misma `taxRateFor` que `create()`, y por eso existe: el frontend previsualizaba el
 * impuesto recalculándolo por su cuenta sobre la config, así que el total del preview podía
 * diferir del que se terminaba emitiendo. Una sola fuente de verdad, la del servidor.
 */
export async function getTaxRateForUser(
  configRepo: RepositoryAdapter<any>,
  user: { hotelId?: string | null },
): Promise<{ rate: number }> {
  if (!user.hotelId) return { rate: 0 }
  return { rate: await taxRateFor(configRepo, user.hotelId) }
}
