<template>
  <router-view />
  <ToastContainer />
  <FeedbackToolbar />
  <FeedbackOverlay />
  <FeedbackModal />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import FeedbackToolbar from '@/components/features/feedback/FeedbackToolbar.vue'
import FeedbackOverlay from '@/components/features/feedback/FeedbackOverlay.vue'
import FeedbackModal from '@/components/features/feedback/FeedbackModal.vue'

const auth = useAuthStore()

onMounted(() => {
  auth.restoreSession()
})
</script>

<style>
</style>
