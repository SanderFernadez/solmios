// usuarios/usecases/token-session.ts — Invalidación de la sesión de refresh (G4).
//
// El JWT de acceso es stateless (verifyToken no toca la DB), así que un logout no puede revocarlo:
// expira solo por su TTL. Pero el refresh token dura mucho más (7d) y era el vector grave: seguía
// renovando accesos incluso después del logout.
//
// Fix acotado, sin tocar el hot path: se guarda el `jti` del refresh token vigente en `users.token`
// (campo que ya existía y no se consultaba). El refresh solo procede si el jti del token presentado
// coincide con el guardado, y rota el jti en cada uso. El logout pone `token = null` → cualquier
// refresh deja de funcionar de inmediato. Es single-session: un login nuevo invalida el refresh viejo.

/** Lee un claim del payload de un JWT SIN verificar la firma. Solo para tokens ya verificados o
 *  recién generados por nosotros (leer jti/id), nunca para autorizar. */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split('.')[1]
  if (!part) return {}
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf-8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function jtiOf(token: string): string | undefined {
  const jti = decodeJwtPayload(token).jti
  return typeof jti === 'string' ? jti : undefined
}

interface RepoLike { findById(id: string): Promise<any>; update(id: string, data: any): Promise<any> }
interface AuthLike { refresh(rt: string): { accessToken: string; refreshToken: string } }

/**
 * Renueva la sesión validando la revocación: el refresh solo procede si su jti coincide con el
 * guardado en el usuario. Tras un logout (token=null) o un login más nuevo (otro jti), un refresh
 * viejo ya no renueva. Rota el jti en cada uso. Lanza `onInvalid()` si no valida.
 */
export async function refreshSession(
  repo: RepoLike,
  auth: AuthLike,
  refreshToken: string,
  onInvalid: () => never,
): Promise<{ token: string; refreshToken: string }> {
  const decoded = decodeJwtPayload(refreshToken)
  const userId = decoded.id as string | undefined
  const presentedJti = typeof decoded.jti === 'string' ? decoded.jti : undefined
  const user = userId ? await repo.findById(userId) : null
  if (!user || !presentedJti || user.token !== presentedJti) onInvalid()
  const result = auth.refresh(refreshToken)
  await repo.update(userId!, { token: jtiOf(result.refreshToken) ?? null })
  return { token: result.accessToken, refreshToken: result.refreshToken }
}
