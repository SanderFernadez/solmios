// channelLogos.ts — Brand logos/icons for OTAs & channels (Channel Manager).
// Single source of truth so every channel is identifiable at a glance, even when
// the backend catalog (`Configuration.canales_ota`) is empty or lacks an icon.
// All SVGs are INLINE (no external requests / remote images — project rule).
// Match is done by channel name, slug or OTA/Channex code (case/format insensitive).

export interface ChannelLogo {
  /** Inline SVG markup. Empty string when there is no brand mark → use `initial` badge. */
  icon: string
  /** First letter of the channel, for the fallback color badge. */
  initial: string
  /** Tailwind background utility for the icon container. */
  bgColor: string
  /** Tailwind text/fill utility for the icon (SVGs use currentColor / fill). */
  iconColor: string
  /** True when a known brand was identified; false when using the generic fallback. */
  matched: boolean
}

// --- Official brand marks (simple-icons paths, monochrome, tinted via currentColor) ---
const ICON_AIRBNB = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="currentColor"><path d="M12.001 18.275c-1.353-1.697-2.148-3.184-2.413-4.457-.263-1.027-.16-1.848.291-2.465.477-.71 1.188-1.056 2.121-1.056s1.643.345 2.12 1.063c.446.61.558 1.432.286 2.465-.291 1.298-1.085 2.785-2.412 4.458zm9.601 1.14c-.185 1.246-1.034 2.28-2.2 2.783-2.253.98-4.483-.583-6.392-2.704 3.157-3.951 3.74-7.028 2.385-9.018-.795-1.14-1.933-1.695-3.394-1.695-2.944 0-4.563 2.49-3.927 5.382.37 1.565 1.352 3.343 2.917 5.332-.98 1.085-1.91 1.856-2.732 2.333-.636.344-1.245.558-1.828.609-2.679.399-4.778-2.2-3.825-4.88.132-.345.395-.98.845-1.961l.025-.053c1.464-3.178 3.242-6.79 5.285-10.795l.053-.132.58-1.116c.45-.822.635-1.19 1.351-1.643.346-.21.77-.315 1.246-.315.954 0 1.698.558 2.016 1.007.158.239.345.557.582.953l.558 1.089.08.159c2.041 4.004 3.821 7.608 5.279 10.794l.026.025.533 1.22.318.764c.243.613.294 1.222.213 1.858zm1.22-2.39c-.186-.583-.505-1.271-.9-2.094v-.03c-1.889-4.006-3.642-7.608-5.307-10.844l-.111-.163C15.317 1.461 14.468 0 12.001 0c-2.44 0-3.476 1.695-4.535 3.898l-.081.16c-1.669 3.236-3.421 6.843-5.303 10.847v.053l-.559 1.22c-.21.504-.317.768-.345.847C-.172 20.74 2.611 24 5.98 24c.027 0 .132 0 .265-.027h.372c1.75-.213 3.554-1.325 5.384-3.317 1.829 1.989 3.635 3.104 5.382 3.317h.372c.133.027.239.027.265.027 3.37.003 6.152-3.261 4.802-6.975z"/></svg>'
const ICON_BOOKING = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="currentColor"><path d="M24 0H0v24h24ZM8.575 6.563h2.658c2.108 0 3.473 1.15 3.473 2.898 0 1.15-.575 1.82-.91 2.108l-.287.263.335.192c.815.479 1.318 1.389 1.318 2.395 0 1.988-1.51 3.257-3.857 3.257H7.449V7.713c0-.623.503-1.126 1.126-1.15zm1.7 1.868c-.479.024-.694.264-.694.79v1.893h1.676c.958 0 1.294-.743 1.294-1.365 0-.815-.503-1.318-1.318-1.318zm-.096 4.36c-.407.071-.598.31-.598.79v2.251h1.868c.934 0 1.509-.55 1.509-1.533 0-.934-.599-1.509-1.51-1.509zm7.737 2.394c.743 0 1.341.599 1.341 1.342a1.34 1.34 0 0 1-1.341 1.341 1.355 1.355 0 0 1-1.341-1.341c0-.743.598-1.342 1.34-1.342z"/></svg>'
const ICON_EXPEDIA = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="currentColor"><path d="M19.067 0H4.933A4.94 4.94 0 0 0 0 4.933v14.134A4.932 4.932 0 0 0 4.933 24h14.134A4.932 4.932 0 0 0 24 19.067V4.933C24.01 2.213 21.797 0 19.067 0ZM7.336 19.341c0 .19-.148.337-.337.337h-2.33a.333.333 0 0 1-.337-.337v-2.33c0-.189.148-.336.337-.336H7c.19 0 .337.147.337.337zm12.121-1.486-2.308 2.298c-.169.168-.422.053-.422-.2V9.57l-6.44 6.44a.533.533 0 0 1-.421.17H8.169a.32.32 0 0 1-.338-.338v-1.697c0-.2.053-.316.169-.422l6.44-6.44H4.058c-.253 0-.369-.253-.2-.421l2.297-2.309c.137-.137.285-.232.517-.232H18.15c.854 0 1.539.686 1.539 1.54v11.478c-.01.231-.095.368-.232.516z"/></svg>'
const ICON_GOOGLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>'
const ICON_TRIP = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="currentColor"><path d="M17.834 9.002c-.68 0-1.29.31-1.707.799v-.514h-1.708v8.348h1.897v-2.923c.416.344.943.551 1.518.551 1.677 0 3.036-1.401 3.036-3.13s-1.36-3.13-3.036-3.13zm-.19 4.516c-.733 0-1.328-.62-1.328-1.385s.595-1.385 1.328-1.385c.734 0 1.328.62 1.328 1.385s-.594 1.385-1.328 1.385zm6.356.607a1.138 1.138 0 1 1-2.277 0 1.138 1.138 0 0 1 2.277 0zM13.205 7.428a1.062 1.062 0 1 1-2.125 0 1.062 1.062 0 0 1 2.125 0zm-2.011 1.859h1.897v5.692h-1.897V9.287zM6.83 8.225H4.364v6.754H2.466V8.225H0V6.63h6.83v1.594zm3.035 1.033c.13 0 .255.012.38.03v1.74a1.55 1.55 0 0 0-.297-.031c-.88 0-1.594.612-1.594 1.593v2.389H6.451V9.287h1.707v.9c.363-.558.991-.93 1.707-.93z"/></svg>'

// --- Representative icons for brands without a clean official mark ---
const ICON_BED = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 14h18M3 18v2m18-2v2M7 10V8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2m0 0V8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2"/></svg>'
const ICON_PALM = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21V10m0 0c-2-3-6-4-9-2 2 1 4 1 6 0-1 2-4 3-6 5 3 0 6-1 9-3Zm0 0c2-3 6-4 9-2-2 1-4 1-6 0 1 2 4 3 6 5-3 0-6-1-9-3Z"/></svg>'
const ICON_PLANE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="currentColor"><path d="m21.5 15-6-2-1-6.5c-.1-.6-.6-1-1.2-1s-1.1.4-1.2 1L11 13l-6 2v2l6-1 1 5-2 1v1.5l3-1 3 1V21l-2-1 1-5 6 1v-2Z"/></svg>'
const ICON_BUILDING = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1"/></svg>'
const ICON_HOUSE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 11.5 12 4l9 7.5M5.5 9.75V20h13V9.75M10 20v-5h4v5"/></svg>'
const ICON_GLOBE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5-2.5 3.75-5.5 3.75-9S14.5 5.5 12 3M12 21c-2.5-2.5-3.75-5.5-3.75-9S9.5 5.5 12 3M3.5 9h17M3.5 15h17"/></svg>'
/** Generic link icon — last-resort fallback when nothing matches. */
export const ICON_CHANNEL_LINK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 0 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1"/></svg>'

interface BrandEntry {
  icon: string
  bgColor: string
  iconColor: string
  /** Substrings (normalized) that identify this brand by name / slug / OTA code. */
  keywords: string[]
}

// Order matters: first match wins. Keep more specific keywords earlier.
const BRANDS: BrandEntry[] = [
  { icon: ICON_AIRBNB,  bgColor: 'bg-coral/10',  iconColor: 'text-coral',  keywords: ['airbnb'] },
  { icon: ICON_BOOKING, bgColor: 'bg-blue/10',   iconColor: 'text-blue',   keywords: ['bookingcom', 'booking', 'bdc'] },
  { icon: ICON_EXPEDIA, bgColor: 'bg-gold/10',   iconColor: 'text-gold',   keywords: ['aexpedia', 'expedia'] },
  { icon: ICON_GOOGLE,  bgColor: 'bg-blue/10',   iconColor: 'text-blue',   keywords: ['googlehotels', 'googlehotel', 'google', 'gha'] },
  { icon: ICON_TRIP,    bgColor: 'bg-teal/10',   iconColor: 'text-teal',   keywords: ['tripcom', 'trip', 'ctrip'] },
  { icon: ICON_BED,     bgColor: 'bg-purple/10', iconColor: 'text-purple', keywords: ['hotelscom', 'hotels'] },
  { icon: ICON_PALM,    bgColor: 'bg-cyan/10',   iconColor: 'text-cyan',   keywords: ['agoda'] },
  { icon: ICON_PLANE,   bgColor: 'bg-gold/10',   iconColor: 'text-gold',   keywords: ['despegar', 'decolar'] },
  { icon: ICON_BUILDING,bgColor: 'bg-gold/10',   iconColor: 'text-gold',   keywords: ['hostelworld', 'hostel', 'hw'] },
  { icon: ICON_HOUSE,   bgColor: 'bg-teal/10',   iconColor: 'text-teal',   keywords: ['vrbo', 'homeaway'] },
  { icon: ICON_GLOBE,   bgColor: 'bg-cyan/10',   iconColor: 'text-cyan',   keywords: ['ostrovok'] },
  { icon: ICON_BED,     bgColor: 'bg-coral/10',  iconColor: 'text-coral',  keywords: ['hostelworldgroup'] },
  { icon: ICON_GLOBE,   bgColor: 'bg-purple/10', iconColor: 'text-purple', keywords: ['travelgate', 'hotelbeds', 'gimmonix'] },
]

const NEUTRAL: ChannelLogo = { icon: ICON_CHANNEL_LINK, initial: '?', bgColor: 'bg-gray-100', iconColor: 'text-navy', matched: false }

/** Normalize a name/code: lowercase, drop everything but a-z0-9. */
function normalize(input: string): string {
  return String(input || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Resolve the brand logo for a channel by its name, slug or OTA/Channex code.
 * Falls back to a generic link icon; when even the name is empty, `initial` is '?'.
 * Callers can render `initial` in a color badge when `icon` isn't a brand mark.
 */
export function resolveChannelLogo(nameOrCode?: string, ...aliases: (string | undefined)[]): ChannelLogo {
  const candidates = [nameOrCode, ...aliases].map((s) => normalize(s ?? '')).filter(Boolean)
  const initial = (nameOrCode || '').trim().charAt(0).toUpperCase() || '?'
  for (const brand of BRANDS) {
    const hit = brand.keywords.some(k => candidates.some(c => c.includes(k)))
    if (hit) return { icon: brand.icon, initial, bgColor: brand.bgColor, iconColor: brand.iconColor, matched: true }
  }
  return { ...NEUTRAL, initial }
}
