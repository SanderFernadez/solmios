// services/Opiniones.service.ts
import { http } from './http'

export interface Review {
  id: string; hotelId: string; guestId: string; reservationId: string | null
  rating: number; title: string; text: string
  platform: string; response: string | null; respondedAt: string | null
  visible: number; createdAt: string
}

export interface ReviewStats {
  total: number; averageRating: number; distribution: Record<number, number>
  responseRate: number
}

export const OpinionesService = {
  list: (params?: Record<string, any>): Promise<Review[]> => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return http.get(`/api/reviews${qs}`)
  },
  getById: (id: string): Promise<Review> => http.get(`/api/reviews/${id}`),
  respond: (id: string, response: string): Promise<Review> => http.put(`/api/reviews/${id}/respond`, { response }),
  toggleVisibility: (id: string, visible: boolean): Promise<Review> => http.put(`/api/reviews/${id}`, { visible }),
  requestReviews: (): Promise<any> => http.post('/api/reviews/request', {}),
  getStats: (): Promise<ReviewStats> => http.get('/api/reviews/stats'),
}
