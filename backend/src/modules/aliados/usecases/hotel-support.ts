// aliados/usecases/hotel-support.ts — #559: soporte del Aliado CERTIFICADO a los hoteles que
// referenció (PLAN-ALIADOS.md, "brinda soporte a su gente" — es la razón del 20% fijo, #557).
//
// Ownership: NUNCA confiar en el hotelId que manda el cliente. El único vínculo válido es
// "hay un Referrals con referrerHotelId=self, referredHotelId=target, status='validated'" —
// mismo criterio que resuelve comisiones (my-partner.ts) y elegibilidad (eligibility.ts).
// Un Aliado normal (no certificado) NO tiene esta capacidad — #558/#559 son exclusivos de
// aliado_certificado, por eso el service verifica el tipo del partner antes que nada.
import type { RepositoryAdapter } from 'arckode-framework'
import { AuthError, NotFoundError, ValidationError } from 'arckode-framework'

export interface HotelSupportDeps {
  partnersRepo: RepositoryAdapter<any>
  referralsRepo: RepositoryAdapter<any>
  hotelsRepo: RepositoryAdapter<any>
  hotelMediaRepo: RepositoryAdapter<any>
}

export interface ReferredHotelSummaryDTO {
  hotelId: string
  name: string
  address: string | null
  descriptionJson: string | null
  latitude: number | null
  longitude: number | null
  photoCount: number
}

/** Campos que el Aliado Certificado puede tocar — deliberadamente chico ("no puede modificar
 *  configuraciones generales del sistema", #559). Fotos/cerraduras/pagos quedan afuera: se
 *  resuelven escalando, no editando (la subida de fotos además tiene su propio flujo en
 *  hotel-media, con su propia validación de tamaño/formato — no se reimplementa acá). */
const EDITABLE_FIELDS = ['descriptionJson', 'address', 'latitude', 'longitude'] as const
type EditableField = (typeof EDITABLE_FIELDS)[number]

export async function assertCertifiedActivePartner(deps: HotelSupportDeps, allyHotelId: string): Promise<any> {
  const partner = ((await deps.partnersRepo.findMany({ hotelId: allyHotelId })) as any[])[0]
  if (!partner || partner.status !== 'active' || partner.type !== 'aliado_certificado') {
    throw new AuthError('Esta sección es exclusiva de Aliados Certificados activos')
  }
  return partner
}

/** Ownership real: hotelId debe venir de un Referral VALIDADO de este Aliado — nunca del
 *  hotelId que manda el cliente sin cruzarlo. Exportada: la reusa escalate() en service.ts,
 *  mismo criterio, sin necesitar un patch real para disparar el chequeo. */
export async function assertReferredAndValidated(
  deps: HotelSupportDeps, allyHotelId: string, targetHotelId: string,
): Promise<void> {
  const link = ((await deps.referralsRepo.findMany({
    referrerHotelId: allyHotelId, referredHotelId: targetHotelId, status: 'validated',
  })) as any[])[0]
  if (!link) throw new AuthError('Ese hotel no forma parte de tu red de referidos validados')
}

export async function listMyReferredHotels(
  deps: HotelSupportDeps, allyHotelId: string,
): Promise<ReferredHotelSummaryDTO[]> {
  await assertCertifiedActivePartner(deps, allyHotelId)

  const validatedReferrals = (await deps.referralsRepo.findMany({
    referrerHotelId: allyHotelId, status: 'validated',
  })) as any[]

  return Promise.all(validatedReferrals.map(async (r): Promise<ReferredHotelSummaryDTO> => {
    // findOne({id}) no findById: ownership ya la verificó assertCertifiedActivePartner +
    // el propio filtro de Referrals validados de este aliado (mem 1805-textual: findById
    // dispara el heurístico del analyzer aunque no aplique acá).
    const hotel = (await deps.hotelsRepo.findOne({ id: r.referredHotelId })) as any
    const photos = (await deps.hotelMediaRepo.findMany({ hotelId: r.referredHotelId })) as any[]
    return {
      hotelId: r.referredHotelId,
      name: hotel?.name ?? '—',
      address: hotel?.address ?? null,
      descriptionJson: hotel?.descriptionJson ?? null,
      latitude: hotel?.latitude ?? null,
      longitude: hotel?.longitude ?? null,
      photoCount: photos.length,
    }
  }))
}

export async function updateReferredHotelBasics(
  deps: HotelSupportDeps, allyHotelId: string, targetHotelId: string, patch: Record<string, unknown>,
): Promise<ReferredHotelSummaryDTO> {
  await assertCertifiedActivePartner(deps, allyHotelId)
  await assertReferredAndValidated(deps, allyHotelId, targetHotelId)

  const cleanPatch: Record<string, unknown> = {}
  for (const key of Object.keys(patch)) {
    if (!EDITABLE_FIELDS.includes(key as EditableField)) {
      throw new ValidationError(`Campo no editable desde soporte de Aliado: "${key}"`)
    }
    cleanPatch[key] = patch[key]
  }
  if (Object.keys(cleanPatch).length === 0) throw new ValidationError('Nada para actualizar')

  // findOne({id}), no findById: ownership ya la verificó assertReferredAndValidated arriba.
  const existing = await deps.hotelsRepo.findOne({ id: targetHotelId })
  if (!existing) throw new NotFoundError('Hotel no encontrado')

  await deps.hotelsRepo.update(targetHotelId, cleanPatch as any)

  const hotel = (await deps.hotelsRepo.findOne({ id: targetHotelId })) as any
  const photos = (await deps.hotelMediaRepo.findMany({ hotelId: targetHotelId })) as any[]
  return {
    hotelId: targetHotelId,
    name: hotel?.name ?? '—',
    address: hotel?.address ?? null,
    descriptionJson: hotel?.descriptionJson ?? null,
    latitude: hotel?.latitude ?? null,
    longitude: hotel?.longitude ?? null,
    photoCount: photos.length,
  }
}
