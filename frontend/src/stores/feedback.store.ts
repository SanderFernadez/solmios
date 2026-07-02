import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FeedbackPin, CreateFeedbackPayload, FeedbackPriority, FeedbackCategory } from '@/types'
import { FeedbackService } from '@/services/Feedback.service'

export const useFeedbackStore = defineStore('feedback', () => {
  const isFeedbackMode = ref(false)
  const pins = ref<FeedbackPin[]>([])
  const selectedPin = ref<FeedbackPin | null>(null)
  const loading = ref(false)
  const activeRoute = ref('')
  const isModalOpen = ref(false)
  const pendingCoordinates = ref<{ x: number; y: number } | null>(null)

  const routePins = computed(() =>
    pins.value.filter(p => p.route === activeRoute.value)
  )

  function enableFeedbackMode(route: string) {
    activeRoute.value = route
    isFeedbackMode.value = true
    loadPins(route)
  }

  function disableFeedbackMode() {
    isFeedbackMode.value = false
    selectedPin.value = null
    pendingCoordinates.value = null
    isModalOpen.value = false
  }

  function captureClick(x: number, y: number) {
    pendingCoordinates.value = { x, y }
    isModalOpen.value = true
  }

  function closeModal() {
    isModalOpen.value = false
    pendingCoordinates.value = null
  }

  function getBrowser(): string {
    const ua = navigator.userAgent
    if (ua.includes('Firefox')) return 'Firefox'
    if (ua.includes('Samsung')) return 'Samsung Internet'
    if (ua.includes('Edg')) return 'Edge'
    if (ua.includes('Chrome')) return 'Chrome'
    if (ua.includes('Safari')) return 'Safari'
    return 'Unknown'
  }

  async function savePin(data: { comment: string; priority: FeedbackPriority; category: FeedbackCategory }) {
    if (!pendingCoordinates.value) return
    loading.value = true
    try {
      const payload: CreateFeedbackPayload = {
        ...pendingCoordinates.value,
        route: activeRoute.value,
        comment: data.comment,
        priority: data.priority,
        category: data.category,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        browser: getBrowser(),
      }
      const pin = await FeedbackService.create(payload)
      pins.value.push(pin)
      isModalOpen.value = false
      pendingCoordinates.value = null
    } finally {
      loading.value = false
    }
  }

  async function updatePin(id: string, data: Partial<FeedbackPin>) {
    loading.value = true
    try {
      const updated = await FeedbackService.update(id, data)
      const idx = pins.value.findIndex(p => p.id === id)
      if (idx >= 0) pins.value[idx] = updated
    } finally {
      loading.value = false
    }
  }

  async function deletePin(id: string) {
    loading.value = true
    try {
      await FeedbackService.remove(id)
      pins.value = pins.value.filter(p => p.id !== id)
    } finally {
      loading.value = false
    }
  }

  async function loadPins(route: string) {
    loading.value = true
    try {
      pins.value = await FeedbackService.list(route)
    } finally {
      loading.value = false
    }
  }

  return {
    isFeedbackMode,
    pins,
    selectedPin,
    loading,
    activeRoute,
    isModalOpen,
    pendingCoordinates,
    routePins,
    enableFeedbackMode,
    disableFeedbackMode,
    captureClick,
    closeModal,
    savePin,
    updatePin,
    deletePin,
    loadPins,
  }
})
