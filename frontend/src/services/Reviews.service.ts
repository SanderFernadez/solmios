// Reviews.service.ts — Flujo público de reseña (sin auth). El token de la URL es la autorización.
export interface PublicReview {
  hotelName: string
  alreadyDone: boolean
}

export const ReviewsService = {
  async get(token: string): Promise<PublicReview> {
    const res = await fetch(`/api/public/reviews/${encodeURIComponent(token)}`)
    if (!res.ok) throw new Error(String(res.status))
    return res.json() as Promise<PublicReview>
  },

  async submit(token: string, payload: { rating: number; comment?: string }): Promise<{ ok: boolean; status: number }> {
    const res = await fetch(`/api/public/reviews/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return { ok: res.ok, status: res.status }
  },
}
