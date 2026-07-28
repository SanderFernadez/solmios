// restaurant/tests/menu-items-f6-persistence.test.ts — Test de regresión del bug fix-menu-items-500.
//
// El bug: PUT /api/restaurant/menu-items/:id devolvía 500 cuando el body incluía `featured`,
// `availableFrom`, o `availableTo`. Root cause: la tabla física `menu_items` en DBs creadas
// ANTES de la feature F6 no tenía esas 3 columnas, y el ORM generaba
// `UPDATE menu_items SET featured=? ...` → SQL fallaba con "no such column".
//
// Este test valida la cadena completa con el ORM REAL (SQLite in-memory):
//   1. El modelo MenuItemModel declara los 3 campos.
//   2. orm.migrate() crea las columnas físicas.
//   3. Un create + update con esos campos persiste y se lee de vuelta.
// Si alguien quita los campos del modelo, este test revienta. Si la migración no los crea, también.
import { describe, it, expect } from 'bun:test'
import { ORM, OrmRepository } from 'arckode-framework'
import { SqliteAdapter } from 'arckode-framework/adapters/sqlite'
import { MenuItemModel, registerRestaurantModels } from '../../restaurant/model'
import type { MenuItemDTO } from '../../restaurant/types'

async function withOrm(fn: (repo: OrmRepository<MenuItemDTO>) => Promise<void>): Promise<void> {
  const db = new SqliteAdapter({ path: ':memory:', wal: false, foreignKeys: false })
  await db.connect()
  const orm = new ORM(db)
  registerRestaurantModels(orm)
  await orm.migrate()
  const repo = new OrmRepository<MenuItemDTO>(orm, 'MenuItems')
  try {
    await fn(repo)
  } finally {
    await db.close?.()
  }
}

describe('fix-menu-items-500 — modelo declara los 3 campos F6', () => {
  it('MenuItemModel.fields incluye featured/availableFrom/availableTo con el tipo correcto', () => {
    expect(MenuItemModel.fields.featured).toBeDefined()
    expect(MenuItemModel.fields.featured?.type).toBe('number')
    expect(MenuItemModel.fields.availableFrom).toBeDefined()
    expect(MenuItemModel.fields.availableFrom?.type).toBe('string')
    expect(MenuItemModel.fields.availableTo).toBeDefined()
    expect(MenuItemModel.fields.availableTo?.type).toBe('string')
  })
})

describe('fix-menu-items-500 — persistencia end-to-end con ORM real', () => {
  it('createItem con featured/availableFrom/availableTo persiste y se lee de vuelta', async () => {
    await withOrm(async (repo) => {
      const created = await repo.create({
        hotelId: 'h1',
        categoryId: 'cat1',
        name: 'Pancakes',
        price: 100,
        featured: 1,
        availableFrom: '07:00',
        availableTo: '11:00',
      } as Omit<MenuItemDTO, 'id'>)
      expect(created.featured).toBe(1)
      expect(created.availableFrom).toBe('07:00')
      expect(created.availableTo).toBe('11:00')

      const fetched = await repo.findById(created.id)
      expect(fetched?.featured).toBe(1)
      expect(fetched?.availableFrom).toBe('07:00')
      expect(fetched?.availableTo).toBe('11:00')
    })
  })

  it('UPDATE que solo toca featured persiste sin 500 (regresión del bug)', async () => {
    await withOrm(async (repo) => {
      const created = await repo.create({
        hotelId: 'h1', categoryId: 'cat1', name: 'Agua', price: 30,
      } as Omit<MenuItemDTO, 'id'>)
      const updated = await repo.update(created.id, { featured: 1 } as Partial<Omit<MenuItemDTO, 'id'>>)
      expect(updated?.featured).toBe(1)
      const fetched = await repo.findById(created.id)
      expect(fetched?.featured).toBe(1)
    })
  })

  it('UPDATE que toca availableFrom/availableTo persiste sin 500 (regresión del bug)', async () => {
    await withOrm(async (repo) => {
      const created = await repo.create({
        hotelId: 'h1', categoryId: 'cat1', name: 'Pizza', price: 200,
      } as Omit<MenuItemDTO, 'id'>)
      const updated = await repo.update(created.id, {
        availableFrom: '22:00', availableTo: '02:00',
      } as Partial<Omit<MenuItemDTO, 'id'>>)
      expect(updated?.availableFrom).toBe('22:00')
      expect(updated?.availableTo).toBe('02:00')
      const fetched = await repo.findById(created.id)
      expect(fetched?.availableFrom).toBe('22:00')
      expect(fetched?.availableTo).toBe('02:00')
    })
  })

  it('UPDATE simultáneo de los 3 campos F6 + otros (caso real del modal Editar)', async () => {
    await withOrm(async (repo) => {
      const created = await repo.create({
        hotelId: 'h1', categoryId: 'cat1', name: 'Old', price: 50,
      } as Omit<MenuItemDTO, 'id'>)
      // El modal Editar manda TODO junto: nombre, precio, destacado, horario.
      const updated = await repo.update(created.id, {
        name: 'New', price: 60, featured: 1, availableFrom: '08:00', availableTo: '12:00',
      } as Partial<Omit<MenuItemDTO, 'id'>>)
      expect(updated?.name).toBe('New')
      expect(updated?.price).toBe(60)
      expect(updated?.featured).toBe(1)
      expect(updated?.availableFrom).toBe('08:00')
      expect(updated?.availableTo).toBe('12:00')
    })
  })
})
