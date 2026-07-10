// El texto de una incidencia no puede ser infinito: viaja al título del ticket,
// a la notificación y a las notas de la tarea.

import { describe, it, expect } from 'bun:test'
import { validateSchema } from '../../../shared/validators/validate-body'
import { ReportIssueSchema, REPORT_DESCRIPTION_MAX } from '../validators/schema'

const ok = (body: unknown) => validateSchema(ReportIssueSchema, body)

describe('ReportIssueSchema', () => {
  it('acepta una descripción normal', () => {
    expect(ok({ description: 'La ducha pierde agua', type: 'maintenance' })).toBeTruthy()
  })

  it(`acepta exactamente ${REPORT_DESCRIPTION_MAX} caracteres`, () => {
    expect(ok({ description: 'a'.repeat(REPORT_DESCRIPTION_MAX) })).toBeTruthy()
  })

  // Antes `/report` solo comprobaba que el campo existiera.
  it('rechaza un caracter de más', () => {
    expect(() => ok({ description: 'a'.repeat(REPORT_DESCRIPTION_MAX + 1) })).toThrow()
  })

  it('rechaza una descripción vacía o de un caracter', () => {
    expect(() => ok({ description: '' })).toThrow()
    expect(() => ok({ description: 'a' })).toThrow()
  })

  it('rechaza que falte la descripción', () => {
    expect(() => ok({ type: 'maintenance' })).toThrow()
  })

  it('solo acepta los destinatarios conocidos', () => {
    expect(ok({ description: 'algo roto', type: 'supervisor' })).toBeTruthy()
    expect(() => ok({ description: 'algo roto', type: 'ceo' })).toThrow()
  })
})
