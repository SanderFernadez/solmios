// widget/booking.js — Main widget logic
(function() {
  'use strict';

  // State
  let selectedRoom = null;
  let currentAvailability = null;
  const sessionId = crypto.randomUUID();

  // Init GA4 if configured
  const params = new URLSearchParams(window.location.search);
  const ga4Id = params.get('ga4') || window.__BOOKING_GA4_ID__;
  if (ga4Id && typeof GA4Tracker !== 'undefined') {
    GA4Tracker.init(ga4Id);
  }

  // DOM elements
  const els = {
    checkin: document.getElementById('checkin'),
    checkout: document.getElementById('checkout'),
    adults: document.getElementById('adults'),
    promoCode: document.getElementById('promo-code'),
    searchBtn: document.getElementById('search-btn'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    errorMessage: document.getElementById('error-message'),
    results: document.getElementById('results'),
    roomList: document.getElementById('room-list'),
    bookingForm: document.getElementById('booking-form'),
    guestName: document.getElementById('guest-name'),
    guestEmail: document.getElementById('guest-email'),
    guestPhone: document.getElementById('guest-phone'),
    children: document.getElementById('children'),
    cancelBooking: document.getElementById('cancel-booking'),
    confirmBooking: document.getElementById('confirm-booking'),
    confirmation: document.getElementById('booking-confirmation'),
    confirmationDetails: document.getElementById('confirmation-details'),
  };

  // Init
  function init() {
    const params = new URLSearchParams(window.location.search);
    const hotelId = params.get('hotel') || params.get('hotelId');
    const apiUrl = params.get('api') || '';
    
    if (!hotelId) {
      showError('No se especificó hotel');
      return;
    }

    WidgetAPI.init(hotelId, apiUrl);
    
    // Set min dates
    const today = new Date().toISOString().split('T')[0];
    els.checkin.min = today;
    els.checkout.min = today;
    
    // Default dates
    els.checkin.value = today;
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    els.checkout.value = tomorrow;

    // Events
    els.searchBtn.addEventListener('click', search);
    els.checkin.addEventListener('change', updateCheckoutMin);
    els.cancelBooking.addEventListener('click', cancelBooking);
    els.confirmBooking.addEventListener('click', confirmBooking);

    // Track page view
    WidgetAPI.trackEvent({ sessionId, event: 'widget_view' });
  }

  function updateCheckoutMin() {
    const checkin = new Date(els.checkin.value);
    checkin.setDate(checkin.getDate() + 1);
    els.checkout.min = checkin.toISOString().split('T')[0];
    if (new Date(els.checkout.value) <= new Date(els.checkin.value)) {
      els.checkout.value = checkin.toISOString().split('T')[0];
    }
  }

  async function search() {
    if (!els.checkin.value || !els.checkout.value) {
      showError('Seleccioná las fechas');
      return;
    }

    hideError();
    showLoading(true);

    try {
      const result = await WidgetAPI.checkAvailability(
        els.checkin.value,
        els.checkout.value,
        parseInt(els.adults.value),
        els.promoCode.value
      );

      currentAvailability = result;
      renderResults(result.roomTypes);

      // GA4 tracking
      if (typeof GA4Tracker !== 'undefined') {
        GA4Tracker.trackSearch(els.checkin.value, els.checkout.value, parseInt(els.adults.value));
      }

      WidgetAPI.trackEvent({
        sessionId,
        event: 'search',
        roomType: result.roomTypes.length > 0 ? 'multiple' : 'none',
      });
    } catch (err) {
      showError(err.message || 'Error al buscar disponibilidad');
    } finally {
      showLoading(false);
    }
  }

  function renderResults(roomTypes) {
    els.roomList.innerHTML = '';
    
    if (!roomTypes || roomTypes.length === 0) {
      els.roomList.innerHTML = '<p class="text-gray-500 text-center py-4">No hay habitaciones disponibles para las fechas seleccionadas</p>';
      els.results.classList.remove('hidden');
      return;
    }

    roomTypes.forEach(room => {
      const card = document.createElement('div');
      card.className = 'bg-white rounded-lg shadow p-4 border-2 border-transparent hover:border-primary-300 transition-colors cursor-pointer';
      card.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <h3 class="font-semibold text-gray-800">${room.roomType}</h3>
            <p class="text-sm text-gray-500">Hasta ${room.capacity} huéspedes</p>
            ${room.amenities && room.amenities.length > 0 ? `
              <div class="mt-2 flex flex-wrap gap-1">
                ${room.amenities.map(a => `<span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">${a}</span>`).join('')}
              </div>
            ` : ''}
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold text-primary-600">$${room.price}</div>
            <div class="text-xs text-gray-500">por noche</div>
            ${room.originalPrice && room.originalPrice > room.price ? `
              <div class="text-xs text-green-600 font-medium mt-1">
                Ahorrás $${room.originalPrice - room.price}
              </div>
            ` : ''}
          </div>
        </div>
        <div class="mt-3 flex justify-between items-center">
          <span class="text-sm ${room.available <= 3 ? 'text-orange-600 font-medium' : 'text-green-600'}">
            ${room.available <= 3 ? `¡Solo ${room.available} disponibles!` : `${room.available} disponibles`}
          </span>
          <button class="select-room bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-colors">
            Seleccionar
          </button>
        </div>
      `;

      card.querySelector('.select-room').addEventListener('click', (e) => {
        e.stopPropagation();
        selectRoom(room);
      });

      els.roomList.appendChild(card);
    });

    els.results.classList.remove('hidden');
  }

  function selectRoom(room) {
    selectedRoom = room;
    els.results.classList.add('hidden');
    els.bookingForm.classList.remove('hidden');
    
    // GA4 tracking
    if (typeof GA4Tracker !== 'undefined') {
      GA4Tracker.trackViewRoom(room.roomType, room.price);
    }

    WidgetAPI.trackEvent({
      sessionId,
      event: 'start_booking',
      roomType: room.roomType,
      amount: room.price,
    });
  }

  function cancelBooking() {
    selectedRoom = null;
    els.bookingForm.classList.add('hidden');
    els.results.classList.remove('hidden');
  }

  async function confirmBooking() {
    if (!els.guestName.value || !els.guestEmail.value || !els.guestPhone.value) {
      showError('Completá todos los campos obligatorios');
      return;
    }

    els.confirmBooking.disabled = true;
    els.confirmBooking.textContent = 'Procesando...';

    try {
      const booking = await WidgetAPI.createBooking({
        roomType: selectedRoom.roomType,
        guestName: els.guestName.value,
        guestEmail: els.guestEmail.value,
        guestPhone: els.guestPhone.value,
        checkIn: els.checkin.value,
        checkOut: els.checkout.value,
        adults: parseInt(els.adults.value),
        children: parseInt(els.children.value),
        promoCode: els.promoCode.value || undefined,
      });

      // Show confirmation
      els.bookingForm.classList.add('hidden');
      els.confirmation.classList.remove('hidden');
      
      const nights = Math.ceil((new Date(els.checkout.value) - new Date(els.checkin.value)) / 86400000);
      els.confirmationDetails.innerHTML = `
        <div class="space-y-2">
          <div class="flex justify-between"><span class="text-gray-500">Reserva #</span><span class="font-mono">${booking.id.slice(0, 8)}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">Habitación</span><span>${selectedRoom.roomType}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">Check-in</span><span>${els.checkin.value}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">Check-out</span><span>${els.checkout.value}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">Noches</span><span>${nights}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">Total</span><span class="font-bold">$${booking.totalAmount} ${booking.currency}</span></div>
        </div>
      `;

      // GA4 tracking
      if (typeof GA4Tracker !== 'undefined') {
        GA4Tracker.trackPurchase(booking.id, booking.totalAmount, booking.currency);
      }

      WidgetAPI.trackEvent({
        sessionId,
        event: 'booking_created',
        roomType: selectedRoom.roomType,
        amount: booking.totalAmount,
      });
    } catch (err) {
      showError(err.message || 'Error al procesar la reserva');
    } finally {
      els.confirmBooking.disabled = false;
      els.confirmBooking.textContent = 'Confirmar y Pagar';
    }
  }

  function showLoading(show) {
    els.loading.classList.toggle('hidden', !show);
    els.searchBtn.disabled = show;
  }

  function showError(msg) {
    els.errorMessage.textContent = msg;
    els.error.classList.remove('hidden');
  }

  function hideError() {
    els.error.classList.add('hidden');
  }

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
