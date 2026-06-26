// widget/ga4.js — Google Analytics 4 integration for widget
const GA4Tracker = {
  measurementId: '',
  
  init(measurementId) {
    if (!measurementId) return;
    this.measurementId = measurementId;
    
    // Load gtag.js
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
    
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, { send_page_view: false });
  },

  track(event, params = {}) {
    if (!this.measurementId || !window.gtag) return;
    window.gtag('event', event, params);
  },

  trackSearch(checkIn, checkOut, adults) {
    this.track('search', {
      check_in_date: checkIn,
      check_out_date: checkOut,
      adults,
    });
  },

  trackViewRoom(roomType, price) {
    this.track('view_item', {
      items: [{ item_name: roomType, price }],
    });
  },

  trackBeginCheckout(roomType, value, currency) {
    this.track('begin_checkout', {
      value,
      currency,
      items: [{ item_name: roomType }],
    });
  },

  trackPurchase(bookingId, value, currency) {
    this.track('purchase', {
      transaction_id: bookingId,
      value,
      currency,
    });
  },
};
