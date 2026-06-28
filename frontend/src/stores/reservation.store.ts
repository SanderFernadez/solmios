import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Reservation, ReservationStatus } from '@/types'
import { ReservationService } from '@/services/Reservation.service'

export const useReservationStore = defineStore('reservations', () => {
  const reservations = ref<Reservation[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref('')

  async function fetchReservations(filters?: { hotelId?: string; status?: ReservationStatus }) {
    loading.value = true
    error.value = ''
    try {
      const { reservations: data, total: t } = await ReservationService.list({ hotelId: filters?.hotelId, status: filters?.status })
      reservations.value = data
      total.value = t
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al cargar reservas'
      reservations.value = []
    } finally {
      loading.value = false
    }
  }

  async function createReservation(input: {
    hotelId: string
    roomId: string
    guestId?: string
    checkIn: string
    checkOut: string
    channel?: string
    source?: string
    totalAmount: number
    status?: string
    deposit?: number
    depositPercentage?: number
    depositStatus?: string
    paymentMethod?: string
    adults?: number
    children?: number
    notes?: string
    ownerNotes?: string
    commission?: number
    commissionAmount?: number
    externalLocator?: string
    otaNotes?: string
    regime?: string
    promoCode?: string
    autoSendEnabled?: boolean
    emergencyContact?: { name: string; phone: string; relation: string; email?: string }
    creditCard?: { holderName: string; brand: string; number: string; cvv: string; expMonth: string; expYear: string }
  }) {
    const created = await ReservationService.create(input)
    reservations.value.unshift(created)
    return created
  }

  async function updateReservation(id: string, patch: Record<string, unknown>) {
    const updated = await ReservationService.update(id, patch)
    const idx = reservations.value.findIndex(r => r.id === id)
    if (idx >= 0) reservations.value[idx] = updated
    return updated
  }

  return { reservations, total, loading, error, fetchReservations, createReservation, updateReservation }
})
