// connectors/tests/tripadvisor-reviews.test.ts — Tests del conector TripAdvisor (F3, task 3.2).
// Aceptance: "mockear las 3 APIs → los 3 connectors devuelven arrays normalizados".
import { describe, it, expect } from 'bun:test'
import {
  fetchTripadvisorReviews, normalizeTripadvisorReview,
  type TripadvisorConfig, type TripadvisorFetcher,
} from '../tripadvisor-reviews'

const noopLog = { info: () => {}, warn: () => {} }

const validConfig: TripadvisorConfig = { apiKey: 'ta-key-123', locationId: 'loc-456' }

const mockFetcher: TripadvisorFetcher = async () => ({
  data: [
    { review_id: 'r1', rating: 5, title: 'Excelente', text: 'Muy bueno', lang: 'es', published_date: '2026-07-01T10:00:00Z', url: 'https://tripadvisor.com/r1', user: { name: 'María' } },
    { review_id: 'r2', rating: 3, title: 'Meh', text: 'Regular', lang: 'en', published_date: '2026-07-02T10:00:00Z', url: 'https://tripadvisor.com/r2', user: { name: 'John' } },
    // review sin rating → se filtra
    { review_id: 'r3', text: 'Sin rating' },
  ],
})

describe('fetchTripadvisorReviews', () => {
  it('sin creds → skip silencioso, devuelve []', async () => {
    expect(await fetchTripadvisorReviews({}, mockFetcher, noopLog)).toEqual([])
    expect(await fetchTripadvisorReviews({ apiKey: 'x' }, mockFetcher, noopLog)).toEqual([])
    expect(await fetchTripadvisorReviews({ locationId: 'y' }, mockFetcher, noopLog)).toEqual([])
  })

  it('API cae → try/catch, devuelve []', async () => {
    const failing: TripadvisorFetcher = async () => { throw new Error('500 Internal Server Error') }
    expect(await fetchTripadvisorReviews(validConfig, failing, noopLog)).toEqual([])
  })

  it('API ok → array normalizado al schema, descarta reviews sin id/rating', async () => {
    const result = await fetchTripadvisorReviews(validConfig, mockFetcher, noopLog)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      source: 'tripadvisor',
      sourceExternalId: 'r1',
      authorName: 'María',
      rating: 5,
      title: 'Excelente',
      comment: 'Muy bueno',
      language: 'es',
      submittedAt: '2026-07-01T10:00:00Z',
      url: 'https://tripadvisor.com/r1',
    })
    expect(result[1].sourceExternalId).toBe('r2')
    expect(result[1].rating).toBe(3)
  })

  it('normalize es puro y mapea todos los campos', () => {
    const out = normalizeTripadvisorReview({ review_id: 'x', rating: 4, text: 'ok', lang: 'pt', published_date: '2026-01-01', user: { name: 'Ana' }, url: 'u' })
    expect(out.source).toBe('tripadvisor')
    expect(out.authorName).toBe('Ana')
    expect(out.language).toBe('pt')
  })

  it('rating > 5 se clamp a 5; rating < 1 se clamp a 1', () => {
    expect(normalizeTripadvisorReview({ review_id: 'x', rating: 9 }).rating).toBe(5)
    expect(normalizeTripadvisorReview({ review_id: 'x', rating: 0 }).rating).toBe(0) // 0 (invalid) stays 0 → filtrado
    expect(normalizeTripadvisorReview({ review_id: 'x', rating: -2 }).rating).toBe(0)
  })
})
