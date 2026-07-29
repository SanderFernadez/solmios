// connectors/tests/gbp-reviews.test.ts — Tests del conector GBP (F3, task 3.2).
// Aceptance: "mockear las 3 APIs → los 3 connectors devuelven arrays normalizados".
//
// El OAuth dance (getGbpAccessToken) está test aparte (services/gbp-oauth-client). Acá
// mockeamos el fetcher post-token para validar la normalización y la resiliencia.
import { describe, it, expect } from 'bun:test'
import {
  fetchGbpReviews, normalizeGbpReview,
  type GbpConfig, type GbpFetcher,
} from '../gbp-reviews'

const noopLog = { info: () => {}, warn: () => {} }

const validConfig: GbpConfig = {
  placeId: 'accounts/123/locations/456',
  serviceAccount: { clientEmail: 'sa@test.iam.gserviceaccount.com', privateKey: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n' },
}

/** Mock tokenFetcher — devuelve un token falso sin tocar la red (evita el OAuth real). */
const mockTokenFetcher = async (_sa: any): Promise<string> => 'fake-access-token'

const mockFetcher: GbpFetcher = async () => ({
  reviews: [
    { reviewId: 'g1', starRating: 5, comment: 'Great', reviewer: { displayName: 'Alice' }, createTime: '2026-07-01T10:00:00Z' },
    { reviewId: 'g2', starRating: 2, comment: 'Bad', reviewer: { displayName: 'Bob' }, createTime: '2026-07-02T10:00:00Z' },
    { reviewId: 'g3', comment: 'Sin rating' }, // filtrada
  ],
})

describe('fetchGbpReviews', () => {
  it('sin placeId → skip silencioso', async () => {
    expect(await fetchGbpReviews({ placeId: '', serviceAccount: validConfig.serviceAccount }, mockFetcher, noopLog, mockTokenFetcher)).toEqual([])
  })

  it('sin serviceAccount → skip silencioso', async () => {
    expect(await fetchGbpReviews({ placeId: 'p', serviceAccount: null }, mockFetcher, noopLog, mockTokenFetcher)).toEqual([])
    expect(await fetchGbpReviews({ placeId: 'p', serviceAccount: { clientEmail: '', privateKey: '' } }, mockFetcher, noopLog, mockTokenFetcher)).toEqual([])
  })

  it('fetcher falla (OAuth invalido, API 500) → try/catch, devuelve []', async () => {
    const failing: GbpFetcher = async () => { throw new Error('GBP reviews responded 500') }
    expect(await fetchGbpReviews(validConfig, failing, noopLog, mockTokenFetcher)).toEqual([])
  })

  it('tokenFetcher falla (OAuth key invalido) → try/catch, devuelve []', async () => {
    const failingToken = async () => { throw new Error('GBP OAuth 401 invalid_grant') }
    expect(await fetchGbpReviews(validConfig, mockFetcher, noopLog, failingToken)).toEqual([])
  })

  it('API ok → array normalizado, sin reviews sin id/rating', async () => {
    const result = await fetchGbpReviews(validConfig, mockFetcher, noopLog, mockTokenFetcher)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      source: 'google',
      sourceExternalId: 'g1',
      authorName: 'Alice',
      rating: 5,
      title: null, // GBP no tiene title
      comment: 'Great',
      language: null, // GBP no expone language en review object
      submittedAt: '2026-07-01T10:00:00Z',
      url: null, // GBP no devuelve URL directa
    })
    expect(result[1].rating).toBe(2)
  })

  it('normalize es puro', () => {
    const out = normalizeGbpReview({ reviewId: 'x', starRating: 4, comment: 'ok', reviewer: { displayName: 'Zoe' }, createTime: '2026-01-01' })
    expect(out.source).toBe('google')
    expect(out.authorName).toBe('Zoe')
    expect(out.title).toBeNull()
  })
})
