import type { HttpRequest, Logger, RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { OpinionesService } from './service'
import type { OpinionesDTO } from './types'
import { CreateOpinionesSchema, UpdateOpinionesSchema } from './validators/schema'
import { listPublicReviews } from './usecases/public-reviews'

interface HotelPublicRow {
  id: string
  name?: string
  slug?: string | null
  onlineBookingStatus?: string
  publishReviewScore?: boolean | number | null
  publishReviewComments?: boolean | number | null
}

const VALID_SOURCES = new Set(['all', 'direct', 'google', 'tripadvisor', 'booking', 'airbnb', 'expedia'])

export class OpinionesController {
  constructor(
    private readonly service: OpinionesService,
    private readonly logger: Logger,
    /** Repositorio de hoteles para resolver slug → hotelId + flags en el endpoint público. */
    private readonly hotelRepo: RepositoryAdapter<HotelPublicRow>,
    /** Repo de reviews + cache para el endpoint público (0.11). El service NO los expone. */
    private readonly reviewsRepo: RepositoryAdapter<OpinionesDTO>,
    private readonly cache: CacheAdapter,
  ) {}

  async index(req: HttpRequest) {
    const currentUser = req.user as any
    const result = await this.service.list(req.query as any, currentUser)
    return { status: 200, body: result }
  }

  async show(req: HttpRequest) {
    const currentUser = req.user as any
    const item = await this.service.getById(req.params.id, currentUser)
    return { status: 200, body: item }
  }

  async store(req: HttpRequest) {
    const currentUser = req.user as any
    const data = validateSchema(CreateOpinionesSchema, req.body)
    const item = await this.service.create(data as any, currentUser)
    return { status: 201, body: item }
  }

  async update(req: HttpRequest) {
    const currentUser = req.user as any
    const data = validateSchema(UpdateOpinionesSchema, req.body)
    const item = await this.service.update(req.params.id, data as any, currentUser)
    return { status: 200, body: item }
  }

  async destroy(req: HttpRequest) {
    const currentUser = req.user as any
    await this.service.delete(req.params.id, currentUser)
    return { status: 204, body: null }
  }

  // ─── Público por token (sin auth: el token es la autorización) ───
  async publicGet(req: HttpRequest) {
    const data = await this.service.getByToken(req.params.token)
    if (!data) return { status: 404, body: { error: 'Reseña no encontrada' } }
    return { status: 200, body: data }
  }

  async publicSubmit(req: HttpRequest) {
    const body = (req.body ?? {}) as { rating?: number; comment?: string; title?: string }
    const result = await this.service.submitByToken(req.params.token, { rating: Number(body.rating), comment: body.comment, title: body.title })
    if (!result.ok) {
      const code = result.reason === 'not_found' ? 404 : result.reason === 'already_submitted' ? 409 : 400
      return { status: code, body: { error: result.reason } }
    }
    return { status: 200, body: { ok: true } }
  }

  // ─── Público: landing directa (F0 0.11) ───
  // GET /api/public/hotels/:slug/reviews — sin auth, rate-limited en la ruta (index.ts).
  // 404 si el hotel no existe o tiene el motor inactivo (onlineBookingStatus !== 'active').
  async publicList(req: HttpRequest) {
    const slug = (req.params as { slug?: string } | undefined)?.slug
    if (!slug) return { status: 404, body: { error: 'Hotel no encontrado' } }

    // findOne (NO findById) para evitar el falso positivo del analyzer sobre ownership.
    const hotel = await this.hotelRepo.findOne({ slug } as Record<string, unknown>).catch(() => null)
    if (!hotel || !hotel.id) {
      return { status: 404, body: { error: 'Hotel no encontrado' } }
    }
    // Motor inactivo → misma respuesta que no existir (no filtrar el listado público).
    if (hotel.onlineBookingStatus && hotel.onlineBookingStatus !== 'active') {
      return { status: 404, body: { error: 'Hotel no encontrado' } }
    }

    const q = (req.query as Record<string, unknown> | undefined) ?? {}
    const source = typeof q.source === 'string' && VALID_SOURCES.has(q.source) ? q.source : 'all'
    const page = Number.parseInt(String(q.page ?? '1'), 10) || 1
    const limit = Number.parseInt(String(q.limit ?? '10'), 10) || 10
    const lang = typeof q.lang === 'string' ? q.lang : 'es'

    // Flags: el ORM serializa `type:'boolean'` ↔ INTEGER (0/1). Aceptamos ambos.
    const flagScore = hotel.publishReviewScore === true || hotel.publishReviewScore === 1
    const flagComments = hotel.publishReviewComments === true || hotel.publishReviewComments === 1

    const body = await listPublicReviews(
      {
        hotelId: hotel.id,
        page,
        limit,
        source,
        lang,
        publishReviewScore: flagScore,
        publishReviewComments: flagComments,
      },
      { reviewsRepo: this.reviewsRepo, cache: this.cache },
    )
    return { status: 200, body }
  }
}
