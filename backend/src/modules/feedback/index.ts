import { createModule, OrmRepository } from 'arckode-framework'
import { registerFeedbackModels } from './model'
import { FeedbackService } from './service'
import { FeedbackController } from './controller'
import type { FeedbackPinDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { FeedbackService }
export type { FeedbackPinDTO, CreateFeedbackPinDTO, UpdateFeedbackPinDTO, FeedbackScreenshotDTO, GitLabIssueResultDTO } from './types'
export { FeedbackValidator } from './validators/schema'

export function FeedbackModule() {
  return createModule({
    name: 'feedback',
    version: '2.0.0',
    description: 'Feedback system: user feedback pins + GitLab issue creator',
    contract: {
      name: 'feedback', version: '2.0.0',
      description: 'User feedback → DB pins + GitLab issues',
      actions: ['listPins', 'getPin', 'createPin', 'updatePin', 'deletePin', 'createGitLabIssue'],
      events: [],
      tables: ['feedback_pins'],
      dependencies: [],
      rules: ['Multi-tenant by hotelId', 'Screenshots optional'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('feedback: auth dependency required')
      registerFeedbackModels(orm)

      const pinsRepo = new OrmRepository<FeedbackPinDTO>(orm, 'FeedbackPins')
      const log = logger.child('feedback')
      const service = new FeedbackService(pinsRepo, log, auth)
      const controller = new FeedbackController(service, log)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      // CRUD feedback pins
      // SC-03: los cuatro verbos exigían solo `feedback:view` — cualquiera con acceso de lectura
      // podía crear/editar/borrar. Separados por acción real (ver permissions.ts: hotel_admin
      // recibió feedback:create/edit/delete para no perder la función que ya usaba de hecho).
      // VER/edit/delete siguen con permiso (administrar pines ajenos sí es privilegiado).
      router.get('/api/feedback', guard('feedback', 'view'), (req: any) => controller.listPins(req))
      router.get('/api/feedback/:id', guard('feedback', 'view'), (req: any) => controller.getPin(req))
      router.patch('/api/feedback/:id', guard('feedback', 'edit'), (req: any) => controller.updatePin(req))
      router.delete('/api/feedback/:id', guard('feedback', 'delete'), (req: any) => controller.deletePin(req))

      // Crear feedback propio + issue de GitLab desde el widget (App.vue, visible para TODOS los
      // autenticados). Antes exigían `feedback:create`/`feedback:edit`, permisos que por defecto SOLO
      // tiene hotel_admin → recepción/supervisor/camarera/técnico recibían 403 al reportar.
      // `auth.authenticate()` sin roles valida el token y deja crear a cualquier logueado.
      // El issue de GitLab lleva rate-limit (createGitLabIssue controller) para no llenar el repo.
      router.post('/api/feedback', [auth.authenticate()], (req: any) => controller.createPin(req))
      router.post('/api/feedback/gitlab-issue', [auth.authenticate()], (req: any) => controller.createGitLabIssue(req))

      log.info('Módulo feedback v2 listo (CRUD + GitLab)')
      return service
    },
  })
}
