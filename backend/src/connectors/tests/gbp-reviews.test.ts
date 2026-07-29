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

  it('B3 fix — starRating como ENUM STRING (STAR_RATING_FOUR) → rating=4 (no NaN)', () => {
    // GBP API v4 devuelve `starRating` como enum string (`STAR_RATING_FOUR`), no como número.
    // Antes `Number('STAR_RATING_FOUR')` → NaN → rating=0 → review descartada. Ahora mapea a 4.
    expect(normalizeGbpReview({ reviewId: 'enum5', starRating: 'STAR_RATING_FIVE' }).rating).toBe(5)
    expect(normalizeGbpReview({ reviewId: 'enum4', starRating: 'STAR_RATING_FOUR' }).rating).toBe(4)
    expect(normalizeGbpReview({ reviewId: 'enum3', starRating: 'STAR_RATING_THREE' }).rating).toBe(3)
    expect(normalizeGbpReview({ reviewId: 'enum2', starRating: 'STAR_RATING_TWO' }).rating).toBe(2)
    expect(normalizeGbpReview({ reviewId: 'enum1', starRating: 'STAR_RATING_ONE' }).rating).toBe(1)
    // Legacy numérico sigue funcionando.
    expect(normalizeGbpReview({ reviewId: 'legacy', starRating: 5 }).rating).toBe(5)
    // Formato desconocido → rating=0 → descartada por la wrapper.
    expect(normalizeGbpReview({ reviewId: 'weird', starRating: 'BOGUS' }).rating).toBe(0)
  })

  it('M4 fix — sin createTime → submittedAt=null (NO now())', async () => {
    const out = normalizeGbpReview({ reviewId: 'no-time', starRating: 5, comment: 'ok' })
    expect(out.submittedAt).toBeNull()
    // La wrapper descarta reviews sin submittedAt (sin fecha no aporta al aggregate).
    const filtered = await fetchGbpReviews(
      validConfig,
      async () => ({ reviews: [{ reviewId: 'with', starRating: 5, createTime: '2026-01-01' }, { reviewId: 'without', starRating: 5 }] }),
      noopLog,
      mockTokenFetcher,
    )
    expect(filtered).toHaveLength(1)
    expect(filtered[0].sourceExternalId).toBe('with')
  })
})
