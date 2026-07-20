// La política de contraseñas es la barrera entre una cuenta de hotel y quien
// quiera entrar a ella. Cada regla acá abajo existe porque sin ella pasa una
// contraseña que en la práctica no protege nada.
import { describe, it, expect } from 'bun:test'
import { passwordIssues, isStrongPassword, PASSWORD_MIN, PASSWORD_MAX } from '../password-policy'

describe('passwordIssues', () => {
  it('acepta una contraseña razonable', () => {
    expect(passwordIssues('MiHotel2026')).toEqual([])
    expect(isStrongPassword('CasaBlanca77')).toBe(true)
  })

  it('rechaza por longitud', () => {
    expect(passwordIssues('Abc12345')).toContain(`Debe tener al menos ${PASSWORD_MIN} caracteres`)
  })

  it('rechaza una contraseña sin mayúscula, sin minúscula o sin número', () => {
    expect(passwordIssues('minusculas123')).toContain('Debe incluir una letra mayúscula')
    expect(passwordIssues('MAYUSCULAS123')).toContain('Debe incluir una letra minúscula')
    expect(passwordIssues('SinNumerosAca')).toContain('Debe incluir un número')
  })

  it('devuelve TODOS los motivos juntos, no de a uno', () => {
    // Corregir de a un error por intento es lo que lleva a poner cualquier cosa.
    expect(passwordIssues('abc').length).toBeGreaterThan(2)
  })

  it('rechaza las de diccionario aunque cumplan la forma', () => {
    expect(passwordIssues('Password123')).toContain('Es una contraseña demasiado común')
    // Con separadores y acentos: la comparación normaliza antes de buscar.
    expect(passwordIssues('Pass-word.123')).toContain('Es una contraseña demasiado común')
  })

  it('rechaza el mismo carácter repetido, que pasa las reglas de composición', () => {
    expect(passwordIssues('AAAAAAAAAA')).toContain('No puede ser el mismo carácter repetido')
  })

  it('no permite que la contraseña sea el propio email', () => {
    const issues = passwordIssues('Recepcion2026', { email: 'recepcion@hotel.com' })
    expect(issues).toContain('No puede contener tu email')
  })

  it('no permite que contenga el nombre de la cuenta', () => {
    const issues = passwordIssues('HotelPalma22', { name: 'Hotel Palma' })
    expect(issues).toContain('No puede contener el nombre de la cuenta')
  })

  it('ignora emails y nombres muy cortos: prohibirlos vetaría media contraseña', () => {
    // Con un email como "ab@x.com", exigir que no contenga "ab" es absurdo.
    expect(passwordIssues('AbogadoLegal9', { email: 'ab@x.com' })).toEqual([])
  })

  it('pone tope al largo: hashear megabytes es un DoS barato', () => {
    const issues = passwordIssues('A1' + 'x'.repeat(PASSWORD_MAX))
    expect(issues).toContain(`No puede superar los ${PASSWORD_MAX} caracteres`)
  })

  it('no explota con null, undefined ni vacío', () => {
    expect(() => passwordIssues(undefined as unknown as string)).not.toThrow()
    expect(() => passwordIssues(null as unknown as string)).not.toThrow()
    expect(isStrongPassword('')).toBe(false)
  })
})
