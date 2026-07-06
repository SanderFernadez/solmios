// empleados/usecases/ownership.ts — Tipo compartido para ownership checks multi-tenant.
// Todos los sub-recursos de empleados (departments, profiles, contracts, documents,
// leave-requests, reviews) tienen hotelId propio en el DTO — el check es directo
// vía auth.assertOwnership(resource.hotelId, user.hotelId, user.role, 'super_admin').

export interface SimpleUser {
  id: string
  role: string
  hotelId?: string
}
