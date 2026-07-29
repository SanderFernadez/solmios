// connectors/tests/stayapi-reviews.test.ts — Tests del conector StayAPI (F3, task 3.2).
// Aceptance: "mockear las 3 APIs → los 3 connectors devuelven arrays normalizados".
import { describe, it, expect, mock } from 'bun:test'
import {
  fetchStayApiReviews, normalizeStayApiReview,
  type StayApiConfig, type StayApiFetcher,
} from '../stayapi-reviews'

const noopLog = { info: () => {}, warn: () => {} }

const validConfig: StayApiConfig = {
  apiKey: 'stay-key',
  hotelIds: { booking: 'book-123', airbnb: 'ab-456' }, // expedia sin mapear
}

describe('fetchStayApiReviews', () => {
  it('sin creds → skip silencioso', async () => {
    expect(await fetchStayApiReviews({}, async () => ({ data: [] }), noopLog)).toEqual([])
    expect(await fetchStayApiReviews({ apiKey: 'x' }, async () => ({ data: [] }), noopLog)).toEqual([])
  })

  it('una OTA cae → las demás siguen (resiliencia por OTA)', async () => {
    const fetcher: StayApiFetcher = async (ota) => {
      if (ota === 'booking') throw new Error('500 booking down')
      return { data: [{ id: 'ab1', rating: 5, comment: 'ok', language: 'en', date: '2026-07-01', reviewer_name: 'Host' }] }
    }
    const result = await fetchStayApiReviews(validConfig, fetcher, noopLog)
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('airbnb')
    expect(result[0].sourceExternalId).toBe('ab1')
  })

  it('3 OTAs ok → concatena resultados con source correcto por OTA', async () => {
    const fullConfig: StayApiConfig = {
      apiKey: 'stay-key',
      hotelIds: { booking: 'b1', airbnb: 'a1', expedia: 'e1' },
    }
    const fetcher: StayApiFetcher = async (ota) => {
      if (ota === 'booking') return { data: [{ id: 'b-1', rating: 4, reviewer_name: 'B1', date: '2026-07-01' }] }
      if (ota === 'airbnb')   return { data: [{ id: 'a-1', rating: 5, reviewer_name: 'A1', date: '2026-07-02' }] }
      return { data: [{ id: 'e-1', rating: 3, reviewer_name: 'E1', date: '2026-07-03' }] }
    }
    const result = await fetchStayApiReviews(fullConfig, fetcher, noopLog)
    expect(result).toHaveLength(3)
    const sources = result.map((r) => r.source).sort()
    expect(sources).toEqual(['airbnb', 'booking', 'expedia'])
  })

  it('OTA sin mapear → se saltea, no falla', async () => {
    const fetcher = mock(async () => ({ data: [] }) as any) as unknown as StayApiFetcher
    await fetchStayApiReviews(validConfig, fetcher, noopLog)
    // Solo booking y airbnb están mapeados → 2 calls, expedia se saltea.
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('normalize mapea al schema correcto', () => {
    const out = normalizeStayApiReview({ id: 'x', rating: 4, comment: 'nice', language: 'es', date: '2026-01-01', reviewer_name: 'Carlos' }, 'booking')
    expect(out.source).toBe('booking')
    expect(out.authorName).toBe('Carlos')
    expect(out.title).toBeNull() // StayAPI no devuelve title
  })
})
