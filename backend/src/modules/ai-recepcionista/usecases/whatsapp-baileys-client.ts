import {
  makeWASocket,
  useMultiFileAuthState,
  Browsers,
  DisconnectReason,
  type WASocket,
} from '@whiskeysockets/baileys'
import type { Logger } from 'arckode-framework'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export type ConnectionMode = 'baileys' | 'meta'

interface HotelSession {
  hotelId: string
  sock: WASocket | null
  status: 'disconnected' | 'connecting' | 'qr_pending' | 'connected'
  qrCode: string | null
  phoneNumber: string | null
  credentials: any
  reconnectTimer: ReturnType<typeof setTimeout> | null
}

const sessions = new Map<string, HotelSession>()
const DEBOUNCE_MS = 1500
const TYPING_MS = 800

export function getSession(hotelId: string): HotelSession | undefined {
  return sessions.get(hotelId)
}

export function getActiveSessions(): { hotelId: string; status: string; phone: string | null }[] {
  return Array.from(sessions.entries()).map(([hotelId, s]) => ({
    hotelId,
    status: s.status,
    phone: s.phoneNumber,
  }))
}

function logger() {
  return { child: () => logger(), info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, level: 'silent' } as any
}

export async function startBaileysSession(
  hotelId: string,
  savedCredentials: any | null,
  onMessage: (msg: { from: string; text: string; hotelId: string; pushName?: string }) => Promise<void>,
  onQR: (hotelId: string, qr: string) => void,
  onConnected: (hotelId: string, phone: string) => void,
  onDisconnected: (hotelId: string, reason: string) => void,
  onCredentialsUpdated: (hotelId: string, creds: any) => Promise<void>,
): Promise<void> {
  const existing = sessions.get(hotelId)
  if (existing?.sock) {
    try { existing.sock.end(undefined as any) } catch {}
    sessions.delete(hotelId)
  }

  const session: HotelSession = {
    hotelId,
    sock: null,
    status: 'connecting',
    qrCode: null,
    phoneNumber: null,
    credentials: savedCredentials || null,
    reconnectTimer: null,
  }
  sessions.set(hotelId, session)

  const authDir = join('/tmp', 'baileys', hotelId)
  if (!existsSync(authDir)) mkdirSync(authDir, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(authDir)

  const sock = makeWASocket({
    auth: state,
    browser: Browsers.macOS('Desktop'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  })

  session.sock = sock

  sock.ev.on('creds.update', async () => {
    await saveCreds()
    try {
      const files = ['creds.json', 'pre-key-1.json', 'pre-key-2.json', 'pre-key-3.json', 'app-state-sync-key.json', 'app-state-sync-version.json']
      const creds: Record<string, any> = {}
      for (const f of files) {
        const path = join(authDir, f)
        if (existsSync(path)) creds[f.replace('.json', '')] = JSON.parse(readFileSync(path, 'utf-8'))
      }
      await onCredentialsUpdated(hotelId, creds)
    } catch {}
  })

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      session.status = 'qr_pending'
      session.qrCode = qr
      onQR(hotelId, qr)
    }

    if (connection === 'open') {
      session.status = 'connected'
      const rawId = sock.user?.id || ''
      const phone = rawId.split(':')[0] || rawId
      session.phoneNumber = phone
      session.qrCode = null
      onConnected(hotelId, phone)
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode
      const reason = DisconnectReason[statusCode as number] || 'unknown'

      if (statusCode === DisconnectReason.loggedOut) {
        session.status = 'disconnected'
        session.sock = null
        sessions.delete(hotelId)
        onDisconnected(hotelId, 'logged_out')
        return
      }

      const delay = statusCode === 440 ? 15000 : 5000

      session.reconnectTimer = setTimeout(() => {
        sessions.delete(hotelId)
        startBaileysSession(hotelId, session.credentials, onMessage, onQR, onConnected, onDisconnected, onCredentialsUpdated)
      }, delay)
    }
  })

  const processedMsgIds = new Set<string>()
  const pendingReplies = new Map<string, ReturnType<typeof setTimeout>>()
  const pendingBuffers = new Map<string, { from: string; pushName: string; texts: string[] }>()

  sock.ev.on('messages.upsert', async (m) => {
    console.log(`[WA-EVENT] type=${m.type} msgs=${m.messages.length}`)
    if (m.type !== 'notify') return

    for (const msg of m.messages) {
      if (msg.key.fromMe) continue

      const msgId = msg.key.id || ''
      if (processedMsgIds.has(msgId)) continue
      processedMsgIds.add(msgId)
      if (processedMsgIds.size > 500) {
        const first = processedMsgIds.values().next().value
        if (first) processedMsgIds.delete(first)
      }

      const text = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || msg.message?.imageMessage?.caption
        || ''
      if (!text) continue

      const from = msg.key.remoteJid || ''
      const pushName = (msg as any)?.pushName || from
      console.log(`[WA-MSG] from=${from} text="${text.substring(0, 50)}"`)

      // Buffer messages — respond after debounce
      const existing = pendingBuffers.get(from)
      if (existing) {
        existing.texts.push(text)
      } else {
        pendingBuffers.set(from, { from, pushName, texts: [text] })
      }

      const prev = pendingReplies.get(from)
      if (prev) clearTimeout(prev)

      pendingReplies.set(from, setTimeout(async () => {
        pendingReplies.delete(from)
        const buffer = pendingBuffers.get(from)
        pendingBuffers.delete(from)
        if (!buffer) return

        const combined = buffer.texts.join(' ')
        console.log(`[WA-DEBOUNCE] firing for ${from}: "${combined.substring(0, 50)}"`)
        await onMessage({ from, text: combined, hotelId, pushName: buffer.pushName }).catch((e: any) => console.log(`[WA-ERROR] ${e?.message}`))
      }, DEBOUNCE_MS))
    }
  })
}

export async function sendWhatsAppMessage(hotelId: string, to: string, text: string): Promise<boolean> {
  const session = sessions.get(hotelId)
  if (!session?.sock || session.status !== 'connected') {
    console.log(`[WA-SEND] FAIL: session sock=${!!session?.sock} status=${session?.status}`)
    return false
  }
  try {
    // Quick typing indicator
    await session.sock.sendPresenceUpdate('composing', to)
    await new Promise(r => setTimeout(r, TYPING_MS))
    await session.sock.sendPresenceUpdate('paused', to)

    await session.sock.sendMessage(to, { text })
    console.log(`[WA-SEND] OK to=${to}`)
    return true
  } catch (err: any) {
    console.log(`[WA-SEND] ERROR: ${err?.message || err}`)
    return false
  }
}

export async function stopBaileysSession(hotelId: string): Promise<void> {
  const session = sessions.get(hotelId)
  if (session?.sock) {
    try { session.sock.end(undefined as any) } catch {}
  }
  if (session?.reconnectTimer) {
    clearTimeout(session.reconnectTimer)
  }
  sessions.delete(hotelId)
}

export async function disconnectBaileys(hotelId: string): Promise<void> {
  const session = sessions.get(hotelId)
  if (session?.sock) {
    try {
      await session.sock.logout()
    } catch {
      try { session.sock.end(undefined as any) } catch {}
    }
  }
  if (session?.reconnectTimer) {
    clearTimeout(session.reconnectTimer)
  }
  sessions.delete(hotelId)
}
