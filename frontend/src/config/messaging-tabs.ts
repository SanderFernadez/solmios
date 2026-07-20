// Fuente ÚNICA de las tabs de Mensajería. La usan la página contenedora
// (src/pages/mensajeria/index.vue) para decidir qué tab renderiza y el menú
// (AdminLayout) para decidir si la entrada "Mensajería" se muestra.
//
// `path` es la ruta ORIGINAL de cada vista: sigue siendo la clave de gateo en
// module-map.ts (settings.auto-messages, settings.push, ...). Colapsar las
// vistas en tabs no debe colapsar sus permisos: cada tab se gatea por su
// propia ruta, igual que cuando eran items sueltos del menú.

export interface MessagingTab {
  /** Valor del query param `?tab=`. Coincide con el último segmento de la ruta vieja. */
  value: string
  label: string
  /** Ruta original — clave de gateo por módulo y destino de los redirects legacy. */
  path: string
  roles: string[]
}

export const MESSAGING_PATH = '/panel/mensajeria'

export const MESSAGING_TABS: MessagingTab[] = [
  { value: 'auto-messages', label: 'Envíos Auto', path: '/panel/auto-messages', roles: ['hotel_admin'] },
  { value: 'whatsapp-templates', label: 'Plantillas WhatsApp', path: '/panel/whatsapp-templates', roles: ['hotel_admin', 'receptionist'] },
  { value: 'message-logs', label: 'Historial de Envíos', path: '/panel/message-logs', roles: ['hotel_admin', 'receptionist'] },
  { value: 'email-queue', label: 'Cola de Emails', path: '/panel/email-queue', roles: ['hotel_admin'] },
  { value: 'push-tokens', label: 'Notificaciones Push', path: '/panel/push-tokens', roles: ['hotel_admin'] },
]

/** Rutas viejas que ahora redirigen a la tab equivalente. */
export const MESSAGING_LEGACY_PATHS = MESSAGING_TABS.map(t => t.path)
