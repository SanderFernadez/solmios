// marketing/sockets.ts
import type { AutoMessageDTO } from './types'

export interface MarketingSockets {
  onAutoMessageSent?: (msg: AutoMessageDTO, recipient: string) => Promise<void>
}
