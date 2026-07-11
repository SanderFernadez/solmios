// capacitacion/tests/emails.test.ts — El correo de inscripción escapa y solo deja links http(s).

import { describe, it, expect } from 'bun:test'
import { buildEnrollmentEmail } from '../usecases/emails'

describe('buildEnrollmentEmail', () => {
  it('incluye el material y el link de confirmación', () => {
    const { subject, html } = buildEnrollmentEmail({
      employeeName: 'María', courseName: 'Manejo de alimentos',
      materialUrl: 'https://cursos.com/video', confirmUrl: 'https://hotel.zx89.site/api/training/confirm/tok',
    })
    expect(subject).toContain('Manejo de alimentos')
    expect(html).toContain('https://cursos.com/video')
    expect(html).toContain('Ya completé el curso')
    expect(html).toContain('María')
  })

  it('sin confirmUrl, dice que avise a RRHH (no rompe)', () => {
    const { html } = buildEnrollmentEmail({ employeeName: 'Ana', courseName: 'C', materialUrl: null, confirmUrl: null })
    expect(html).toContain('Recursos Humanos')
  })

  it('rechaza URLs no http (javascript:) y escapa el HTML del nombre/curso', () => {
    const { html } = buildEnrollmentEmail({ employeeName: '<b>hack', courseName: '<script>', materialUrl: 'javascript:alert(1)' })
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;b&gt;hack')
  })
})
