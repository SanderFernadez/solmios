export interface FeedbackSockets {
  onGitLabIssueCreated?: (data: { issueUrl: string; route: string }) => Promise<void>
}
