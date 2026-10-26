/* القياس في موقع نُبل وابتكار للتسويق — Google Analytics 4 + Meta Pixel
   - صفحات الموقع تتنقل بلا إعادة تحميل (app.js يبدّل #main ويستدعي pushState)، لذلك نرسل page_view يدوياً عند كل انتقال.
   - أحداث القياس الرئيسية: whatsapp_click · phone_click · email_click · book_click · generate_lead · view_item (الباقات) · job_application
   - إيقاف القياس للزائر: localStorage.nb_noanalytics = '1' (رابط «إيقاف القياس» في سياسة الخصوصية) أو إشارة Global Privacy Control.
   - الاستخدام من ملفات أخرى: window.NBA.event(name, params) · NBA.lead(method) · NBA.optOut() · NBA.optIn()
*/
(function () {
  var GA_ID = 'G-XXXXXXXXXX';          // معرّف قياس GA4 — خاصية «Nubl Ebtikar Marketing - nubl-ebtikar.online»
  var PIXEL_ID = '993831000407341';    // بكسل Meta لموقع التسويق (مربوط بكتالوج «نبل وابتكار للتسويق — الباقات والخدمات»)
  var W = window, D = document, N = W.NBA = W.NBA || {};
  var optedOut = false;
  try { optedOut = localStorage.getItem('nb_noanalytics') === '1'; } catch (e) {}
  if (navigator.globalPrivacyControl) optedOut = true;
  var embedded = /[?&]embed=1/.test(location.search) || W.top !== W.self;
  var gaOn = !optedOut && /^G-[A-Z0-9]{6,}$/.test(GA_ID) && !/^G-X+$/.test(GA_ID);
  var fbOn = !optedOut && !!PIXEL_ID;

  N.enabled = !optedOut;
  function dropCookies() {
    try { D.cookie.split(';').forEach(function (c) { var n = c.split('=')[0].trim(); if (/^(_ga|_gid|_gat|_fbp|_fbc)/.test(n)) ['', '.' + location.hostname].forEach(function (dm) { D.cookie = n + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/' + (dm ? ';domain=' + dm : ''); }); }); } catch (e) {}
  }
  N.optOut = function () { try { localStorage.setItem('nb_noanalytics', '1'); } catch (e) {} optedOut = true; gaOn = false; fbOn = false; N.enabled = false; dropCookies(); syncOptLink(); };
  N.optIn = function () { try { localStorage.removeItem('nb_noanalytics'); } catch (e) {} N.enabled = true; location.reload(); };
  // رابط «إيقاف القياس» في سياسة الخصوصية (#nb-optout) — يعمل حتى عند الوصول للصفحة بتنقّل بلا إعادة تحميل
  function syncOptLink() { var a = D.getElementById('nb-optout'); if (a) a.textContent = optedOut ? 'القياس متوقف على هذا الجهاز ✓ (انقر لإعادة تفعيله)' : 'إيقاف القياس على هذا الجهاز'; }
  D.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('#nb-optout'); if (!a) return; e.preventDefault(); optedOut ? N.optIn() : N.optOut(); }, true);

  // ---------- GA4 ----------
  W.dataLayer = W.dataLayer || [];
  function gtag() { W.dataLayer.push(arguments); }
  W.gtag = W.gtag || gtag;
  if (gaOn) {
    gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', wait_for_update: 0 });
    gtag('js', new Date());
    gtag('config', GA_ID, { send_page_view: false, cookie_flags: 'SameSite=None;Secure', page_location: location.href, page_title: D.title });
    var g = D.createElement('script'); g.async = true; g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID; D.head.appendChild(g);
  }

  // ---------- Meta Pixel ----------
  if (fbOn && !W.fbq) {
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(W, D, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    W.fbq('init', PIXEL_ID);
  }

  // ---------- أدوات ----------
  var pagePath = function () { return location.pathname + location.search; };
  var lastPV = '', lastAt = 0;
  function pageView() {
    var p = pagePath(), now = Date.now();
    setTimeout(syncOptLink, 50);
    if (p === lastPV && now - lastAt < 1000) return;
    lastPV = p; lastAt = now;
    if (gaOn) gtag('event', 'page_view', { page_title: D.title, page_location: location.href, page_path: p, embedded: embedded ? 1 : 0 });
    if (fbOn && W.fbq) W.fbq('track', 'PageView');
  }
  N.event = function (name, params) {
    if (optedOut) return;
    params = params || {}; params.page_path = params.page_path || pagePath();
    if (gaOn) gtag('event', name, params);
  };
  N.lead = function (method, extra) {
    N.event('generate_lead', Object.assign({ method: method || 'form', currency: 'SAR', value: 0 }, extra || {}));
    if (fbOn && W.fbq) W.fbq('track', 'Lead', { content_name: method || 'form' });
  };
  N.viewPackage = function (sectorId, sectorName) {
    N.event('view_item', { currency: 'SAR', items: [{ item_id: 'PKG-' + sectorId, item_name: sectorName || sectorId, item_category: 'package' }] });
    if (fbOn && W.fbq) W.fbq('track', 'ViewContent', { content_ids: ['PKG-' + sectorId], content_type: 'product', content_name: sectorName || sectorId });
  };

  // أول صفحة
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', pageView); else pageView();

  // الانتقالات بلا إعادة تحميل (app.js) — pushState بعد تحديث العنوان، وpopstate يتبعه تبديل المحتوى
  var ps = history.pushState;
  history.pushState = function () { var r = ps.apply(this, arguments); setTimeout(pageView, 60); return r; };
  W.addEventListener('popstate', function () { setTimeout(pageView, 1500); });

  // النقرات: واتساب · اتصال · بريد · حجز جلسة · تبويبات الباقات
  D.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (a) {
      var h = a.getAttribute('href') || '', txt = (a.textContent || '').trim().slice(0, 60);
      if (/wa\.me|api\.whatsapp\.com|whatsapp:/.test(h)) {
        N.event('whatsapp_click', { link_url: h.split('?')[0], link_text: txt, location_id: a.closest('section,footer,header') ? (a.closest('section,footer,header').className || a.closest('section,footer,header').tagName).toString().slice(0, 40) : '' });
        if (fbOn && W.fbq) W.fbq('track', 'Contact', { content_name: txt });
      } else if (/^tel:/.test(h)) N.event('phone_click', { link_url: h });
      else if (/^mailto:/.test(h)) N.event('email_click', { link_url: h });
      else if (/^\/book(\/|$|\?)|\/marketing\/book/.test(h)) N.event('book_click', { link_text: txt });
    }
    var tab = e.target.closest && e.target.closest('#sector-tabs .tab');
    if (tab && W.SECTORS) { var s = W.SECTORS[+tab.dataset.i]; if (s) N.viewPackage(s.id, s.name); }
  }, true);

  // نموذج التواصل (يفتح واتساب برسالة جاهزة)
  D.addEventListener('submit', function (e) {
    var f = e.target;
    if (f && f.id === 'lead-form') N.lead('contact_form');
  }, true);
})();
