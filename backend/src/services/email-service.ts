// services/email-service.ts — Email transaccional multi-tenant con cola persistente.
//
// Responsabilidad: encolar, procesar (con reintentos + backoff) y enviar emails.
// Proveedores: SMTP (Configuration key 'email_config') con fallback a Resend
// (Configuration key 'resend_api_key'). Multi-tenant por hotelId.
//
// Es un servicio TRANSVERSAL (no módulo): no tiene endpoints CRUD propios,
// es consumido por otros módulos (reservas, y futuras auto-messages).
// Análogo a StripeService. Las dependencias se inyectan en composition-root.
//
// REGLA: sin credenciales hardcodeadas. Todo SMTP/Resend se lee de Configuration.

import nodemailer from 'nodemailer'
import type { RepositoryAdapter, Logger } from 'arckode-framework'

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type EmailStatus = 'pending' | 'processing' | 'sent' | 'failed'

export interface EmailQueueDTO {
  id: string
  hotelId: string
  /** Destinatario (columna 'recipient' en DB; 'to' es palabra reservada de SQL). */
  recipient: string
  subject: string
  html: string
  status: EmailStatus
  attempts: number
  maxAttempts: number
  lastError?: string | null
  nextRetryAt?: string | null
  provider?: 'smtp' | 'resend' | null
  relatedType?: string | null
  relatedId?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface EnqueueInput {
  to: string
  subject: string
  html: string
  hotelId: string
  /** Variables de plantilla a interpolar (placeholders {guest_name}, etc.). */
  variables?: Record<string, string | number>
  /** Origen del email para trazabilidad (ej: 'reservation'). */
  relatedType?: string
  relatedId?: string
}

interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
  secure: boolean
}

// ─── Constantes ─────────────────────────────────────────────────────────────

/** Backoff exponencial tras cada fallo: 1min, 5min, 15min (3 reintentos). */
const BACKOFF_MS = [60_000, 300_000, 900_000]
const MAX_ATTEMPTS = 3
/** Límite defensivo de tamaño del HTML (500 KB). */
const MAX_HTML_BYTES = 500_000
/** Filas en 'processing' más viejas que esto se consideran stale (crash del worker). */
const STALE_MS = 5 * 60_000

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PLACEHOLDER_RE = /\{(\w+)\}/g

// ─── Errores ────────────────────────────────────────────────────────────────

export class EmailNotConfiguredError extends Error {
  constructor(message = 'No email provider configured (email_config or resend_api_key)') {
    super(message)
    this.name = 'EmailNotConfiguredError'
  }
}

// ─── Render de plantillas ───────────────────────────────────────────────────

/**
 * Reemplaza placeholders `{key}` por su valor en `variables`.
 * - Si la key ESTÁ en variables (aunque sea '') → reemplaza.
 * - Si la key NO está en variables → deja el placeholder literal (no rompe).
 */
/** Escapa HTML en valores de plantilla (defensa XSS si el HTML se re-muestra en una vista web). */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function renderTemplate(template: string, variables: Record<string, string | number>): string {
  return template.replace(PLACEHOLDER_RE, (match, key: string) => {
    if (!(key in variables)) return match
    const v = variables[key]
    if (v === null || v === undefined) return ''
    const str = String(v)
    return typeof v === 'string' ? escapeHtml(str) : str
  })
}

// Variables soportadas por las plantillas (spec 6.1.4):
// {guest_name} {hotel_name} {checkin_date} {checkout_date} {room_number}
// {total_amount} {wifi_network} {wifi_password} {lock_code} {hotel_phone} {locator}

const RESERVATION_CONFIRMATION_HTML = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1a2b4c;color:white;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="margin:0;font-size:24px;">🏨 {hotel_name}</h1>
    <p style="margin:5px 0 0;opacity:0.8;">Confirmación de Reserva</p>
  </div>
  <div style="background:#f8f9fa;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
    <p style="font-size:16px;">Hola <strong>{guest_name}</strong>,</p>
    <p>Tu reserva ha sido confirmada. Aquí tienes los detalles:</p>
    <div style="background:white;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb;">
      <table style="width:100%;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b7280;">Habitación</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{room_number}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-in</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkin_date}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-out</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkout_date}</td></tr>
        <tr><td style="padding:6px 0;border-top:2px solid #e5e7eb;color:#1a2b4c;font-weight:bold;">Total</td><td style="padding:6px 0;border-top:2px solid #e5e7eb;font-weight:bold;text-align:right;font-size:18px;color:#1a2b4c;">{total_amount}</td></tr>
      </table>
    </div>
    <p style="font-size:13px;color:#6b7280;">Localizador: <strong>{locator}</strong></p>
    <p style="font-size:13px;color:#6b7280;">Si tenés alguna consulta, llamá al <strong>{hotel_phone}</strong>.</p>
    <p style="font-size:13px;color:#6b7280;">¡Te esperamos!</p>
  </div>
</body>
</html>`

const RESERVATION_PRE_SALE_HTML = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1a2b4c;color:white;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="margin:0;font-size:24px;">🏨 {hotel_name}</h1>
    <p style="margin:5px 0 0;opacity:0.8;">Reserva — Pago Pendiente</p>
  </div>
  <div style="background:#f8f9fa;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
    <p style="font-size:16px;">Hola <strong>{guest_name}</strong>,</p>
    <p>Tenemos una reserva preparada para vos. Para confirmarla, necesitamos el pago del anticipo.</p>
    <div style="background:white;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb;">
      <table style="width:100%;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b7280;">Habitación</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{room_number}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-in</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkin_date}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-out</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkout_date}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Anticipo requerido</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{total_amount}</td></tr>
      </table>
    </div>
    <p style="font-size:13px;color:#6b7280;">Localizador: <strong>{locator}</strong></p>
    <p style="font-size:13px;color:#6b7280;">Si tenés alguna consulta, llamá al <strong>{hotel_phone}</strong>.</p>
  </div>
</body>
</html>`

/** Plantilla de confirmación de reserva renderizada con `variables`. */
export function reservationConfirmation(variables: Record<string, string | number>): string {
  return renderTemplate(RESERVATION_CONFIRMATION_HTML, variables)
}

/** Plantilla de reserva pendiente de pago renderizada con `variables`. */
export function reservationPreSale(variables: Record<string, string | number>): string {
  return renderTemplate(RESERVATION_PRE_SALE_HTML, variables)
}

// ─── EmailService ───────────────────────────────────────────────────────────

export class EmailService {
  /** Guard de reentrada: un solo processQueue por proceso a la vez. */
  private processing = false
  /** Cache de transporters SMTP por host:port:user (evita reconstruir por email). */
  private transporters = new Map<string, nodemailer.Transporter<unknown>>()

  constructor(
    private readonly configRepo: RepositoryAdapter<Record<string, unknown>>,
    private readonly queueRepo: RepositoryAdapter<EmailQueueDTO>,
    private readonly logger: Logger,
  ) {}

  /**
   * Encola un email para envío asíncrono. Inserta la fila y dispara el procesamiento
   * fire-and-forget (no bloquea al caller). Devuelve el id de la fila en cola.
   */
  async enqueue(input: EnqueueInput): Promise<string> {
    if (!input.to || !EMAIL_RE.test(input.to)) {
      throw new Error(`EmailService: recipient inválido "${input.to}"`)
    }
    if (!input.hotelId) {
      throw new Error('EmailService: hotelId requerido (multi-tenancy)')
    }
    if (Buffer.byteLength(input.html, 'utf8') > MAX_HTML_BYTES) {
      throw new Error('EmailService: HTML payload excede 500KB')
    }

    const html = input.variables ? renderTemplate(input.html, input.variables) : input.html
    const created = await this.queueRepo.create({
      hotelId: input.hotelId,
      recipient: input.to,
      subject: input.subject,
      html,
      status: 'pending',
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      lastError: null,
      nextRetryAt: null,
      provider: null,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
    } as Omit<EmailQueueDTO, 'id'>)

    // Envío inmediato sin bloquear: el worker del interval también lo tomará.
    this.processQueue().catch((e) => this.logger.error('EmailService enqueue → processQueue', { error: (e as Error).message }))

    return String((created as EmailQueueDTO).id ?? '')
  }

  /**
   * Worker de la cola. Toma filas `pending` vencidas y las envía.
   * Reentrante-safe (guard `processing`). Una sola fila por proceso a la vez.
   * Limitación documentada: no soporta multi-instancia (claim atómico requiere
   * SQL crudo que esta capa no debe usar); en single-process SQLite esto es correcto.
   */
  async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true
    try {
      const now = new Date().toISOString()
      const pending = (await this.queueRepo.findMany({ status: 'pending' } as Partial<EmailQueueDTO>)) as EmailQueueDTO[]
      const due = pending.filter((r) => !r.nextRetryAt || r.nextRetryAt <= now)
      for (const row of due) {
        await this.processOne(row)
      }
    } catch (e) {
      this.logger.error('EmailService processQueue', { error: (e as Error).message })
    } finally {
      this.processing = false
    }
  }

  /** Reclama filas `processing` stale (worker crasheó) al arranque del server. */
  async reclaimStale(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - STALE_MS).toISOString()
      const stuck = (await this.queueRepo.findMany({ status: 'processing' } as Partial<EmailQueueDTO>)) as EmailQueueDTO[]
      for (const row of stuck) {
        if (!row.updatedAt || row.updatedAt < cutoff) {
          await this.queueRepo.update(row.id, { status: 'pending', nextRetryAt: null } as Partial<EmailQueueDTO>)
          this.logger.warn('EmailService: stale reclaim', { id: row.id, to: row.recipient })
        }
      }
    } catch (e) {
      this.logger.error('EmailService reclaimStale', { error: (e as Error).message })
    }
  }

  // ─── Internos ─────────────────────────────────────────────────────────────

  /** Procesa una fila: reclama, envía y actualiza estado. */
  private async processOne(row: EmailQueueDTO): Promise<void> {
    // Revalidación (defensa multi-camino): sigue pending antes de tomarla.
    const fresh = await this.queueRepo.findOne({ id: row.id, status: 'pending' } as Partial<EmailQueueDTO>)
    if (!fresh) return
    await this.queueRepo.update(row.id, { status: 'processing' } as Partial<EmailQueueDTO>)

    try {
      const provider = await this.sendNow({ to: row.recipient, subject: row.subject, html: row.html, hotelId: row.hotelId })
      await this.queueRepo.update(row.id, { status: 'sent', provider, lastError: null, nextRetryAt: null } as Partial<EmailQueueDTO>)
    } catch (e) {
      await this.handleFailure(row, e as Error)
    }
  }

  /** Envía el email: SMTP desde Configuration, fallback Resend, o error si ninguno. */
  private async sendNow(input: { to: string; subject: string; html: string; hotelId: string }): Promise<'smtp' | 'resend'> {
    const smtp = await this.resolveSmtpConfig(input.hotelId)
    if (smtp) {
      const transporter = this.getTransporter(smtp)
      await transporter.sendMail({ from: smtp.from, to: input.to, subject: input.subject, html: input.html })
      return 'smtp'
    }

    const resendKey = await this.resolveResendKey(input.hotelId)
    if (resendKey) {
      const fromAddress = 'ManagerHotel <noreply@managerhotel.com>'
      const { Resend } = await import('resend')
      const resend = new Resend(resendKey)
      const { error } = await resend.emails.send({ from: fromAddress, to: input.to, subject: input.subject, html: input.html })
      if (error) throw new Error(`Resend: ${error.message}`)
      return 'resend'
    }

    throw new EmailNotConfiguredError()
  }

  /** Lee SMTP de Configuration key 'email_config'. Null si no configurado/válido. */
  private async resolveSmtpConfig(hotelId: string): Promise<SmtpConfig | null> {
    try {
      let row = await this.configRepo.findOne({ hotelId, key: 'email_config' } as Record<string, unknown>)
      // Fallback a config 'platform' (SaaS: SMTP compartido por todos los hoteles).
      if (!row) row = await this.configRepo.findOne({ hotelId: 'platform', key: 'email_config' } as Record<string, unknown>)
      const raw = (row as { value?: unknown } | null)?.value
      let cfg = raw as Record<string, unknown> | null
      if (typeof raw === 'string') {
        try { cfg = JSON.parse(raw) as Record<string, unknown> } catch { cfg = null }
      }
      if (!cfg || !cfg.host || !cfg.user || !cfg.pass) return null
      const port = Number(cfg.port) || 587
      return {
        host: String(cfg.host),
        port,
        user: String(cfg.user),
        pass: String(cfg.pass),
        from: String(cfg.from ?? 'noreply@managerhotel.com'),
        secure: cfg.secure === true || port === 465,
      }
    } catch {
      return null
    }
  }

  /** Lee la API key de Resend de Configuration key 'resend_api_key'. Null si vacío. */
  private async resolveResendKey(hotelId: string): Promise<string | null> {
    try {
      let row = await this.configRepo.findOne({ hotelId, key: 'resend_api_key' } as Record<string, unknown>)
      // Fallback a config 'platform' (SaaS: API key compartida).
      if (!row) row = await this.configRepo.findOne({ hotelId: 'platform', key: 'resend_api_key' } as Record<string, unknown>)
      const raw = (row as { value?: unknown } | null)?.value
      let key: unknown = raw
      if (raw && typeof raw === 'object') key = (raw as { key?: unknown; api_key?: unknown }).key ?? (raw as { api_key?: unknown }).api_key
      if (typeof key === 'string' && key.trim()) return key.trim()
      return null
    } catch {
      return null
    }
  }

  /** Cache de transporter SMTP por credenciales (evita reconstruir por envío). */
  private getTransporter(cfg: SmtpConfig): nodemailer.Transporter<unknown> {
    const cacheKey = `${cfg.host}:${cfg.port}:${cfg.user}:${cfg.pass}`
    const cached = this.transporters.get(cacheKey)
    if (cached) return cached
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    })
    this.transporters.set(cacheKey, transporter)
    return transporter
  }

  /** Maneja un fallo de envío: reintento con backoff o fallo permanente. */
  private async handleFailure(row: EmailQueueDTO, e: Error): Promise<void> {
    const attempts = Number(row.attempts || 0) + 1
    const errMsg = e instanceof EmailNotConfiguredError ? 'no provider configured' : (e.message || String(e))

    if (attempts >= MAX_ATTEMPTS) {
      await this.queueRepo.update(row.id, { status: 'failed', attempts, lastError: errMsg, nextRetryAt: null } as Partial<EmailQueueDTO>)
      this.logger.warn('EmailService: envío fallido definitivo', { id: row.id, to: row.recipient, attempts, error: errMsg })
      return
    }

    const nextRetryAt = new Date(Date.now() + BACKOFF_MS[attempts - 1]).toISOString()
    await this.queueRepo.update(row.id, { status: 'pending', attempts, lastError: errMsg, nextRetryAt } as Partial<EmailQueueDTO>)
    this.logger.warn('EmailService: reintento programado', { id: row.id, to: row.recipient, attempts, nextRetryAt, error: errMsg })
  }
}
