// capacitacion/usecases/emails.ts — HTML del correo de inscripción y de la página de confirmación.
// Todo lo que viene de input (nombre del curso, URLs) se escapa: el HR lo escribe, pero igual no
// dejamos que rompa el HTML del mail.

const esc = (s: string): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Solo dejamos pasar http(s) como link, para no meter `javascript:` u otros esquemas en el correo. */
const safeUrl = (u?: string | null): string | null => {
  const s = String(u ?? '').trim()
  return /^https?:\/\//i.test(s) ? esc(s) : null
}

export function buildEnrollmentEmail(opts: {
  employeeName: string; courseName: string; materialUrl?: string | null; confirmUrl?: string | null
}): { subject: string; html: string } {
  const name = esc(opts.employeeName || 'Hola')
  const course = esc(opts.courseName)
  const material = safeUrl(opts.materialUrl)
  const confirm = safeUrl(opts.confirmUrl)

  const materialBlock = material
    ? `<p style="margin:16px 0"><a href="${material}" style="background:#0e7490;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Abrir el material del curso</a></p>`
    : ''
  const confirmBlock = confirm
    ? `<p style="margin:16px 0;font-size:14px">Cuando termines el curso, confirmalo acá:<br><a href="${confirm}" style="color:#0e7490;font-weight:bold">✔ Ya completé el curso</a></p>`
    : '<p style="margin:16px 0;font-size:14px">Cuando termines el curso, avisale a Recursos Humanos.</p>'

  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
    <h2 style="color:#0f172a">Capacitación asignada</h2>
    <p>${name}, te inscribimos en el curso <b>${course}</b>.</p>
    ${materialBlock}
    ${confirmBlock}
  </div>`

  return { subject: `Capacitación: ${opts.courseName}`, html }
}

/** Página HTML que ve el empleado al abrir el link de confirmación del correo. */
export function confirmPageHtml(opts: { courseName?: string | null; confirmUrl: string }): string {
  const course = esc(opts.courseName || 'el curso')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirmar capacitación</title></head>
  <body style="font-family:system-ui,Arial,sans-serif;background:#f1f5f9;margin:0;padding:40px 16px">
    <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;text-align:center">
      <h2 style="color:#0f172a;margin:0 0 8px">Confirmar capacitación</h2>
      <p style="color:#475569">¿Confirmás que completaste <b>${course}</b>?</p>
      <form method="POST" action="${esc(opts.confirmUrl)}">
        <button type="submit" style="background:#0e7490;color:#fff;border:0;padding:12px 24px;border-radius:10px;font-weight:bold;font-size:15px;cursor:pointer">Sí, ya lo completé</button>
      </form>
    </div>
  </body></html>`
}

export function confirmDoneHtml(courseName?: string | null): string {
  const course = esc(courseName || 'el curso')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>¡Listo!</title></head>
  <body style="font-family:system-ui,Arial,sans-serif;background:#f1f5f9;margin:0;padding:40px 16px">
    <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;text-align:center">
      <div style="font-size:40px">✅</div>
      <h2 style="color:#0f172a;margin:8px 0">¡Gracias!</h2>
      <p style="color:#475569">Registramos que completaste <b>${course}</b>. Ya podés cerrar esta página.</p>
    </div>
  </body></html>`
}
