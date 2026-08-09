import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FeedbackPin, FeedbackPriority, FeedbackCategory } from '@/types'
import { FeedbackService } from '@/services/Feedback.service'
import type { GitHubIssueResult } from '@/services/Feedback.service'

export const useFeedbackStore = defineStore('feedback', () => {
  const isFeedbackMode = ref(false)
  const pins = ref<FeedbackPin[]>([])
  const selectedPin = ref<FeedbackPin | null>(null)
  const loading = ref(false)
  const activeRoute = ref('')
  const isModalOpen = ref(false)
  const pendingCoordinates = ref<{ x: number; y: number } | null>(null)
  const pendingScreenshot = ref<string | null>(null)
  const lastIssueUrl = ref<string | null>(null)
  const lastError = ref<string | null>(null)

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
    pendingScreenshot.value = null
    isModalOpen.value = false
  }

  function captureClick(x: number, y: number) {
    pendingCoordinates.value = { x, y }
    lastIssueUrl.value = null
    lastError.value = null
    isModalOpen.value = true
  }

  function setScreenshot(dataUrl: string) {
    pendingScreenshot.value = dataUrl
  }

  function closeModal() {
    isModalOpen.value = false
    pendingCoordinates.value = null
    pendingScreenshot.value = null
    lastIssueUrl.value = null
    lastError.value = null
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
    lastIssueUrl.value = null
    try {
      // Guardar en la DB
      const pin = await FeedbackService.create({
        route: activeRoute.value,
        x: pendingCoordinates.value.x,
        y: pendingCoordinates.value.y,
        comment: data.comment,
        priority: data.priority,
        category: data.category,
        screenshot: pendingScreenshot.value || undefined,
        browser: getBrowser(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      })
      pins.value.push(pin)

      // Crear issue en GitHub y vincularlo al pin (lo hace el server con pinId, sin PATCH desde acá).
      try {
        const result: GitHubIssueResult = await FeedbackService.createGitHubIssue({
          pinId: pin.id,
          screenshot: pendingScreenshot.value || '',
          filename: `feedback-${activeRoute.value.replace(/\//g, '-')}-${Date.now()}.png`,
          comment: data.comment,
          route: activeRoute.value,
          x: pendingCoordinates.value.x,
          y: pendingCoordinates.value.y,
          browser: getBrowser(),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        })
        lastIssueUrl.value = result.issueUrl
        lastError.value = null

        // El server ya guardó el issueUrl en el pin; actualizamos la copia local.
        pin.githubIssueUrl = result.issueUrl
      } catch (e: any) {
        lastError.value = e?.message || 'Error al crear issue en GitHub'
      }

      isModalOpen.value = false
      pendingCoordinates.value = null
      pendingScreenshot.value = null
    } catch (e: any) {
      lastError.value = e?.message || 'Error al guardar feedback'
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
      const result = await FeedbackService.list(route)
      pins.value = Array.isArray(result) ? result : (result as any).data || []
    } catch {
      pins.value = []
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
    pendingScreenshot,
    lastIssueUrl,
    lastError,
    routePins,
    enableFeedbackMode,
    disableFeedbackMode,
    captureClick,
    setScreenshot,
    closeModal,
    savePin,
    updatePin,
    deletePin,
    loadPins,
  }
})
