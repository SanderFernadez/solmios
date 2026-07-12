<template>
  <div class="flex flex-col items-center">
    <!-- Tarjeta del departamento -->
    <div class="card px-4 py-3 min-w-[180px] max-w-[240px] text-center border-t-4" :style="{ borderTopColor: 'var(--color-cyan, #22d3ee)' }">
      <div class="font-black text-navy text-sm truncate">{{ node.name }}</div>
      <div v-if="node.description" class="text-[10px] text-text-muted truncate">{{ node.description }}</div>
      <div class="mt-2 space-y-1">
        <div v-for="e in node.employees" :key="e.id" class="flex items-center gap-1.5 text-left">
          <span class="w-1.5 h-1.5 rounded-full bg-teal shrink-0"></span>
          <span class="text-[11px] text-text-secondary truncate">{{ e.userName || e.position || 'Empleado' }}</span>
        </div>
        <div v-if="node.employees.length === 0" class="text-[10px] text-text-muted italic">Sin personal</div>
      </div>
    </div>

    <!-- Conector + hijos -->
    <template v-if="node.children.length">
      <div class="w-px h-5 bg-border"></div>
      <div class="flex items-start gap-6 pt-0 relative">
        <div class="absolute top-0 left-0 right-0 h-px bg-border" v-if="node.children.length > 1"></div>
        <div v-for="child in node.children" :key="child.id" class="flex flex-col items-center">
          <div class="w-px h-5 bg-border -mt-5" v-if="node.children.length > 1"></div>
          <OrgNode :node="child" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { OrgChartNode } from '@/services/Empleados.service'
defineProps<{ node: OrgChartNode }>()
</script>
