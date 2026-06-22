// shims.d.ts — Tipos para dependencias del framework arckode-framework que este proyecto no instala.
// mysql2/pg: el framework las importa en su CLI para soporte multi-DB; este proyecto usa SQLite.
// jsonwebtoken: el framework lo usa internamente; tipos mínimos para que typecheck pase.

declare module 'mysql2/promise'
declare module 'pg'

declare module 'jsonwebtoken' {
  interface SignOptions {
    algorithm?: string
    expiresIn?: string | number
    [key: string]: unknown
  }
  interface VerifyOptions {
    algorithms?: string[]
    [key: string]: unknown
  }
  export function sign(payload: string | object | Buffer, secret: string, options?: SignOptions): string
  export function verify(token: string, secret: string, options?: VerifyOptions): Record<string, unknown>
  const jwt: { sign: typeof sign; verify: typeof verify }
  export default jwt
}
