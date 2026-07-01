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

let _redirecting = false
function forceLogout() {
  if (_redirecting) return
  _redirecting = true
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  // Evitar loop: no redirigir si ya estamos en /login
  if (!location.pathname.startsWith('/login')) {
    location.href = '/login'
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  // FormData (multipart): el browser setea el boundary; NO forzar Content-Type ni stringificar.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const headers: Record<string, string> = isFormData ? {} : { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const url = path.startsWith('/api') ? path : `/api${path}`
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? (isFormData ? (body as FormData) : JSON.stringify(body)) : undefined,
  })

  if (res.status === 401) {
    forceLogout()
    throw new ApiError(401, 'Sesión expirada')
  }

  const text = await res.text()

  // Detect HTML response (backend error page / redirect)
  if (text && text.trimStart().startsWith('<')) {
    throw new ApiError(res.status, `El servidor respondió HTML en vez de JSON (HTTP ${res.status}). Verificá que el backend esté corriendo en el puerto correcto.`)
  }

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
  /** Descarga binaria (PDF, etc.) con el mismo token JWT. Devuelve Blob para descarga/preview. */
  async getBlob(path: string): Promise<Blob> {
    const headers: Record<string, string> = {}
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
    const url = path.startsWith('/api') ? path : `/api${path}`
    const res = await fetch(url, { method: 'GET', headers })
    if (res.status === 401) { forceLogout(); throw new ApiError(401, 'Sesión expirada') }
    if (!res.ok) throw new ApiError(res.status, `Error ${res.status} al descargar`)
    return res.blob()
  },
}
