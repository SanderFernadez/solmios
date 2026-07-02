import { http } from './http'
import type { FeedbackPin, CreateFeedbackPayload } from '@/types'

export const FeedbackService = {
  async list(route?: string): Promise<FeedbackPin[]> {
    const qs = route ? `?route=${encodeURIComponent(route)}` : ''
    return http.get<FeedbackPin[]>(`/feedback${qs}`)
  },

  async create(payload: CreateFeedbackPayload): Promise<FeedbackPin> {
    return http.post<FeedbackPin>('/feedback', payload)
  },

  async update(id: string, data: Partial<FeedbackPin>): Promise<FeedbackPin> {
    return http.patch<FeedbackPin>(`/feedback/${id}`, data)
  },

  async remove(id: string): Promise<void> {
    return http.delete(`/feedback/${id}`)
  },
}
