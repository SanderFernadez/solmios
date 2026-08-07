// usecases/create-github-issue.ts — Crea un Issue en GitHub a partir de un feedback pin.
//
// El screenshot se commitea a una rama DEDICADA (GITHUB_ASSETS_BRANCH, default
// `feedback-assets`) vía Contents API, NUNCA a main — el repo tiene un workflow que
// auto-deploya a producción en cada push a main (.github/workflows/deploy.yml); si el
// screenshot pisara main, cada feedback de un usuario dispararía un deploy completo.
import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import type { FeedbackPinDTO } from '../types'

async function uploadScreenshotToGitHub(
  logger: Logger,
  screenshot: string | undefined,
  filename: string | undefined,
  GITHUB_API: string,
  GITHUB_TOKEN: string,
  branch: string,
): Promise<string | null> {
  if (!screenshot || !screenshot.includes(',')) return null
  try {
    const imgBase64 = screenshot.split(',')[1]
    if (!imgBase64) return null
    const path = `feedback-screenshots/${filename || `feedback-${Date.now()}.png`}`
    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }

    // La rama de assets puede no existir todavía (primer feedback con screenshot) — si el PUT de
    // abajo falla porque `branch` no existe, la creamos apuntando al HEAD de main y reintentamos.
    const put = async (): Promise<Response> =>
      fetch(`${GITHUB_API}/contents/${encodeURIComponent(path)}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `feedback: screenshot ${filename || ''}`.trim(), content: imgBase64, branch }),
      })

    let res = await put()
    if (res.status === 404 || res.status === 422) {
      const mainRef = await fetch(`${GITHUB_API}/git/ref/heads/main`, { headers })
      if (mainRef.ok) {
        const mainSha = ((await mainRef.json()) as any).object.sha
        await fetch(`${GITHUB_API}/git/refs`, {
          method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: mainSha }),
        })
        res = await put()
      }
    }
    if (!res.ok) {
      logger.warn('Screenshot upload a GitHub falló, continuo sin imagen', { status: res.status })
      return null
    }
    const GITHUB_REPO = process.env.GITHUB_REPO
    return `https://raw.githubusercontent.com/${GITHUB_REPO}/${branch}/${path}`
  } catch (e) {
    logger.warn('Screenshot upload failed, continuing without image', { error: (e as Error).message })
    return null
  }
}

export interface CreateGitHubIssueDeps {
  pinsRepo: RepositoryAdapter<FeedbackPinDTO>
  logger: Logger
  auth?: Auth
  resolveEmail: (user: { id?: string; email?: string } | undefined) => Promise<string | undefined>
}

export async function createGitHubIssueUsecase(deps: CreateGitHubIssueDeps, reqBody: any, user: any): Promise<any> {
  const { pinsRepo, logger, auth, resolveEmail } = deps
  const { screenshot, filename, comment, route, x, y, browser, viewportWidth, viewportHeight, pinId } = reqBody
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN
  const GITHUB_REPO = process.env.GITHUB_REPO
  if (!GITHUB_TOKEN || !GITHUB_REPO) throw new Error('GitHub no configurado en el servidor')
  if (!comment) throw new Error('Comentario requerido')

  const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}`
  const ASSETS_BRANCH = process.env.GITHUB_ASSETS_BRANCH || 'feedback-assets'

  const imgUrl = await uploadScreenshotToGitHub(logger, screenshot, filename, GITHUB_API, GITHUB_TOKEN, ASSETS_BRANCH)
  const imgMarkdown = imgUrl ? `![screenshot](${imgUrl})` : ''

  // feedback-user-email (#632): el JWT no lleva email → user?.email era siempre undefined y el issue
  // salía "Usuario: desconocido" para todos. Resolverlo por id desde la tabla users; si no se puede,
  // cae a 'desconocido' (el feedback nunca se pierde por esto).
  const userEmail = await resolveEmail(user)
  const title = `[Feedback] ${comment.length > 72 ? comment.slice(0, 72) + '…' : comment}`
  const bodyParts = [
    '## 📝 Detalles del Feedback', '',
    '| Campo | Valor |', '|-------|-------|',
    `| **Comentario** | ${comment} |`,
    `| **Ruta** | \`${route}\` |`,
    `| **Coordenadas** | (${x}, ${y}) |`,
    `| **Browser** | ${browser} |`,
    `| **Viewport** | ${viewportWidth}×${viewportHeight} |`,
    `| **Usuario** | ${userEmail || 'desconocido'} |`,
    `| **Timestamp** | ${new Date().toISOString()} |`,
  ]
  if (imgMarkdown) {
    bodyParts.splice(1, 0, '', '## 📸 Screenshot', '', imgMarkdown, '', '---')
  }
  const body = bodyParts.join('\n')

  const issueRes = await fetch(`${GITHUB_API}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body, labels: ['feedback'] }),
  })
  if (!issueRes.ok) { const errText = await issueRes.text(); throw new Error(`Error al crear issue: ${errText}`) }
  const issueData = (await issueRes.json()) as any
  logger.info('GitHub issue creado desde feedback', { issueUrl: issueData.html_url, route })

  // Vincular el issue al pin de feedback. El widget crea el pin primero y pasa su id acá, así el
  // servidor escribe `githubIssueUrl`/`githubIssueId` sin que el frontend necesite un PATCH (que
  // exigiría `feedback:edit`). Ownership: el pin tiene que ser del hotel del usuario; el
  // assertOwnership bloquea escribir en el pin de otro hotel. Si falla, no abortamos: el issue ya
  // se creó en GitHub y devolvemos su URL igual (solo logueamos).
  if (pinId) {
    try {
      const existing = (await pinsRepo.findById(pinId)) as FeedbackPinDTO | null
      if (existing) {
        if (auth && user) auth.assertOwnership(existing.hotelId ?? '', user.hotelId, user.role, 'super_admin')
        await pinsRepo.update(pinId, {
          githubIssueUrl: issueData.html_url,
          githubIssueId: issueData.number,
          updatedAt: new Date().toISOString(),
        } as any)
      }
    } catch (e) {
      logger.warn('No se pudo vincular el issue de GitHub al pin', { pinId, error: (e as Error).message })
    }
  }

  return { issueUrl: issueData.html_url, issueId: issueData.number, title: issueData.title }
}
