// aliados/usecases/certification.ts — Solicitud/evaluación para convertirse en Aliado
// Certificado: cuestionario inicial (answers) + aprobación/rechazo de un super_admin.
// Aprobar crea (o actualiza, si ya era 'aliado') el Partner a type:'aliado_certificado',
// payoutMode:'monthly' (fijo, no escala) y certifiedAt:now.
import type { RepositoryAdapter } from 'arckode-framework'
import { ValidationError, NotFoundError, ConflictError } from 'arckode-framework'
import type { PartnerCertificationRequestDTO, PartnerDTO } from '../types'

export async function applyForCertification(
  requestsRepo: RepositoryAdapter<any>,
  hotelId: string,
  answers: Record<string, unknown>,
): Promise<PartnerCertificationRequestDTO> {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new ValidationError('answers debe ser un objeto con las respuestas del cuestionario')
  }
  const pending = (await requestsRepo.findMany({ hotelId, status: 'pending' })) as any[]
  if (pending.length > 0) throw new ConflictError('Ya hay una solicitud de certificación pendiente para este hotel')

  return requestsRepo.create({
    id: crypto.randomUUID(),
    hotelId,
    status: 'pending',
    answers,
    examScore: null,
    reviewedBy: null,
    reviewedAt: null,
  } as any) as unknown as Promise<PartnerCertificationRequestDTO>
}

export async function listCertificationRequests(
  requestsRepo: RepositoryAdapter<any>,
): Promise<{ data: PartnerCertificationRequestDTO[]; total: number }> {
  const data = (await requestsRepo.findMany({})) as PartnerCertificationRequestDTO[]
  return { data, total: data.length }
}

async function getRequestOrThrow(requestsRepo: RepositoryAdapter<any>, id: string): Promise<any> {
  const request = (await requestsRepo.findMany({ id }))[0]
  if (!request) throw new NotFoundError('Solicitud de certificación no encontrada')
  return request
}

export async function approveCertification(
  requestsRepo: RepositoryAdapter<any>,
  partnersRepo: RepositoryAdapter<any>,
  id: string,
  reviewedBy: string,
): Promise<PartnerDTO> {
  const request = await getRequestOrThrow(requestsRepo, id)
  if (request.status !== 'pending') throw new ConflictError('La solicitud ya fue revisada')

  const now = new Date().toISOString()
  await requestsRepo.update(id, { status: 'approved', reviewedBy, reviewedAt: now })

  const existingPartner = (await partnersRepo.findMany({ hotelId: request.hotelId }))[0] as any
  if (existingPartner) {
    return partnersRepo.update(existingPartner.id, {
      type: 'aliado_certificado', payoutMode: 'monthly', status: 'active', certifiedAt: now,
    }) as unknown as Promise<PartnerDTO>
  }
  return partnersRepo.create({
    id: crypto.randomUUID(),
    hotelId: request.hotelId,
    type: 'aliado_certificado',
    payoutMode: 'monthly',
    status: 'active',
    becamePartnerAt: now,
    certifiedAt: now,
  } as any) as unknown as Promise<PartnerDTO>
}

export async function rejectCertification(
  requestsRepo: RepositoryAdapter<any>,
  id: string,
  reviewedBy: string,
): Promise<PartnerCertificationRequestDTO> {
  const request = await getRequestOrThrow(requestsRepo, id)
  if (request.status !== 'pending') throw new ConflictError('La solicitud ya fue revisada')

  const now = new Date().toISOString()
  return requestsRepo.update(id, { status: 'rejected', reviewedBy, reviewedAt: now }) as unknown as Promise<PartnerCertificationRequestDTO>
}
