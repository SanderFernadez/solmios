import type { MiddlewareHandler } from 'arckode-framework'

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
      },
    }
  }
}
