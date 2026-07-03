import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FeedbackPin, CreateFeedbackPayload, FeedbackPriority, FeedbackCategory } from '@/types'
import { FeedbackService } from '@/services/Feedback.service'
import type { GitLabIssueResult } from '@/services/Feedback.service'

const STORAGE_KEY = 'solmios_feedback_pins'

function loadStorage(): FeedbackPin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveStorage(pins: FeedbackPin[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins))
  } catch { /* quota exceeded, ignore */ }
}

let seqId = Date.now()
function nextId(): string {
  return `fb_${++seqId}`
}

export const useFeedbackStore = defineStore('feedback', () => {
  const isFeedbackMode = ref(false)
  const pins = ref<FeedbackPin[]>(loadStorage())
  const selectedPin = ref<FeedbackPin | null>(null)
  const loading = ref(false)
  const activeRoute = ref('')
  const isModalOpen = ref(false)
  const pendingCoordinates = ref<{ x: number; y: number } | null>(null)
  const pendingScreenshot = ref<string | null>(null)
  const lastIssueUrl = ref<string | null>(null)

  const routePins = computed(() =>
    pins.value.filter(p => p.route === activeRoute.value)
  )

  function persist() {
    saveStorage(pins.value)
  }

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
    isModalOpen.value = true
  }

  function setScreenshot(dataUrl: string) {
    pendingScreenshot.value = dataUrl
  }

  function closeModal() {
    isModalOpen.value = false
    pendingCoordinates.value = null
    pendingScreenshot.value = null
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
      const pin: FeedbackPin = {
        id: nextId(),
        ...pendingCoordinates.value,
        route: activeRoute.value,
        comment: data.comment,
        priority: data.priority,
        category: data.category,
        status: 'open',
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        browser: getBrowser(),
        createdAt: new Date(),
      }
      pins.value.push(pin)
      persist()

      if (pendingScreenshot.value) {
        try {
          const result: GitLabIssueResult = await FeedbackService.createGitLabIssue({
            screenshot: pendingScreenshot.value,
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
        } catch {
          /* GitLab not configured or unavailable */
        }
      }

      FeedbackService.create(pin).catch(() => {
        /* backend not available — localStorage fallback active */
      })

      isModalOpen.value = false
      pendingCoordinates.value = null
      pendingScreenshot.value = null
    } finally {
      loading.value = false
    }
  }

  async function updatePin(id: string, data: Partial<FeedbackPin>) {
    loading.value = true
    try {
      const idx = pins.value.findIndex(p => p.id === id)
      if (idx >= 0) {
        pins.value[idx] = { ...pins.value[idx], ...data }
        persist()
      }
      FeedbackService.update(id, data).catch(() => {})
    } finally {
      loading.value = false
    }
  }

  async function deletePin(id: string) {
    loading.value = true
    try {
      pins.value = pins.value.filter(p => p.id !== id)
      persist()
      FeedbackService.remove(id).catch(() => {})
    } finally {
      loading.value = false
    }
  }

  async function loadPins(route: string) {
    loading.value = true
    try {
      const remote = await FeedbackService.list(route)
      const localIds = new Set(pins.value.map(p => p.id))
      const merged = [...pins.value]
      for (const r of remote) {
        const i = merged.findIndex(m => m.id === r.id)
        if (i >= 0) merged[i] = r
        else merged.push(r)
      }
      pins.value = merged
      persist()
    } catch {
      /* use localStorage data */
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
