<template>
  <CommandCenterHeader
    :hotel-name="hotelName"
    :star-rating="hotelStars"
    :api-online="apiOnline"
    :last-sync="lastSync"
    :weather="weather"
    :alerts="alerts"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import CommandCenterHeader, { type WeatherInfo } from '@/components/features/dashboard/CommandCenterHeader.vue'
import { HotelService, type HotelData } from '@/services/Hotel.service'
import { ChannelService } from '@/services/Channel.service'
import { useAuthStore } from '@/stores/auth.store'
import { useDashboardStore } from '@/stores/dashboard.store'

// Header global del panel: la misma barra "command center" del dashboard, en todas las páginas.
const auth = useAuthStore()
const dashboard = useDashboardStore()

const hotelData = ref<HotelData | null>(null)
const apiOnline = ref(true)
const lastSync = ref<string | null>(null)
const weather = ref<WeatherInfo | null>(null)

const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))
const hotelName = computed(() => hotelData.value?.name || auth.currentHotel || 'Mi Hotel')
const hotelStars = computed(() => hotelData.value?.starRating ?? null)
// Incidencias abiertas: reactivo al dashboard store si ya fue cargado; si no, 0 → "ONLINE".
const alerts = computed(() => dashboard.stats?.openIncidents ?? 0)

// Clima (open-meteo, sin API key — solo si el hotel tiene coordenadas). Copiado del dashboard.
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast'
const WMO_MAP: Array<{ codes: number[]; label: string; icon: string }> = [
  { codes: [0], label: 'Despejado', icon: '☀️' },
  { codes: [1, 2], label: 'Parcialmente nublado', icon: '⛅' },
  { codes: [3], label: 'Nublado', icon: '☁️' },
  { codes: [45, 48], label: 'Niebla', icon: '🌫️' },
  { codes: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67], label: 'Lluvia', icon: '🌧️' },
  { codes: [71, 73, 75, 77, 85, 86], label: 'Nieve', icon: '❄️' },
  { codes: [80, 81, 82], label: 'Chubascos', icon: '🌦️' },
  { codes: [95, 96, 99], label: 'Tormenta', icon: '⛈️' },
]

async function fetchWeather() {
  const lat = Number(hotelData.value?.latitude)
  const lon = Number(hotelData.value?.longitude)
  if (!lat || !lon) { weather.value = null; return }
  try {
    const res = await fetch(`${WEATHER_API}?latitude=${lat}&longitude=${lon}&current_weather=true`)
    if (!res.ok) return
    const cw = (await res.json())?.current_weather
    if (!cw) return
    const meta = WMO_MAP.find((m) => m.codes.includes(Number(cw.weathercode))) ?? { label: 'Clima', icon: '🌤️' }
    weather.value = { temp: Number(cw.temperature), label: meta.label, icon: meta.icon }
  } catch { weather.value = null }
}

onMounted(async () => {
  try { hotelData.value = ((await HotelService.settings(hotelId.value)) as any)?.hotel ?? null } catch { /* sin datos */ }
  try { lastSync.value = (await ChannelService.status(hotelId.value)).lastSync ?? null; apiOnline.value = true } catch { apiOnline.value = false }
  await fetchWeather()
})
</script>
