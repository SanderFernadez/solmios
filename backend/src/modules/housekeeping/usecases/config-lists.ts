// config-lists.ts — Usecase: Photo Requirements y Supply Lists
import type { RepositoryAdapter, Logger } from 'arckode-framework'

export interface PhotoRequirement {
  id: string
  areaId: string
  areaName: string
  icon: string
  required: boolean
  tipText: string
  roomType: string
  active: boolean
  hotelId: string
}

export interface SupplyItem {
  id: string
  roomType: string
  name: string
  quantity: number
  unit: string
  hotelId: string
}

export interface ChecklistItem {
  id: string
  hotelId: string
  roomType: string
  text: string
  sortOrder: number
  active: boolean
}

export class ConfigListsUseCase {
  constructor(
    private readonly photoReqRepo: RepositoryAdapter<PhotoRequirement>,
    private readonly supplyRepo: RepositoryAdapter<SupplyItem>,
    private readonly logger: Logger,
    private readonly checklistRepo?: RepositoryAdapter<ChecklistItem>,
  ) {}

  // Lista por defecto cuando el hotel todavía no configuró su checklist. El
  // admin la sobrescribe. Sin esto la camarera no tendría ítems que revisar.
  private defaultChecklist(hotelId: string): ChecklistItem[] {
    const items = [
      'Papel higiénico y amenities',
      'A/C funcionando',
      'TV y control remoto',
      'Cortinas sin manchas',
      'Basureros vacíos',
      'Sábanas sin arrugas',
      'Baño desinfectado',
    ]
    return items.map((text, i) => ({
      id: `default-check-${i}`,
      hotelId,
      roomType: 'all',
      text,
      sortOrder: i,
      active: true,
    }))
  }

  async getChecklist(hotelId: string, roomType?: string): Promise<ChecklistItem[]> {
    if (!this.checklistRepo) return this.defaultChecklist(hotelId)
    const filters: Record<string, unknown> = { hotelId, active: 1 }
    if (roomType) filters.roomType = roomType
    const rows = await this.checklistRepo.findMany(filters)
    const list = rows.length > 0 ? rows : this.defaultChecklist(hotelId)
    return [...list]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((r) => ({ ...r, active: true }))
  }

  // Reemplaza la lista completa del (hotel, roomType): borra e inserta, igual
  // que supply-lists. Permite ítems libres y reordenar sin dejar huérfanos.
  async upsertChecklist(hotelId: string, roomType: string, items: Partial<ChecklistItem>[]): Promise<ChecklistItem[]> {
    if (!this.checklistRepo) return []
    const existing = await this.checklistRepo.findMany({ hotelId, roomType })
    for (const item of existing) await this.checklistRepo.delete(item.id)
    const results: ChecklistItem[] = []
    let order = 0
    for (const item of items) {
      const text = (item.text ?? '').trim()
      if (!text) continue
      const created = await this.checklistRepo.create({
        hotelId, roomType, text, sortOrder: order++, active: 1,
      } as any)
      results.push({ ...created, active: true })
    }
    return results
  }

  // Set por defecto cuando el hotel todavía no configuró sus fotos requeridas.
  // El admin puede sobrescribirlo (upsert). Sin esto, la camarera no tendría
  // ninguna foto que subir hasta que alguien configure.
  private defaultRequirements(hotelId: string): PhotoRequirement[] {
    const base = [
      { areaId: 'bed', areaName: 'Cama tendida', icon: 'bed', tipText: 'Foto de la cama tendida' },
      { areaId: 'bathroom', areaName: 'Baño', icon: 'bathroom', tipText: 'Baño limpio, amenities alineados' },
      { areaId: 'general', areaName: 'Vista general', icon: 'photo', tipText: 'Vista general desde la puerta' },
    ]
    return base.map((b) => ({
      id: `default-${b.areaId}`,
      areaId: b.areaId,
      areaName: b.areaName,
      icon: b.icon,
      required: true,
      tipText: b.tipText,
      roomType: 'all',
      active: true,
      hotelId,
    }))
  }

  // ─── Photo Requirements ───────────────────────────────────────────────────
  // La columna `required`/`active` es numérica (0/1) en la BD; la API habla en
  // booleanos. Se convierte en la frontera: número→bool al salir, bool→número al
  // entrar. (Pasar `true` a una columna `real` en Postgres tira 500.)
  private toBool(v: unknown): boolean {
    return v === true || v === 1 || v === '1' || v === 'true'
  }

  private normalizeOut(r: PhotoRequirement): PhotoRequirement {
    return { ...r, required: this.toBool(r.required), active: true }
  }

  async getPhotoRequirements(hotelId: string, roomType?: string): Promise<PhotoRequirement[]> {
    const filters: Record<string, unknown> = { hotelId, active: 1 }
    if (roomType) filters.roomType = roomType
    const configured = await this.photoReqRepo.findMany(filters)
    const rows = configured.length > 0 ? configured : this.defaultRequirements(hotelId)
    return rows.map((r) => this.normalizeOut(r))
  }

  async upsertPhotoRequirements(hotelId: string, items: Partial<PhotoRequirement>[]): Promise<PhotoRequirement[]> {
    const results: PhotoRequirement[] = []
    for (const item of items) {
      // bool→número para la columna numérica.
      const payload: Record<string, unknown> = { ...item }
      if ('required' in item) payload.required = this.toBool(item.required) ? 1 : 0
      if ('active' in item) payload.active = this.toBool(item.active) ? 1 : 0
      const existing = await this.photoReqRepo.findMany({
        hotelId,
        areaId: item.areaId,
        roomType: item.roomType || 'all',
      })
      if (existing.length > 0) {
        const updated = await this.photoReqRepo.update(existing[0].id, payload as any)
        if (updated) results.push(this.normalizeOut(updated))
      } else {
        const created = await this.photoReqRepo.create({ ...payload, hotelId, active: 1 } as any)
        results.push(this.normalizeOut(created))
      }
    }
    return results
  }

  // ─── Supply Lists ─────────────────────────────────────────────────────────
  async getSupplyLists(hotelId: string, roomType?: string): Promise<SupplyItem[]> {
    const filters: Record<string, unknown> = { hotelId }
    if (roomType) filters.roomType = roomType
    return this.supplyRepo.findMany(filters)
  }

  async upsertSupplyLists(hotelId: string, roomType: string, items: Partial<SupplyItem>[]): Promise<SupplyItem[]> {
    const existing = await this.supplyRepo.findMany({ hotelId, roomType })
    for (const item of existing) {
      await this.supplyRepo.delete(item.id)
    }
    const results: SupplyItem[] = []
    for (const item of items) {
      const created = await this.supplyRepo.create({ ...item, hotelId, roomType } as any)
      results.push(created)
    }
    return results
  }
}
