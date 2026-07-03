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
