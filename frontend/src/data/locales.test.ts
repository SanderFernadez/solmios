// El catálogo alimenta tres formularios y, desde que tiene código ISO, también
// el prefijo y el formato del teléfono. Un código mal puesto no rompe el build:
// hace que el input de teléfono ofrezca el prefijo de otro país.
//
// Los códigos se derivaron con Intl.DisplayNames en vez de escribirse a mano;
// este test es el que comprueba que la derivación quedó bien.
import { describe, it, expect } from 'vitest'
import { getCountries, getCountryCallingCode } from 'libphonenumber-js'
import type { CountryCode } from 'libphonenumber-js'
import { COUNTRIES, NATIONALITIES, COUNTRY_ENTRIES, countryCode } from './locales'

describe('catálogo de países', () => {
  it('países y nacionalidades quedan alineados 1:1', () => {
    // Antes eran dos arrays paralelos: agregar un país sin su gentilicio corría
    // todos los índices siguientes y desplazaba las nacionalidades.
    expect(COUNTRIES.length).toBe(NATIONALITIES.length)
    expect(COUNTRIES.length).toBe(COUNTRY_ENTRIES.length)
  })

  it('no hay países repetidos', () => {
    expect(new Set(COUNTRIES).size).toBe(COUNTRIES.length)
  })

  it('cubre el mundo, no solo el Caribe', () => {
    // El catálogo arrancó con 32 países y el producto se vende internacional.
    expect(COUNTRIES.length).toBeGreaterThan(190)
    for (const c of ['Portugal', 'Grecia', 'Marruecos', 'Tailandia', 'India', 'Sudáfrica']) {
      expect(COUNTRIES).toContain(c)
    }
  })

  it('conserva los valores que ya están guardados en huéspedes', () => {
    // Sacar uno dejaría a ese huésped con un país fuera del catálogo.
    for (const c of ['República Dominicana', 'Estados Unidos', 'España', 'Corea del Sur', 'Otros']) {
      expect(COUNTRIES).toContain(c)
    }
    expect(NATIONALITIES).toContain('Coreana')
  })

  it('cada país (salvo "Otros") tiene un código ISO que libphonenumber reconoce', () => {
    const known = new Set<string>(getCountries())
    const malos: string[] = []
    for (const entry of COUNTRY_ENTRIES) {
      if (entry.name === 'Otros') continue
      if (!/^[A-Z]{2}$/.test(entry.code) || !known.has(entry.code)) malos.push(`${entry.name} → "${entry.code}"`)
    }
    expect(malos).toEqual([])
  })

  it('el código apunta al país correcto, no a otro', () => {
    // Verificación independiente de cómo se generaron: se traduce el código de
    // vuelta a español con Intl y se compara con el nombre del catálogo.
    //
    // El catálogo usa el nombre de uso corriente y Intl a veces devuelve el
    // oficial. Cada equivalencia se lista explícitamente en vez de aflojar la
    // comparación: si mañana un código apunta a otro país, el test tiene que
    // gritar igual.
    const ALIAS: Record<string, string> = {
      CI: 'Costa de Marfil',   // Intl: "Côte d’Ivoire"
      PS: 'Palestina',         // Intl: "Territorios Palestinos"
      CZ: 'República Checa',   // Intl: "Chequia"
    }
    const dn = new Intl.DisplayNames(['es'], { type: 'region' })
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const desalineados: string[] = []
    for (const entry of COUNTRY_ENTRIES) {
      if (!entry.code) continue
      if (ALIAS[entry.code]) {
        // El alias fija el par código↔nombre esperado.
        if (ALIAS[entry.code] !== entry.name) desalineados.push(`${entry.name} → ${entry.code} (alias esperaba "${ALIAS[entry.code]}")`)
        continue
      }
      const oficial = dn.of(entry.code)
      if (!oficial) continue
      const a = norm(oficial).split(' ')[0]
      const b = norm(entry.name).split(' ')[0]
      if (a !== b && !norm(oficial).includes(b) && !norm(entry.name).includes(a)) {
        desalineados.push(`${entry.name} → ${entry.code} (${oficial})`)
      }
    }
    expect(desalineados).toEqual([])
  })

  it('cada código tiene prefijo telefónico', () => {
    for (const entry of COUNTRY_ENTRIES) {
      if (!entry.code) continue
      expect(() => getCountryCallingCode(entry.code as CountryCode)).not.toThrow()
    }
  })

  it('countryCode resuelve por nombre y no inventa para lo desconocido', () => {
    expect(countryCode('España')).toBe('ES')
    expect(countryCode('República Dominicana')).toBe('DO')
    expect(countryCode('Otros')).toBeUndefined()
    expect(countryCode('Wakanda')).toBeUndefined()
    expect(countryCode('')).toBeUndefined()
  })
})
