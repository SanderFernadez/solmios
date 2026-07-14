import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { RolesService } from './service'
import { CreateRolesSchema, UpdateRolesSchema } from './validators/schema'
import { parseRolePermissions } from '../../shared/usecases/parse-role-permissions'
import { MODULES, ACTIONS } from '../../shared/permissions'
import { assertGrantablePermissions } from './usecases/assert-grantable'

// Acciones que la matriz de la UI ofrece por módulo. checkin/checkout viven en el rol de recepción por
// defecto y son casos borde: no ensuciamos la matriz custom con ellas.
const MATRIX_ACTIONS = ['view', 'create', 'edit', 'delete', 'export'] as const

export class RolesController {
  constructor(
    private readonly service: RolesService,
    private readonly logger: Logger,
  ) {}

  async index(req: HttpRequest) {
    const currentUser = req.user as any
    const result = await this.service.list(req.query as any, currentUser)
    return { status: 200, body: result }
  }

  /** Catálogo de módulos y acciones para armar la matriz de permisos en la UI (server-driven, sin
   *  duplicar la lista en el frontend). */
  async catalog(_req: HttpRequest) {
    const modules = Object.entries(MODULES).map(([key, label]) => ({ key, label }))
    const actions = MATRIX_ACTIONS.map((key) => ({ key, label: ACTIONS[key] }))
    return { status: 200, body: { modules, actions } }
  }

  async show(req: HttpRequest) {
    const currentUser = req.user as any
    const item = await this.service.getById(req.params.id, currentUser)
    return { status: 200, body: item }
  }

  async store(req: HttpRequest) {
    const currentUser = req.user as any
    // `hotelId` sale del token, no del body; el schema descarta `permissions` (validateSchema no soporta
    // arrays), así que se parsean aparte a `modulo:accion` válido antes de crear.
    const body = (req.body ?? {}) as Record<string, unknown>
    const data = validateSchema(CreateRolesSchema, { ...body, hotelId: currentUser?.hotelId ?? body.hotelId })
    const payload = { ...data } as any
    payload.permissions = body.permissions !== undefined ? parseRolePermissions(body.permissions) : []
    // S-A2: no se puede crear un rol con permisos que el creador no tiene (escalada).
    assertGrantablePermissions(currentUser?.permissions, payload.permissions)
    const item = await this.service.create(payload, currentUser)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    const currentUser = req.user as any
    const body = (req.body ?? {}) as Record<string, unknown>
    const data = validateSchema(UpdateRolesSchema, req.body)
    const payload = { ...data } as any
    // Solo se tocan los permisos si vienen en el body; se validan a `modulo:accion` (el formato que
    // entiende hasPermission), no el objeto {module, actions} viejo que no otorgaba acceso.
    if (body.permissions !== undefined) {
      payload.permissions = parseRolePermissions(body.permissions)
      // S-A2: no se puede editar un rol para otorgarle permisos que el editor no tiene (escalada).
      assertGrantablePermissions(currentUser?.permissions, payload.permissions)
    }
    const item = await this.service.update(req.params.id, payload, currentUser)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    const currentUser = req.user as any
    await this.service.delete(req.params.id, currentUser)
    return { status: 204, body: null }
  }
}
