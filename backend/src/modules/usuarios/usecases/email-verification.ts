// email-verification.ts — Verificación de email del alta (#421).
//
// El alta NO se bloquea: el hotel entra igual y usa el sistema, pero se le avisa hasta que
// verifique. El token viaja en claro en el link del correo; en la BD se guarda su HASH (sha256),
// para que un dump de `users` no regale accesos. Un solo uso, con vencimiento.

import { createHash, randomBytes } from 'node:crypto'
import type { RepositoryAdapter } from 'arckode-framework'

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000   // 24 h

export interface VerificationUser {
  id: string
  email?: string
  emailVerifiedAt?: string | null
  emailVerificationToken?: string | null
  emailVerificationExpires?: number | null
}

/** Hash del token para guardar/buscar. Nunca se persiste el token en claro. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Token nuevo: el `token` va en el link del correo; `tokenHash` + `expires` se guardan en el user. */
export function newVerificationToken(now: number = Date.now()): { token: string; tokenHash: string; expires: number } {
  const token = randomBytes(32).toString('hex')
  return { token, tokenHash: hashToken(token), expires: now + TOKEN_TTL_MS }
}

export type VerifyOutcome = 'verified' | 'invalid' | 'expired' | 'already_verified'

/**
 * Marca el email como verificado si el token es válido. Los motivos se distinguen para dar mensajes
 * distintos, PERO nunca revelan si un email existe (se busca por hash de token, no por email).
 */
export async function verifyEmailToken(
  repo: RepositoryAdapter<VerificationUser>,
  token: string,
  now: number = Date.now(),
): Promise<VerifyOutcome> {
  if (!token) return 'invalid'
  const user = await repo.findOne({ emailVerificationToken: hashToken(token) })
  if (!user) return 'invalid'
  if (user.emailVerifiedAt) return 'already_verified'
  if (!user.emailVerificationExpires || user.emailVerificationExpires < now) return 'expired'
  await repo.update(user.id, {
    emailVerifiedAt: new Date(now).toISOString(),
    emailVerificationToken: null,       // un solo uso
    emailVerificationExpires: null,
  } as Partial<VerificationUser>)
  return 'verified'
}

/** Asunto + HTML del correo de verificación. Link público con el token en claro. */
export function verificationEmail(link: string, hotelName: string): { subject: string; html: string } {
  return {
    subject: 'Verificá tu email — SolmiOS',
    html: `<p>Hola,</p>
<p>Gracias por registrar <strong>${escapeHtml(hotelName)}</strong> en SolmiOS. Para confirmar tu dirección de correo, hacé clic acá:</p>
<p><a href="${link}" style="background:#0a1322;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Verificar mi email</a></p>
<p>El enlace vence en 24 horas. Si no fuiste vos, ignorá este correo.</p>`,
  }
}

/** Regenera el token y reenvía el correo. Devuelve {sent:false} si ya está verificado o sin sender. */
export async function resendVerificationEmail(
  repo: RepositoryAdapter<VerificationUser & { name?: string; hotelId?: string }>,
  sender: { enqueue: (i: { to: string; subject: string; html: string; hotelId: string; relatedType?: string }) => Promise<string> } | undefined,
  appUrl: string,
  userId: string,
): Promise<{ sent: boolean }> {
  const u = await repo.findById(userId)
  if (!u) return { sent: false }
  if (u.emailVerifiedAt) return { sent: false }
  const v = newVerificationToken()
  await repo.update(u.id, { emailVerificationToken: v.tokenHash, emailVerificationExpires: v.expires } as any)
  if (!sender || !u.email) return { sent: false }
  const link = `${appUrl.replace(/\/$/, '')}/api/public/verify-email?token=${v.token}`
  const mail = verificationEmail(link, u.name || '')
  await sender.enqueue({ to: u.email, subject: mail.subject, html: mail.html, hotelId: u.hotelId || '', relatedType: 'email_verification' })
  return { sent: true }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
