// admin/usecases/module-overrides.ts — CRUD de overrides de módulos por hotel (3ra capa de entitlement).
// Extracción del service para mantener AdminService < 200 líneas (analyzer God Object gate).
// enabled = fuerza ON aunque el plan no lo incluya (trial/concesión).
// disabled = fuerza OFF aunque el plan sí lo incluya (bloqueo comercial).

import { ValidationError, type RepositoryAdapter, type Logger } from 'arckode-framework'
import type { ModuleOverrideDTO } from '../types'
import { allKeys } from './modules'

/** Recurso de plataforma: el centinela hace que assertOwnership solo pase por el rol super_admin. */
const PLATFORM_RESOURCE = '__platform__'

export class ModuleOverridesUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<any>,
    private readonly auth: any,
    private readonly logger: Logger,
  ) {}

  async list(hotelId: string): Promise<ModuleOverrideDTO[]> {
    return await this.repo.findMany({ hotelId }) as ModuleOverrideDTO[]
  }

  /**
   * Upsert por (hotelId, moduleKey). Si ya existe un override para esa combinación, se actualiza;
   * si no, se crea. moduleKey se valida contra el catálogo (allKeys) y status contra el enum.
   */
  async upsert(hotelId: string, body: any, user?: any): Promise<any> {
    const validKeys = new Set(allKeys())
    if (!validKeys.has(body.moduleKey)) {
      throw new ValidationError(`moduleKey '${body.moduleKey}' no es una clave válida del catálogo`)
    }
    if (body.status !== 'enabled' && body.status !== 'disabled') {
      throw new ValidationError(`status debe ser 'enabled' o 'disabled' (recibido: '${body.status}')`)
    }
    const existing = ((await this.repo.findMany({ hotelId, moduleKey: body.moduleKey })) as any[])?.[0]
    const payload = {
      moduleKey: body.moduleKey,
      status: body.status,
      reason: body.reason ?? '',
      grantedByUserId: user?.id ?? null,
      startsAt: body.startsAt ?? null,
      endsAt: body.endsAt ?? null,
    }
    if (existing) {
      if (this.auth) this.auth.assertOwnership(PLATFORM_RESOURCE, user?.id ?? '', user?.role, 'super_admin')
      return await this.repo.update(existing.id, payload)
    }
    return await this.repo.create({ id: crypto.randomUUID(), hotelId, ...payload })
  }

  async delete(id: string, user?: any): Promise<void> {
    const existing = await this.repo.findById(id) as any
    if (!existing) throw new Error('Override no encontrado')
    if (this.auth) this.auth.assertOwnership(PLATFORM_RESOURCE, user?.id ?? '', user?.role, 'super_admin')
    await this.repo.delete(id)
  }
}
