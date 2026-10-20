/* منصة نُبل وابتكار للتسويق — طبقة الواجهة 3.0 «نُبل موشن»
   1) مكتبة أيقونات متحركة ثنائية اللون تستبدل I.* في كل المنصة (تتحرك باستمرار مثل GIF وبوضوح SVG)
   2) إطار متجاوب: درج جانبي آمن، شريط سفلي بزر إنشاء سريع، بحث منبثق، لوحة أوامر Ctrl+K
   3) انتقالات: شريط تقدم، دخول متتابع، عدّ الأرقام، تموّج الأزرار، نوافذ تُغلق بحركة
   لا تغيّر أي منطق أو بيانات — تغلّف renderShell/rerender/modal فقط. */
'use strict';
(function nublMotion() {
  // ---------- 1) الأيقونات المتحركة ----------
  const A = (body, cls = '') => `<svg class="ai ${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  const s = (d, c = '') => `<path class="s ${c}" d="${d}"/>`;
  const ICONS = {
    home: A(`<path class="t" d="M4 11l8-6.5 8 6.5v8.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>${s('M3 11l9-7 9 7')}${s('M5 9.8V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.8')}<rect class="f m-pulse" x="10" y="14" width="4" height="7" rx="1"/><circle class="f2 m-up" cx="17" cy="4.5" r="1.3"/>`),
    sun: A(`<circle class="f m-pulse" cx="12" cy="12" r="4.2"/><g class="m-spin">${s('M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6')}</g>`),
    users: A(`<g class="m-bob2"><circle class="t" cx="16.5" cy="8" r="3"/>${s('M16.5 5a3 3 0 0 1 0 6M18.6 14.6c1.8.8 2.9 2.6 3.1 5.4')}</g><g class="m-bob"><circle class="f" cx="9" cy="8" r="3.4"/>${s('M2.5 20.5c.8-3.6 3.4-5.7 6.5-5.7s5.7 2.1 6.5 5.7')}</g>`),
    funnel: A(`<path class="t" d="M3.5 4h17l-6.7 8.2V18l-3.6 2v-7.8z"/>${s('M3 4h18l-7 8.5V19l-4 2v-8.5z')}<circle class="f m-drop" cx="12" cy="7" r="1.2"/><circle class="f2 m-drop2" cx="12" cy="7" r="1.1"/>`),
    chat: A(`<path class="t" d="M4 5h16v11H8l-4 4z"/>${s('M4 5h16v11H8l-4 4z')}<circle class="f m-t1" cx="8.5" cy="10.5" r="1.25"/><circle class="f m-t2" cx="12" cy="10.5" r="1.25"/><circle class="f m-t3" cx="15.5" cy="10.5" r="1.25"/>`),
    pin: A(`<ellipse class="t m-pulse" cx="12" cy="21.3" rx="4.5" ry="1.2"/><g class="m-bob">${s('M12 19s-6.5-5.8-6.5-10.6a6.5 6.5 0 0 1 13 0C18.5 13.2 12 19 12 19z')}<circle class="f" cx="12" cy="8.6" r="2.4"/></g>`),
    brief: A(`<rect class="t" x="3" y="7" width="18" height="13" rx="2"/>${s('M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2', 'm-bob')}<rect class="s" x="3" y="7" width="18" height="13" rx="2"/><rect class="f m-pulse" x="10" y="11.5" width="4" height="3" rx="1"/>${s('M3 13h7M14 13h7')}`),
    tag: A(`<g class="m-swing" style="transform-origin:30% 30%"><path class="t" d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/>${s('M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z')}<circle class="f" cx="8" cy="8" r="1.7"/></g>`),
    doc: A(`<path class="t" d="M6 3h9l4 4v14H6z"/>${s('M6 3h9l4 4v14H6z')}${s('M14 3v5h5')}<path class="x m-draw" pathLength="1" d="M9 12.5h7"/><path class="x m-draw2" pathLength="1" d="M9 16.5h5"/>`),
    sign: A(`${s('M4 20.5h16')}<path class="x m-draw" pathLength="1" d="M4.5 17c2-2.6 3.3-2.6 4 0s2.2 2.4 3.6-.2"/><g class="m-glass">${s('M13.5 13.5l6-6a1.8 1.8 0 0 0-2.6-2.6l-6 6-.8 3.4z')}<path class="f" d="M16.9 4.9l2.6 2.6-1.3 1.3-2.6-2.6z"/></g>`),
    bill: A(`<path class="t" d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/>${s('M6 3h12v18l-3-2-3 2-3-2-3 2z')}<path class="x m-draw" pathLength="1" d="M9 8h6"/><path class="x m-draw2" pathLength="1" d="M9 12h6"/><circle class="f2 m-pulse" cx="12" cy="16" r="1.2"/>`),
    cash: A(`<rect class="t" x="2" y="6" width="20" height="12" rx="2"/><rect class="s" x="2" y="6" width="20" height="12" rx="2"/><circle class="f m-pulse" cx="12" cy="12" r="2.8"/><circle class="f2 m-shine" cx="5.5" cy="9.5" r="1"/><circle class="f2 m-shine" cx="18.5" cy="14.5" r="1" style="animation-delay:1s"/>`),
    out: A(`${s('M4 20h16')}<g class="m-down">${s('M12 3v12M7 10l5 5 5-5')}</g><circle class="f m-pulse" cx="12" cy="20" r="1.1"/>`),
    folder: A(`<path class="t" d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>${s('M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z')}<path class="f m-open o-b" d="M5 11h15l-1.6 7H3.4z" opacity=".55"/><rect class="f2 m-slide" x="8" y="8.5" width="8" height="2" rx="1"/>`),
    check: A(`<rect class="t" x="3" y="3" width="18" height="18" rx="4"/><rect class="s" x="3" y="3" width="18" height="18" rx="4"/><path class="x m-draw" pathLength="1" d="M7.5 12.3l3.2 3.2 5.8-6.8"/>`),
    cal: A(`<rect class="t" x="3" y="5" width="18" height="16" rx="2.5"/><rect class="s" x="3" y="5" width="18" height="16" rx="2.5"/>${s('M3 10h18')}<g class="m-flip o-t"><path class="f" d="M5 5.2h14V10H5z" opacity=".6"/></g>${s('M8 3v4M16 3v4')}<circle class="f2 m-pulse" cx="15.5" cy="15.5" r="1.8"/><circle class="t" cx="8.5" cy="15.5" r="1.2"/>`),
    star: A(`<path class="f m-tw" d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z"/><circle class="f2 m-sp1" cx="19" cy="5" r="1.4"/><circle class="f2 m-sp2" cx="5" cy="19" r="1.1"/>`),
    book: A(`<path class="t" d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/>${s('M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3')}${s('M20 4v14h-7')}<path class="f m-flip o-l" d="M13 6.5c1.5-1.2 3.5-1.5 5.5-1.3v11c-2-.2-4 .1-5.5 1.3z" opacity=".55"/>`),
    mega: A(`<path class="t" d="M3 10v4a1 1 0 0 0 1 1h2.5L12 19V5L6.5 9H4a1 1 0 0 0-1 1z"/>${s('M3 10v4a1 1 0 0 0 1 1h2.5L12 19V5L6.5 9H4a1 1 0 0 0-1 1z')}<g class="m-pulse">${s('M15.5 9.2a4 4 0 0 1 0 5.6')}</g><g class="m-tw">${s('M18.4 6.6a8 8 0 0 1 0 10.8')}</g><rect class="f m-bob" x="6.2" y="15.4" width="2.6" height="4.6" rx="1.1"/>`),
    chart: A(`${s('M2 20.5h20')}<rect class="f2 m-g1 o-b" x="4" y="10" width="3.4" height="10" rx="1"/><rect class="f m-g2 o-b" x="10.3" y="4" width="3.4" height="16" rx="1"/><rect class="f2 m-g3 o-b" x="16.6" y="13" width="3.4" height="7" rx="1"/>`),
    team: A(`<circle class="t" cx="12" cy="8" r="4"/><g class="m-bob"><circle class="s" cx="12" cy="8" r="4"/></g>${s('M4 21c1-4 4-6 8-6s7 2 8 6')}<circle class="f m-pulse" cx="18.5" cy="5.5" r="2"/>`),
    gear: A(`<g class="m-spin">${s('M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z')}</g><circle class="f m-pulse" cx="12" cy="12" r="3"/>`),
    upload: A(`${s('M4 20h16')}<g class="m-up">${s('M12 17V5M7 10l5-5 5 5')}</g>`),
    plus: A(`<g class="m-pulse">${s('M12 5v14M5 12h14')}</g>`),
    search: A(`<g class="m-glass"><circle class="t" cx="11" cy="11" r="7"/><circle class="s" cx="11" cy="11" r="7"/>${s('M20 20l-3.6-3.6')}<path class="x m-shine" d="M8 9.2a3.2 3.2 0 0 1 2.4-2"/></g>`),
    menu: A(`<path class="s m-wd o-r" d="M4 6h16"/><path class="s" d="M4 12h16"/><path class="s m-wd2 o-r" d="M4 18h16"/>`),
    wa: `<svg class="ai" viewBox="0 0 24 24" aria-hidden="true"><circle class="f2 m-ring" cx="12" cy="12" r="10" style="opacity:.35"/><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.5 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg>`,
    phone: A(`<g class="m-wig">${s('M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2')}</g><path class="x m-shine" d="M15 3.5a6 6 0 0 1 5.5 5.5"/><path class="x m-shine" style="animation-delay:.5s" d="M15 7a2.5 2.5 0 0 1 2 2"/>`),
    print: A(`${s('M6 9V3h12v6')}<path class="t" d="M4 11h16v7H4z"/>${s('M6 18H4v-7h16v7h-2')}<g class="m-slide"><rect class="s" x="8" y="14" width="8" height="7"/><path class="x" d="M10 17h4"/></g><circle class="f2 m-shine" cx="17" cy="13.5" r=".9"/>`),
    tg: `<svg class="ai" viewBox="0 0 24 24" aria-hidden="true"><g class="m-fly"><path fill="currentColor" d="M21.9 4.6 18.8 19.3c-.2 1-.8 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.8-7.9c.4-.3-.1-.5-.6-.2L6.7 13.2 2 11.7c-1-.3-1-1 .2-1.5l18.4-7.1c.9-.3 1.6.2 1.3 1.5z"/></g></svg>`,
    layers: A(`<g class="m-bob"><path class="f" d="M12 3l9 5-9 5-9-5z" opacity=".75"/>${s('M12 3l9 5-9 5-9-5z')}</g><g class="m-bob2">${s('M3 13l9 5 9-5')}</g>${s('M3 17.5l9 5 9-5', 'm-shine')}`),
    spark: A(`<g class="m-tw">${s('M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6')}</g><circle class="f m-pulse" cx="12" cy="12" r="2"/>`),
    // أيقونات جديدة للمراحل القادمة
    bulb: A(`<circle class="f m-ring" cx="12" cy="9" r="6" style="opacity:.4"/>${s('M9 18h6M10 21h4')}${s('M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0 0 12 3z')}<path class="x m-shine" d="M12 7v4l1.6 1.6"/>`),
    ai: A(`<path class="f m-tw" d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6z"/><path class="f2 m-sp1" d="M17.5 13l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z"/><circle class="f m-sp2" cx="18" cy="5" r="1.2"/>`),
    clip: A(`<g class="m-swing" style="transform-origin:50% 20%">${s('M20.5 11.5l-8.3 8.3a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9')}</g>`),
    clock: A(`<circle class="t" cx="12" cy="12" r="9"/><circle class="s" cx="12" cy="12" r="9"/><path class="x m-spin-f" style="transform-origin:12px 12px;transform-box:view-box" d="M12 12V7"/>${s('M12 12l3.5 2')}`),
    bell: A(`<g class="m-wig" style="transform-origin:50% 8%">${s('M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z')}<circle class="f" cx="12" cy="20.5" r="1.6"/></g>`),
    link: A(`<g class="m-bob">${s('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1')}</g><g class="m-bob2">${s('M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1')}</g>`),
    edit: A(`<g class="m-glass">${s('M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z')}<path class="f" d="M14 6l4 4-1.2 1.2-4-4z"/></g>`),
    trash: A(`<g class="m-wig" style="transform-origin:80% 100%">${s('M4 7h16M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1z')}</g><path class="t" d="M6 7h12l-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z"/>${s('M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6')}`),
  };
  Object.assign(I, ICONS);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOBILE = () => window.matchMedia('(max-width:860px)').matches;
  const tile = (ic, cls = '') => `<span class="ico ${cls}">${I[ic] || I.star}</span>`;

  // ورقة الأنماط تكون آخر ما يُحمَّل لتتقدم على أنماط الوحدات المحقونة
  function themeLast() { const l = document.querySelector('link[href^="theme.css"]'); if (l && document.head.lastElementChild !== l) document.head.appendChild(l); }
  themeLast();

  // ---------- 2) الإطار ----------
  function routeInfo(name) {
    for (const [g, items] of NAV) for (const it of items) {
      if (it[0] === name || (it[4] || '').split(',').includes(name)) return { group: g, icon: it[2], title: it[1], route: it[0] };
    }
    const extra = { wa: ['صندوق واتساب', 'wa'], search: ['نتائج البحث', 'search'], lead: ['عميل محتمل', 'users'], client: ['عميل', 'brief'] };
    if (extra[name]) return { group: '', icon: extra[name][1], title: extra[name][0], route: name };
    return { group: '', icon: 'star', title: '', route: name };
  }

  function decorateNav() {
    const logo = $('.side .brand img'); if (logo) logo.setAttribute('src', '../logo-white.png');
    $$('.side .nav-a').forEach((a, i) => {
      if (a.querySelector('.ico')) return;
      const svg = a.querySelector('svg'); if (!svg) return;
      const w = document.createElement('span'); w.className = 'ico';
      svg.replaceWith(w); w.appendChild(svg);
      w.querySelectorAll('.ai *').forEach((p) => { p.style.animationDelay = `${(i % 7) * 0.23}s`; });
    });
    if (!$('.side-close')) {
      const c = document.createElement('button'); c.type = 'button'; c.className = 'side-close'; c.setAttribute('aria-label', 'إغلاق القائمة'); c.textContent = '✕';
      c.onclick = () => toggleSide(false); $('.side').appendChild(c);
    }
  }

  function toggleSide(open) {
    const side = $('.side'); if (!side) return;
    side.classList.toggle('open', open);
    $('#sidedim')?.classList.toggle('on', open);
    document.body.style.overflow = open && MOBILE() ? 'hidden' : '';
  }

  function topBar() {
    const top = $('.top'); if (!top) return;
    const burger = $('.burger', top);
    if (burger && !burger.dataset.v3) { burger.dataset.v3 = 1; burger.classList.add('tbtn'); burger.onclick = () => toggleSide(!$('.side').classList.contains('open')); }
    const gs = $('#gsearch');
    if (gs && !$('kbd', gs)) gs.insertAdjacentHTML('beforeend', '<kbd>Ctrl K</kbd>');
    if (!$('#sbtn')) {
      const b = document.createElement('button'); b.type = 'button'; b.id = 'sbtn'; b.className = 'tbtn sbtn'; b.setAttribute('aria-label', 'بحث'); b.innerHTML = I.search;
      const bell = $('#bell'); bell ? bell.before(b) : top.appendChild(b);
      b.onclick = () => { top.classList.toggle('s-open'); if (top.classList.contains('s-open')) setTimeout(() => $('#gsearch input')?.focus(), 50); };
    }
    // الجرس يهتز عند وجود إشعارات غير مقروءة
    const bdg = $('#bell .bdg');
    if (bdg && !bdg.dataset.v3) {
      bdg.dataset.v3 = 1;
      const sync = () => { $('#bell')?.classList.toggle('ring', !!bdg.textContent.trim()); const d = $('#bdot'); if (d) d.textContent = bdg.textContent; };
      new MutationObserver(sync).observe(bdg, { childList: true, characterData: true, subtree: true }); sync();
    }
  }

  function pageTitle() {
    const h = $('#ptitle'); if (!h) return;
    const info = routeInfo(S.route);
    const t = h.textContent || info.title;
    h.innerHTML = `${tile(info.icon)}<span class="tt">${esc(t)}</span>`;
    document.title = `${t} · منصة نُبل وابتكار للتسويق`;
  }

  // شريط سفلي + زر إنشاء سريع
  const BNAV = [['dashboard', 'الرئيسية', 'home', null], ['tasks', 'المهام', 'check', 'tasks'], ['fab'], ['leads', 'العملاء', 'users', 'leads'], ['more', 'المزيد', 'menu']];
  const QUICK = [
    ['مهمة من قالب', 'layers', () => go('#/templates'), 'templates'],
    ['عميل محتمل', 'users', () => openForm('leads'), 'leads'],
    ['تسجيل تواصل', 'chat', () => openForm('activities'), 'activities'],
    ['زيارة ميدانية', 'pin', () => openForm('visits'), 'visits'],
    ['صندوق واتساب', 'wa', () => go('#/wa'), null],
    ['منشور محتوى', 'cal', () => openForm('content'), 'content'],
  ];
  function bottomNav() {
    if ($('#bnav')) return;
    const ok = (p) => { try { return navAllowed(p); } catch { return true; } };
    const nav = document.createElement('nav'); nav.id = 'bnav'; nav.className = 'bnav'; nav.setAttribute('aria-label', 'التنقل السريع');
    nav.innerHTML = BNAV.map(([r, l, ic, p]) => {
      if (r === 'fab') return `<button type="button" class="fab" id="bfab" aria-label="إنشاء سريع">${tile('plus')}</button>`;
      if (r === 'more') return `<button type="button" id="bmore">${tile(ic)}<span>${l}</span><i class="dot" id="bdot"></i></button>`;
      if (!ok(p)) return `<a href="#/myday" data-r="myday">${tile('sun')}<span>يومي</span></a>`;
      return `<a href="#/${r}" data-r="${r}">${tile(ic)}<span>${l}</span></a>`;
    }).join('');
    document.body.appendChild(nav);
    const items = QUICK.filter((q) => !q[3] || can(q[3], 'w') || (q[3] === 'templates' && can('tasks')));
    const sh = document.createElement('div'); sh.className = 'fab-sheet'; sh.id = 'fabsheet';
    sh.innerHTML = `<h6>إنشاء سريع</h6><div class="fs-g">${items.map((q, i) => `<button type="button" data-q="${i}">${tile(q[1])}<span>${q[0]}</span></button>`).join('')}</div>`;
    const dim = document.createElement('div'); dim.className = 'fab-dim'; dim.id = 'fabdim';
    document.body.append(dim, sh);
    const fab = $('#bfab');
    const setFab = (on) => { fab.classList.toggle('open', on); sh.classList.toggle('on', on); dim.classList.toggle('on', on); };
    fab.onclick = () => setFab(!sh.classList.contains('on'));
    dim.onclick = () => setFab(false);
    $$('[data-q]', sh).forEach((b) => b.onclick = () => { setFab(false); items[+b.dataset.q][2](); });
    $('#bmore').onclick = () => toggleSide(true);
  }
  function syncBottom() {
    const r = routeInfo(S.route).route;
    $$('#bnav a').forEach((a) => a.classList.toggle('on', a.dataset.r === S.route || a.dataset.r === r));
  }

  // إخفاء الشريط السفلي عند التمرير للأسفل وإظهاره عند الصعود
  let lastY = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    document.body.classList.toggle('scrolled', y > 8);
    if (MOBILE()) document.body.classList.toggle('bn-hide', y > lastY + 6 && y > 120);
    if (y < lastY - 4) document.body.classList.remove('bn-hide');
    lastY = y;
  }, { passive: true });

  // ---------- 3) الحركة داخل الصفحات ----------
  function countUp(root) {
    if (reduce) return;
    $$('.kpi .v .num', root).forEach((el) => {
      if (el.dataset.cu) return; el.dataset.cu = 1;
      const raw = el.textContent.replace(/,/g, ''); const target = Number(raw);
      if (!isFinite(target) || target === 0) return;
      const dec = (raw.split('.')[1] || '').length; const t0 = performance.now(); const dur = 900;
      const step = (t) => { const p = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * e).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }
  const KPI_ICONS = [[/محتمل|عملاء/, 'users'], [/متابع/, 'phone'], [/خط المبيعات|صفقات/, 'funnel'], [/مكسوب/, 'star'], [/الإيراد|المتكرر/, 'chart'],
    [/المستحق|فواتير/, 'bill'], [/المحص|مدفوع/, 'cash'], [/مصروف/, 'out'], [/مهام|المهام/, 'check'], [/محتوى/, 'cal'], [/عقود|عقد/, 'sign'],
    [/زيار/, 'pin'], [/الالتزام|المواعيد/, 'clock'], [/رسائل|محادث|واتساب/, 'chat']];
  function decorate(root) {
    $$('.kpi', root).forEach((k, i) => {
      if (k.querySelector('.ki')) return;
      const l = (k.querySelector('.l') || {}).textContent || '';
      const hit = KPI_ICONS.find(([re]) => re.test(l));
      k.insertAdjacentHTML('afterbegin', tile(hit ? hit[1] : 'spark', 'ki'));
      k.style.setProperty('--i', i);
    });
    $$('.grid', root).forEach((g) => [...g.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 12))));
    $$('table.t', root).forEach((tb) => {
      const heads = $$('thead th', tb).map((th) => th.textContent.trim());
      if (!heads.length) return;
      $$('tbody tr', tb).forEach((tr, ri) => {
        if (tr.dataset.lb) return; tr.dataset.lb = 1; tr.style.animationDelay = `${Math.min(ri, 10) * 35}ms`;
        [...tr.children].forEach((td, i) => { if (!td.hasAttribute('data-label')) td.setAttribute('data-label', heads[i] || ''); });
      });
    });
    // شريط الأدوات على الجوال: الفلاتر مطوية خلف زر «تصفية»
    $$('.toolbar', root).forEach((tb) => {
      const sels = $$(':scope>select.inp', tb);
      if (sels.length < 2 || tb.dataset.tbc) return; tb.dataset.tbc = 1; tb.classList.add('tb-c');
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-g tb-filter';
      const upd = () => { const n = sels.filter((x) => x.value).length; b.innerHTML = `${I.funnel} تصفية${n ? ` <b>${n}</b>` : ''}`; };
      upd(); sels.forEach((x) => x.addEventListener('change', upd));
      b.onclick = () => tb.classList.toggle('tb-c');
      const sr = $(':scope>.search', tb); sr ? sr.after(b) : tb.prepend(b);
    });
    $$('.empty', root).forEach((e) => { if (!e.querySelector('.ai') && !e.classList.contains('small') && e.textContent.trim().length < 80) e.insertAdjacentHTML('afterbegin', I.spark); });
    countUp(root);
  }

  // تموّج الأزرار
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.btn'); if (!b || reduce) return;
    const r = b.getBoundingClientRect(); const d = Math.max(r.width, r.height);
    const s1 = document.createElement('span'); s1.className = 'rp';
    s1.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    b.appendChild(s1); setTimeout(() => s1.remove(), 650);
  });

  // شريط التقدم أثناء التنقل
  function prog(on) {
    let p = $('#navbar-prog'); if (!p) { p = document.createElement('div'); p.id = 'navbar-prog'; document.body.appendChild(p); }
    if (on) { p.className = ''; void p.offsetWidth; p.className = 'go'; } else { p.className = 'done'; }
  }

  // ---------- لوحة الأوامر (Ctrl+K) ----------
  function cmdk() {
    if ($('.cmdk')) return;
    const items = [];
    for (const [g, its] of NAV) for (const it of its) if (navAllowed(it[3])) items.push({ g, l: it[1], ic: it[2], run: () => go('#/' + it[0]) });
    items.push({ g: 'المبيعات و CRM', l: 'صندوق واتساب', ic: 'wa', run: () => go('#/wa') });
    QUICK.forEach((q) => { if (!q[3] || can(q[3], 'w')) items.push({ g: 'إنشاء', l: q[0], ic: q[1], run: q[2] }); });
    const bg = document.createElement('div'); bg.className = 'cmdk';
    bg.innerHTML = `<div class="cmdk-b"><input placeholder="اكتب للانتقال أو الإنشاء… أو ابحث في السجلات" aria-label="بحث الأوامر"><div class="cmdk-l"></div></div>`;
    document.body.appendChild(bg);
    const inp = $('input', bg); const list = $('.cmdk-l', bg); let sel = 0; let shown = [];
    const draw = () => {
      const q = inp.value.trim();
      shown = items.filter((x) => !q || x.l.includes(q) || x.g.includes(q));
      if (q) shown.push({ g: 'بحث', l: `ابحث في السجلات عن «${q}»`, ic: 'search', run: () => go('#/search/' + encodeURIComponent(q)) });
      sel = Math.min(sel, shown.length - 1);
      let lastG = '';
      list.innerHTML = shown.map((x, i) => { const h = x.g !== lastG ? `<div class="cmdk-g">${esc(x.g)}</div>` : ''; lastG = x.g;
        return `${h}<div class="cmdk-i ${i === sel ? 'sel' : ''}" data-i="${i}">${tile(x.ic)}<span>${esc(x.l)}</span><small>${i === sel ? 'Enter ↵' : ''}</small></div>`; }).join('');
      $$('.cmdk-i', list).forEach((d) => { d.onclick = () => pick(+d.dataset.i); d.onmousemove = () => { if (sel !== +d.dataset.i) { sel = +d.dataset.i; draw(); } }; });
      $('.cmdk-i.sel', list)?.scrollIntoView({ block: 'nearest' });
    };
    const close = () => bg.remove();
    const pick = (i) => { const x = shown[i]; close(); x && x.run(); };
    inp.oninput = () => { sel = 0; draw(); };
    inp.onkeydown = (e) => {
      if (e.key === 'ArrowDown') { sel = (sel + 1) % shown.length; draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = (sel - 1 + shown.length) % shown.length; draw(); e.preventDefault(); }
      else if (e.key === 'Enter') pick(sel); else if (e.key === 'Escape') close();
    };
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
    draw(); inp.focus();
  }
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && S.meta) { e.preventDefault(); cmdk(); }
    if (e.key === 'Escape') { toggleSide(false); $('#fabdim.on')?.click(); }
  });

  // ---------- إغلاق النوافذ بحركة ----------
  const baseModal = modal;
  modal = function (o) {
    const m = baseModal(o);
    const h = $('.modal-h h3', m.el);
    if (h && o.icon && I[o.icon]) h.insertAdjacentHTML('afterbegin', tile(o.icon));
    const rawClose = m.close; let closing = false;
    const animClose = () => {
      if (closing) return; closing = true;
      if (reduce) return rawClose();
      $('.modal', m.el)?.classList.add('out'); m.el.classList.add('out');
      setTimeout(rawClose, 230);
    };
    // كل أزرار الإغلاق الأصلية تستدعي close المحلي؛ نعيد ربط الخلفية وزر ×
    $('.x', m.el).onclick = animClose;
    m.el.addEventListener('mousedown', (e) => { if (e.target === m.el) { e.stopImmediatePropagation(); animClose(); } }, true);
    decorate(m.el);
    return { el: m.el, close: animClose };
  };

  // ---------- الربط مع النواة ----------
  function enhanceShell() {
    themeLast();
    decorateNav(); topBar(); bottomNav();
    if (!$('#sidedim')) {
      const dim = document.createElement('div'); dim.id = 'sidedim'; dim.className = 'side-dim';
      dim.onclick = () => toggleSide(false); $('.side')?.after(dim);
    }
    // سحب الدرج لليمين لإغلاقه
    const side = $('.side');
    if (side && !side.dataset.sw) {
      side.dataset.sw = 1; let x0 = null;
      side.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
      side.addEventListener('touchend', (e) => { if (x0 != null && e.changedTouches[0].clientX - x0 > 60) toggleSide(false); x0 = null; }, { passive: true });
    }
    const view = $('#view');
    if (view && !view.dataset.obs) {
      view.dataset.obs = 1; let pend = false;
      new MutationObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; decorate(view); }); }).observe(view, { childList: true, subtree: true });
    }
  }
  const baseShell = renderShell;
  renderShell = function () { baseShell.apply(this, arguments); enhanceShell(); };
  const baseRender = rerender;
  rerender = async function () {
    toggleSide(false); $('.top')?.classList.remove('s-open'); $('#fabdim.on')?.click();
    prog(true);
    const v = $('#view'); v && v.classList.remove('vt');
    try { await baseRender.apply(this, arguments); } finally {
      prog(false); pageTitle(); syncBottom();
      if (v) { [...v.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 10))); void v.offsetWidth; v.classList.add('vt'); }
      document.body.classList.remove('bn-hide');
    }
  };

  const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute('content', '#F6F3EC');
  if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
    document.head.insertAdjacentHTML('beforeend', '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="منصة نُبل">');
  }
  window.nublCmdk = cmdk;
  if (S.meta && $(".side")) { renderShell(); rerender(); }
})();
