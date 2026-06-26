import type { AiIntentDTO, NlpResult } from '../types'

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text: string): string[] {
  return normalize(text).split(/\s+/).filter(t => t.length > 0)
}

function jaroWinkler(s1: string, s2: string): number {
  const a = normalize(s1)
  const b = normalize(s2)
  if (a === b) return 1.0
  if (a.length === 0 || b.length === 0) return 0.0

  const matchDistance = Math.floor(Math.max(a.length, b.length) / 2) - 1
  const aMatches = new Array(a.length).fill(false)
  const bMatches = new Array(b.length).fill(false)
  let matches = 0
  let transpositions = 0

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance)
    const end = Math.min(i + matchDistance + 1, b.length)
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue
      aMatches[i] = true
      bMatches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0.0

  let k = 0
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue
    while (!bMatches[k]) k++
    if (a[i] !== b[k]) transpositions++
    k++
  }

  const jaro = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3
  let prefix = 0
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++
    else break
  }

  return jaro + prefix * 0.1 * (1 - jaro)
}

function tokenOverlap(tokens1: string[], tokens2: string[]): number {
  const set1 = new Set(tokens1)
  const set2 = new Set(tokens2)
  const intersection = new Set([...set1].filter(x => set2.has(x)))
  const union = new Set([...set1, ...set2])
  return union.size === 0 ? 0 : intersection.size / union.size
}

export function detectIntent(message: string, intents: AiIntentDTO[]): NlpResult {
  const msgTokens = tokenize(message)
  const msgNormalized = normalize(message)

  let bestIntent: AiIntentDTO | null = null
  let bestScore = 0
  let bestPhrase = ''

  for (const intent of intents) {
    if (!intent.isActive) continue
    const phrases: string[] = Array.isArray(intent.triggerPhrases) ? intent.triggerPhrases : []
    let intentBestScore = 0

    for (const phrase of phrases) {
      const similarity = jaroWinkler(msgNormalized, phrase)
      const phraseTokens = tokenize(phrase)
      const overlap = tokenOverlap(msgTokens, phraseTokens)
      const score = similarity * 0.6 + overlap * 0.4

      if (score > intentBestScore) {
        intentBestScore = score
      }
    }

    const weightedScore = intentBestScore * 0.7 + (intent.priority || 0) * 0.3 * 0.01

    if (weightedScore > bestScore) {
      bestScore = weightedScore
      bestIntent = intent
      bestPhrase = phrases[0] || ''
    }
  }

  if (bestIntent && bestScore >= (bestIntent.confidenceThreshold || 0.65)) {
    return {
      intent: bestIntent,
      confidence: Math.round(bestScore * 100) / 100,
      matchedPhrase: bestPhrase,
      fallback: false,
    }
  }

  return {
    intent: null,
    confidence: Math.round(bestScore * 100) / 100,
    matchedPhrase: undefined,
    fallback: true,
  }
}
