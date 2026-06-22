import { useAuthStore } from '@/stores/auth.store'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function getToken(): string | null {
  return localStorage.getItem('token')
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    throw new ApiError(401, 'Sesión expirada')
  }

  const text = await res.text()
  const raw = text ? JSON.parse(text) : null

  if (!res.ok) {
    // El framework envuelve errores en { success, error }; server.ts usa { error }
    const errObj = raw?.error ?? raw
    const msg = (typeof errObj === 'object' && errObj?.message) || raw?.error || raw?.message || `Error ${res.status}`
    throw new ApiError(res.status, msg)
  }

  // Envelope del framework arckode: { success, data, meta, error }
  if (raw && typeof raw === 'object' && 'success' in raw && 'data' in raw) {
    // Lista paginada: el framework pone el array en `data` y el total en `meta.pagination`
    const pagination = (raw as any).meta?.pagination
    if (pagination && Array.isArray((raw as any).data)) {
      return { data: (raw as any).data, total: pagination.total ?? (raw as any).data.length } as unknown as T
    }
    return (raw as any).data as T
  }

  return raw as T
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
