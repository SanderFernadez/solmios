<script setup lang="ts">
// pages/restaurante/caja.vue — Caja del RESTAURANTE (punto de venta separado de recepción).
// Antes el efectivo del POS caía en el mismo turno único del hotel, gestionable solo por
// hotel_admin — un mesero no podía abrir/cerrar SU turno ni cargar un movimiento manual del salón.
// Ahora es un turno independiente (register='restaurant'), operable por quien tiene permiso
// `restaurant` (hotel_admin/receptionist/waiter).
import { RestaurantCajaService } from '@/services/Caja.service'
import CashRegisterView from '@/components/features/CashRegisterView.vue'
</script>

<template>
  <CashRegisterView :service="RestaurantCajaService" title="Caja del Restaurante"
    subtitle="Turno, movimientos y arqueo del punto de venta"
    empty-message="Registrá un ingreso o un egreso para empezar a mover la caja del restaurante." />
</template>
