// widget/api.js — API communication layer
const WidgetAPI = {
  baseUrl: '',
  
  init(hotelId, apiUrl) {
    this.hotelId = hotelId;
    this.baseUrl = apiUrl || window.location.origin;
  },

  async checkAvailability(checkIn, checkOut, adults = 2, promoCode = '') {
    const response = await fetch(`${this.baseUrl}/api/public/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotelId: this.hotelId,
        checkIn,
        checkOut,
        adults,
        promoCode: promoCode || undefined,
      }),
    });
    if (!response.ok) throw new Error('Error al buscar disponibilidad');
    return response.json();
  },

  async getHotelInfo(slug) {
    const response = await fetch(`${this.baseUrl}/api/public/hotel/${slug}`);
    if (!response.ok) throw new Error('Error al obtener info del hotel');
    return response.json();
  },

  async createBooking(data) {
    const response = await fetch(`${this.baseUrl}/api/public/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, hotelId: this.hotelId }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Error al crear reserva');
    }
    return response.json();
  },

  async trackEvent(eventData) {
    try {
      await fetch(`${this.baseUrl}/api/public/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...eventData, hotelId: this.hotelId }),
      });
    } catch { /* fire and forget */ }
  },
};
