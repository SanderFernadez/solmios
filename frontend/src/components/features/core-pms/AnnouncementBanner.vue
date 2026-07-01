<template>
  <div v-if="visibleAnnouncements.length > 0" class="space-y-2 px-6 pt-4">
    <div
      v-for="a in visibleAnnouncements"
      :key="a.id"
      class="relative rounded-xl border p-3 pr-10 flex items-start gap-3"
      :class="[announcementMeta(a.type).bgClass, announcementMeta(a.type).borderClass]"
    >
      <span class="text-lg shrink-0">{{ announcementMeta(a.type).icon }}</span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-black" :class="announcementMeta(a.type).textClass">{{ a.title }}</span>
          <span v-if="a.priority === 'urgent' || a.priority === 'high'" class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/60 uppercase" :class="announcementMeta(a.type).textClass">
            {{ a.priority }}
          </span>
        </div>
        <p v-if="a.message" class="text-xs mt-0.5" :class="announcementMeta(a.type).textClass">{{ a.message }}</p>
      </div>
      <button
        @click="dismiss(a.id)"
        class="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/60 cursor-pointer transition-colors"
        :class="announcementMeta(a.type).textClass"
        aria-label="Cerrar anuncio"
      >✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { AnnouncementsService, announcementMeta } from '@/services/Announcements.service'
import type { Announcement } from '@/services/Announcements.service'
import { ConfigService } from '@/services/Platform.service'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const all = ref<Announcement[]>([])
const dismissedIds = ref<Set<string>>(new Set())

const visibleAnnouncements = computed(() =>
  all.value
    .filter(a => a.active && !dismissedIds.value.has(a.id))
    // Prioridad: urgent > high > medium > low
    .sort((a, b) => {
      const order = { urgent: 0, high: 1, medium: 2, low: 3 } as Record<string, number>
      return (order[a.priority] ?? 4) - (order[b.priority] ?? 4)
    })
    .slice(0, 3) // Mostrar máximo 3 a la vez
)

async function load() {
  try {
    const r = await AnnouncementsService.list({ activeOnly: true })
    all.value = r.data || []
  } catch { all.value = [] }

  // Cargar dismissedIds del usuario (Configuration KV)
  try {
    const dismissed = await ConfigService.get('dismissed_announcements', hotelId.value)
    if (Array.isArray(dismissed)) {
      dismissedIds.value = new Set(dismissed.filter((x: any): x is string => typeof x === 'string'))
    } else if (typeof dismissed === 'string') {
      try {
        const parsed = JSON.parse(dismissed)
        if (Array.isArray(parsed)) dismissedIds.value = new Set(parsed.filter((x: any): x is string => typeof x === 'string'))
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

async function dismiss(id: string) {
  dismissedIds.value = new Set([...dismissedIds.value, id])
  // Persistir para no mostrar de nuevo
  try {
    await ConfigService.set('dismissed_announcements', JSON.stringify([...dismissedIds.value]), hotelId.value)
  } catch { /* silent */ }
}

onMounted(load)
</script>

<style scoped></style>
