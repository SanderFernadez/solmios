// abandon-recovery/usecases/template.ts — Construcción del email + link (F3 3.14).
//
// Extraído de service.ts para mantenerlo < 200 líneas (regla del analyzer: God Object).
// Puro + sin IO: ideal para tests unitarios sin mockear orm ni email.

/** Paleta del email (inline CSS hex). Mismo look&feel Apple-system del panel. */
const EMAIL_PALETTE = {
  bg: '#f5f5f7',
  card: '#ffffff',
  textTitle: '#1d1d1f',
  textBody: '#3a3a3c',
  textMuted: '#86868b',
  ctaBg: '#0a84ff',
  ctaText: '#ffffff',
}

const EMAIL_SUBJECT = 'Completá tu reserva — te guardamos tus datos'

export function emailSubject(): string {
  return EMAIL_SUBJECT
}

/**
 * Arma el link de recuperación: el widget restaura el state desde
 * `?reservation=:id&token=:accessToken` (spec booking-unification R2).
 * Si falta base o slug, igual arma algo apuntando al dominio raíz (mal pero mejor que nada).
 *
 * El token en la URL es el `accessToken` de la reserva (NO es un token HMAC como el de
 * /api/public/reservations/:id — eso es para lectura; este es para reabrir el widget con
 * la selección previa).
 */
export function buildRecoveryLink(publicBaseUrl: string, hotelSlug: string, reservationId: string, accessToken: string): string {
  const base = (publicBaseUrl || '').replace(/\/$/, '')
  const path = hotelSlug ? `/book/${hotelSlug}` : '/book'
  const q = `?reservation=${encodeURIComponent(reservationId)}&token=${encodeURIComponent(accessToken)}`
  return base ? `${base}${path}${q}` : `${path}${q}`
}

/** Template HTML inline del email. Mantenemos inline (no depende de un archivo externo ni
 *  de AutoMessages). Si el hotel quiere customizar, F4 puede moverlo a auto_messages. */
export function renderAbandonEmailHtml(opts: { link: string; reservationId: string }): string {
  const c = EMAIL_PALETTE
  return [
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `</head><body style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; background:${c.bg}; margin:0; padding:24px;">`,
    `<div style="max-width:560px; margin:0 auto; background:${c.card}; border-radius:16px; padding:32px 24px; box-shadow:0 2px 16px rgba(0,0,0,0.06);">`,
    `<h1 style="margin:0 0 12px; font-size:22px; color:${c.textTitle};">Tu reserva te está esperando</h1>`,
    `<p style="margin:0 0 16px; color:${c.textBody}; line-height:1.5;">`,
    'Vimos que empezaste a reservar pero no terminaste. No te preocupes:',
    'nos guardamos tus datos para que retomes justo donde lo dejaste.',
    '</p>',
    '<a href="' + escapeHtml(opts.link) + '" ',
    `style="display:inline-block; background:${c.ctaBg}; color:${c.ctaText}; text-decoration:none; padding:14px 24px; border-radius:12px; font-weight:600; font-size:15px;">`,
    'Completar mi reserva</a>',
    `<p style="margin:24px 0 0; color:${c.textMuted}; font-size:12px; line-height:1.5;">`,
    'Si no querés continuar, ignorá este correo. El link caduca cuando la reserva',
    ' vence automáticamente (24 h desde su creación).',
    '</p>',
    '</div></body></html>',
  ].join('')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
