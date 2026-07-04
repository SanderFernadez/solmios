export function createNightAuditCron(orm: any, resolveModule: (name: string) => any, logger: any): () => Promise<{ posted: number; skipped: number }> {
  return async (): Promise<{ posted: number; skipped: number }> => {
    try {
      const folios = resolveModule('folios')
      if (!folios || !folios.postNightAuditRoomCharges) {
        logger.warn('night-audit-cron: módulo folios no disponible')
        return { posted: 0, skipped: 0 }
      }
      const hotels = await orm.findMany('Hotels', {}) as any[]
      let totalPosted = 0
      let totalSkipped = 0
      for (const hotel of hotels) {
        const systemUser = { id: 'system', role: 'super_admin', hotelId: hotel.id }
        const result = await folios.postNightAuditRoomCharges(orm, systemUser, { hotelId: hotel.id })
        totalPosted += (result.posted || 0)
        totalSkipped += (result.skipped || 0)
      }
      logger.info('night-audit-cron completado', { posted: totalPosted, skipped: totalSkipped })
      return { posted: totalPosted, skipped: totalSkipped }
    } catch (e: any) {
      logger.warn('night-audit-cron falló', { error: e.message })
      return { posted: 0, skipped: 0 }
    }
  }
}
