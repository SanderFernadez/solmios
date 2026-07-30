// landing/tests/theme-crud.test.ts — Tests del usecase theme-crud (solmi-direct-booking).
//
// Cubre los 5 acceptance criteria de la Task A + extras defensivos:
//  (a) getTheme devuelve default classic cuando no hay fila (lazy).
//  (b) setTheme round-trip: persiste + lee el mismo theme.
//  (c) listPublicBySlug incluye theme default (classic) cuando no hay fila.
//  (d) listPublicBySlug incluye theme custom cuando la fila existe.
//  (e) setTheme rechaza templateId fuera del enum → ValidationError.
//  (f) setTheme respeta ownership (merchant de hotel B no setea theme de hotel A).
//  (g) setTheme invalida caché `landing:public:${hotelId}` (Riesgo #2 del plan).
//  (h) sanitize: allow-list de colors/fonts descarta keys no conocidas (mass-assignment).
//
// Sin dependencia de SQLite/Postgres: mockeamos config/userRepo/auth/cache.
import { describe, it, expect } from 'bun:test'
import {
  getTheme, setTheme, toPublicTheme,
  LANDING_THEME_KEY, DEFAULT_THEME, PUBLIC_CACHE_KEY,
} from '../usecases/theme-crud'
import type { ThemeCrudDeps } from '../usecases/theme-crud'
import { listPublicBySlug } from '../usecases/blocks-crud'
import type { BlocksCrudDeps } from '../usecases/blocks-crud'
import type { LandingBlockDTO, LandingTheme } from '../types'

const adminUser = { id: 'u1', hotelId: 'h1', role: 'hotel_admin', userType: 'merchant' } as any

/** Mock mínimo de ThemeCrudDeps. `overrides` por caso. */
function makeThemeDeps(overrides: Partial<ThemeCrudDeps> & { existingRow?: any } = {}): ThemeCrudDeps {
  const existingRow = overrides.existingRow ?? null
  const store: any[] = existingRow ? [{ ...existingRow }] : []
  return {
    config: {
      findMany: async (_f: any) => store.filter((r) => r.key === LANDING_THEME_KEY),
      findOne: async () => store[0] ?? null,
      create: async (data: any) => { store.push({ ...data }); return { ...data } },
      update: async (id: string, patch: any) => {
        const i = store.findIndex((r) => r.id === id)
        if (i >= 0) Object.assign(store[i], patch)
        return store[i] ?? null
      },
    } as any,
    userRepo: { findOne: async () => ({ hotelId: 'h1' }) } as any,
    auth: { assertOwnership: () => {} } as any,
    cache: { delete: async () => {} } as any,
    ...overrides,
  }
}

/** Mock mínimo de BlocksCrudDeps para los tests de listPublicBySlug. */
function makeBlocksDeps(overrides: Partial<BlocksCrudDeps> & { themeRow?: any; blocks?: LandingBlockDTO[] } = {}): BlocksCrudDeps {
  const hotel = { id: 'h1', slug: 'mi-hotel', onlineBookingStatus: 'active' }
  const themeRow = overrides.themeRow ?? null
  const themeStore: any[] = themeRow ? [{ ...themeRow }] : []
  const blocks = overrides.blocks ?? [
    { id: 'b1', hotelId: 'h1', type: 'hero', config: { title: 'Hero' }, sortOrder: 0, active: true, createdAt: '', updatedAt: '' },
  ]
  return {
    blocks: {
      findMany: async () => blocks,
      findOne: async () => null,
      create: async (d: any) => d,
      update: async () => null,
    } as any,
    hotels: { findOne: async () => hotel } as any,
    userRepo: { findOne: async () => ({ hotelId: 'h1' }) } as any,
    config: {
      findMany: async (_f: any) => themeStore.filter((r) => r.key === LANDING_THEME_KEY),
      findOne: async () => null,
      create: async () => null,
      update: async () => null,
    } as any,
    auth: { assertOwnership: () => {} } as any,
    transactor: { transaction: async (fn: (tx: any) => Promise<any>) => fn({ deleteMany: async () => 0, createMany: async () => [] }) },
    ...overrides,
  }
}

// ─── (a) getTheme: default lazy ─────────────────────────────────────────────
describe('getTheme', () => {
  it('devuelve {templateId:"classic"} cuando no hay fila (default lazy)', async () => {
    const deps = makeThemeDeps() // store vacío
    const theme = await getTheme(deps, 'h1')
    expect(theme).toEqual(DEFAULT_THEME)
    expect(theme.templateId).toBe('classic')
    expect(theme.colors).toBeUndefined()
    expect(theme.fonts).toBeUndefined()
  })

  it('lee el theme persistido (templateId modern + colors + fonts)', async () => {
    const persisted = {
      templateId: 'boutique',
      colors: { navy: '#4A1D1D', gold: '#B7950B' },
      fonts: { heading: 'Playfair Display' },
    } as LandingTheme
    const deps = makeThemeDeps({
      existingRow: { id: 'c1', hotelId: 'h1', key: LANDING_THEME_KEY, value: JSON.stringify(persisted) },
    })
    const theme = await getTheme(deps, 'h1')
    expect(theme).toEqual(persisted)
  })

  it('cae a default classic si la fila está corrupta (templateId fuera de enum)', async () => {
    const deps = makeThemeDeps({
      existingRow: { id: 'c1', hotelId: 'h1', key: LANDING_THEME_KEY, value: JSON.stringify({ templateId: 'inventado' }) },
    })
    const theme = await getTheme(deps, 'h1')
    expect(theme.templateId).toBe('classic')
  })
})

// ─── (b) setTheme: round-trip + persistencia ────────────────────────────────
describe('setTheme (round-trip)', () => {
  it('persiste y el round-trip getTheme→setTheme→getTheme devuelve lo mismo', async () => {
    const deps = makeThemeDeps()
    const input = {
      templateId: 'modern' as const,
      colors: { navy: '#0F766E', cyan: '#F97316' },
      fonts: { body: 'Inter' },
    }
    const saved = await setTheme(deps, 'h1', input, adminUser)
    expect(saved).toEqual(input)
    // Re-leer: store tiene la fila, getTheme la parsea.
    const reRead = await getTheme(deps, 'h1')
    expect(reRead).toEqual(input)
  })

  it('inserta nueva fila si no existe; update si ya existe (no duplica)', async () => {
    let creates = 0
    let updates = 0
    const deps = makeThemeDeps({
      existingRow: { id: 'c-fixed', hotelId: 'h1', key: LANDING_THEME_KEY, value: JSON.stringify({ templateId: 'classic' }) },
      config: {
        findMany: async () => [{ id: 'c-fixed', hotelId: 'h1', key: LANDING_THEME_KEY, value: JSON.stringify({ templateId: 'classic' }) }],
        findOne: async () => null,
        create: async (d: any) => { creates++; return d },
        update: async () => { updates++; return null },
      } as any,
    })
    await setTheme(deps, 'h1', { templateId: 'boutique' }, adminUser)
    expect(creates).toBe(0)
    expect(updates).toBe(1)
  })
})

// ─── (e) schema / templateId inválido ───────────────────────────────────────
describe('setTheme (validación)', () => {
  it('rechaza templateId fuera del enum con ValidationError', async () => {
    const deps = makeThemeDeps()
    await expect(
      setTheme(deps, 'h1', { templateId: 'pixel-art' }, adminUser),
    ).rejects.toThrow(/templateId debe ser uno de/)
  })

  it('rechaza colors con formato no-hex (defensa de sanitize)', async () => {
    const deps = makeThemeDeps()
    await expect(
      setTheme(deps, 'h1', { templateId: 'classic', colors: { navy: 'not-a-color' } }, adminUser),
    ).rejects.toThrow(/colors\.navy debe ser/)
  })

  it('descarta silenciosamente keys no conocidas en colors (allow-list / mass-assignment)', async () => {
    const deps = makeThemeDeps()
    const saved = await setTheme(deps, 'h1', {
      templateId: 'classic',
      // 'navy' válido + 'malicious' no debe pasar.
      colors: { navy: '#0D2B4E', malicious: '#000000' } as any,
    }, adminUser)
    expect(saved.colors).toEqual({ navy: '#0D2B4E' })
    expect((saved.colors as any)?.malicious).toBeUndefined()
  })
})

// ─── (f) ownership ──────────────────────────────────────────────────────────
describe('setTheme (ownership)', () => {
  it('merchant de hotel B no puede setear theme del hotel A', async () => {
    const deps = makeThemeDeps({
      userRepo: { findOne: async () => ({ hotelId: 'h-B' }) } as any,
      auth: {
        assertOwnership: (resourceHotel: string, userHotel: string) => {
          if (resourceHotel !== userHotel) throw new Error('Ownership error')
        },
      } as any,
    })
    await expect(
      setTheme(deps, 'h-A', { templateId: 'classic' }, { ...adminUser, hotelId: 'h-B' } as any),
    ).rejects.toThrow('Ownership')
  })
})

// ─── (g) cache invalidation ─────────────────────────────────────────────────
describe('setTheme (cache)', () => {
  it('invalida `landing:public:${hotelId}` (Riesgo #2 del plan)', async () => {
    const deletedKeys: string[] = []
    const deps = makeThemeDeps({
      cache: { delete: async (k: string) => { deletedKeys.push(k) } } as any,
    })
    await setTheme(deps, 'h1', { templateId: 'modern' }, adminUser)
    expect(deletedKeys).toEqual([PUBLIC_CACHE_KEY('h1')])
  })

  it('no revienta si el cache está ausente (sin adapter)', async () => {
    const deps = makeThemeDeps({ cache: undefined })
    await expect(setTheme(deps, 'h1', { templateId: 'modern' }, adminUser)).resolves.toBeTruthy()
  })
})

// ─── (c) y (d) listPublicBySlug incluye theme ───────────────────────────────
describe('listPublicBySlug (theme en response)', () => {
  it('incluye theme default classic cuando no hay fila', async () => {
    const deps = makeBlocksDeps() // sin themeRow
    const { data, theme } = await listPublicBySlug(deps, 'mi-hotel')
    expect(data).toHaveLength(1)
    expect(theme).toEqual({ templateId: 'classic' })
  })

  it('incluye theme custom cuando la fila existe', async () => {
    const customTheme = {
      templateId: 'boutique',
      colors: { navy: '#4A1D1D' },
      fonts: { heading: 'Playfair Display' },
    } as LandingTheme
    const deps = makeBlocksDeps({
      themeRow: { id: 'c1', hotelId: 'h1', key: LANDING_THEME_KEY, value: JSON.stringify(customTheme) },
    })
    const { theme } = await listPublicBySlug(deps, 'mi-hotel')
    expect(theme).toEqual(customTheme)
  })

  it('el theme público NO incluye hotelId ni keys internas (allow-list)', async () => {
    const deps = makeBlocksDeps({
      themeRow: {
        id: 'c1', hotelId: 'h1', key: LANDING_THEME_KEY,
        value: JSON.stringify({ templateId: 'modern', colors: { navy: '#0F766E' } }),
      },
    })
    const { theme } = await listPublicBySlug(deps, 'mi-hotel')
    expect((theme as any).hotelId).toBeUndefined()
    expect((theme as any).id).toBeUndefined()
    expect((theme as any).key).toBeUndefined()
    expect(theme.templateId).toBe('modern')
    expect(theme.colors?.navy).toBe('#0F766E')
  })
})

// ─── toPublicTheme (cobertura unitaria del helper) ──────────────────────────
describe('toPublicTheme', () => {
  it('construye allow-list sin hotelId ni metadata', () => {
    const publicTheme = toPublicTheme({
      templateId: 'classic',
      colors: { navy: '#0D2B4E' },
      fonts: { heading: 'Inter' },
    })
    expect(publicTheme).toEqual({
      templateId: 'classic',
      colors: { navy: '#0D2B4E' },
      fonts: { heading: 'Inter' },
    })
    expect(Object.keys(publicTheme).sort()).toEqual(['colors', 'fonts', 'templateId'])
  })
})
