<template>
  <!-- Logo de marca real del canal/OTA. Cae a un ícono genérico de hotel para "directa"/desconocido. -->
  <span class="channel-icon" :style="{ width: size + 'px', height: size + 'px' }" :title="label">
    <!-- Airbnb (Bélo) -->
    <svg v-if="key === 'airbnb'" :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#FF5A5F" d="M22.515 15.335c-.117-.281-.234-.586-.351-.844-.187-.42-.375-.82-.539-1.195l-.023-.023c-1.618-3.516-3.352-7.078-5.179-10.594l-.07-.14c-.187-.352-.374-.727-.562-1.102-.234-.421-.468-.867-.843-1.29C14.19.61 13.15.07 12.011.07c-1.163 0-2.179.54-2.937 1.523-.351.399-.586.844-.82 1.266-.188.375-.375.75-.563 1.101l-.07.141c-1.804 3.516-3.562 7.078-5.18 10.594l-.023.047c-.164.375-.351.773-.539 1.194-.117.258-.234.54-.351.844-.305.867-.399 1.687-.281 2.531.257 1.758 1.428 3.235 3.045 3.891.61.246 1.24.363 1.898.363.187 0 .421-.023.609-.047.774-.093 1.571-.34 2.343-.796.961-.54 1.874-1.313 2.905-2.436 1.03 1.123 1.968 1.897 2.905 2.436.772.457 1.569.703 2.343.796.188.024.422.047.609.047.657 0 1.312-.117 1.898-.363 1.641-.656 2.789-2.156 3.047-3.89.14-.845.047-1.665-.258-2.532zM12.011 17.047c-1.265-1.594-2.085-3.094-2.367-4.36-.117-.539-.14-1.007-.07-1.428.047-.375.187-.703.375-.984.445-.633 1.196-1.032 2.062-1.032.867 0 1.641.375 2.063 1.032.187.281.328.609.375.984.07.421.047.914-.07 1.428-.282 1.243-1.102 2.743-2.368 4.36zm9.234 2.812c-.164 1.219-.984 2.273-2.133 2.742-.562.234-1.172.305-1.781.234-.586-.07-1.172-.257-1.781-.609-.844-.469-1.688-1.196-2.649-2.25 1.523-1.875 2.446-3.586 2.797-5.11.164-.727.187-1.383.117-1.992-.094-.586-.305-1.125-.633-1.594-.727-1.031-1.945-1.617-3.305-1.617s-2.578.61-3.305 1.617c-.328.469-.539 1.008-.633 1.594-.094.61-.047 1.29.117 1.992.352 1.524 1.29 3.258 2.79 5.133-.938 1.054-1.805 1.781-2.649 2.25-.609.352-1.195.54-1.781.609-.633.07-1.243-.023-1.781-.234-1.149-.469-1.969-1.523-2.133-2.742-.07-.586-.023-1.172.211-1.828.07-.211.164-.422.281-.68.164-.375.352-.773.539-1.171l.024-.047c1.617-3.492 3.351-7.055 5.156-10.547l.07-.14c.187-.352.375-.727.562-1.078.188-.375.399-.727.657-1.008.492-.563 1.148-.867 1.875-.867.726 0 1.382.304 1.875.867.257.281.468.633.656 1.008.187.351.375.726.562 1.078l.07.14c1.782 3.516 3.516 7.078 5.133 10.57v.024c.187.375.352.796.539 1.171.117.258.211.469.281.68.234.633.281 1.219.211 1.805z"/>
    </svg>

    <!-- Booking.com -->
    <svg v-else-if="key === 'booking'" :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#003580"/>
      <text x="11.5" y="17.5" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="800" fill="#fff">B.</text>
    </svg>

    <!-- Expedia -->
    <svg v-else-if="key === 'expedia'" :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#00355F"/>
      <path fill="#FDBB2E" d="M4 12.2l14-6.2-6 13-2.1-4.9L4 12.2z"/>
    </svg>

    <!-- Google -->
    <svg v-else-if="key === 'google'" :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.07H2.18a11 11 0 000 9.87l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>

    <!-- WhatsApp -->
    <svg v-else-if="key === 'whatsapp'" :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#25D366"/>
      <path fill="#fff" d="M12.01 4.5A7.5 7.5 0 005.6 15.86L4.6 19.5l3.74-.98A7.5 7.5 0 1012.01 4.5zm0 1.5a6 6 0 015.13 9.1l.34.55-.62 2.26-2.3-.6-.35.2A6 6 0 1112.01 6zm-2.6 2.9c-.14 0-.36.05-.55.26-.19.2-.72.7-.72 1.72 0 1.01.74 1.99.84 2.13.1.13 1.44 2.3 3.56 3.13 1.76.7 2.12.56 2.5.52.38-.03 1.23-.5 1.4-.99.18-.48.18-.9.13-.98-.05-.09-.19-.14-.4-.24-.2-.1-1.23-.6-1.42-.67-.19-.07-.33-.1-.47.1-.14.21-.54.68-.66.82-.12.14-.24.16-.45.05-.2-.1-.86-.32-1.63-1.01-.6-.54-1.01-1.2-1.13-1.4-.12-.21-.01-.32.09-.42.09-.09.2-.24.3-.36.1-.12.13-.2.2-.34.06-.14.03-.26-.02-.36-.05-.1-.46-1.13-.63-1.54-.16-.4-.33-.34-.46-.35h-.4z"/>
    </svg>

    <!-- Teléfono -->
    <svg v-else-if="key === 'phone'" :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#64748B"/>
      <path fill="#fff" d="M17.5 14.9c-.9 0-1.8-.15-2.65-.43a.9.9 0 00-.92.22l-1.4 1.4a12.3 12.3 0 01-4.6-4.6l1.4-1.4a.9.9 0 00.22-.92 8.4 8.4 0 01-.43-2.65.9.9 0 00-.9-.9H6a.9.9 0 00-.9.9c0 6.9 5.6 12.5 12.5 12.5a.9.9 0 00.9-.9v-2.55a.9.9 0 00-.9-.9z"/>
    </svg>

    <!-- Directa / desconocido: ícono genérico de hotel (no es marca) -->
    <svg v-else :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#117A65"/>
      <path fill="#fff" d="M6 18.5v-11c0-.55.45-1 1-1h6c.55 0 1 .45 1 1v3.5h3c.55 0 1 .45 1 1v6.5H6zm2-9h2v1.5H8V9.5zm0 3.5h2v1.5H8V13zm7 0h2v4h-2v-4z"/>
    </svg>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ channel?: string; size?: number }>(), { channel: 'direct', size: 18 })

// Normaliza alias del canal al set con logo. Todo lo no reconocido cae al ícono de hotel (directa).
const ALIAS: Record<string, string> = {
  direct: 'direct', directa: 'direct', walk_in: 'direct', email: 'direct',
  booking: 'booking', 'booking.com': 'booking',
  expedia: 'expedia', airbnb: 'airbnb', google: 'google', whatsapp: 'whatsapp', phone: 'phone',
}
const LABELS: Record<string, string> = {
  direct: 'Directa', booking: 'Booking.com', expedia: 'Expedia',
  airbnb: 'Airbnb', google: 'Google', whatsapp: 'WhatsApp', phone: 'Teléfono',
}
const key = computed(() => ALIAS[(props.channel || 'direct').toLowerCase()] || 'direct')
const label = computed(() => LABELS[key.value] || props.channel || 'Directa')
</script>

<style scoped>
.channel-icon { display: inline-flex; align-items: center; justify-content: center; line-height: 0; vertical-align: middle; }
.channel-icon svg { display: block; }
</style>
