// usuarios/usecases/assignable-role.ts — Qué rol puede asignar quién al crear un usuario.
//
// Dos fuentes: la jerarquía de roles del SISTEMA (un hotel_admin no crea otro admin ni un super_admin)
// y los roles PERSONALIZADOS del propio hotel (que antes no se podían asignar: se creaban pero quedaban
// inutilizables). Los custom llegan ya filtrados por hotelId, así que nadie asigna el rol de otro hotel.

const SYSTEM_HIERARCHY: Record<string, string[]> = {
  super_admin: ['super_admin', 'hotel_admin', 'receptionist', 'housekeeper', 'maintenance', 'supervisor'],
  hotel_admin: ['receptionist', 'housekeeper', 'maintenance', 'supervisor'],
  receptionist: ['housekeeper', 'maintenance'],
}

/** Roles del sistema que `callerRole` puede asignar (por jerarquía). */
export function systemRolesForCreator(callerRole: string): string[] {
  return SYSTEM_HIERARCHY[callerRole] ?? []
}

/**
 * ¿`callerRole` puede asignar `targetRole`?
 * @param customHotelRoles nombres de roles personalizados del hotel del creador (ya scoped por hotelId).
 */
export function canAssignRole(callerRole: string, targetRole: string, customHotelRoles: string[] = []): boolean {
  return systemRolesForCreator(callerRole).includes(targetRole) || customHotelRoles.includes(targetRole)
}
