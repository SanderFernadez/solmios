<template>
  <div>
    <div class="flex items-center justify-between mb-6 gap-3 flex-wrap">
      <div>
        <h2 class="text-xl font-black text-navy">Organigrama</h2>
        <p class="text-sm text-text-muted mt-0.5">Estructura de departamentos y personal — {{ total }} empleados</p>
      </div>
      <router-link to="/panel/rrhh/empleados" class="text-xs font-bold text-navy hover:underline">← Volver a Empleados</router-link>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
    </div>

    <div v-else-if="!roots.length" class="card p-12 text-center text-sm text-text-muted">
      No hay departamentos cargados. Creá departamentos para ver el organigrama.
    </div>

    <div v-else class="overflow-x-auto pb-6">
      <div class="flex items-start gap-10 min-w-max px-4 py-4">
        <OrgNode v-for="root in roots" :key="root.id" :node="root" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { EmpleadosService, type OrgChartNode } from '@/services/Empleados.service'
import { useToast } from '@/composables/useToast'
import OrgNode from '@/components/features/OrgNode.vue'

const toast = useToast()
const loading = ref(true)
const roots = ref<OrgChartNode[]>([])
const total = ref(0)

onMounted(async () => {
  try {
    const chart = await EmpleadosService.getOrgChart()
    roots.value = chart.departments
    total.value = chart.totalEmployees
  } catch { toast.error('No se pudo cargar el organigrama') }
  finally { loading.value = false }
})
</script>
