// accounting/types.ts — Contrato TypeScript del módulo. El schema de DB vive en model.ts.

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'

export interface AccountDTO {
  id: string
  hotelId: string
  code: string
  name: string
  type: AccountType
  parentId?: string
  isPostable?: number
  active?: number
  createdAt: string
  updatedAt: string
}

export interface CreateAccountDTO {
  hotelId?: string        // lo fuerza el service desde el JWT
  code: string
  name: string
  type: AccountType
  parentId?: string
  isPostable?: number
  active?: number
}

export interface UpdateAccountDTO {
  name?: string
  type?: AccountType
  parentId?: string
  isPostable?: number
  active?: number
}

export interface AccountsQuery {
  hotelId?: string
  type?: AccountType
  active?: number
  page?: number
  limit?: number
}

export interface AccountsPaginated {
  data: AccountDTO[]
  total: number
  limit: number
  offset: number
  pages: number
  hasNext: boolean
  hasPrev: boolean
}

// Usuario autenticado del JWT (req.user). Para ownership (IDOR).
export interface CurrentUser {
  id: string
  hotelId?: string | null
  role?: string
}
