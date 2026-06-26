// widget/loader.js — Embed script for external hotel websites
// Usage: <script src="https://yourdomain.com/widget/loader.js" data-hotel="HOTEL_ID"></script>
(function() {
  'use strict';
  
  const script = document.currentScript;
  const hotelId = script?.getAttribute('data-hotel');
  const apiUrl = script?.getAttribute('data-api') || '';
  const containerId = script?.getAttribute('data-container') || 'booking-widget-container';
  
  if (!hotelId) {
    console.error('[BookingWidget] Missing data-hotel attribute');
    return;
  }

  // Create container
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    script.parentNode.insertBefore(container, script);
  }

  // Build iframe URL
  const widgetUrl = `${apiUrl}/widget/index.html?hotel=${encodeURIComponent(hotelId)}${apiUrl ? `&api=${encodeURIComponent(apiUrl)}` : ''}`;

  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.src = widgetUrl;
  iframe.style.width = '100%';
  iframe.style.minHeight = '600px';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '12px';
  iframe.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('title', 'Motor de reservas');
  
  container.appendChild(iframe);

  // Resize handler
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'booking-widget-resize' && e.data?.height) {
      iframe.style.height = e.data.height + 'px';
    }
  });
})();
