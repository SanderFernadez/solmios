import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Room, RoomStatus } from '@/types'
import { RoomService } from '@/services/Room.service'

export const useRoomStore = defineStore('rooms', () => {
  const rooms = ref<Room[]>([])
  const loading = ref(false)
  const error = ref('')

  async function fetchRooms(filters?: { hotelId?: string; status?: RoomStatus; tipo?: string }) {
    loading.value = true
    error.value = ''
    try {
      const estado = filters?.status === 'available' ? 'disponible'
        : filters?.status === 'occupied' ? 'ocupada'
        : filters?.status === 'cleaning' ? 'limpieza'
        : filters?.status === 'pending' ? 'pendiente'
        : filters?.status === 'out_of_service' ? 'fuera de servicio'
        : undefined
      const { rooms: data } = await RoomService.list({ hotelId: filters?.hotelId, estado, type: filters?.type })
      rooms.value = filters?.status ? data.filter(r => r.status === filters.status) : data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al cargar habitaciones'
      rooms.value = []
    } finally {
      loading.value = false
    }
  }

  async function updateRoomStatus(id: string, status: RoomStatus) {
    const updated = await RoomService.update(id, { status })
    const idx = rooms.value.findIndex(r => r.id === id)
    if (idx >= 0) rooms.value[idx] = updated
    return updated
  }

  return { rooms, loading, error, fetchRooms, updateRoomStatus }
})
