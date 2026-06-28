// services/notification-defaults.ts — Plantillas base de notificaciones por evento × idioma.
//
// Fuente de verdad de los defaults de email (NO se seedean en DB). El override del hotel
// vive en auto_messages; este archivo es el fallback. Versionado con git, testeable sin DB.
// Las variables {key} se interpolan con renderTemplate() de email-service (6.1.2).

export type NotificationEvent = 'reservation_confirmed' | 'reservation_presale' | 'checkin_welcome'
export type NotificationLanguage = 'es' | 'en' | 'pt'

export interface NotificationDefault {
  /** Asunto del email (con placeholders {key}). */
  subject: string
  /** Cuerpo HTML del email (con placeholders {key}). */
  body: string
}

// ─── reservation_confirmed ──────────────────────────────────────────────────

const CONFIRMED_ES = `<!DOCTYPE html>
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

const CONFIRMED_EN = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1a2b4c;color:white;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="margin:0;font-size:24px;">🏨 {hotel_name}</h1>
    <p style="margin:5px 0 0;opacity:0.8;">Booking Confirmation</p>
  </div>
  <div style="background:#f8f9fa;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
    <p style="font-size:16px;">Hi <strong>{guest_name}</strong>,</p>
    <p>Your booking has been confirmed. Here are the details:</p>
    <div style="background:white;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb;">
      <table style="width:100%;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b7280;">Room</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{room_number}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-in</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkin_date}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-out</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkout_date}</td></tr>
        <tr><td style="padding:6px 0;border-top:2px solid #e5e7eb;color:#1a2b4c;font-weight:bold;">Total</td><td style="padding:6px 0;border-top:2px solid #e5e7eb;font-weight:bold;text-align:right;font-size:18px;color:#1a2b4c;">{total_amount}</td></tr>
      </table>
    </div>
    <p style="font-size:13px;color:#6b7280;">Booking ref: <strong>{locator}</strong></p>
    <p style="font-size:13px;color:#6b7280;">For any questions, call <strong>{hotel_phone}</strong>.</p>
    <p style="font-size:13px;color:#6b7280;">We look forward to welcoming you!</p>
  </div>
</body>
</html>`

const CONFIRMED_PT = `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1a2b4c;color:white;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="margin:0;font-size:24px;">🏨 {hotel_name}</h1>
    <p style="margin:5px 0 0;opacity:0.8;">Confirmação de Reserva</p>
  </div>
  <div style="background:#f8f9fa;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
    <p style="font-size:16px;">Olá <strong>{guest_name}</strong>,</p>
    <p>A sua reserva foi confirmada. Aqui estão os detalhes:</p>
    <div style="background:white;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb;">
      <table style="width:100%;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b7280;">Quarto</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{room_number}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-in</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkin_date}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-out</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkout_date}</td></tr>
        <tr><td style="padding:6px 0;border-top:2px solid #e5e7eb;color:#1a2b4c;font-weight:bold;">Total</td><td style="padding:6px 0;border-top:2px solid #e5e7eb;font-weight:bold;text-align:right;font-size:18px;color:#1a2b4c;">{total_amount}</td></tr>
      </table>
    </div>
    <p style="font-size:13px;color:#6b7280;">Localizador: <strong>{locator}</strong></p>
    <p style="font-size:13px;color:#6b7280;">Para qualquer dúvida, ligue para <strong>{hotel_phone}</strong>.</p>
    <p style="font-size:13px;color:#6b7280;">Esperamos por si!</p>
  </div>
</body>
</html>`

// ─── reservation_presale ────────────────────────────────────────────────────

const PRESALE_ES = `<!DOCTYPE html>
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

const PRESALE_EN = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1a2b4c;color:white;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="margin:0;font-size:24px;">🏨 {hotel_name}</h1>
    <p style="margin:5px 0 0;opacity:0.8;">Booking — Payment Pending</p>
  </div>
  <div style="background:#f8f9fa;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
    <p style="font-size:16px;">Hi <strong>{guest_name}</strong>,</p>
    <p>We have a booking ready for you. To confirm it, we need the deposit payment.</p>
    <div style="background:white;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb;">
      <table style="width:100%;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b7280;">Room</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{room_number}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-in</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkin_date}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-out</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkout_date}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Deposit required</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{total_amount}</td></tr>
      </table>
    </div>
    <p style="font-size:13px;color:#6b7280;">Booking ref: <strong>{locator}</strong></p>
    <p style="font-size:13px;color:#6b7280;">For any questions, call <strong>{hotel_phone}</strong>.</p>
  </div>
</body>
</html>`

const PRESALE_PT = `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1a2b4c;color:white;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="margin:0;font-size:24px;">🏨 {hotel_name}</h1>
    <p style="margin:5px 0 0;opacity:0.8;">Reserva — Pagamento Pendente</p>
  </div>
  <div style="background:#f8f9fa;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
    <p style="font-size:16px;">Olá <strong>{guest_name}</strong>,</p>
    <p>Temos uma reserva pronta para si. Para a confirmar, precisamos do pagamento do sinal.</p>
    <div style="background:white;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb;">
      <table style="width:100%;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b7280;">Quarto</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{room_number}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-in</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkin_date}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-out</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkout_date}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Sinal exigido</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{total_amount}</td></tr>
      </table>
    </div>
    <p style="font-size:13px;color:#6b7280;">Localizador: <strong>{locator}</strong></p>
    <p style="font-size:13px;color:#6b7280;">Para qualquer dúvida, ligue para <strong>{hotel_phone}</strong>.</p>
  </div>
</body>
</html>`

// ─── checkin_welcome ────────────────────────────────────────────────────────

const CHECKIN_ES = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1a2b4c;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
    <div style="font-size:40px;">🏨</div>
    <h1 style="margin:8px 0 0;font-size:24px;">{hotel_name}</h1>
    <p style="margin:5px 0 0;opacity:0.85;">¡Bienvenido!</p>
  </div>
  <div style="background:#f8f9fa;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
    <p style="font-size:18px;">Hola <strong>{guest_name}</strong>,</p>
    <p style="font-size:15px;">Tu check-in está confirmado. Estos son los datos de tu estancia:</p>
    <div style="background:white;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb;">
      <table style="width:100%;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b7280;">Habitación</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{room_number}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-in</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkin_date}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-out</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkout_date}</td></tr>
      </table>
    </div>
    <p style="font-size:13px;color:#6b7280;">📍 {hotel_address}</p>
    <p style="font-size:13px;color:#6b7280;">📞 <a href="tel:{hotel_phone}" style="color:#1a2b4c;">{hotel_phone}</a></p>
    <div style="background:white;border-radius:8px;padding:14px;margin:16px 0;border:1px dashed #d1d5db;font-size:13px;">
      <p style="margin:0 0 6px;font-weight:bold;color:#1a2b4c;">📶 WiFi</p>
      <p style="margin:0;color:#6b7280;">Red: {wifi_network} · Contraseña: {wifi_password}</p>
      <p style="margin:6px 0 0;font-weight:bold;color:#1a2b4c;">🔐 Cerradura</p>
      <p style="margin:0;color:#6b7280;">Código: {lock_code}</p>
      <p style="margin:6px 0 0;font-weight:bold;color:#1a2b4c;">📋 Pre-checkin</p>
      <p style="margin:0;"><a href="{pre_checkin_url}" style="color:#1a2b4c;">{pre_checkin_url}</a></p>
    </div>
    <p style="font-size:14px;">¡Que disfrutes tu estancia! Si necesitas algo, estamos para ayudarte.</p>
  </div>
</body>
</html>`

const CHECKIN_EN = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1a2b4c;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
    <div style="font-size:40px;">🏨</div>
    <h1 style="margin:8px 0 0;font-size:24px;">{hotel_name}</h1>
    <p style="margin:5px 0 0;opacity:0.85;">Welcome!</p>
  </div>
  <div style="background:#f8f9fa;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
    <p style="font-size:18px;">Hi <strong>{guest_name}</strong>,</p>
    <p style="font-size:15px;">Your check-in is confirmed. Here are your stay details:</p>
    <div style="background:white;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb;">
      <table style="width:100%;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b7280;">Room</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{room_number}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-in</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkin_date}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-out</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkout_date}</td></tr>
      </table>
    </div>
    <p style="font-size:13px;color:#6b7280;">📍 {hotel_address}</p>
    <p style="font-size:13px;color:#6b7280;">📞 <a href="tel:{hotel_phone}" style="color:#1a2b4c;">{hotel_phone}</a></p>
    <div style="background:white;border-radius:8px;padding:14px;margin:16px 0;border:1px dashed #d1d5db;font-size:13px;">
      <p style="margin:0 0 6px;font-weight:bold;color:#1a2b4c;">📶 WiFi</p>
      <p style="margin:0;color:#6b7280;">Network: {wifi_network} · Password: {wifi_password}</p>
      <p style="margin:6px 0 0;font-weight:bold;color:#1a2b4c;">🔐 Door lock</p>
      <p style="margin:0;color:#6b7280;">Code: {lock_code}</p>
      <p style="margin:6px 0 0;font-weight:bold;color:#1a2b4c;">📋 Pre-check-in</p>
      <p style="margin:0;"><a href="{pre_checkin_url}" style="color:#1a2b4c;">{pre_checkin_url}</a></p>
    </div>
    <p style="font-size:14px;">Enjoy your stay! If you need anything, we're here to help.</p>
  </div>
</body>
</html>`

const CHECKIN_PT = `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1a2b4c;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
    <div style="font-size:40px;">🏨</div>
    <h1 style="margin:8px 0 0;font-size:24px;">{hotel_name}</h1>
    <p style="margin:5px 0 0;opacity:0.85;">Bem-vindo!</p>
  </div>
  <div style="background:#f8f9fa;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
    <p style="font-size:18px;">Olá <strong>{guest_name}</strong>,</p>
    <p style="font-size:15px;">O seu check-in está confirmado. Aqui estão os dados da sua estadia:</p>
    <div style="background:white;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb;">
      <table style="width:100%;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b7280;">Quarto</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{room_number}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-in</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkin_date}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Check-out</td><td style="padding:6px 0;font-weight:bold;text-align:right;">{checkout_date}</td></tr>
      </table>
    </div>
    <p style="font-size:13px;color:#6b7280;">📍 {hotel_address}</p>
    <p style="font-size:13px;color:#6b7280;">📞 <a href="tel:{hotel_phone}" style="color:#1a2b4c;">{hotel_phone}</a></p>
    <div style="background:white;border-radius:8px;padding:14px;margin:16px 0;border:1px dashed #d1d5db;font-size:13px;">
      <p style="margin:0 0 6px;font-weight:bold;color:#1a2b4c;">📶 WiFi</p>
      <p style="margin:0;color:#6b7280;">Rede: {wifi_network} · Palavra-passe: {wifi_password}</p>
      <p style="margin:6px 0 0;font-weight:bold;color:#1a2b4c;">🔐 Fechadura</p>
      <p style="margin:0;color:#6b7280;">Código: {lock_code}</p>
      <p style="margin:6px 0 0;font-weight:bold;color:#1a2b4c;">📋 Pré-check-in</p>
      <p style="margin:0;"><a href="{pre_checkin_url}" style="color:#1a2b4c;">{pre_checkin_url}</a></p>
    </div>
    <p style="font-size:14px;">Desfrute da sua estadia! Se precisar de algo, estamos aqui para ajudar.</p>
  </div>
</body>
</html>`

// ─── Registro central ───────────────────────────────────────────────────────

export const NOTIFICATION_DEFAULTS: Record<NotificationEvent, Partial<Record<NotificationLanguage, NotificationDefault>>> = {
  reservation_confirmed: {
    es: { subject: 'Confirmación de reserva — {hotel_name}', body: CONFIRMED_ES },
    en: { subject: 'Booking confirmation — {hotel_name}', body: CONFIRMED_EN },
    pt: { subject: 'Confirmação de reserva — {hotel_name}', body: CONFIRMED_PT },
  },
  reservation_presale: {
    es: { subject: 'Reserva pendiente de pago — {hotel_name}', body: PRESALE_ES },
    en: { subject: 'Booking pending payment — {hotel_name}', body: PRESALE_EN },
    pt: { subject: 'Reserva pendente de pagamento — {hotel_name}', body: PRESALE_PT },
  },
  checkin_welcome: {
    es: { subject: '¡Bienvenido a {hotel_name}, {guest_name}!', body: CHECKIN_ES },
    en: { subject: 'Welcome to {hotel_name}, {guest_name}!', body: CHECKIN_EN },
    pt: { subject: 'Bem-vindo a {hotel_name}, {guest_name}!', body: CHECKIN_PT },
  },
}

/**
 * Devuelve el default de código para (event, language), con fallback a 'es'.
 * Lanza si el evento no existe (mejor ruidoso que email vacío).
 */
export function getCodeDefault(event: NotificationEvent, language: NotificationLanguage): NotificationDefault {
  const ev = NOTIFICATION_DEFAULTS[event]
  if (!ev) throw new Error(`notification-defaults: evento desconocido "${event}"`)
  const tmpl = ev[language] ?? ev.es
  if (!tmpl) throw new Error(`notification-defaults: sin default ni fallback "es" para "${event}"`)
  return tmpl
}
