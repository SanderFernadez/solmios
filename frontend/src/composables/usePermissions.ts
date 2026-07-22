// composables/usePermissions.ts — Gateo de UI por permiso granular para los componentes.
// El backend sigue siendo la autoridad (responde 403); esto solo decide qué mostrar/ocultar
// para no ofrecerle al usuario acciones que después le van a fallar.
//
// Los permisos reales del rol llegan en `user.permissions` (login + /auth/me, formato
// `module:action`). Para roles de SISTEMA la app además decide por nombre de rol en otros
// lados; `can()` funciona igual para todos porque el backend ya resuelve sus permisos.
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { hasPermission } from '@/config/permissions'
import { permissionModuleForPath } from '@/config/module-map'

export function usePermissions() {
  const auth = useAuthStore()
  const permissions = computed(() => auth.user?.permissions ?? [])

  /** ¿El usuario tiene `module:action`? Entiende `*:*` y `module:*`. */
  function can(module: string, action: string): boolean {
    return hasPermission(permissions.value, module, action)
  }

  /** ¿Puede entrar a una ruta del panel? CORE (sin módulo mapeado) siempre true. */
  function canRoute(path: string): boolean {
    const mod = permissionModuleForPath(path)
    return !mod || can(mod, 'view')
  }

  return { can, canRoute, permissions }
}
