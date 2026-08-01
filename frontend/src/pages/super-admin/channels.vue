<template>
  <div class="p-6 max-w-4xl mx-auto space-y-6">
    <div>
      <h1 class="text-2xl font-black text-navy">Canales (Channel Manager)</h1>
      <p class="text-sm text-text-muted mt-1">
        Cuenta Channex de la plataforma. Se configura una sola vez y la usan todos los hoteles para
        sincronizar disponibilidad, tarifas y reservas con las OTAs.
      </p>
    </div>

    <ChannexPlatformConfig />

    <SectionCard title="Cómo conectar un hotel" bodyClass="p-4 sm:p-5 text-sm text-text-secondary space-y-2">
      <ol class="list-decimal list-inside space-y-1">
        <li>Cargá acá la <b>API key</b> de Channex y elegí el entorno (Staging para probar).</li>
        <li>Tocá <b>Probar conexión</b> — tiene que dar ✓.</li>
        <li>En el panel del hotel → <b>Canales</b> → <b>Sincronizar</b> (crea la <i>property</i> del hotel bajo esta cuenta).</li>
        <li>Al crear una reserva, la disponibilidad se empuja a Channex automáticamente.</li>
      </ol>
    </SectionCard>
  </div>
</template>

<script setup lang="ts">
import ChannexPlatformConfig from '@/components/features/ChannexPlatformConfig.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
</script>
