import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { FeedbackService } from '../service'

const log = silentLogger()

describe('FeedbackService', () => {
  describe('constructor', () => {
    it('creates service instance', () => {
      const svc = new FeedbackService(log)
      expect(svc).toBeDefined()
    })
  })

  describe('createGitLabIssue', () => {
    it('throws when GitLab token not configured', async () => {
      const originalToken = process.env.GITLAB_TOKEN
      const originalProjectId = process.env.GITLAB_PROJECT_ID
      delete process.env.GITLAB_TOKEN
      delete process.env.GITLAB_PROJECT_ID
      try {
        const svc = new FeedbackService(log)
        const body = { screenshot: 'data:image/png;base64,iVBOR', comment: 'Test', route: '/test' }
        await expect(svc.createGitLabIssue(body, { email: 'test@test.com' })).rejects.toThrow('GitLab no configurado')
      } finally {
        if (originalToken) process.env.GITLAB_TOKEN = originalToken
        if (originalProjectId) process.env.GITLAB_PROJECT_ID = originalProjectId
      }
    })
  })
})
