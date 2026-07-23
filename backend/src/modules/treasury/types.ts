// treasury/types.ts — Contrato TypeScript del módulo. Schema de DB en model.ts.

export interface SupplierDTO {
  id: string
  hotelId: string
  name: string
  taxId?: string
  contact?: string
  email?: string
  phone?: string
  active?: number
  createdAt: string
  updatedAt: string
}

export interface CreateSupplierDTO {
  hotelId?: string
  name: string
  taxId?: string
  contact?: string
  email?: string
  phone?: string
  active?: number
}

export interface UpdateSupplierDTO {
  name?: string
  taxId?: string
  contact?: string
  email?: string
  phone?: string
  active?: number
}

// Usuario autenticado del JWT (req.user). Para ownership (IDOR).
export interface CurrentUser {
  id: string
  hotelId?: string | null
  role?: string
}
