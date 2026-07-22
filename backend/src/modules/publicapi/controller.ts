// publicapi/controller.ts — Adaptador HTTP de la API pública v1.
// Auth EXCLUSIVAMENTE por API key (`req.apiKeyAuth`, adjuntado por
// `infrastructure/auth/api-key-auth.ts`) — sin JWT, sin `req.user`.
//
// Scope requerido por ruta (campo `apikeys.scope`, CSV — ver frontend `scopes` en api-keys.vue):
//   GET  /api/public/v1/rooms              → read:rooms
//   POST /api/public/v1/reservations       → write:reservations
//   GET  /api/public/v1/reservations/:id   → read:reservations

import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema, AuthError, ForbiddenError } from 'arckode-framework'
import type { PublicapiService } from './service'
import type { PublicApiAuthContext } from './types'
import { requireApiScope } from '../../infrastructure/auth/api-key-auth'
import { CreatePublicReservationSchema } from './validators/schema'

function authOf(req: HttpRequest): PublicApiAuthContext {
  const ctx = (req as unknown as { apiKeyAuth?: PublicApiAuthContext }).apiKeyAuth
  if (!ctx?.hotelId) throw new AuthError('La API key no tiene un hotel asociado')
  return ctx
}

function assertScope(ctx: PublicApiAuthContext, required: string): void {
  if (!requireApiScope(ctx.scope, required)) {
    throw new ForbiddenError(`API key sin scope requerido: ${required}`)
  }
}

export class PublicapiController {
  constructor(
    private readonly service: PublicapiService,
    private readonly logger: Logger,
  ) {}

  async listRooms(req: HttpRequest) {
    const auth = authOf(req)
    assertScope(auth, 'read:rooms')
    const query = {
      checkIn: (req.query?.checkIn as string) || undefined,
      checkOut: (req.query?.checkOut as string) || undefined,
    }
    const data = await this.service.listRooms(auth.hotelId as string, query)
    return { status: 200, body: { data } }
  }

  async createReservation(req: HttpRequest) {
    const auth = authOf(req)
    assertScope(auth, 'write:reservations')
    const data = validateSchema(CreatePublicReservationSchema, req.body)
    const item = await this.service.createReservation(auth.hotelId as string, data as any)
    return { status: 201, body: item }
  }

  async getReservation(req: HttpRequest) {
    const auth = authOf(req)
    assertScope(auth, 'read:reservations')
    const item = await this.service.getReservation(auth.hotelId as string, req.params.id)
    return { status: 200, body: item }
  }
}
