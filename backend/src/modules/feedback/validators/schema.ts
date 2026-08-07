import type { ValidationRule } from 'arckode-framework'

export const CreateGitHubIssueSchema: Record<string, ValidationRule> = {
  screenshot: { type: 'string' as const },
  filename: { type: 'string' as const, max: 200 },
  // id del pin recién creado: el server lo vincula con el issue (evita un PATCH desde el frontend).
  pinId: { type: 'string' as const, max: 100 },
  comment: { type: 'string' as const, required: true, min: 3, max: 1000 },
  route: { type: 'string' as const, required: true, max: 500 },
  x: { type: 'number' as const },
  y: { type: 'number' as const },
  browser: { type: 'string' as const, max: 100 },
  viewportWidth: { type: 'number' as const, min: 0 },
  viewportHeight: { type: 'number' as const, min: 0 },
}

export const CreateFeedbackPinSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, max: 100 },
  route: { type: 'string' as const, required: true, max: 500 },
  x: { type: 'number' as const, required: true },
  y: { type: 'number' as const, required: true },
  comment: { type: 'string' as const, required: true, min: 1, max: 1000 },
  priority: { type: 'string' as const },
  category: { type: 'string' as const },
  screenshot: { type: 'string' as const },
  browser: { type: 'string' as const, max: 100 },
  viewportWidth: { type: 'number' as const, min: 0 },
  viewportHeight: { type: 'number' as const, min: 0 },
}

export const UpdateFeedbackPinSchema: Record<string, ValidationRule> = {
  status: { type: 'string' as const },
  comment: { type: 'string' as const, min: 1, max: 1000 },
  priority: { type: 'string' as const },
  category: { type: 'string' as const },
}

export const FeedbackValidator = {
  createGitHubIssue: CreateGitHubIssueSchema,
  createFeedbackPin: CreateFeedbackPinSchema,
  updateFeedbackPin: UpdateFeedbackPinSchema,
}
