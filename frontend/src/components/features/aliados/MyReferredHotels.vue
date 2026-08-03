<template>
  <SectionCard title="Mis hoteles">
    <p class="text-xs text-text-muted mb-4">
      Los hoteles que referiste y ya validaron su período de prueba. Podés ayudarlos con
      configuraciones básicas o escalar a SOLMI OS lo que no puedas resolver.
    </p>

    <div v-if="loading" class="h-32 animate-pulse rounded-2xl bg-surface"></div>

    <EmptyState v-else-if="!hotels.length" title="Todavía no tenés hoteles para dar soporte"
      message="Cuando uno de tus referidos valide su período de prueba, aparece acá." />

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div v-for="h in hotels" :key="h.hotelId" class="rounded-2xl border border-border p-4">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-sm font-black text-navy truncate">{{ h.name }}</div>
            <div class="text-xs text-text-muted truncate">{{ h.address || 'Sin dirección cargada' }}</div>
          </div>
          <span class="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full"
            :class="h.photoCount > 0 ? 'bg-teal/10 text-teal' : 'bg-warning/10 text-warning'">
            {{ h.photoCount }} foto{{ h.photoCount === 1 ? '' : 's' }}
          </span>
        </div>
        <p class="text-xs text-text-secondary mt-2 line-clamp-2">
          {{ descriptionPreview(h.descriptionJson) || 'Sin descripción cargada.' }}
        </p>
        <div class="flex gap-2 mt-3">
          <button type="button" @click="openEdit(h)"
            class="px-3 py-1.5 bg-navy text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-navy-light transition-colors">
            Ayudar con configuración
          </button>
          <button type="button" @click="openEscalate(h)"
            class="px-3 py-1.5 bg-surface border border-border rounded-lg text-xs font-bold text-navy cursor-pointer hover:bg-surface-dark transition-colors">
            Escalar a SOLMI OS
          </button>
        </div>
      </div>
    </div>

    <!-- Editar configuración básica -->
    <AppModal :open="editTarget !== null" title="Ayudar con configuración básica" :subtitle="editTarget?.name"
      @close="editTarget = null">
      <div class="p-5 space-y-4">
        <div>
          <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Dirección</label>
          <input v-model="editForm.address" type="text" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
        </div>
        <div>
          <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Descripción</label>
          <textarea v-model="editForm.description" rows="4" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Latitud</label>
            <input v-model.number="editForm.latitude" type="number" step="any" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Longitud</label>
            <input v-model.number="editForm.longitude" type="number" step="any" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
          </div>
        </div>
        <p class="text-[11px] text-text-muted">
          Para fotos, cerraduras o pagos no se puede editar desde acá — usá "Escalar a SOLMI OS".
        </p>
      </div>
      <template #footer>
        <button type="button" @click="editTarget = null" class="px-4 py-2 text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
        <button type="button" @click="saveEdit" :disabled="saving"
          class="px-4 py-2 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-navy-light transition-colors disabled:opacity-50">
          {{ saving ? 'Guardando...' : 'Guardar' }}
        </button>
      </template>
    </AppModal>

    <!-- Escalar -->
    <AppModal :open="escalateTarget !== null" title="Escalar a SOLMI OS" :subtitle="escalateTarget?.name"
      @close="escalateTarget = null">
      <div class="p-5">
        <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Contanos qué necesita el hotel</label>
        <textarea v-model="escalateComment" rows="4" placeholder="Ej: el hotel no puede subir sus fotos, la cerradura no responde, etc."
          class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm"></textarea>
      </div>
      <template #footer>
        <button type="button" @click="escalateTarget = null" class="px-4 py-2 text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
        <button type="button" @click="sendEscalate" :disabled="saving || escalateComment.trim().length < 5"
          class="px-4 py-2 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-navy-light transition-colors disabled:opacity-50">
          {{ saving ? 'Enviando...' : 'Enviar' }}
        </button>
      </template>
    </AppModal>
  </SectionCard>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AppModal from '@/components/ui/AppModal.vue'
import { useToast } from '@/composables/useToast'
import { AliadosService, type ReferredHotelDTO } from '@/services/Aliados.service'

const toast = useToast()
const loading = ref(true)
const saving = ref(false)
const hotels = ref<ReferredHotelDTO[]>([])

const editTarget = ref<ReferredHotelDTO | null>(null)
const editForm = ref({ address: '', description: '', latitude: 0, longitude: 0 })
const escalateTarget = ref<ReferredHotelDTO | null>(null)
const escalateComment = ref('')

// descriptionJson guarda un objeto serializado ({title, description}) — mismo shape que usa
// settings/index.vue. Acá solo se muestra un preview corto, no se edita esa estructura completa.
function descriptionPreview(raw: string | null): string {
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    return parsed?.description || parsed?.title || ''
  } catch {
    return raw
  }
}

function openEdit(h: ReferredHotelDTO) {
  editTarget.value = h
  editForm.value = {
    address: h.address || '',
    description: descriptionPreview(h.descriptionJson),
    latitude: h.latitude || 0,
    longitude: h.longitude || 0,
  }
}

async function saveEdit() {
  if (!editTarget.value) return
  saving.value = true
  try {
    const updated = await AliadosService.updateReferredHotel(editTarget.value.hotelId, {
      address: editForm.value.address,
      descriptionJson: JSON.stringify({ description: editForm.value.description }),
      latitude: editForm.value.latitude,
      longitude: editForm.value.longitude,
    })
    const idx = hotels.value.findIndex((h) => h.hotelId === updated.hotelId)
    if (idx >= 0) hotels.value[idx] = updated
    toast.success('Configuración actualizada')
    editTarget.value = null
  } catch (e: any) {
    toast.error(e.message || 'No se pudo guardar')
  } finally {
    saving.value = false
  }
}

function openEscalate(h: ReferredHotelDTO) {
  escalateTarget.value = h
  escalateComment.value = ''
}

async function sendEscalate() {
  if (!escalateTarget.value) return
  saving.value = true
  try {
    await AliadosService.escalateReferredHotel(escalateTarget.value.hotelId, escalateComment.value.trim())
    toast.success('Escalado a SOLMI OS — te contactamos pronto')
    escalateTarget.value = null
  } catch (e: any) {
    toast.error(e.message || 'No se pudo escalar')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    hotels.value = await AliadosService.myReferredHotels()
  } catch {
    // 400/AuthError esperado si no es aliado_certificado activo — el padre decide si muestra
    // este componente según partner.type, así que acá el error simplemente deja la lista vacía.
    hotels.value = []
  } finally {
    loading.value = false
  }
})
</script>
