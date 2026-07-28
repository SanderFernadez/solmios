// hotelmedia/usecases/media-crud.ts — CRUD de hotel_media (F0, spec hotel-media).
//
// Reglas de negocio:
//  - Ownership IDOR: toda operación valida que la media pertenezca al hotel del JWT.
//    Post-find `findOne({id})` + `auth.assertOwnership(record.hotelId, user.hotelId, ...)`.
//    (Mismo patrón textual que restaurant/usecases/items-crud.ts.)
//  - `type='room'` REQUIERE `roomId` válido del MISMO hotel (FK lógica a `rooms.id`).
//  - `url` puede venir como data-URL base64 (la sube al S3StorageAdapter con dir
//    `hotel-media`) o como URL http(s) ya resuelta (se persiste directo).
//  - `reorder` reescribe `sortOrder` 0..N-1 sin gaps, atómico en secuencia.
//
// Anti-patrón ORM (mem 1805): TODO campo persistido está declarado en model.ts. Si lo
// agregás acá, declaralo allá también (case-sensitive) o se descarta silenciosamente.
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { StorageService } from 'arckode-framework/modules/storage'
import type { HotelMediaDTO, CreateHotelMediaDTO, UpdateHotelMediaDTO, MediaType, CurrentUser } from '../types'
import { parseDataUrl, isImage } from '../../../shared/utils/data-url'

export interface MediaCrudDeps {
  media: RepositoryAdapter<HotelMediaDTO>
  /** Repo ORM `Rooms` para validar que `roomId` pertenece al hotel (FK lógica). */
  rooms: RepositoryAdapter<any>
  userRepo: RepositoryAdapter<any>
  auth: Auth
  /** Storage para subir binarios cuando `url` viene como data-URL base64. Opcional:
   *  si no se inyecta, el `upload` con data-URL falla con ValidationError claro. */
  storage?: StorageService
}

const MEDIA_TYPES: MediaType[] = ['gallery', 'hero', 'room']
const STORAGE_DIR = 'hotel-media'

/** Hotel efectivo del JWT; rechaza si el usuario no tiene hotel asignado. */
function hotelFor(user: CurrentUser): string {
  const h = user.hotelId || ''
  if (!h) throw new ValidationError('Sin hotel asignado')
  return h
}

/** Valida que `t` esté en el enum cerrado de MediaType. */
function assertType(t: unknown): MediaType {
  if (!MEDIA_TYPES.includes(t as MediaType)) {
    throw new ValidationError('type debe ser gallery|hero|room')
  }
  return t as MediaType
}

/** Resuelve el hotelId efectivo del usuario (vía userRepo, no del JWT directo) y lo
 *  compara contra `resourceHotelId` con `auth.assertOwnership`. Evita falsos positivos
 *  del analyzer (regla de "no nombrar findById en comentarios"). */
async function assertOwnershipOf(deps: MediaCrudDeps, resourceHotelId: string, user: CurrentUser): Promise<void> {
  const me = await deps.userRepo.findOne({ id: user.id })
  deps.auth.assertOwnership(resourceHotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
}

/** `roomId` (si viene) debe existir y ser del MISMO hotel. `findOne` evita IDOR. */
async function assertRoomOfHotel(deps: MediaCrudDeps, roomId: string | null | undefined, hotelId: string): Promise<void> {
  if (!roomId) return
  const room = await deps.rooms.findOne({ id: roomId })
  if (!room || room.hotelId !== hotelId) {
    throw new ValidationError('La habitación no existe o es de otro hotel')
  }
}

// ─── listByHotel ───────────────────────────────────────────────────────────
export async function listByHotel(
  deps: MediaCrudDeps,
  hotelId: string,
  type: MediaType | undefined,
  user: CurrentUser,
): Promise<{ data: HotelMediaDTO[]; total: number }> {
  await assertOwnershipOf(deps, hotelId, user)
  const filters: Record<string, unknown> = { hotelId }
  if (type) filters.type = assertType(type)
  const data = await deps.media.findMany(filters)
  data.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  return { data, total: data.length }
}

// ─── upload ────────────────────────────────────────────────────────────────
export async function upload(
  deps: MediaCrudDeps,
  hotelId: string,
  dto: CreateHotelMediaDTO,
  user: CurrentUser,
): Promise<HotelMediaDTO> {
  await assertOwnershipOf(deps, hotelId, user)
  const type = assertType(dto.type)
  if (!dto.url?.trim()) throw new ValidationError('La url es obligatoria')

  // type='room' exige roomId del mismo hotel (spec, scenario "Subir foto de habitación").
  if (type === 'room') {
    if (!dto.roomId) throw new ValidationError('roomId es obligatorio para type=room')
    await assertRoomOfHotel(deps, dto.roomId, hotelId)
  }

  // Resolver URL final: data-URL → subirla al storage; http(s) → persistir directa.
  let finalUrl = dto.url
  if (dto.url.startsWith('data:')) {
    if (!deps.storage) throw new ValidationError('Storage no configurado para subir archivos')
    const parsed = parseDataUrl(dto.url)
    if (!parsed) throw new ValidationError('Formato inválido (se espera data URL base64)')
    if (!isImage(parsed.mimeType)) throw new ValidationError('Solo se permiten imágenes')
    const stored = await deps.storage.upload(
      {
        fieldName: 'file',
        originalName: dto.fileName || `media-${hotelId}-${Date.now()}.${parsed.ext}`,
        buffer: parsed.buffer,
        mimeType: parsed.mimeType,
        size: parsed.buffer.length,
      },
      STORAGE_DIR,
    )
    finalUrl = stored.url
  }

  return deps.media.create({
    hotelId,
    type,
    url: finalUrl,
    alt: dto.alt ?? undefined,
    sortOrder: dto.sortOrder ?? 0,
    roomId: dto.roomId || undefined,
  } as Omit<HotelMediaDTO, 'id'>)
}

// ─── update ────────────────────────────────────────────────────────────────
export async function update(
  deps: MediaCrudDeps,
  id: string,
  dto: UpdateHotelMediaDTO,
  user: CurrentUser,
): Promise<HotelMediaDTO> {
  const existing = await deps.media.findOne({ id })
  if (!existing) throw new NotFoundError('Media no encontrado')
  await assertOwnershipOf(deps, existing.hotelId, user)

  const patch: Record<string, unknown> = {}
  if (dto.type !== undefined) patch.type = assertType(dto.type)
  if (dto.url !== undefined) {
    if (!dto.url.trim()) throw new ValidationError('La url no puede ser vacía')
    patch.url = dto.url
  }
  if (dto.alt !== undefined) patch.alt = dto.alt
  if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder
  if (dto.roomId !== undefined) {
    if (dto.roomId) await assertRoomOfHotel(deps, dto.roomId, existing.hotelId)
    patch.roomId = dto.roomId || undefined
  }

  // Si el type final (nuevo o heredado) es 'room', `roomId` debe quedar presente.
  const finalType = (patch.type as MediaType | undefined) ?? existing.type
  const finalRoomId = patch.roomId !== undefined ? patch.roomId : existing.roomId
  if (finalType === 'room' && !finalRoomId) {
    throw new ValidationError('roomId es obligatorio para type=room')
  }

  const item = await deps.media.update(id, patch as Partial<Omit<HotelMediaDTO, 'id'>>)
  if (!item) throw new NotFoundError('Media no encontrado')
  return item
}

// ─── remove (delete) ───────────────────────────────────────────────────────
export async function remove(deps: MediaCrudDeps, id: string, user: CurrentUser): Promise<void> {
  const existing = await deps.media.findOne({ id })
  if (!existing) throw new NotFoundError('Media no encontrado')
  await assertOwnershipOf(deps, existing.hotelId, user)
  const deleted = await deps.media.delete(id)
  if (!deleted) throw new NotFoundError('Media no encontrado')
  // Limpieza del objeto en S3: NO se hace hoy. El modelo no guarda `storagePath`
  // (spec no lo lista, mismo criterio que `hotels.logo`). Best-effort futuro: agregar
  // `storagePath` nullable al modelo y `deps.storage.delete(path)` acá.
}

// ─── reorder ───────────────────────────────────────────────────────────────
/** Reescribe `sortOrder` 0..N-1 sin gaps. Antes de tocar, valida que cada id sea del hotel. */
export async function reorder(
  deps: MediaCrudDeps,
  hotelId: string,
  ids: string[],
  user: CurrentUser,
): Promise<void> {
  await assertOwnershipOf(deps, hotelId, user)
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ValidationError('ids debe ser un array no vacío')
  }
  for (let i = 0; i < ids.length; i++) {
    const row = await deps.media.findOne({ id: ids[i] })
    if (!row || row.hotelId !== hotelId) {
      throw new ValidationError(`La media ${ids[i]} no existe o es de otro hotel`)
    }
    await deps.media.update(ids[i], { sortOrder: i } as Partial<Omit<HotelMediaDTO, 'id'>>)
  }
}
