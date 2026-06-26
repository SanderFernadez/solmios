import { startBaileysSession, stopBaileysSession, getSession, sendWhatsAppMessage } from './whatsapp-baileys-client'

export async function beginSession(
  hotelId: string,
  config: any,
  configRepo: any,
  convRepo: any,
  messageRepo: any,
  intentRepo: any,
  sockets: any,
  cache: any,
  logger: any,
  processIncoming: (convId: string, text: string, hid: string) => Promise<any>,
  findOrCreateConv: (dto: any) => Promise<any>,
): Promise<{ qr: string | null; status: string }> {
  const savedCreds = config?.baileysCredentials || null
  let qrResult: string | null = null

  await startBaileysSession(
    hotelId,
    savedCreds,
    async (msg) => {
      const conv = await findOrCreateConv({
        hotelId: msg.hotelId,
        channel: 'whatsapp',
        channelConversationId: msg.from,
        guestPhone: msg.from,
        guestName: msg.pushName || msg.from,
        language: 'es',
      })
      const response = await processIncoming(conv.id, msg.text, msg.hotelId)
      const replyText = response?.text || response?.message || ''
      if (replyText) {
        await sendWhatsAppMessage(msg.hotelId, msg.from, replyText)
      }
    },
    (_hotelId, qr) => { qrResult = qr },
    async (_hotelId, phone) => {
      if (config) {
        await configRepo.update(config.id, { connectionStatus: 'connected', isActive: 1 } as any)
      } else {
        await configRepo.create({
          id: crypto.randomUUID(),
          hotelId,
          connectionMode: 'baileys',
          connectionStatus: 'connected',
          isActive: 1,
        } as any)
      }
    },
    async (_hotelId, reason) => {
      if (config) {
        await configRepo.update(config.id, { connectionStatus: 'disconnected', isActive: 0 } as any)
      }
    },
    async (_hotelId, creds) => {
      if (config) {
        await configRepo.update(config.id, { baileysCredentials: creds } as any)
      } else {
        const existing = (await configRepo.findMany({ hotelId }))[0]
        if (existing) await configRepo.update(existing.id, { baileysCredentials: creds } as any)
      }
    },
  )

  return { qr: qrResult, status: 'connecting' }
}

export async function endSession(hotelId: string, configRepo: any): Promise<{ success: boolean }> {
  await stopBaileysSession(hotelId)
  const configs = await configRepo.findMany({ hotelId })
  if (configs[0]) {
    await configRepo.update(configs[0].id, { connectionStatus: 'disconnected', isActive: 0 } as any)
  }
  return { success: true }
}

export function getQRSync(hotelId: string): { qr: string | null; status: string } {
  const session = getSession(hotelId)
  return { qr: session?.qrCode || null, status: session?.status || 'disconnected' }
}

export async function getStatusSync(hotelId: string, configRepo: any): Promise<{ status: string; phone: string | null; mode: string }> {
  const session = getSession(hotelId)
  const configs = await configRepo.findMany({ hotelId })
  const config = configs[0]
  return {
    status: session?.status || config?.connectionStatus || 'disconnected',
    phone: session?.phoneNumber || null,
    mode: config?.connectionMode || 'baileys',
  }
}
