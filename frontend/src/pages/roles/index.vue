<template>
  <div>
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Roles y Permisos</h2>
        <p class="text-sm text-text-muted mt-0.5">Creá roles a medida y definí qué puede hacer cada uno</p>
      </div>
      <button @click="openCreate" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">
        <span class="text-lg leading-none">+</span>Nuevo Rol
      </button>
    </div>

    <div class="mb-5 p-3 rounded-xl bg-navy/5 border border-navy/10 text-xs text-text-secondary">
      Los roles del sistema (Admin, Recepcionista, Limpieza, Mantenimiento) ya vienen configurados. Acá creás
      <b>roles personalizados</b> para tu hotel (ej: Cajero, Gerente de piso) y los asignás al registrar un empleado.
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
    </div>

    <template v-else>
      <!-- Grid de roles custom -->
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <button v-for="role in roles" :key="role.id" @click="select(role)"
          class="text-left bg-white rounded-2xl border-2 p-5 transition-all hover:shadow-lg cursor-pointer"
          :class="selected?.id === role.id ? 'border-navy shadow-md' : 'border-border'">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center text-lg">{{ role.icon }}</div>
              <div>
                <div class="text-sm font-black text-navy">{{ role.name }}</div>
                <div class="text-[10px] text-text-muted">{{ role.users }} usuario(s)</div>
              </div>
            </div>
            <button @click.stop="confirmDelete(role)" class="text-coral hover:bg-coral/10 rounded-lg p-1 cursor-pointer" title="Eliminar rol">
              <span class="w-4 h-4 block" v-html="ICON_TRASH"></span>
            </button>
          </div>
          <div class="text-[10px] text-text-muted">{{ role.permissions.length }} permiso(s)</div>
        </button>

        <button @click="openCreate" class="bg-white rounded-2xl border-2 border-dashed border-border p-5 flex flex-col items-center justify-center min-h-[112px] hover:border-cyan transition-colors cursor-pointer">
          <span class="text-2xl text-text-muted mb-1">+</span>
          <span class="text-xs font-bold text-text-muted">Crear rol personalizado</span>
        </button>
      </div>

      <!-- Matriz de permisos -->
      <div v-if="selected" class="bg-white rounded-2xl border border-border overflow-hidden">
        <div class="p-4 border-b border-border bg-surface/50 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 class="font-extrabold text-navy text-sm">Permisos — {{ selected.name }}</h3>
            <p class="text-[10px] text-text-muted">Marcá lo que puede hacer este rol</p>
          </div>
          <div class="flex gap-2">
            <button @click="selectAll" class="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-surface text-navy hover:bg-navy hover:text-white transition-colors cursor-pointer">Todo</button>
            <button @click="clearAll" class="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-surface text-navy hover:bg-navy hover:text-white transition-colors cursor-pointer">Nada</button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-navy/5">
                <th class="text-left py-3 px-4 text-xs font-black text-navy">Módulo</th>
                <th v-for="a in catalog.actions" :key="a.key" class="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase">{{ a.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in catalog.modules" :key="m.key" class="border-b border-border/40 hover:bg-surface/30 transition-colors">
                <td class="py-2.5 px-4 text-xs font-bold text-navy">{{ m.label }}</td>
                <td v-for="a in catalog.actions" :key="a.key" class="py-2.5 px-3 text-center">
                  <input type="checkbox" :value="`${m.key}:${a.key}`" v-model="selected.permissions"
                    class="w-4 h-4 accent-navy rounded cursor-pointer" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="p-4 border-t border-border flex items-center justify-between">
          <span class="text-xs text-text-muted">{{ selected.permissions.length }} permiso(s) asignado(s)</span>
          <button @click="save" :disabled="saving" class="px-4 py-2 bg-navy text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50">
            {{ saving ? 'Guardando…' : 'Guardar Permisos' }}
          </button>
        </div>
      </div>
    </template>

    <FormModal
      v-if="createModal"
      title="Nuevo Rol"
      :fields="createFields"
      :loading="creating"
      submit-label="Crear Rol"
      @close="createModal = false"
      @submit="create"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RolesService, type Role, type PermissionCatalog } from '@/services/Roles.service'
import FormModal, { type FormField } from '@/components/features/FormModal.vue'
import { useToast } from '@/composables/useToast'

const ICON_TRASH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M6 7.5h12M9.75 7.5v-1.5a1.5 1.5 0 0 1 1.5-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v1.5m-8.25 0 .75 11.25a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5L17.25 7.5"/></svg>'

const toast = useToast()
const loading = ref(true)
const saving = ref(false)
const roles = ref<Role[]>([])
const catalog = ref<PermissionCatalog>({ modules: [], actions: [] })
const selected = ref<Role | null>(null)

async function load() {
  loading.value = true
  try {
    const [r, c] = await Promise.all([RolesService.list(), RolesService.catalog()])
    roles.value = r
    catalog.value = c
    if (selected.value) selected.value = roles.value.find((x) => x.id === selected.value!.id) ?? null
  } catch { toast.error('No se pudieron cargar los roles') }
  finally { loading.value = false }
}
onMounted(load)

function select(role: Role) {
  // Copia editable: no mutar la card del listado hasta guardar.
  selected.value = { ...role, permissions: [...role.permissions] }
}

function selectAll() {
  if (!selected.value) return
  selected.value.permissions = catalog.value.modules.flatMap((m) => catalog.value.actions.map((a) => `${m.key}:${a.key}`))
}
function clearAll() {
  if (selected.value) selected.value.permissions = []
}

async function save() {
  if (!selected.value) return
  saving.value = true
  try {
    await RolesService.update(selected.value.id, { permissions: selected.value.permissions })
    toast.success('Permisos guardados')
    await load()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Error al guardar')
  } finally { saving.value = false }
}

async function confirmDelete(role: Role) {
  if (!confirm(`¿Eliminar el rol "${role.name}"? Los empleados con este rol quedarán sin permisos hasta reasignarlos.`)) return
  try {
    await RolesService.remove(role.id)
    toast.success('Rol eliminado')
    if (selected.value?.id === role.id) selected.value = null
    await load()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Error al eliminar')
  }
}

const createModal = ref(false)
const creating = ref(false)
const createFields: FormField[] = [
  { key: 'name', label: 'Nombre del rol', required: true, minLength: 2, maxLength: 40, placeholder: 'Cajero, Gerente de piso…' },
  { key: 'icon', label: 'Ícono (emoji)', maxLength: 4, default: '👤', placeholder: '👤' },
]
function openCreate() { createModal.value = true }

async function create(values: Record<string, string | number>) {
  creating.value = true
  try {
    const role = await RolesService.create({
      name: String(values.name).trim(),
      icon: String(values.icon || '👤'),
      permissions: [],
    })
    toast.success('Rol creado — ahora asignale permisos')
    createModal.value = false
    await load()
    const fresh = roles.value.find((r) => r.id === role.id)
    if (fresh) select(fresh)
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Error al crear el rol')
  } finally { creating.value = false }
}
</script>
