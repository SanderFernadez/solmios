import type { ValidationRule } from 'arckode-framework'

export const CreateGitLabIssueSchema: Record<string, ValidationRule> = {
  screenshot: { type: 'string' as const, required: true },
  filename: { type: 'string' as const, max: 200 },
  comment: { type: 'string' as const, required: true, min: 3, max: 1000 },
  route: { type: 'string' as const, required: true, max: 500 },
  x: { type: 'number' as const },
  y: { type: 'number' as const },
  browser: { type: 'string' as const, max: 100 },
  viewportWidth: { type: 'number' as const, min: 0 },
  viewportHeight: { type: 'number' as const, min: 0 },
}

export const FeedbackValidator = {
  createGitLabIssue: CreateGitLabIssueSchema,
}
