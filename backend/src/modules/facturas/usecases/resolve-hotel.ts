import type { RepositoryAdapter } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'

/**
 * Resuelve el hotel de una factura a crear, imponiendo ownership.
 *
 * El hotelId sale del JWT (leído de la DB, no del token crudo), NO de `dto.hotelId` — que lo
 * controla el cliente. Un hotel_admin que mande `{ hotelId: <otro hotel> }` facturaría en el
 * libro ajeno, consumiendo su numerador fiscal: era un IDOR de escritura financiera.
 *
 * Solo `super_admin` (dueño de la plataforma) puede facturar en un hotel arbitrario.
 */
export async function resolveInvoiceHotelId(
  userRepo: RepositoryAdapter<any>,
  user: { id: string; role?: string; hotelId?: string | null },
  dtoHotelId?: string,
): Promise<string> {
  let hotelId: string
  if (user.role === 'super_admin') {
    hotelId = dtoHotelId ?? user.hotelId ?? ''
  } else {
    // Se lee el PROPIO usuario del request para sacar su hotelId (no un recurso ajeno) → no hay
    // ownership que verificar: la verificación ES forzar este hotelId e ignorar el del cliente.
    const me = await userRepo.findOne({ id: user.id })
    hotelId = me?.hotelId ?? ''
  }
  if (!hotelId) throw new ValidationError('No se pudo determinar el hotel de la factura')
  return hotelId
}
