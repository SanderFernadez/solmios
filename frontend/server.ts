import { file, sleep } from 'bun'
import { join } from 'path'

const DIST = join(import.meta.dir, 'dist')
const BACKEND = process.env.BACKEND_URL || 'http://localhost:3001'
const PORT = parseInt(process.env.PORT || '5173')

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    // Proxy API requests to backend
    if (url.pathname.startsWith('/api')) {
      return fetch(`${BACKEND}${url.pathname}${url.search}`, {
        method: req.method,
        headers: req.headers,
        body: req.body,
      })
    }

    // Serve static files
    let filePath = join(DIST, url.pathname === '/' ? 'index.html' : url.pathname)

    const f = file(filePath)
    if (await f.exists()) {
      const ext = '.' + filePath.split('.').pop()
      return new Response(f, {
        headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' },
      })
    }

    // SPA fallback — only for routes without file extension (navigation)
    const hasExt = /\.\w+$/.test(url.pathname)
    if (hasExt) {
      return new Response('Not found', { status: 404 })
    }
    const index = file(join(DIST, 'index.html'))
    return new Response(index, {
      headers: { 'Content-Type': 'text/html' },
    })
  },
})

console.log(`Frontend serving at http://localhost:${PORT}`)
console.log(`Proxy /api → ${BACKEND}`)
