<template>
  <div class="p-6 max-w-3xl mx-auto space-y-6">
    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-black text-navy">Módulos del producto</h1>
        <p class="text-sm text-text-muted mt-1">
          Activá o desactivá módulos para todos los hoteles. Los desactivados desaparecen del menú del panel del hotel.
          Cada módulo puede tener submódulos que se controlan por separado. Dashboard, Configuración y Soporte son base y siempre están activos.
        </p>
      </div>
      <button @click="save" :disabled="saving || !dirty"
        class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-black hover:bg-navy/90 disabled:opacity-40 cursor-pointer shrink-0">
        {{ saving ? 'Guardando…' : 'Guardar cambios' }}
      </button>
    </div>

    <div class="space-y-4">
      <div v-for="m in catalog" :key="m.key" class="bg-white rounded-2xl border border-border card-shadow overflow-hidden">
        <!-- Módulo -->
        <div class="flex items-center justify-between gap-4 p-5">
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

        <!-- Submódulos -->
        <div v-if="m.submodules?.length" class="border-t border-border bg-surface/40" :class="{ 'opacity-50': !state[m.key] }">
          <div v-for="s in m.submodules" :key="s.key" class="flex items-center justify-between gap-4 pl-8 pr-5 py-3 border-b border-border/60 last:border-b-0">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-1.5 h-1.5 rounded-full bg-border shrink-0"></span>
              <div class="min-w-0">
                <div class="text-sm font-bold text-navy truncate">{{ s.label }}</div>
                <div class="text-xs text-text-muted truncate">{{ s.description }}</div>
              </div>
            </div>
            <button @click="toggle(s.key)" type="button" :disabled="!state[m.key]"
              class="w-10 h-5 rounded-full relative transition-colors cursor-pointer shrink-0 disabled:cursor-not-allowed"
              :class="state[s.key] ? 'bg-teal' : 'bg-gray-300'"
              :aria-pressed="state[s.key]" :title="!state[m.key] ? 'El módulo está desactivado' : (state[s.key] ? 'Activado' : 'Desactivado')">
              <span class="w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow" :class="state[s.key] ? 'right-0.5' : 'left-0.5'"></span>
            </button>
          </div>
        </div>
      </div>
      <div v-if="!catalog.length" class="bg-white rounded-2xl border border-border p-6 text-center text-sm text-text-muted">Cargando módulos…</div>
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

// Todas las claves (módulos + submódulos) para comparar cambios.
const allKeys = computed(() => catalog.value.flatMap(m => [m.key, ...(m.submodules ?? []).map(s => s.key)]))
const dirty = computed(() => allKeys.value.some(k => state.value[k] !== saved.value[k]))

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
