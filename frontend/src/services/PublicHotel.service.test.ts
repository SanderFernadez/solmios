// services/PublicHotel.service.test.ts — F0 0.19
// Cubre los 3 métodos del service: getBySlug, getMedia, getReviews. Verifica URL + query
// params + que el respuesta del backend se devuelve sin mutar (el http client ya desenvuelve
// el envelope del framework en producción; acá lo mockeamos plano).
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./http', () => ({
  http: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { PublicHotelService } from './PublicHotel.service'
import { http } from './http'
import type { PublicHotelInfo, PublicHotelMedia, PublicReviewsResponse } from '@/types/public-hotel'

const HOTEL: PublicHotelInfo = {
  id: 'h1',
  slug: 'hotel-demo',
  name: 'Hotel Demo',
  title: 'Bienvenido',
  description: 'Un hotel',
  descriptionTranslations: null,
  accommodationType: 'hotel',
  starRating: '4',
  latitude: 18.4,
  longitude: -69.6,
  address: 'Calle 1',
  province: null,
  municipality: null,
  locality: null,
  postalCode: null,
  phone: '+1 809 555 0000',
  email: 'h@demo.com',
  website: 'https://demo.com',
  checkIn: '15:00',
  checkOut: '12:00',
  currency: 'USD',
  taxName: 'ITBIS',
  taxRate: 18,
  cancellationType: 'flexible',
  freeCancellation: true,
  depositRequired: true,
  depositPercent: 30,
  releaseHours: 0,
  logo: null,
  amenities: ['pool', 'wifi'],
  onlineBookingStatus: 'active',
}

const MEDIA: PublicHotelMedia = {
  hero: [{ id: 'm1', type: 'hero', url: 'https://x/hero.jpg', alt: 'Hero', sortOrder: 0, roomId: null }],
  gallery: [],
  rooms: [],
}

const REVIEWS: PublicReviewsResponse = {
  reviews: [
    { rating: 5, title: 'Excelente', comment: 'Muy bueno', channel: 'direct', date: '2026-07-01', authorName: 'Ana' },
  ],
  aggregate: { score: 4.5, count: 10, perSource: { direct: { score: 4.5, count: 10 } } },
  distribution: { '1': 0, '2': 1, '3': 0, '4': 3, '5': 6 },
  pagination: { page: 1, limit: 10, total: 10, totalPages: 1 },
}

describe('PublicHotel.service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getBySlug pega a /public/hotel/:slug sin query si no hay lang', async () => {
    vi.mocked(http.get).mockResolvedValue(HOTEL as any)
    const res = await PublicHotelService.getBySlug('hotel-demo')
    expect(http.get).toHaveBeenCalledWith('/public/hotel/hotel-demo')
    expect(res).toBe(HOTEL)
  })

  it('getBySlug append ?lang= cuando se pasa idioma (no encode dos veces el slug)', async () => {
    vi.mocked(http.get).mockResolvedValue(HOTEL as any)
    await PublicHotelService.getBySlug('hotel-demo', 'en')
    expect(http.get).toHaveBeenCalledWith('/public/hotel/hotel-demo?lang=en')
  })

  it('getBySlug encodea slugs con caracteres especiales', async () => {
    vi.mocked(http.get).mockResolvedValue(HOTEL as any)
    await PublicHotelService.getBySlug('hotel demo & co', 'pt')
    // encodeURIComponent → 'hotel%20demo%20%26%20co'
    expect(http.get).toHaveBeenCalledWith('/public/hotel/hotel%20demo%20%26%20co?lang=pt')
  })

  it('getMedia pega al path futuro /public/hotels/:slug/media', async () => {
    vi.mocked(http.get).mockResolvedValue(MEDIA as any)
    const res = await PublicHotelService.getMedia('hotel-demo')
    expect(http.get).toHaveBeenCalledWith('/public/hotels/hotel-demo/media')
    expect(res).toBe(MEDIA)
  })

  it('getReviews sin params pega al path base sin query', async () => {
    vi.mocked(http.get).mockResolvedValue(REVIEWS as any)
    const res = await PublicHotelService.getReviews('hotel-demo')
    expect(http.get).toHaveBeenCalledWith('/public/hotels/hotel-demo/reviews')
    expect(res).toBe(REVIEWS)
  })

  it('getReviews serializa page/limit/source/lang como query string', async () => {
    vi.mocked(http.get).mockResolvedValue(REVIEWS as any)
    await PublicHotelService.getReviews('hotel-demo', { page: 2, limit: 20, source: 'google', lang: 'en' })
    // build() respeta el orden de inserción (page, limit, source, lang) — más natural que alfabético.
    expect(http.get).toHaveBeenCalledWith(
      '/public/hotels/hotel-demo/reviews?page=2&limit=20&source=google&lang=en',
    )
  })

  it('getReviews omite params undefined/vacíos (no deja claves sin valor)', async () => {
    vi.mocked(http.get).mockResolvedValue(REVIEWS as any)
    await PublicHotelService.getReviews('hotel-demo', { page: 3, source: undefined, lang: '' })
    expect(http.get).toHaveBeenCalledWith('/public/hotels/hotel-demo/reviews?page=3')
  })
})
