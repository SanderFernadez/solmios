import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { FeedbackService } from '../service'

const log = silentLogger()

function makeRepo() {
  return {
    findMany: async () => [],
    findById: async () => null,
    create: async (d: any) => d,
    update: async (_id: string, d: any) => d,
    delete: async () => true,
    count: async () => 0,
  }
}

describe('FeedbackService', () => {
  describe('constructor', () => {
    it('creates service instance', () => {
      const svc = new FeedbackService(makeRepo() as any, log)
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
        const svc = new FeedbackService(makeRepo() as any, log)
        const body = { screenshot: 'data:image/png;base64,iVBOR', comment: 'Test', route: '/test' }
        await expect(svc.createGitLabIssue(body, { email: 'test@test.com' })).rejects.toThrow('GitLab no configurado')
      } finally {
        if (originalToken) process.env.GITLAB_TOKEN = originalToken
        if (originalProjectId) process.env.GITLAB_PROJECT_ID = originalProjectId
      }
    })
  })

  describe('CRUD pins', () => {
    it('creates a feedback pin', async () => {
      const repo = {
        ...makeRepo(),
        create: async (d: any) => ({ id: 'pin1', ...d }),
      }
      const svc = new FeedbackService(repo as any, log)
      const pin = await svc.createPin({ route: '/test', x: 100, y: 200, comment: 'Test pin' })
      expect(pin.route).toBe('/test')
      expect(pin.comment).toBe('Test pin')
      expect(pin.status).toBe('open')
    })

    it('lists pins by route', async () => {
      const repo = {
        ...makeRepo(),
        findMany: async () => [
          { id: 'pin1', route: '/test', comment: 'Pin 1' },
          { id: 'pin2', route: '/other', comment: 'Pin 2' },
        ],
      }
      const svc = new FeedbackService(repo as any, log)
      const result = await svc.listPins(undefined, '/test')
      expect(result.data).toHaveLength(2)
    })
  })
})
