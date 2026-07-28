// widget/loader.js — Embed script for external hotel websites.
// F2 2.13 (solmi-direct-booking) — Opción A: retrocompat del snippet viejo.
//
// Carga el NUEVO widget SPA (pages/public/booking-widget.vue) dentro de un <iframe>
// apuntando a /book/:slug?embed=1. Sirve el MISMO bundle SPA que la ruta /book/:slug y
// la landing /h/:slug — sin duplicar archivos sueltos en public/widget/.
//
// Uso (snippet que pega el hotelero en su sitio):
//   <script src="https://hotel.zx89.site/widget/loader.js" data-hotel="<slug>"></script>
//
// `data-hotel` es el SLUG público del hotel (no el hotelId). El slug es el identificador
// público estable desde F0 0.1; se edita en Settings → "Página pública" (F0 0.21).
//
// Atributos opcionales:
//   data-container  — id del elemento contenedor (default: 'booking-widget-container').
//                     Si no existe, se crea un <div> antes del <script>.
//   data-base       — origin del backend (default: el origin desde el que se sirve este
//                     script, ej. https://hotel.zx89.site). Útil para staging/testing.
//
// El iframe se auto-resize cuando el widget emite `booking-widget-resize` (postMessage),
// mismo protocolo que el loader viejo para no romper integraciones que ya lo escuchaban.
// El widget SPA todavía no emite ese evento (vive en F3); mientras tanto, min-height fija
// asegura que el iframe no quede recortado.
(function () {
  'use strict';

  var script = document.currentScript;
  var slug = script && script.getAttribute('data-hotel');
  if (!slug) {
    console.error('[BookingWidget] Falta el atributo data-hotel (slug público del hotel)');
    return;
  }

  var containerId = (script && script.getAttribute('data-container')) || 'booking-widget-container';
  var container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    if (script && script.parentNode) {
      script.parentNode.insertBefore(container, script);
    } else {
      document.body.appendChild(container);
    }
  }

  // Resolver el origin del backend: explícito (data-base), o derivado del src del propio script.
  var base = (script && script.getAttribute('data-base')) || '';
  if (!base) {
    var src = script && script.getAttribute('src');
    if (src) {
      try { base = new URL(src, window.location.href).origin; } catch (e) { base = ''; }
    }
    if (!base) base = window.location.origin;
  }

  // Deep-link: si el sitio host ya tiene checkIn/checkOut/guests/rooms en su URL, los
  // propagamos al iframe para que el widget arranque en ese contexto.
  var hostQuery = new URLSearchParams(window.location.search);
  var iframeQuery = new URLSearchParams({ embed: '1' });
  ['checkIn', 'checkOut', 'guests', 'rooms'].forEach(function (k) {
    var v = hostQuery.get(k);
    if (v) iframeQuery.set(k, v);
  });

  var iframeUrl = base.replace(/\/$/, '') + '/book/' + encodeURIComponent(slug) + '?' + iframeQuery.toString();

  var iframe = document.createElement('iframe');
  iframe.src = iframeUrl;
  iframe.style.width = '100%';
  iframe.style.minHeight = '560px';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '12px';
  iframe.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('title', 'Motor de reservas');
  container.appendChild(iframe);

  // Auto-resize via postMessage. Misma forma de evento que el loader viejo para mantener
  // compat con integraciones existentes que lo escuchaban.
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'booking-widget-resize' && typeof e.data.height === 'number') {
      iframe.style.height = e.data.height + 'px';
    }
  });
})();
