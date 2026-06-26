import { createModule, OrmRepository } from 'arckode-framework'
import { registerAiRecepcionistaModels } from './model'
import { AiRecepcionistaService } from './service'
import { AiRecepcionistaController } from './controller'
import type {
  AiConversationDTO, CreateAiConversationDTO, UpdateAiConversationDTO,
  AiMessageDTO, CreateAiMessageDTO,
  AiIntentDTO, CreateAiIntentDTO, UpdateAiIntentDTO,
  AiTemplateDTO, CreateAiTemplateDTO, UpdateAiTemplateDTO,
  AiWhatsappConfigDTO, CreateAiWhatsappConfigDTO,
  AiMetricsDTO,
  AiBookingFlowRecord,
  AiVoiceConfigRecord,
} from './types'

export { AiRecepcionistaService }
export type {
  AiConversationDTO, CreateAiConversationDTO, UpdateAiConversationDTO,
  AiMessageDTO, CreateAiMessageDTO,
  AiIntentDTO, CreateAiIntentDTO, UpdateAiIntentDTO,
  AiTemplateDTO, CreateAiTemplateDTO, UpdateAiTemplateDTO,
  AiWhatsappConfigDTO, CreateAiWhatsappConfigDTO,
  AiMetricsDTO,
  AiBookingFlowRecord,
  AiVoiceConfigRecord,
} from './types'
export type { AiRecepcionistaSockets } from './sockets'
export { AiRecepcionistaValidator, CreateConversationSchema, CreateMessageSchema, CreateIntentSchema, CreateTemplateSchema } from './validators/schema'

export function AiRecepcionistaModule() {
  return createModule({
    name: 'ai-recepcionista',
    version: '1.0.0',
    description: 'Recepcionista Virtual con IA — atención multicanal al huésped (WhatsApp, webchat, email, voice)',
    contract: {
      name: 'ai-recepcionista',
      version: '1.0.0',
      description: 'AI receptionist: conversations, NLP, WhatsApp, booking flows, escalation, metrics',
      actions: [
        'listConversations', 'getConversation', 'findOrCreateConversation', 'closeConversation', 'transferConversation',
        'sendMessage', 'getMessages', 'processIncomingMessage',
        'listIntents', 'createIntent', 'updateIntent', 'deleteIntent', 'testIntent',
        'listTemplates', 'createTemplate', 'updateTemplate', 'deleteTemplate',
        'getWhatsappConfig', 'updateWhatsappConfig',
        'getMetrics', 'getDashboardMetrics',
        'getBookingFlow', 'createBookingFlow', 'updateBookingFlow',
        'getVoiceConfig',
      ],
      events: [
        'onConversationStarted', 'onMessageReceived', 'onBotReplied',
        'onConversationTransferred', 'onConversationClosed',
        'onIncidentRegistered', 'onBookingCreated', 'onPaymentRequested',
        'onEscalatedToHuman',
      ],
      tables: [
        'ai_conversations', 'ai_messages', 'ai_intents', 'ai_templates',
        'ai_whatsapp_config', 'ai_metrics_daily', 'ai_booking_flows', 'ai_voice_config',
      ],
      dependencies: [],
      rules: ['No importar de otros módulos', 'RepositoryAdapter<T>', 'Validación en controller'],
    },
    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('ai-recepcionista: auth dependency required')
      registerAiRecepcionistaModels(orm)

      const conversationRepo = new OrmRepository<AiConversationDTO>(orm, 'AiConversations')
      const messageRepo = new OrmRepository<AiMessageDTO>(orm, 'AiMessages')
      const intentRepo = new OrmRepository<AiIntentDTO>(orm, 'AiIntents')
      const templateRepo = new OrmRepository<AiTemplateDTO>(orm, 'AiTemplates')
      const whatsappConfigRepo = new OrmRepository<AiWhatsappConfigDTO>(orm, 'AiWhatsappConfig')
      const metricsRepo = new OrmRepository<AiMetricsDTO>(orm, 'AiMetricsDaily')
      const bookingFlowRepo = new OrmRepository<AiBookingFlowRecord>(orm, 'AiBookingFlows')
      const voiceConfigRepo = new OrmRepository<AiVoiceConfigRecord>(orm, 'AiVoiceConfig')
      const userRepo = new OrmRepository<any>(orm, 'Users')
      const hotelRepo = new OrmRepository<any>(orm, 'Hotels')
      const roomRepo = new OrmRepository<any>(orm, 'Rooms')
      const reservationRepo = new OrmRepository<any>(orm, 'Reservations')
      const paymentLinkRepo = new OrmRepository<any>(orm, 'PaymentLinks')
      const configRepo = new OrmRepository<any>(orm, 'Configuration')
      const invoiceRepo = new OrmRepository<any>(orm, 'Invoices')

      const log = logger.child('ai-recepcionista')

      // Callback: when AI creates a reservation, push availability to Channex.
      // system.resolveModule is NOT available inside create(); the pusher is injected from
      // composition-root via service.channexPusher (see composition-root.ts).
      let service: AiRecepcionistaService
      const onReservationCreated = async (hotelId: string, roomId: string) => {
        try { service?.channexPusher?.(hotelId, roomId) } catch {}
      }
      service = new AiRecepcionistaService(
        conversationRepo, messageRepo, intentRepo, templateRepo,
        whatsappConfigRepo, metricsRepo, bookingFlowRepo, voiceConfigRepo,
        userRepo, hotelRepo, roomRepo, reservationRepo, paymentLinkRepo, configRepo, invoiceRepo,
        log, cache, auth!, onReservationCreated,
      )
      const controller = new AiRecepcionistaController(service, log)

      router.get('/api/ai/conversations', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.index(req))
      router.get('/api/ai/conversations/:id', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.show(req))
      router.post('/api/ai/conversations/:id/close', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.close(req))
      router.post('/api/ai/conversations/:id/transfer', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.transfer(req))
      router.post('/api/ai/conversations/:id/messages', [auth.authenticate('hotel_admin', 'receptionist', 'super_admin')], (req) => controller.sendMessage(req))

      router.get('/api/ai/intents', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.listIntents(req))
      router.get('/api/ai/intents/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.getIntent(req))
      router.post('/api/ai/intents', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.createIntent(req))
      router.put('/api/ai/intents/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.updateIntent(req))
      router.delete('/api/ai/intents/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.deleteIntent(req))
      router.post('/api/ai/intents/:id/test', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.testIntent(req))

      router.get('/api/ai/templates', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.listTemplates(req))
      router.post('/api/ai/templates', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.createTemplate(req))
      router.put('/api/ai/templates/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.updateTemplate(req))
      router.delete('/api/ai/templates/:id', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.deleteTemplate(req))

      router.get('/api/ai/whatsapp/config', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.getWhatsappConfig(req))
      router.put('/api/ai/whatsapp/config', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.updateWhatsappConfig(req))
      router.post('/api/ai/whatsapp/start', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.startWhatsapp(req))
      router.post('/api/ai/whatsapp/stop', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.stopWhatsapp(req))
      router.get('/api/ai/whatsapp/qr/:hotelId?', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.getWhatsappQR(req))
      router.get('/api/ai/whatsapp/status/:hotelId?', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.getWhatsappStatus(req))

      router.get('/api/ai/whatsapp/webhook/:hotelId', (req) => controller.whatsappWebhookVerify(req))
      router.post('/api/ai/whatsapp/webhook/:hotelId', (req) => controller.whatsappWebhookReceive(req))

      router.post('/api/ai/chat/:slug', (req) => controller.webChatMessage(req))

      router.get('/api/ai/metrics', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.metrics(req))
      router.get('/api/ai/metrics/dashboard', [auth.authenticate('hotel_admin', 'super_admin')], (req) => controller.dashboardMetrics(req))

      log.info('Módulo ai-recepcionista listo')
      // Auto-reconnect WhatsApp sessions that were active before restart
      service.autoReconnectSessions().catch(() => {})
      return service
    },
  })
}
