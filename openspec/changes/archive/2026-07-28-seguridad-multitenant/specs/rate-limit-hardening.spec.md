# Spec: Rate limit hardening

## Contexto
El rate limit de login **funciona** (`usuarios/index.ts:45` usa `getClientIp` sobre
X-Forwarded-For). Pero tiene dos debilidades: XFF es spoofeable (V7) y el limiter GLOBAL
usa `remoteAddress`, que detrás de nginx es siempre `127.0.0.1` (V8).

## DB
Sin cambios.

## API

### REQ-1 — Proxy confiable para X-Forwarded-For (V7)
- **Given** un request con header `X-Forwarded-For`
  **When** el rate limiter deriva la IP del cliente (`rate-limit.ts:53`)
  **Then** el sistema SHOULD confiar en XFF **solo** si el request viene de un proxy
  confiable (nginx local). MUST tomar el IP correcto de la cadena XFF (no el primero
  arbitrario que el cliente puede inyectar) según la cantidad de proxies configurada.
  MUST NOT permitir que rotar el header genere un bucket nuevo por request.

### REQ-2 — Rate limiter global con IP real (V8)
- **Given** el rate limiter global (`composition-root.ts:56`)
  **When** se registra el middleware `rateLimit({ windowMs, max })`
  **Then** MUST setear `keyBy` a la misma función `getClientIp` que usa el limiter de
  login, para que cada cliente tenga su propio bucket. MUST NOT usar el default
  `remoteAddress` (colapsa todos los clientes en `127.0.0.1` tras nginx).

## UI
Sin cambios.

## Errores
| Código | Cuándo |
|--------|--------|
| `429 TOO_MANY_REQUESTS` | se excede el límite por IP real |

## Verificación
- Test: N+1 requests desde la misma IP real → el N+1 da 429, aunque roten XFF.
- Test: dos IPs distintas → buckets independientes (una no consume el cupo de la otra).
