<template>
  <div class="p-6 max-w-3xl mx-auto space-y-6">
    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-black text-navy">Módulos del producto</h1>
        <p class="text-sm text-text-muted mt-1">
          Activá o desactivá módulos para todos los hoteles. Los desactivados desaparecen del menú del panel del hotel.
          Dashboard, Configuración y Soporte son base y siempre están activos.
        </p>
      </div>
      <button @click="save" :disabled="saving || !dirty"
        class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-black hover:bg-navy/90 disabled:opacity-40 cursor-pointer">
        {{ saving ? 'Guardando…' : 'Guardar cambios' }}
      </button>
    </div>

    <div class="bg-white rounded-2xl border border-border card-shadow divide-y divide-border">
      <div v-for="m in catalog" :key="m.key" class="flex items-center justify-between gap-4 p-5">
        <div>
          <div class="font-black text-navy">{{ m.label }}</div>
          <div class="text-sm text-text-muted">{{ m.description }}</div>
        </div>
        <button @click="toggle(m.key)" type="button"
          class="w-12 h-6 rounded-full relative transition-colors cursor-pointer shrink-0"
          :class="state[m.key] ? 'bg-teal' : 'bg-gray-300'"
          :aria-pressed="state[m.key]" :title="state[m.key] ? 'Activado' : 'Desactivado'">
          <span class="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow" :class="state[m.key] ? 'right-0.5' : 'left-0.5'"></span>
        </button>
      </div>
      <div v-if="!catalog.length" class="p-6 text-center text-sm text-text-muted">Cargando módulos…</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ModulesService, type ModuleMeta, type ModuleState } from '@/services/Platform.service'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const catalog = ref<ModuleMeta[]>([])
const state = ref<ModuleState>({})
const saved = ref<ModuleState>({})
const saving = ref(false)

const dirty = computed(() => catalog.value.some(m => state.value[m.key] !== saved.value[m.key]))

function toggle(key: string) { state.value = { ...state.value, [key]: !state.value[key] } }

async function load() {
  try {
    const r = await ModulesService.adminGet()
    catalog.value = r.catalog || []
    state.value = { ...r.state }
    saved.value = { ...r.state }
  } catch { toast.error('No se pudieron cargar los módulos') }
}
async function save() {
  saving.value = true
  try {
    const r = await ModulesService.adminSave(state.value)
    state.value = { ...r.state }
    saved.value = { ...r.state }
    toast.success('Módulos actualizados')
  } catch { toast.error('No se pudieron guardar los módulos') }
  finally { saving.value = false }
}

onMounted(load)
</script>
