export interface FeedbackSockets {
  onGitHubIssueCreated?: (data: { issueUrl: string; route: string }) => Promise<void>
  onFeedbackPinCreated?: (data: { id: string; route: string; comment: string }) => Promise<void>
  onFeedbackPinUpdated?: (data: { id: string; status: string }) => Promise<void>
  onFeedbackPinDeleted?: (id: string) => Promise<void>
}
