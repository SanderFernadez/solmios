// empleados/usecases/appraisal-config.ts — Plantillas de evaluación (Odoo hr_appraisal templates).
//
// Una plantilla es un formulario de preguntas reutilizable. Las respuestas se guardan en la review
// (performance_reviews.answers como JSON). findOne({id,hotelId}) scoped → sin IDOR.

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { AppraisalTemplateDTO, CreateAppraisalTemplateDTO } from '../types'

/** Plantilla por defecto que se siembra la primera vez que un hotel abre las evaluaciones. */
const DEFAULT_QUESTIONS = [
  '¿Cumplió los objetivos del período?',
  '¿Cómo es su trato con huéspedes y compañeros?',
  '¿Qué fortalezas destacás?',
  '¿Qué áreas debería mejorar?',
  '¿Qué objetivos proponés para el próximo período?',
]

export class AppraisalConfigUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<AppraisalTemplateDTO>,
    private readonly logger: Logger,
  ) {}

  private serialize(questions: string[] | string): string {
    if (Array.isArray(questions)) return JSON.stringify(questions)
    // Si viene como string, aceptamos JSON válido o lo envolvemos como una sola pregunta.
    try { JSON.parse(questions); return questions } catch { return JSON.stringify([questions]) }
  }

  async list(hotelId: string): Promise<AppraisalTemplateDTO[]> {
    const existing = await this.repo.findMany({ hotelId, active: 1 })
    if (existing.length) return existing
    await this.repo.create({ hotelId, name: 'Evaluación estándar', questions: JSON.stringify(DEFAULT_QUESTIONS), active: 1 } as any)
    return this.repo.findMany({ hotelId, active: 1 })
  }

  async create(dto: CreateAppraisalTemplateDTO): Promise<AppraisalTemplateDTO> {
    if (!dto.name) throw new ValidationError('name es obligatorio')
    const questions = this.serialize(dto.questions)
    if (JSON.parse(questions).length === 0) throw new ValidationError('La plantilla necesita al menos una pregunta')
    return this.repo.create({ hotelId: dto.hotelId, name: dto.name, questions, active: 1 } as any)
  }

  async update(id: string, hotelId: string, data: Partial<CreateAppraisalTemplateDTO>): Promise<AppraisalTemplateDTO> {
    const t = await this.repo.findOne({ id, hotelId })
    if (!t) throw new NotFoundError('Plantilla no encontrada')
    const patch: Record<string, unknown> = {}
    if (data.name) patch.name = data.name
    if (data.questions) patch.questions = this.serialize(data.questions)
    return this.repo.update(id, patch as any) as Promise<AppraisalTemplateDTO>
  }

  async remove(id: string, hotelId: string): Promise<void> {
    const t = await this.repo.findOne({ id, hotelId })
    if (!t) throw new NotFoundError('Plantilla no encontrada')
    await this.repo.update(id, { active: 0 } as any) // soft-delete: no romper reviews que la referencian
  }
}
