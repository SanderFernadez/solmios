<template>
  <router-view />
  <ToastContainer />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import ToastContainer from '@/components/ui/ToastContainer.vue'

const auth = useAuthStore()

onMounted(() => {
  auth.restoreSession()
})
</script>

<style>
</style>
