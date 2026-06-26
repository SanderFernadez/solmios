import type { NlpResult, BotResponse } from '../types'

export function buildResponse(nlpResult: NlpResult, variables: Record<string, string>): BotResponse {
  const intent = nlpResult.intent

  if (intent && nlpResult.confidence >= (intent.confidenceThreshold || 0.65)) {
    let text = intent.responseTemplate

    for (const [key, value] of Object.entries(variables)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
    }

    return {
      text,
      actionTaken: intent.action || undefined,
      actionResult: undefined,
      intentDetected: intent.name,
      confidence: nlpResult.confidence,
    }
  }

  if (intent?.fallbackResponse) {
    let text = intent.fallbackResponse
    for (const [key, value] of Object.entries(variables)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
    }
    return {
      text,
      intentDetected: intent.name,
      confidence: nlpResult.confidence,
    }
  }

  return {
    text: 'No estoy segura de haber entendido. ¿Podrías decírmelo de otra forma?',
    confidence: nlpResult.confidence,
  }
}
