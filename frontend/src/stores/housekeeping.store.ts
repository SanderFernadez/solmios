// stores/housekeeping.store.ts — Estado y acciones del panel de housekeeping.
// Carga tasks + rooms + staff, mapea a ViewTask (join + duration en runtime, D1),
// y expone acciones de administración (start/complete/photos/stats).
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { HousekeepingService, type HousekeepingTask, type StaffStats, type PhotoEvidence, type VideoEvidence } from '@/services/Housekeeping.service'
import { RoomService } from '@/services/Room.service'
import { TeamService, type TeamMember } from '@/services/Team.service'

const TYPE_LABELS: Record<string, string> = {
  full_cleaning: 'Full Cleaning', quick_cleaning: 'Quick Clean', deep_cleaning: 'Deep Clean',
  inspection: 'Inspection', maintenance: 'Maintenance',
}
const PRI_LABELS: Record<string, string> = { high: 'High', medium: 'Normal', low: 'Low', urgent: 'Urgent' }

export interface HousekeepingViewTask {
  id: string
  rawType?: string
  roomNumber: string
  type: string
  floor: string
  status: string
  priority: string
  priorityRaw: string
  assignedTo: string
  staffId: string
  startTime?: string
  endTime?: string
  durationMs?: number
  time: string
  notes: string
  items: string[]
  photos: PhotoEvidence[]
  /** Calificación 1–10 del supervisor, o null si aprobó sin calificar. */
  rating: number | null
  /** Video de evidencia de fin, si el hotel usa el modo `video`. */
  video: VideoEvidence | null
  /** Nombre del supervisor que aprobó/revisó, o '' si nadie la revisó aún. */
  supervisorName: string
  /** Nota que dejó el supervisor al aprobar. */
  supervisorNote: string
  /** Hora en que el supervisor estuvo en la habitación. */
  supOnSiteTime: string
}

const MS_PER_MINUTE = 60 * 1000

export function humanizeMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ''
  const min = Math.round(ms / MS_PER_MINUTE)
  if (min < 1) return '<1 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function parseItems(cleaningItems: unknown): string[] {
  if (!cleaningItems) return []
  const arr = Array.isArray(cleaningItems)
    ? cleaningItems
    : typeof cleaningItems === 'string'
      ? (() => { try { return JSON.parse(cleaningItems) } catch { return [] } })()
      : []
  if (!Array.isArray(arr)) return []
  return arr.map((i: any) => (typeof i === 'string' ? i : i?.name)).filter(Boolean)
}

function mapTask(t: HousekeepingTask, roomMap: Map<string, any>, staffMap: Map<string, string>): HousekeepingViewTask {
  const room = roomMap.get(t.roomId)
  const durationMs = t.startTime && t.endTime
    ? new Date(t.endTime).getTime() - new Date(t.startTime).getTime()
    : undefined
  const supervisorName = t.supervisorId ? (staffMap.get(t.supervisorId) || '') : ''
  return {
    id: t.id,
    rawType: t.type,
    roomNumber: room?.number || '—',
    type: TYPE_LABELS[t.type ?? ''] || t.type || 'Cleaning',
    floor: room?.floor || '',
    status: t.status || 'pending',
    priorityRaw: t.priority || 'medium',
    priority: PRI_LABELS[t.priority ?? ''] || t.priority || 'Normal',
    assignedTo: staffMap.get(t.staffId || '') || 'Sin asignar',
    staffId: t.staffId || '',
    startTime: t.startTime,
    endTime: t.endTime,
    durationMs,
    time: durationMs !== undefined ? humanizeMs(durationMs) : '',
    notes: t.notes || '',
    items: parseItems(t.cleaningItems),
    photos: t.photos ?? [],
    rating: typeof t.rating === 'number' ? t.rating : null,
    video: t.video ?? null,
    supervisorName,
    supervisorNote: t.supervisorNote || '',
    supOnSiteTime: t.supOnSiteTime || '',
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export const useHousekeepingStore = defineStore('housekeeping', () => {
  const tasks = ref<HousekeepingViewTask[]>([])
  const stats = ref<StaffStats[]>([])
  // El personal son USUARIOS del hotel (tabla users), no perfiles de RRHH: los
  // tasks guardan staffId = users.id, así que hay que resolver contra /usuarios.
  const staff = ref<TeamMember[]>([])
  const rooms = ref<any[]>([])
  const loading = ref(false)
  const currentHotelId = ref<string | undefined>()

  async function load(hotelId?: string) {
    currentHotelId.value = hotelId
    loading.value = true
    try {
      const [roomsRes, usersResult, tasksRes] = await Promise.all([
        hotelId ? RoomService.list({ hotelId }) : Promise.resolve({ rooms: [] as any[] }),
        TeamService.list(),
        HousekeepingService.list(hotelId),
      ])
      rooms.value = roomsRes.rooms ?? []
      staff.value = Array.isArray(usersResult) ? usersResult : (usersResult?.data ?? [])
      const roomMap = new Map(rooms.value.map(r => [r.id, r]))
      // Indexar por users.id: los tasks guardan staffId/supervisorId = users.id.
      const staffMap = new Map(staff.value.map(s => [s.id, s.name || s.id]))
      tasks.value = (tasksRes.data ?? []).map(t => mapTask(t, roomMap, staffMap))
    } finally {
      loading.value = false
    }
  }

  async function createTask(payload: Partial<HousekeepingTask>) {
    await HousekeepingService.create(payload)
    await load(currentHotelId.value)
  }

  async function updateTask(id: string, patch: Partial<HousekeepingTask>) {
    await HousekeepingService.update(id, patch)
    await load(currentHotelId.value)
  }

  async function startTask(id: string) {
    await HousekeepingService.start(id)
    await load(currentHotelId.value)
  }

  async function completeTask(id: string) {
    await HousekeepingService.complete(id)
    await load(currentHotelId.value)
  }

  async function uploadPhoto(id: string, file: File) {
    const photo = await fileToDataUrl(file)
    await HousekeepingService.uploadPhoto(id, photo, file.name)
    await load(currentHotelId.value)
  }

  async function removePhoto(id: string, url: string) {
    await HousekeepingService.removePhoto(id, url)
    await load(currentHotelId.value)
  }

  async function loadStats(from?: string, to?: string) {
    stats.value = await HousekeepingService.stats(currentHotelId.value, from, to)
  }

  /// Aprueba y califica una limpieza (1–10). El backend exige presencia marcada
  /// antes de aprobar, así que el admin que revisa desde el panel la sella en el
  /// mismo paso, y después aprueba con la calificación.
  async function approveTask(id: string, rating: number, note?: string) {
    await HousekeepingService.markPresence(id)
    await HousekeepingService.approve(id, rating, note)
    await load(currentHotelId.value)
  }

  return {
    tasks, stats, staff, rooms, loading,
    load, createTask, updateTask, startTask, completeTask, uploadPhoto, removePhoto, loadStats, approveTask,
  }
})
