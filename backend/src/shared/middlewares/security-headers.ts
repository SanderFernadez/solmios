import type { MiddlewareHandler } from 'arckode-framework'

// #657 — faltaban 3 de los 6 headers estándar. Este middleware cubre /api/* y /uploads/*
// (todo lo que pasa por el Router de arckode); el index.html/assets estáticos los sirve nginx
// directo desde disco SIN pasar por acá — esos headers van en el vhost del servidor (fuera del
// repo, ver skill ssh-solmios / deploy). CSP acá es defensivo para las respuestas JSON de la API
// y los archivos servidos desde /uploads (fotos/firmas/documentos) — 'self' porque nada de esto
// carga terceros embebidos.
export function securityHeaders(): MiddlewareHandler {
  return async (req: any, next: any) => {
    const res = await next(req)
    return {
      ...res,
      headers: {
        ...res?.headers,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      },
    }
  }
}
