// landing/tests/blocks-crud.test.ts — Tests de los usecases de landing_blocks (F1).
//
// Cubre los 4 acceptance criteria de la task 1.3 + comportamiento del seeder (1.2):
//  (a) upsert atómico: reemplaza config + orden en una sola transacción.
//  (b) toggle: cambia `active`.
//  (c) listByHotel: ordena por sortOrder Y dispara seeder lazy en hotel nuevo (10 defaults).
//  (d) ownership: bloque de hotel ajeno → error antes de mutar.
//
// Sin dependencia de SQLite/Postgres: mockeamos los repos y el orm.transaction. El
// callback de transaction se ejecuta síncrono pasando un mock `tx` que graba las
// llamadas (deleteMany + createMany) para asertar atomicidad.
import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import {
  listByHotel, upsert, toggle, seedDefaults, listPublicBySlug,
} from '../usecases/blocks-crud'
import type { BlocksCrudDeps } from '../usecases/blocks-crud'
import type { LandingBlockDTO } from '../types'
import { BLOCK_TYPES, DEFAULT_SORT_ORDER } from '../types'
import { defaultConfigFor } from '../usecases/defaults'

const log = silentLogger()

/** Construye deps con mocks. `overrides` permite customizar cada repo para el caso. */
function makeDeps(overrides: Partial<BlocksCrudDeps> & { txMock?: any } = {}): BlocksCrudDeps {
  const created: any[] = []
  const txMock = overrides.txMock ?? {
    deleteMany: async () => 0,
    createMany: async (_model: string, records: any[]) => {
      created.length = 0
      for (const r of records) created.push({ ...r })
      return created
    },
  }
  const transactor = {
    transaction: async (fn: (tx: any) => Promise<any>) => fn(txMock),
  }
  return {
    blocks: {
      findMany: async () => [],
      findById: async () => null,
      findOne: async () => null,
      create: async (data: any) => ({ id: 'auto-' + Math.random().toString(36).slice(2), ...data }) as LandingBlockDTO,
      update: async () => null,
      delete: async () => true,
      count: async () => 0,
      paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    } as any,
    hotels: { findOne: async () => null, findMany: async () => [] } as any,
    userRepo: { findOne: async () => ({ hotelId: 'h1' }) } as any,
    config: { findMany: async () => [], findOne: async () => null, create: async () => null, update: async () => null } as any,
    auth: { assertOwnership: () => {} } as any,
    transactor,
    ...overrides,
  }
}

const adminUser = { id: 'u1', hotelId: 'h1', role: 'hotel_admin', userType: 'merchant' } as any

// ─── (c) listByHotel: ordena por sortOrder y dispara seeder lazy ─────────────
describe('listByHotel', () => {
  it('ordena los bloques por sortOrder ASC', async () => {
    const unsorted: LandingBlockDTO[] = [
      { id: 'b1', hotelId: 'h1', type: 'footer', config: null, sortOrder: 8, active: true, createdAt: '', updatedAt: '' },
      { id: 'b2', hotelId: 'h1', type: 'hero', config: null, sortOrder: 0, active: true, createdAt: '', updatedAt: '' },
      { id: 'b3', hotelId: 'h1', type: 'rooms', config: null, sortOrder: 3, active: true, createdAt: '', updatedAt: '' },
    ]
    const deps = makeDeps({
      blocks: { ...(makeDeps().blocks!), findMany: async () => unsorted } as any,
    })
    const { data, total } = await listByHotel(deps, 'h1', adminUser)
    expect(total).toBe(3)
    expect(data.map((b) => b.type)).toEqual(['hero', 'rooms', 'footer'])
  })

  it('dispara el seeder lazy en hotel nuevo y devuelve los 10 defaults', async () => {
    let calls = 0
    let seeded: LandingBlockDTO[] = []
    const baseBlocks = makeDeps().blocks!
    const deps = makeDeps({
      blocks: {
        ...baseBlocks,
        findMany: async () => {
          calls++
          // Primera llamada: vacío (triggers seeder). Segunda: devuelve los 10 seeded.
          return calls === 1 ? [] : seeded
        },
        create: async (data: any) => {
          const b = { id: `auto-${data.type}`, ...data } as LandingBlockDTO
          seeded.push(b)
          return b
        },
      } as any,
    })
    const { data, total } = await listByHotel(deps, 'h-new', adminUser)
    expect(total).toBe(10)
    expect(data).toHaveLength(10)
    // Los 10 types están presentes.
    for (const t of BLOCK_TYPES) {
      expect(data.some((b) => b.type === t)).toBe(true)
    }
    // El orden respeta DEFAULT_SORT_ORDER.
    expect(data.map((b) => b.type)).toEqual(
      BLOCK_TYPES.slice().sort((a, b) => DEFAULT_SORT_ORDER[a] - DEFAULT_SORT_ORDER[b]),
    )
    // Todos vienen con active=true y su config default.
    for (const b of data) {
      expect(b.active).toBe(true)
      expect(b.config).toEqual(defaultConfigFor(b.type))
    }
  })

  it('rechaza si el user es de otro hotel (ownership)', async () => {
    const deps = makeDeps({
      userRepo: { findOne: async () => ({ hotelId: 'h2' }) } as any,
      auth: {
        assertOwnership: (_r: string, userHotel: string) => {
          if (_r !== userHotel) throw new Error('Ownership error')
        },
      } as any,
    })
    await expect(listByHotel(deps, 'h1', adminUser)).rejects.toThrow('Ownership')
  })
})

// ─── (a) upsert atómico: delete-all + insert-all en una sola tx ──────────────
describe('upsert', () => {
  it('reemplaza config + orden atómicamente (deleteMany + createMany en la misma tx)', async () => {
    const txCalls: any[] = []
    const txMock = {
      deleteMany: async (model: string, filters: any) => {
        txCalls.push({ op: 'deleteMany', model, filters })
        return 10 // simula que borró los 10 anteriores
      },
      createMany: async (model: string, records: any[]) => {
        txCalls.push({ op: 'createMany', model, count: records.length })
        return records.map((r) => ({ ...r }))
      },
    }
    const deps = makeDeps({ txMock })

    const inputs = [
      { type: 'hero' as const, config: { title: 'Nuevo hero' }, sortOrder: 5, active: true },
      { type: 'faq' as const, config: { title: 'FAQ', items: [{ q: 'hora?', a: '15:00' }] }, sortOrder: 0, active: false },
    ]
    const result = await upsert(deps, 'h1', inputs, adminUser)

    // El callback de la tx se llamó UNA vez, y adentro: 1 deleteMany + 1 createMany.
    expect(txCalls).toEqual([
      { op: 'deleteMany', model: 'LandingBlocks', filters: { hotelId: 'h1' } },
      { op: 'createMany', model: 'LandingBlocks', count: 2 },
    ])
    // Los registros insertados reflejan el payload del admin (no los defaults).
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('hero')
    expect(result[0].config).toEqual({ title: 'Nuevo hero' })
    expect(result[0].sortOrder).toBe(5)
    expect(result[1].type).toBe('faq')
    expect(result[1].active).toBe(false)
    expect(result[1].sortOrder).toBe(0)
  })

  it('valida ANTES de abrir la tx: type fuera del enum → error y no toca la tabla', async () => {
    let txOpened = false
    const deps = makeDeps({
      transactor: { transaction: async () => { txOpened = true; throw new Error('no debería entrar') } } as any,
    })
    await expect(
      upsert(deps, 'h1', [{ type: 'bloque-inventado' as any, config: {}, sortOrder: 0, active: true }], adminUser),
    ).rejects.toThrow(/type debe ser uno de/)
    expect(txOpened).toBe(false)
  })

  it('valida ANTES de abrir la tx: type duplicado en el payload → error y no toca la tabla', async () => {
    let txOpened = false
    const deps = makeDeps({
      transactor: { transaction: async () => { txOpened = true; throw new Error('no debería entrar') } } as any,
    })
    await expect(
      upsert(deps, 'h1', [
        { type: 'hero', config: {}, sortOrder: 0, active: true },
        { type: 'hero', config: {}, sortOrder: 1, active: true },
      ], adminUser),
    ).rejects.toThrow(/duplicado/)
    expect(txOpened).toBe(false)
  })

  it('aplica sortOrder y active defaults si el input no los trae', async () => {
    const deps = makeDeps()
    const result = await upsert(deps, 'h1', [{ type: 'hero' }], adminUser)
    expect(result[0].sortOrder).toBe(DEFAULT_SORT_ORDER.hero)
    expect(result[0].active).toBe(true)
  })
})

// ─── (b) toggle ─────────────────────────────────────────────────────────────
describe('toggle', () => {
  it('cambia `active` del bloque y devuelve el actualizado', async () => {
    const existing: LandingBlockDTO = {
      id: 'b1', hotelId: 'h1', type: 'reviews', config: null,
      sortOrder: 4, active: true, createdAt: '', updatedAt: '',
    }
    const deps = makeDeps({
      blocks: {
        findOne: async () => existing,
        update: async (id: string, data: any) => ({ ...existing, ...data } as LandingBlockDTO),
      } as any,
    })
    const result = await toggle(deps, 'b1', false, adminUser)
    expect(result.active).toBe(false)
  })

  it('404 si el bloque no existe', async () => {
    const deps = makeDeps({
      blocks: { findOne: async () => null } as any,
    })
    await expect(toggle(deps, 'no-existe', true, adminUser)).rejects.toThrow(/no encontrado/i)
  })

  it('rechaza si el bloque es de otro hotel (ownership)', async () => {
    const existing: LandingBlockDTO = {
      id: 'b1', hotelId: 'h-otro', type: 'hero', config: null,
      sortOrder: 0, active: true, createdAt: '', updatedAt: '',
    }
    const deps = makeDeps({
      blocks: { findOne: async () => existing } as any,
      userRepo: { findOne: async () => ({ hotelId: 'h1' }) } as any,
      auth: {
        assertOwnership: (resourceHotel: string, userHotel: string) => {
          if (resourceHotel !== userHotel) throw new Error('Ownership error')
        },
      } as any,
    })
    await expect(toggle(deps, 'b1', false, adminUser)).rejects.toThrow('Ownership')
  })
})

// ─── seedDefaults (cobertura extra del seeder 1.2) ───────────────────────────
describe('seedDefaults', () => {
  it('inserta los 10 bloques con active=true y config default', async () => {
    const inserted: any[] = []
    const deps = makeDeps({
      blocks: {
        findOne: async () => null, // ninguno existe todavía
        create: async (data: any) => { inserted.push(data); return data },
      } as any,
    })
    await seedDefaults(deps, 'h-new')
    expect(inserted).toHaveLength(10)
    const types = inserted.map((b) => b.type)
    for (const t of BLOCK_TYPES) expect(types).toContain(t)
    for (const b of inserted) {
      expect(b.active).toBe(true)
      expect(b.sortOrder).toBe(DEFAULT_SORT_ORDER[b.type as keyof typeof DEFAULT_SORT_ORDER])
      expect(b.config).toEqual(defaultConfigFor(b.type))
      expect(b.hotelId).toBe('h-new')
    }
  })

  it('es idempotente: si el hotel ya tiene un bloque, no lo pisa', async () => {
    const inserted: any[] = []
    const existingHero: LandingBlockDTO = {
      id: 'b-hero', hotelId: 'h1', type: 'hero', config: { title: 'Hero custom' },
      sortOrder: 0, active: false, createdAt: '', updatedAt: '',
    }
    const deps = makeDeps({
      blocks: {
        findOne: async (filters: any) => (filters.type === 'hero' ? existingHero : null),
        create: async (data: any) => { inserted.push(data); return data },
      } as any,
    })
    await seedDefaults(deps, 'h1')
    // Inserta los 9 faltantes (todos menos hero).
    expect(inserted).toHaveLength(9)
    expect(inserted.find((b) => b.type === 'hero')).toBeUndefined()
  })
})

// ─── defaultConfigFor — nuevos types/shapes (hero.searchBar, trust-badges, rooms badge) ──
describe('defaultConfigFor — nuevos shapes', () => {
  it('trust-badges trae los 5 items default', () => {
    const config = defaultConfigFor('trust-badges')
    expect(config.items).toHaveLength(5)
    expect((config.items as any[]).every((i) => typeof i.icon === 'string' && typeof i.text === 'string')).toBe(true)
  })

  it('hero incluye searchBar deshabilitado por default', () => {
    const config = defaultConfigFor('hero')
    expect(config.searchBar).toEqual({ enabled: false, ctaText: 'Buscar disponibilidad' })
  })

  it('rooms incluye featuredRoomId null por default (el admin lo setea manualmente)', () => {
    const config = defaultConfigFor('rooms')
    expect(config.featuredRoomId).toBeNull()
    expect(config.featuredBadgeText).toBe('Más reservada')
    expect(config.showSpecs).toBe(true)
  })
})

// ─── listPublicBySlug ────────────────────────────────────────────────────────
describe('listPublicBySlug', () => {
  it('404 si el hotel no existe o no tiene bookingStatus=active', async () => {
    const deps = makeDeps({
      hotels: { findOne: async () => null } as any,
    })
    await expect(listPublicBySlug(deps, 'slug-inexistente')).rejects.toThrow(/no encontrado/i)
  })

  it('filtra active=false y omite hotelId/active del DTO público', async () => {
    const hotel = { id: 'h1', slug: 'mi-hotel', onlineBookingStatus: 'active' }
    const blocks: LandingBlockDTO[] = [
      { id: 'b1', hotelId: 'h1', type: 'hero', config: { title: 'Hero' }, sortOrder: 0, active: true, createdAt: '', updatedAt: '' },
      { id: 'b2', hotelId: 'h1', type: 'reviews', config: { title: 'Reviews' }, sortOrder: 4, active: false, createdAt: '', updatedAt: '' },
      { id: 'b3', hotelId: 'h1', type: 'faq', config: { title: 'FAQ' }, sortOrder: 6, active: true, createdAt: '', updatedAt: '' },
    ]
    const deps = makeDeps({
      hotels: { findOne: async () => hotel } as any,
      blocks: { findMany: async () => blocks } as any,
    })
    const { data } = await listPublicBySlug(deps, 'mi-hotel')
    expect(data.map((b) => b.type)).toEqual(['hero', 'faq']) // reviews quedó fuera
    // DTO público NO expone hotelId ni active (spec lines 144-147).
    for (const b of data) {
      expect((b as any).hotelId).toBeUndefined()
      expect((b as any).active).toBeUndefined()
    }
  })
})
