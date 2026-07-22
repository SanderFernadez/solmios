// src/infrastructure/auth/api-key-auth.ts
// Middleware de autenticación por API key (header `x-api-key`) para la superficie pública
// `publicapi` (`/api/public/v1/*`). NO usa JWT ni `req.user` — adjunta `req.apiKeyAuth`.
//
// Importa el usecase de `modules/apikeys` directamente: es capa transversal (infrastructure/),
// mismo criterio que `require-module.ts` importando `modules/admin/usecases/modules` o
// `create-permission-guard.ts` importando `shared/permissions` — ningún módulo de NEGOCIO
// importa a otro módulo de negocio, pero infra sí puede leer un usecase puntual.

import type { MiddlewareHandler, ORM } from 'arckode-framework'
import { AuthError, OrmRepository } from 'arckode-framework'
import { validateApiKey } from '../../modules/apikeys/usecases/validate-key'
import type { ApikeysDTO } from '../../modules/apikeys/types'

export interface ApiKeyAuth {
  hotelId?: string
  scope?: string
}

/**
 * Crea el middleware de auth por API key. Construye su propio `OrmRepository<ApikeysDTO>` sobre
 * el modelo `Apikeys` (registrado por el módulo `apikeys` en `orm.define`) — no depende de la
 * instancia del servicio `apikeys`, solo del ORM (ya wireado a todos los módulos por igual).
 */
export function apiKeyAuth(orm: ORM): MiddlewareHandler {
  const repo = new OrmRepository<ApikeysDTO>(orm, 'Apikeys')
  return async (req, next) => {
    const header = req.headers?.['x-api-key']
    const key = Array.isArray(header) ? header[0] : header
    if (!key) throw new AuthError('API key requerida (header x-api-key)')

    const result = await validateApiKey(repo, key)
    if (!result) throw new AuthError('API key inválida o revocada')

    ;(req as unknown as { apiKeyAuth: ApiKeyAuth }).apiKeyAuth = result
    return next()
  }
}

/** Exige que el scope de la key incluya el token dado (CSV, ej. "read:rooms,write:reservations"). */
export function requireApiScope(scope: string | undefined, required: string): boolean {
  if (!scope) return false
  return scope.split(',').map((s) => s.trim()).includes(required)
}
