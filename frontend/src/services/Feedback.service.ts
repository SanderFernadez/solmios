import { http } from './http'
import type { FeedbackPin, CreateFeedbackPayload } from '@/types'

export interface GitHubIssuePayload {
  screenshot: string
  filename: string
  /** id del pin recién creado: el backend lo vincula con el issue (evita un PATCH desde acá). */
  pinId?: string
  comment: string
  route: string
  x: number
  y: number
  browser: string
  viewportWidth: number
  viewportHeight: number
}

export interface GitHubIssueResult {
  issueUrl: string
  issueId: number
  title: string
}

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

  async createGitHubIssue(payload: GitHubIssuePayload): Promise<GitHubIssueResult> {
    return http.post<GitHubIssueResult>('/feedback/github-issue', payload)
  },
}
