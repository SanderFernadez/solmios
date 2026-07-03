import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { FeedbackService } from '../service'

const log = silentLogger()

describe('FeedbackService', () => {
  describe('constructor', () => {
    it('creates service instance', () => {
      const svc = new FeedbackService({} as any, log)
      expect(svc).toBeDefined()
    })
  })

  describe('createGitLabIssue', () => {
    it('throws when GitLab token not configured', async () => {
      const svc = new FeedbackService({} as any, log)
      const body = { screenshot: 'data:image/png;base64,iVBOR', comment: 'Test', route: '/test' }
      await expect(svc.createGitLabIssue(body, { email: 'test@test.com' })).rejects.toThrow('GitLab no configurado')
    })
  })
})
