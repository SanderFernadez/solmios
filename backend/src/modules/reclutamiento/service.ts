// reclutamiento/service.ts — Pipeline de selección (postulantes por etapa).
// NO sabe de HTTP. NO importa de otros módulos (jobPositionId se guarda por valor).

import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type {
  ApplicantDTO, CreateApplicantDTO, UpdateApplicantDTO,
  ReclutamientoQuery, PipelineSummary,
} from './types'
import { APPLICANT_STAGES } from './types'
import type { ReclutamientoSockets } from './sockets'

interface SimpleUser { id?: string; hotelId?: string; role?: string }

export class ReclutamientoService {
  private sockets: ReclutamientoSockets = {}

  constructor(
    private readonly repo: RepositoryAdapter<ApplicantDTO>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth?: Auth,
  ) {}

  setSockets(s: Partial<ReclutamientoSockets>): void {
    const next = s as Record<string, any>
    const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) {
      const h = next[key]; if (!h) continue
      const prev = cur[key]
      cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h
    }
  }

  private own(item: ApplicantDTO, user?: SimpleUser): void {
    if (this.auth && user) this.auth.assertOwnership(item.hotelId, user.hotelId ?? '', user.role ?? '', 'super_admin')
  }

  async list(query: ReclutamientoQuery): Promise<ApplicantDTO[]> {
    const filters: Record<string, unknown> = { active: 1 }
    if (query.hotelId) filters.hotelId = query.hotelId
    if (query.jobPositionId) filters.jobPositionId = query.jobPositionId
    if (query.stage) filters.stage = query.stage
    return this.repo.findMany(filters)
  }

  async getById(id: string, user?: SimpleUser): Promise<ApplicantDTO> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError('Postulante no encontrado')
    this.own(item, user)
    return item
  }

  async create(dto: CreateApplicantDTO): Promise<ApplicantDTO> {
    const item = await this.repo.create({ ...dto, stage: 'new', rating: dto.rating ?? 0, active: 1 } as any)
    await this.sockets.onApplicantCreated?.(item)
    await this.cache.delete('reclutamiento:list')
    return item
  }

  async update(id: string, dto: UpdateApplicantDTO, user?: SimpleUser): Promise<ApplicantDTO> {
    await this.getById(id, user)
    const item = await this.repo.update(id, dto as any)
    if (!item) throw new NotFoundError('Postulante no encontrado')
    await this.cache.delete('reclutamiento:list')
    return item as ApplicantDTO
  }

  /** Mover al postulante a otra etapa del pipeline. */
  async moveStage(id: string, stage: string, user?: SimpleUser): Promise<ApplicantDTO> {
    if (!APPLICANT_STAGES.includes(stage as any)) throw new ValidationError('Etapa inválida')
    const current = await this.getById(id, user)
    if (current.stage === 'hired') throw new ValidationError('El postulante ya fue contratado')
    return this.repo.update(id, { stage } as any) as Promise<ApplicantDTO>
  }

  async reject(id: string, reason: string, user?: SimpleUser): Promise<ApplicantDTO> {
    const current = await this.getById(id, user)
    if (current.stage === 'hired') throw new ValidationError('El postulante ya fue contratado')
    const item = await this.repo.update(id, { stage: 'rejected', rejectReason: reason } as any)
    await this.sockets.onApplicantRejected?.(item as ApplicantDTO)
    return item as ApplicantDTO
  }

  /** Marca al postulante como contratado. `hiredEmployeeId` (opcional) liga al expediente creado. */
  async hire(id: string, hiredEmployeeId: string | undefined, user?: SimpleUser): Promise<ApplicantDTO> {
    const current = await this.getById(id, user)
    if (current.stage === 'hired') throw new ValidationError('El postulante ya fue contratado')
    const item = await this.repo.update(id, { stage: 'hired', hiredEmployeeId: hiredEmployeeId ?? null } as any) as ApplicantDTO
    await this.sockets.onApplicantHired?.(item)
    await this.cache.delete('reclutamiento:list')
    return item
  }

  async delete(id: string, user?: SimpleUser): Promise<void> {
    await this.getById(id, user)
    await this.repo.update(id, { active: 0 } as any) // soft-delete: conservar el historial de selección
  }

  /** Conteo de postulantes por etapa (para el board del pipeline). */
  async pipeline(hotelId: string): Promise<PipelineSummary[]> {
    const all = await this.repo.findMany({ hotelId, active: 1 })
    const counts = new Map<string, number>(APPLICANT_STAGES.map((s) => [s, 0]))
    for (const a of all) counts.set(a.stage, (counts.get(a.stage) ?? 0) + 1)
    return [...counts.entries()].map(([stage, count]) => ({ stage, count }))
  }
}
