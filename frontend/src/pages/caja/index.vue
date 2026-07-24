<script setup lang="ts">
// pages/caja/index.vue — Caja de RECEPCIÓN. La UI vive en CashRegisterView (compartida con la
// caja del restaurante en pages/restaurante/caja.vue); acá solo se elige el service (/caja, mismo
// de siempre) y el copy. El backend separa turno/movimientos por `register` — nunca se mezclan.
import { CajaService } from '@/services/Caja.service'
import CashRegisterView from '@/components/features/CashRegisterView.vue'
</script>

<template>
  <CashRegisterView :service="CajaService" title="Caja" subtitle="Movimientos, turnos y arqueo" />
</template>
