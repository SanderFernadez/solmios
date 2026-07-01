<template>
  <div v-if="hotels.length > 1" class="relative" ref="container">
    <button
      @click="open = !open"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors hover:bg-white/10"
      :class="currentHotel ? 'bg-white/10 text-white' : 'text-white/60'"
      title="Cambiar de hotel"
    >
      <span class="text-[14px]">🏨</span>
      <span class="max-w-[120px] truncate">{{ currentHotel?.name || 'Hoteles' }}</span>
      <span class="text-[10px] ml-0.5" :class="open ? 'rotate-0' : 'rotate-180'">▲</span>
    </button>

    <Transition name="fade">
      <div v-if="open" class="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
        <div class="p-2">
          <div class="text-[10px] uppercase text-gray-400 font-bold px-3 py-1.5 tracking-wider">
            {{ hotels.length }} hoteles
          </div>
          <div
            v-for="h in hotels"
            :key="h.id"
            @click="switchTo(h)"
            class="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-navy/5"
            :class="auth.user?.hotelId === h.id ? 'bg-navy/5' : ''"
          >
            <div class="w-7 h-7 rounded-md flex items-center justify-center text-[14px] flex-shrink-0"
              :class="auth.user?.hotelId === h.id ? 'bg-navy text-white' : 'bg-gray-100'"
            >🏨</div>
            <div class="min-w-0 flex-1">
              <div class="text-[13px] font-semibold text-navy truncate">{{ h.name }}</div>
              <div class="text-[10px] text-gray-400 truncate">{{ h.country || '-' }}</div>
            </div>
            <span v-if="auth.user?.hotelId === h.id" class="w-2 h-2 rounded-full bg-teal flex-shrink-0"></span>
          </div>
        </div>
        <button
          @click="open = false; $emit('close')"
          class="w-full text-center text-[11px] text-gray-400 py-2 border-t border-gray-100 hover:text-navy cursor-pointer transition-colors"
        >Cerrar</button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { AuthService } from '@/services/Auth.service'
import type { Hotel } from '@/types'

const auth = useAuthStore()
const router = useRouter()

const open = ref(false)
const hotels = ref<Hotel[]>([])
const container = ref<HTMLElement | null>(null)

const currentHotel = computed(() =>
  hotels.value.find((h) => h.id === auth.user?.hotelId) || null
)

async function loadHotels() {
  try {
    hotels.value = await AuthService.getHotels()
  } catch { /* graceful */ }
}

async function switchTo(hotel: Hotel) {
  if (hotel.id === auth.user?.hotelId) {
    open.value = false
    return
  }
  try {
    const { token, user } = await AuthService.switchHotel(hotel.id)
    auth.token = token
    auth.user = { ...auth.user!, ...user, hotelId: user.hotelId || '', hotelName: user.hotelName || '' } as typeof auth.user
    open.value = false
    router.push('/panel')
  } catch (e: any) {
    console.error('switchHotel failed:', e)
  }
}

function handleClickOutside(e: MouseEvent) {
  if (container.value && !container.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => {
  loadHotels()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
