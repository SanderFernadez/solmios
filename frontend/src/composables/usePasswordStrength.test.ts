// Espejo de backend/src/shared/password-policy.ts. Si estos tests y los del
// backend dejan de coincidir, el formulario acepta contraseñas que el servidor
// rechaza (o al revés) y el alta falla recién al apretar el botón.
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { usePasswordStrength, PASSWORD_MIN } from './usePasswordStrength'

function check(pwd: string, ctx: { email?: string; name?: string } = {}) {
  const password = ref(pwd)
  return usePasswordStrength(password, () => ctx)
}

describe('usePasswordStrength', () => {
  it('en blanco no marca nada como cumplido: no recibe con tildes verdes', () => {
    const { isValid, score, label } = check('')
    expect(isValid.value).toBe(false)
    expect(score.value).toBe(0)
    expect(label.value).toBe('')
  })

  it('acepta una contraseña que cumple todo', () => {
    const { isValid } = check('MiHotel2026')
    expect(isValid.value).toBe(true)
  })

  it('marca qué requisito falta, no solo que falla', () => {
    const { requirements } = check('minusculas123')
    const mayus = requirements.value.find((r) => r.label === 'Una letra mayúscula')
    expect(mayus?.met).toBe(false)
    // Los demás sí están: el checklist tiene que mostrar avance parcial.
    expect(requirements.value.find((r) => r.label === 'Un número')?.met).toBe(true)
  })

  it(`exige ${PASSWORD_MIN} caracteres`, () => {
    expect(check('Abc12345').isValid.value).toBe(false)   // 8
    expect(check('Abc123456').isValid.value).toBe(false)  // 9
    expect(check('Abc1234567').isValid.value).toBe(true)  // 10
  })

  it('rechaza las comunes y el carácter repetido', () => {
    expect(check('Password123').isValid.value).toBe(false)
    expect(check('AAAAAAAAAA').isValid.value).toBe(false)
  })

  it('rechaza que contenga el email o el nombre del hotel', () => {
    expect(check('Recepcion2026', { email: 'recepcion@hotel.com' }).isValid.value).toBe(false)
    expect(check('HotelPalma22', { name: 'Hotel Palma' }).isValid.value).toBe(false)
  })

  it('una contraseña larga puntúa más alto que uno que cumple al mínimo', () => {
    const corta = check('Abc1234567')
    const larga = check('CaballoAzulSalta2026')
    expect(larga.score.value).toBeGreaterThan(corta.score.value)
    expect(larga.label.value).toBe('Excelente')
  })

  it('el color de la barra acompaña al score y usa tokens que existen', () => {
    const ok = ['bg-danger', 'bg-warning', 'bg-cyan', 'bg-success', 'bg-border']
    expect(ok).toContain(check('abc').barClass.value)
    expect(check('CaballoAzulSalta2026').barClass.value).toBe('bg-success')
  })

  it('es reactivo: al escribir se recalcula', () => {
    const password = ref('abc')
    const { isValid } = usePasswordStrength(password)
    expect(isValid.value).toBe(false)
    password.value = 'MiHotel2026'
    expect(isValid.value).toBe(true)
  })
})
