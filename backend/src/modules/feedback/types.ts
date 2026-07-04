export interface FeedbackPinDTO {
  id: string
  hotelId?: string
  route: string
  x: number
  y: number
  comment: string
  priority: 'low' | 'medium' | 'high'
  category: 'UI' | 'Bug' | 'Improvement'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  screenshot?: string
  browser?: string
  viewportWidth?: number
  viewportHeight?: number
  userId?: string
  userEmail?: string
  gitlabIssueUrl?: string
  gitlabIssueId?: number
  createdAt: string
  updatedAt: string
}

export interface CreateFeedbackPinDTO {
  hotelId?: string
  route: string
  x: number
  y: number
  comment: string
  priority?: 'low' | 'medium' | 'high'
  category?: 'UI' | 'Bug' | 'Improvement'
  screenshot?: string
  browser?: string
  viewportWidth?: number
  viewportHeight?: number
  userId?: string
  userEmail?: string
}

export interface UpdateFeedbackPinDTO {
  status?: 'open' | 'in_progress' | 'resolved' | 'closed'
  comment?: string
  priority?: 'low' | 'medium' | 'high'
  category?: 'UI' | 'Bug' | 'Improvement'
}

export interface FeedbackScreenshotDTO {
  screenshot: string
  filename?: string
  comment: string
  route: string
  x?: number
  y?: number
  browser?: string
  viewportWidth?: number
  viewportHeight?: number
}

export interface GitLabIssueResultDTO {
  issueUrl: string
  issueId: number
  title: string
}
