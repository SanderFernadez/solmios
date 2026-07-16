/**
 * generate-openapi.ts — Genera docs/openapi.yaml (OpenAPI 3.0) escaneando las
 * rutas REALES registradas en cada `src/modules/<mod>/index.ts`.
 *
 * Enfoque: regex sobre `router.<method>('<path>', <middleware>, handler)`.
 *   - method + path se extraen del literal.
 *   - permiso/seguridad se infiere del middleware:
 *       guard('mod','action')        → permission "mod:action" (bearer requerido)
 *       [auth.authenticate(...roles)] o var → bearer requerido (roles listados)
 *       handler directo (async/(req)) → público (security: [])
 *
 * Re-ejecutable e idempotente. NO documenta cada schema de body a mano
 * (requestBody genérico en métodos con cuerpo).
 *
 *   Uso:  cd backend && bun run scripts/generate-openapi.ts
 *   Out:  ../docs/openapi.yaml
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'

const BACKEND_ROOT = resolve(import.meta.dir, '..')
const MODULES_DIR = join(BACKEND_ROOT, 'src', 'modules')
const OUT_DIR = resolve(BACKEND_ROOT, '..', 'docs')
const OUT_FILE = join(OUT_DIR, 'openapi.yaml')

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

interface Route {
  module: string
  method: HttpMethod
  path: string // OpenAPI path (con {param})
  rawPath: string // path original (:param)
  permission?: string // "module:action"
  auth: 'bearer' | 'public'
  roles?: string[] // roles/notas cuando no hay guard granular
}

const ROUTE_RE = /router\.(get|post|put|patch|delete)\(\s*'([^']+)'\s*(?:,\s*([\s\S]*?))?\)?\s*(?:=>|$)/

// Regex por línea (path siempre en la misma línea que router.<method>).
const LINE_ROUTE_RE = /router\.(get|post|put|patch|delete)\(\s*'([^']+)'\s*(,\s*(.*))?$/

function toOpenApiPath(p: string): string {
  return p.replace(/:([A-Za-z0-9_]+)/g, '{$1}')
}

/** Escanea `const NAME = [auth.authenticate('a','b'), ...]` en un archivo. */
function collectNamedMiddleware(src: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  const re = /const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\[([^\]]*auth\.authenticate[^\]]*)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const name = m[1]
    const body = m[2]
    const roles = [...body.matchAll(/'([^']+)'/g)].map((r) => r[1])
    out[name] = roles
  }
  return out
}

/** Roles listados en `STAFF_ROLES`-style spreads, best-effort. */
function collectRoleConstants(src: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  const re = /const\s+([A-Z_][A-Z0-9_]*)\s*=\s*\[([^\]]+)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const roles = [...m[2].matchAll(/'([^']+)'/g)].map((r) => r[1])
    if (roles.length) out[m[1]] = roles
  }
  return out
}

function parseModule(mod: string, src: string): Route[] {
  const named = collectNamedMiddleware(src)
  const roleConsts = collectRoleConstants(src)
  const routes: Route[] = []

  for (const rawLine of src.split('\n')) {
    const line = rawLine.trim()
    const m = LINE_ROUTE_RE.exec(line)
    if (!m) continue
    const method = m[1] as HttpMethod
    const rawPath = m[2]
    const rest = (m[4] ?? '').trim()

    let auth: 'bearer' | 'public' = 'bearer'
    let permission: string | undefined
    let roles: string[] | undefined

    // Handler directo (sin middleware) → público.
    const handlerDirect =
      rest === '' ||
      /^async\b/.test(rest) ||
      /^\(?\s*req\b/.test(rest) ||
      /^\(req[^)]*\)\s*=>/.test(rest)

    const guardMatch = /guard\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/.exec(rest)

    if (guardMatch) {
      permission = `${guardMatch[1]}:${guardMatch[2]}`
      auth = 'bearer'
    } else if (handlerDirect && !/auth\.authenticate|requireUserType|requirePermission/.test(rest)) {
      auth = 'public'
    } else {
      // middleware por variable o array literal → bearer, tratar de listar roles
      const inlineRoles = [...rest.matchAll(/auth\.authenticate\(([^)]*)\)/g)]
        .flatMap((r) => [...r[1].matchAll(/'([^']+)'/g)].map((x) => x[1]))
      const varName = /^[,\s]*([A-Za-z_][A-Za-z0-9_]*)\b/.exec(rest)?.[1]
      let resolved: string[] = inlineRoles
      if (!resolved.length && varName && named[varName]) resolved = named[varName]
      // spreads tipo ...STAFF_ROLES
      const spreads = [...rest.matchAll(/\.\.\.([A-Z_][A-Z0-9_]*)/g)].flatMap(
        (r) => roleConsts[r[1]] ?? [],
      )
      resolved = [...new Set([...resolved, ...spreads])]
      if (resolved.length) roles = resolved
      auth = 'bearer'
      if (/requireUserType\(\s*'admin'/.test(rest)) roles = [...new Set([...(roles ?? []), 'admin(userType)'])]
    }

    routes.push({
      module: mod,
      method,
      path: toOpenApiPath(rawPath),
      rawPath,
      permission,
      auth,
      roles,
    })
  }
  return routes
}

function collectRoutes(): Route[] {
  const mods = readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()

  const all: Route[] = []
  for (const mod of mods) {
    const idx = join(MODULES_DIR, mod, 'index.ts')
    if (!existsSync(idx)) continue
    const src = readFileSync(idx, 'utf8')
    all.push(...parseModule(mod, src))
  }
  return all
}

// ---------- YAML emit (sin dependencias externas) ----------

function q(s: string): string {
  // comilla simple YAML, escapando comillas simples internas
  return `'${s.replace(/'/g, "''")}'`
}

function summaryFor(r: Route): string {
  const verb: Record<HttpMethod, string> = {
    get: r.path.includes('{') ? 'Get' : 'List',
    post: 'Create/Action',
    put: 'Update',
    patch: 'Patch',
    delete: 'Delete',
  }
  return `${verb[r.method]} ${r.rawPath}`
}

function buildYaml(routes: Route[]): string {
  const byPath = new Map<string, Route[]>()
  for (const r of routes) {
    if (!byPath.has(r.path)) byPath.set(r.path, [])
    byPath.get(r.path)!.push(r)
  }

  const tags = [...new Set(routes.map((r) => r.module))].sort()

  const L: string[] = []
  L.push('openapi: 3.0.3')
  L.push('info:')
  L.push('  title: ManagerHotel API')
  L.push('  version: 1.0.0')
  L.push(
    '  description: >-\n    API REST del backend ManagerHotel (SOLMI OS), generada automáticamente\n    desde las rutas reales registradas en cada modulo (scripts/generate-openapi.ts).\n    Multi-tenant por hotelId. Auth por JWT Bearer salvo endpoints publicos.',
  )
  L.push('servers:')
  L.push('  - url: /api')
  L.push('    description: Base path (los paths de abajo ya incluyen /api)')
  L.push('  - url: https://hotel.zx89.site')
  L.push('    description: Produccion')

  // tags
  L.push('tags:')
  for (const t of tags) {
    L.push(`  - name: ${q(t)}`)
  }

  // paths
  L.push('paths:')
  const sortedPaths = [...byPath.keys()].sort()
  for (const p of sortedPaths) {
    L.push(`  ${q(p)}:`)
    // detectar path params
    const params = [...p.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1])
    const ops = byPath.get(p)!.sort((a, b) => a.method.localeCompare(b.method))
    for (const r of ops) {
      L.push(`    ${r.method}:`)
      L.push(`      tags: [${q(r.module)}]`)
      L.push(`      summary: ${q(summaryFor(r))}`)
      const opId = `${r.module}_${r.method}_${r.rawPath.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
      L.push(`      operationId: ${q(opId)}`)
      // description con permiso / roles
      const descBits: string[] = []
      if (r.permission) descBits.push(`Permiso requerido: ${r.permission}.`)
      if (r.roles && r.roles.length) descBits.push(`Roles: ${r.roles.join(', ')}.`)
      if (r.auth === 'public') descBits.push('Endpoint publico (sin autenticacion).')
      if (descBits.length) L.push(`      description: ${q(descBits.join(' '))}`)
      // extension propietaria con el permiso crudo (util para tooling)
      if (r.permission) L.push(`      x-permission: ${q(r.permission)}`)
      // params
      if (params.length) {
        L.push('      parameters:')
        for (const pp of params) {
          L.push(`        - name: ${pp}`)
          L.push('          in: path')
          L.push('          required: true')
          L.push('          schema: { type: string }')
        }
      }
      // requestBody generico para metodos con cuerpo
      if (r.method === 'post' || r.method === 'put' || r.method === 'patch') {
        L.push('      requestBody:')
        L.push('        required: true')
        L.push('        content:')
        L.push('          application/json:')
        L.push('            schema:')
        L.push('              type: object')
        L.push('              additionalProperties: true')
      }
      // security
      if (r.auth === 'public') {
        L.push('      security: []')
      } else {
        L.push('      security:')
        L.push('        - bearerAuth: []')
      }
      // responses genericas
      L.push('      responses:')
      L.push(`        '200': { description: OK }`)
      if (r.method === 'post') L.push(`        '201': { description: Created }`)
      if (r.auth !== 'public') {
        L.push(`        '401': { description: No autenticado }`)
        L.push(`        '403': { description: Sin permiso }`)
      }
      L.push(`        '400': { description: Peticion invalida }`)
      L.push(`        '404': { description: No encontrado }`)
    }
  }

  // components
  L.push('components:')
  L.push('  securitySchemes:')
  L.push('    bearerAuth:')
  L.push('      type: http')
  L.push('      scheme: bearer')
  L.push('      bearerFormat: JWT')
  L.push('      description: >-')
  L.push('        JWT emitido por login. Enviar como "Authorization: Bearer <token>".')
  L.push('security:')
  L.push('  - bearerAuth: []')

  return L.join('\n') + '\n'
}

// ---------- main ----------

const routes = collectRoutes()
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
const yaml = buildYaml(routes)
writeFileSync(OUT_FILE, yaml, 'utf8')

const paths = new Set(routes.map((r) => r.path)).size
const publicCount = routes.filter((r) => r.auth === 'public').length
const withPerm = routes.filter((r) => r.permission).length
const byModule = routes.reduce<Record<string, number>>((a, r) => {
  a[r.module] = (a[r.module] ?? 0) + 1
  return a
}, {})

console.log(`✅ OpenAPI generado: ${OUT_FILE}`)
console.log(`   Endpoints (operaciones): ${routes.length}`)
console.log(`   Paths unicos: ${paths}`)
console.log(`   Con permiso granular (guard): ${withPerm}`)
console.log(`   Publicos (sin auth): ${publicCount}`)
console.log(`   Modulos: ${Object.keys(byModule).length}`)
