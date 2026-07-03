import type { Logger } from 'arckode-framework'

export class FeedbackService {
  constructor(
    private readonly logger: Logger,
  ) {}

  async createGitLabIssue(reqBody: any, user: any): Promise<any> {
    const { screenshot, filename, comment, route, x, y, browser, viewportWidth, viewportHeight } = reqBody
    const GITLAB_TOKEN = process.env.GITLAB_TOKEN
    const GITLAB_PROJECT_ID = process.env.GITLAB_PROJECT_ID
    if (!GITLAB_TOKEN || !GITLAB_PROJECT_ID) throw new Error('GitLab no configurado en el servidor')
    if (!comment) throw new Error('Comentario requerido')

    const GITLAB_API = `https://gitlab.com/api/v4/projects/${encodeURIComponent(GITLAB_PROJECT_ID)}`

    // Screenshot es opcional
    let imgMarkdown = ''
    if (screenshot && screenshot.includes(',')) {
      try {
        const imgBase64 = screenshot.split(',')[1]
        if (imgBase64) {
          const imgBuffer = Buffer.from(imgBase64, 'base64')
          const formData = new FormData()
          const blob = new Blob([imgBuffer], { type: 'image/png' })
          formData.append('file', blob, filename || `feedback-${Date.now()}.png`)
          const uploadRes = await fetch(`${GITLAB_API}/uploads`, {
            method: 'POST', headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN }, body: formData,
          })
          if (uploadRes.ok) {
            const uploadData = (await uploadRes.json()) as any
            imgMarkdown = uploadData.markdown || `![screenshot](${uploadData.url})`
          }
        }
      } catch (e) {
        this.logger.warn('Screenshot upload failed, continuing without image', { error: (e as Error).message })
      }
    }

    const title = `[Feedback] ${comment.length > 72 ? comment.slice(0, 72) + '…' : comment}`
    const descriptionParts = [
      '## 📝 Detalles del Feedback', '',
      '| Campo | Valor |', '|-------|-------|',
      `| **Comentario** | ${comment} |`,
      `| **Ruta** | \`${route}\` |`,
      `| **Coordenadas** | (${x}, ${y}) |`,
      `| **Browser** | ${browser} |`,
      `| **Viewport** | ${viewportWidth}×${viewportHeight} |`,
      `| **Usuario** | ${user?.email || 'desconocido'} |`,
      `| **Timestamp** | ${new Date().toISOString()} |`,
    ]
    if (imgMarkdown) {
      descriptionParts.splice(1, 0, '', '## 📸 Screenshot', '', imgMarkdown, '', '---')
    }
    const description = descriptionParts.join('\n')

    const issueRes = await fetch(`${GITLAB_API}/issues`, {
      method: 'POST', headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, labels: 'feedback' }),
    })
    if (!issueRes.ok) { const errText = await issueRes.text(); throw new Error(`Error al crear issue: ${errText}`) }
    const issueData = (await issueRes.json()) as any
    this.logger.info('GitLab issue creado desde feedback', { issueUrl: issueData.web_url, route })
    return { issueUrl: issueData.web_url, issueId: issueData.iid, title: issueData.title }
  }
}
