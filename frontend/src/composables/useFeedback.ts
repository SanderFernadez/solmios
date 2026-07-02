import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useFeedbackStore } from '@/stores/feedback.store'

export function useFeedback() {
  const route = useRoute()
  const store = useFeedbackStore()

  const currentRoute = computed(() => route.fullPath)

  function toggleMode() {
    if (store.isFeedbackMode) {
      store.disableFeedbackMode()
    } else {
      store.enableFeedbackMode(currentRoute.value)
    }
  }

  return {
    isFeedbackMode: computed(() => store.isFeedbackMode),
    pins: computed(() => store.routePins),
    isModalOpen: computed(() => store.isModalOpen),
    loading: computed(() => store.loading),
    selectedPin: computed(() => store.selectedPin),
    toggleMode,
    enableFeedbackMode: () => store.enableFeedbackMode(currentRoute.value),
    disableFeedbackMode: store.disableFeedbackMode,
    captureClick: store.captureClick,
    closeModal: store.closeModal,
    savePin: store.savePin,
    updatePin: store.updatePin,
    deletePin: store.deletePin,
  }
}
