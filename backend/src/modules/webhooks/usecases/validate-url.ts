// webhooks/usecases/validate-url.ts — Guard anti-SSRF para URLs de webhooks salientes.
//
// Un webhook saliente es, por diseño, un `fetch()` a una URL que el hotel_admin elige libremente.
// Sin este chequeo, cualquier hotel (tenant pagante, no necesariamente confiable) podría apuntar el
// webhook a `http://localhost:3000/...`, a la red interna del VPS (Postgres, otros servicios) o al
// endpoint de metadata de la nube (`169.254.169.254`) y usar el servidor como proxy ciego hacia
// esos destinos. Se valida en dos momentos: al crear/editar (falla rápido, buen UX) y de nuevo
// justo antes de cada `fetch()` en el dispatcher (mitiga DNS rebinding — el hostname pudo resolver
// a una IP pública al crear el webhook y a una privada más tarde).

import { promises as dns } from 'dns'
import { isIP } from 'net'
import { ValidationError } from 'arckode-framework'

function isPrivateOrLocalIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true // malformado → tratar como no-público
  const [a, b] = parts
  if (a === 127) return true // loopback
  if (a === 10) return true // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 169 && b === 254) return true // link-local + metadata cloud (169.254.169.254)
  if (a === 0) return true // 0.0.0.0/8
  return false
}

function isPrivateOrLocalIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase()
  if (normalized === '::1') return true // loopback
  if (normalized.startsWith('::ffff:')) return isPrivateOrLocalIPv4(normalized.slice('::ffff:'.length))
  if (normalized.startsWith('fe80:')) return true // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true // unique local fc00::/7
  return false
}

function isPrivateOrLocalIP(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return isPrivateOrLocalIPv4(ip)
  if (version === 6) return isPrivateOrLocalIPv6(ip)
  return true // no es una IP reconocible → no-público por las dudas
}

/** Resuelve un hostname a sus direcciones IP. Inyectable en tests para no depender de DNS real. */
export type DnsLookupFn = (hostname: string) => Promise<string[]>

const defaultLookup: DnsLookupFn = async (hostname) =>
  (await dns.lookup(hostname, { all: true })).map((a) => a.address)

/**
 * Valida que `urlString` sea http(s) y que su host NO resuelva a una dirección privada/loopback/
 * link-local. Lanza `ValidationError` (mensaje apto para mostrar al usuario) si no es válida.
 */
export async function assertPublicWebhookUrl(urlString: string, lookup: DnsLookupFn = defaultLookup): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(urlString)
  } catch {
    throw new ValidationError('URL de webhook inválida')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError('El webhook debe usar http o https')
  }

  const hostname = parsed.hostname
  if (hostname === 'localhost') {
    throw new ValidationError('El webhook no puede apuntar a localhost')
  }

  let addresses: string[]
  if (isIP(hostname)) {
    addresses = [hostname]
  } else {
    try {
      addresses = await lookup(hostname)
    } catch {
      throw new ValidationError('No se pudo resolver el host del webhook')
    }
  }

  if (addresses.length === 0 || addresses.some(isPrivateOrLocalIP)) {
    throw new ValidationError('El webhook no puede apuntar a una dirección de red privada o local')
  }
}
