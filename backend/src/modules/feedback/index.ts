import { createModule } from 'arckode-framework'
import { FeedbackService } from './service'
import { FeedbackController } from './controller'

export { FeedbackService }

export function FeedbackModule() {
  return createModule({
    name: 'feedback',
    version: '1.0.0',
    description: 'Feedback system: GitLab issue creator',
    contract: {
      name: 'feedback', version: '1.0.0',
      description: 'User feedback → GitLab issues',
      actions: ['createGitLabIssue'],
      events: [],
      tables: [],
      dependencies: [],
      rules: [],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('feedback: auth dependency required')
      const log = logger.child('feedback')
      const service = new FeedbackService(log)
      const controller = new FeedbackController(service, log)

      router.post('/api/feedback/gitlab-issue', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req: any) => controller.createGitLabIssue(req))

      log.info('Módulo feedback listo')
      return service
    },
  })
}
