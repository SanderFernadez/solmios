import type { ModelDefinition, ORM } from 'arckode-framework'

export const FeedbackPinsModel: ModelDefinition = {
  table: 'feedback_pins',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string' },
    route: { type: 'string', required: true },
    x: { type: 'number', required: true },
    y: { type: 'number', required: true },
    comment: { type: 'string', required: true },
    priority: { type: 'string', default: 'medium' },
    category: { type: 'string', default: 'UI' },
    status: { type: 'string', default: 'open' },
    screenshot: { type: 'string' },
    browser: { type: 'string' },
    viewportWidth: { type: 'number' },
    viewportHeight: { type: 'number' },
    userId: { type: 'string' },
    userEmail: { type: 'string' },
    githubIssueUrl: { type: 'string' },
    githubIssueId: { type: 'number' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
}

export function registerFeedbackModels(orm: ORM): void {
  orm.define('FeedbackPins', FeedbackPinsModel)
}
