<template>
  <div ref="root" class="relative">
    <button @click="toggle"
      class="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-danger/10 hover:bg-danger/20 transition-colors cursor-pointer"
      aria-label="Contactos de emergencia">
      <svg class="w-4 h-4 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
      <span class="text-[11px] font-black text-danger uppercase tracking-wide hidden sm:inline">Emergencia</span>
    </button>

    <Teleport to="body">
      <div v-if="open" class="fixed inset-0 z-40" @click="open = false"></div>
      <div v-if="open" class="absolute mt-2 w-80 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden border border-danger/20"
        :style="{ top: btnRect.bottom + 8 + 'px', left: Math.max(8, btnRect.right - 320) + 'px' }">
        <!-- Header -->
        <div class="px-4 py-3 bg-danger/10 border-b border-danger/20">
          <h3 class="text-sm font-black text-danger">Contactos de emergencia</h3>
          <p class="text-[10px] text-text-secondary mt-0.5">Tocá un número para llamar de inmediato</p>
        </div>

        <div class="max-h-96 overflow-y-auto">
          <div v-if="loading" class="py-8 text-center text-xs text-text-muted">Cargando...</div>

          <!-- Estado vacío: nunca inventamos números -->
          <div v-else-if="contacts.length === 0" class="px-4 py-8 text-center">
            <svg class="w-8 h-8 mx-auto mb-2 text-text-muted opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <p class="text-xs font-bold text-navy mb-1">Sin contactos configurados</p>
            <p class="text-[11px] text-text-muted mb-3 leading-relaxed">
              Cargá los números de emergencia del hotel para tenerlos siempre a mano.
            </p>
            <router-link :to="{ path: '/panel/settings', query: { tab: 'emergency' } }" @click="open = false"
              class="inline-block px-4 py-2 bg-danger text-white rounded-full text-xs font-bold hover:shadow-lg cursor-pointer">
              Configurar ahora
            </router-link>
          </div>

          <div v-else>
            <div v-for="group in groups" :key="group.kind">
              <div v-if="group.items.length" class="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-wide text-text-muted">
                {{ group.title }}
              </div>
              <a v-for="c in group.items" :key="c.id" :href="`tel:${c.phone}`"
                class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-surface transition-colors cursor-pointer">
                <div class="min-w-0">
                  <div class="text-xs font-bold text-navy truncate">{{ c.label }}</div>
                  <div class="text-[11px] text-text-secondary">{{ c.phone }}</div>
                </div>
                <span class="shrink-0 w-8 h-8 rounded-full bg-danger/10 text-danger flex items-center justify-center">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                  </svg>
                </span>
              </a>
            </div>
            <div class="px-4 py-2.5 border-t border-border/60 text-center">
              <router-link :to="{ path: '/panel/settings', query: { tab: 'emergency' } }" @click="open = false"
                class="text-xs font-bold text-navy hover:underline cursor-pointer">
                Editar contactos →
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { EmergencyContactsService } from '@/services/Platform.service'
import type { HotelEmergencyContact } from '@/types'

const open = ref(false)
const loading = ref(true)
const contacts = ref<HotelEmergencyContact[]>([])
const root = ref<HTMLElement | null>(null)
const btnRect = ref<DOMRect>({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 } as DOMRect)

const groups = computed(() => [
  { kind: 'external', title: 'Servicios de emergencia', items: contacts.value.filter(c => c.kind !== 'internal') },
  { kind: 'internal', title: 'Contactos internos', items: contacts.value.filter(c => c.kind === 'internal') },
])

async function load() {
  loading.value = true
  try {
    const cfg = await EmergencyContactsService.get() as { contacts?: HotelEmergencyContact[] } | null
    const list = Array.isArray(cfg?.contacts) ? cfg.contacts : []
    contacts.value = list.filter(c => c && c.label && c.phone)
  } catch {
    contacts.value = []
  } finally {
    loading.value = false
  }
}

async function positionDropdown() {
  await nextTick()
  if (root.value) btnRect.value = root.value.getBoundingClientRect()
}

function toggle() {
  open.value = !open.value
}

watch(open, (val) => { if (val) positionDropdown() })

onMounted(load)
</script>

<style scoped></style>
