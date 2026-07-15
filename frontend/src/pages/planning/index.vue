<template>
  <ReservationCalendar />
</template>

<script setup lang="ts">
// La página Planning es un wrapper delgado: toda la lógica del calendario vive en
// <ReservationCalendar>, compartido con el widget del dashboard (home). Una sola fuente
// de verdad — mover/extender/pagar/crear/bloquear/check-in/cancelar se mantienen en un
// único lugar. Sin `embedded` el componente muestra el header de página "Planning".
import ReservationCalendar from '@/components/features/ReservationCalendar.vue'
</script>
