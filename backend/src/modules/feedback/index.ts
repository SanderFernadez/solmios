import { createModule, OrmRepository } from 'arckode-framework'
import { registerFeedbackModels } from './model'
import { FeedbackService } from './service'
import { FeedbackController } from './controller'
import type { FeedbackPinDTO } from './types'

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

      const hra = [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')]
      const sa = [auth.authenticate('super_admin')]

      // CRUD feedback pins
      router.get('/api/feedback', hra, (req: any) => controller.listPins(req))
      router.get('/api/feedback/:id', hra, (req: any) => controller.getPin(req))
      router.post('/api/feedback', hra, (req: any) => controller.createPin(req))
      router.patch('/api/feedback/:id', hra, (req: any) => controller.updatePin(req))
      router.delete('/api/feedback/:id', sa, (req: any) => controller.deletePin(req))

      // GitLab issue creation
      router.post('/api/feedback/gitlab-issue', hra, (req: any) => controller.createGitLabIssue(req))

      log.info('Módulo feedback v2 listo (CRUD + GitLab)')
      return service
    },
  })
}
