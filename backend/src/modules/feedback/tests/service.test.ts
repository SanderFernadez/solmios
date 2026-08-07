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

  describe('createGitHubIssue', () => {
    it('throws when GitHub token not configured', async () => {
      const originalToken = process.env.GITHUB_TOKEN
      const originalRepo = process.env.GITHUB_REPO
      delete process.env.GITHUB_TOKEN
      delete process.env.GITHUB_REPO
      try {
        const svc = new FeedbackService(makeRepo() as any, log)
        const body = { screenshot: 'data:image/png;base64,iVBOR', comment: 'Test', route: '/test' }
        await expect(svc.createGitHubIssue(body, { email: 'test@test.com' })).rejects.toThrow('GitHub no configurado')
      } finally {
        if (originalToken) process.env.GITHUB_TOKEN = originalToken
        if (originalRepo) process.env.GITHUB_REPO = originalRepo
      }
    })

    // feedback-user-email (#632): el JWT (req.user) no lleva email → antes TODOS los issues salían
    // "Usuario: desconocido". Ahora el service lo resuelve por id desde la tabla users. Mockeamos
    // fetch para capturar el body del POST /issues y asertar el campo Usuario sin pegar a GitHub.
    function mockGitHubFetch(captured: { body?: any }) {
      const real = globalThis.fetch
      const stub: any = async (url: string | URL | Request, init?: any) => {
        const u = String(url)
        if (u.endsWith('/issues')) {
          captured.body = JSON.parse(init.body)
          return { ok: true, json: async () => ({ html_url: 'https://github.com/arckodeteam-hash/solmios/issues/1', number: 1, title: 't' }) }
        }
        return { ok: false, status: 404, text: async () => 'mock: not found' }
      }
      globalThis.fetch = stub
      return () => { globalThis.fetch = real }
    }

    it('resuelve el email del autor por userId (no "desconocido") cuando el JWT no lleva email', async () => {
      process.env.GITHUB_TOKEN = 'test-token'
      process.env.GITHUB_REPO = 'arckodeteam-hash/solmios'
      const userRepo = { ...makeRepo(), findById: async () => ({ id: 'u1', email: 'real@solmios.com' }) }
      const svc = new FeedbackService(makeRepo() as any, log, undefined, userRepo as any)
      const captured: { body?: any } = {}
      const restore = mockGitHubFetch(captured)
      try {
        await svc.createGitHubIssue({ comment: 'Prueba', route: '/panel/dashboard' }, { id: 'u1' } as any)
        expect(captured.body.body).toContain('real@solmios.com')
        expect(captured.body.body).not.toContain('desconocido')
      } finally {
        restore()
        delete process.env.GITHUB_TOKEN
        delete process.env.GITHUB_REPO
      }
    })

    it('degrada a "desconocido" si no hay userRepo ni id (el feedback nunca se pierde)', async () => {
      process.env.GITHUB_TOKEN = 'test-token'
      process.env.GITHUB_REPO = 'arckodeteam-hash/solmios'
      // Sin userRepo (4to param) — como un módulo sin users cableado.
      const svc = new FeedbackService(makeRepo() as any, log)
      const captured: { body?: any } = {}
      const restore = mockGitHubFetch(captured)
      try {
        await svc.createGitHubIssue({ comment: 'Prueba', route: '/panel/dashboard' }, undefined as any)
        expect(captured.body.body).toContain('desconocido')
      } finally {
        restore()
        delete process.env.GITHUB_TOKEN
        delete process.env.GITHUB_REPO
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
