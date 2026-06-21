<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChannelService } from '@/services/Channel.service'

const route = useRoute()
const router = useRouter()
const channelId = computed(() => route.params.id as string)
const detail = ref<any>(null)
const loading = ref(true)

onMounted(async () => {
  try { 
    detail.value = await ChannelService.detail(channelId.value)
  } catch {} 
  finally { loading.value = false }
})

const statusColor = computed(() => detail.value?.isActive ? 'bg-teal' : 'bg-orange')
const statusText = computed(() => detail.value?.isActive ? 'Activo' : 'Inactivo')
</script>

<template>
  <div v-if="loading" class="text-center py-8 text-text-muted">Cargando...</div>
  <div v-else-if="!detail" class="text-center py-8 text-text-muted">Canal no encontrado</div>
  <div v-else class="space-y-6">
    <!-- Header -->
    <div class="bg-white rounded-2xl border p-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-navy flex items-center justify-center text-2xl">
            {{ detail.channel === 'AirBNB' ? '🩷' : detail.channel === 'BDC' ? '🟦' : '🔗' }}
          </div>
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-xl font-black text-navy">{{ detail.title }}</h1>
              <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full', statusColor + '/10', 'text-' + (detail.isActive ? 'teal' : 'orange')]">{{ statusText }}</span>
            </div>
            <p class="text-xs text-text-muted">{{ detail.channel }} · ID: {{ detail.id }}</p>
          </div>
        </div>
        <button @click="router.push('/panel/channel-manager')" class="px-4 py-2 bg-surface text-sm font-bold rounded-xl cursor-pointer hover:bg-navy hover:text-white transition-colors">← Volver</button>
      </div>
    </div>

    <div class="grid lg:grid-cols-2 gap-6">
      <!-- Rate Plans Mapeados -->
      <div class="bg-white rounded-2xl border p-6">
        <h2 class="font-black text-navy mb-4">Rate Plans Mapeados ({{ detail.ratePlans?.length || 0 }})</h2>
        <div v-if="!detail.ratePlans?.length" class="text-xs text-text-muted py-4 text-center">Sin rate plans mapeados. El canal no puede activarse sin mapear al menos uno.</div>
        <div v-else class="space-y-2">
          <div v-for="rp in detail.ratePlans" :key="rp.rate_plan_id" class="bg-surface rounded-xl p-3 flex items-center justify-between">
            <div><span class="text-xs font-bold">{{ rp.rate_plan_id?.slice(0,8) }}...</span></div>
            <span class="text-[10px] text-text-muted">{{ JSON.stringify(rp.settings) }}</span>
          </div>
        </div>
      </div>

      <!-- Rate Plans Disponibles -->
      <div class="bg-white rounded-2xl border p-6">
        <h2 class="font-black text-navy mb-4">Rate Plans del Hotel ({{ detail.allRatePlans?.length || 0 }})</h2>
        <div class="space-y-2">
          <div v-for="rp in detail.allRatePlans" :key="rp.id" class="bg-surface rounded-xl p-3 flex items-center justify-between">
            <div>
              <div class="text-sm font-bold text-navy">{{ rp.title }}</div>
              <div class="text-[10px] text-text-muted">{{ rp.roomTypeTitle }} · {{ rp.occupancy }}p</div>
            </div>
            <span class="text-[10px] font-mono text-text-muted">{{ rp.id?.slice(0,8) }}...</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
