/* «نُبل موشن» للموقع العام — نفس أيقونات المنصة المتحركة ثنائية اللون وتفاعلها وسلاستها
   - يستبدل أيقونات الخدمات الثابتة بأيقونات المنصة المتحركة (مطابقة بالشكل)
   - تموّج الأزرار عند النقر، رفع البطاقات بزنبرك ناعم، انتقالات سلسة بين الصفحات، عدّ الأرقام موجود في app.js */
(function () {
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
  // أيقونات إضافية للموقع بنفس أسلوب المنصة
  ICONS.insta = A(`<rect class="t" x="3" y="3" width="18" height="18" rx="5"/><rect class="s" x="3" y="3" width="18" height="18" rx="5"/><circle class="f m-pulse" cx="12" cy="12" r="3.6"/><circle class="s" cx="12" cy="12" r="4.2"/><circle class="f2 m-sp1" cx="17.5" cy="6.5" r="1.2"/>`);
  ICONS.mega = A(`<g class="m-wig" style="transform-origin:20% 50%"><path class="t" d="M3 11v2a2 2 0 0 0 2 2h2l6 4V5L7 9H5a2 2 0 0 0-2 2z"/>${s('M3 11v2a2 2 0 0 0 2 2h2l6 4V5L7 9H5a2 2 0 0 0-2 2z')}</g><path class="x m-draw" pathLength="1" d="M17 8.5a5 5 0 0 1 0 7"/><path class="x m-draw2" pathLength="1" d="M19.5 6a8.5 8.5 0 0 1 0 12"/>`);
  ICONS.cube = A(`<g class="m-bob"><path class="t" d="M12 3l9 4.5v9L12 21l-9-4.5v-9z"/>${s('M12 3l9 4.5v9L12 21l-9-4.5v-9z')}${s('M12 12l9-4.5M12 12v9M12 12L3 7.5')}<path class="f m-pulse" d="M12 4.6l6.2 3.1L12 10.8 5.8 7.7z"/></g>`);
  ICONS.camera = A(`<path class="t" d="M4 8h3l2-3h6l2 3h3v11H4z"/>${s('M4 8h3l2-3h6l2 3h3v11H4z')}<circle class="s" cx="12" cy="13" r="3.6"/><circle class="f m-pulse" cx="12" cy="13" r="1.9"/><circle class="f2 m-blink" cx="17.6" cy="10.4" r="1"/>`);
  ICONS.store = A(`<path class="t" d="M3 9h18v11H3z"/>${s('M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18')}<g class="m-swing" style="transform-origin:50% 0">${s('M9 20v-6h6v6')}</g><circle class="f m-pulse" cx="7" cy="12" r="1.1"/><circle class="f2 m-pulse" cx="17" cy="12" r="1.1"/>`);

  // مطابقة أيقونات الموقع الثابتة بأيقونات المنصة
  const MAP = [
    [/width="18" height="18" rx="5"/, 'insta'], [/M3 11v2a2 2 0 0 0 2 2h2l6 4V5/, 'mega'], [/M12 3l9 4\.5v9L12 21/, 'cube'],
    [/M4 8h3l2-3h6l2 3h3v11H4z/, 'camera'], [/rect x="3" y="5" width="18" height="16"/, 'cal'], [/M4 20V10M10 20V4/, 'chart'],
    [/M3 9l1\.5-5h15L21 9/, 'store'], [/M12 21s7-6 7-12a7 7 0 0 0-14 0/, 'pin'], [/M6 9V3h12v6/, 'print'],
    [/M3 4h18l-7 8v6l-4 2v-8z/, 'funnel'], [/M12 3l9 5-9 5-9-5z/, 'layers'], [/M8 21h8M12 17v4/, 'gear'], [/M8 8l-4 4 4 4M16 8l4 4-4 4/, 'link'],
  ];
  function upgrade(root) {
    root.querySelectorAll('svg[viewBox="0 0 24 24"][stroke="currentColor"]:not(.ai)').forEach((svg) => {
      const html = svg.innerHTML; const hit = MAP.find(([re]) => re.test(html)); if (!hit || !ICONS[hit[1]]) return;
      const t = document.createElement('template'); t.innerHTML = ICONS[hit[1]].trim(); const n = t.content.firstChild;
      n.setAttribute('class', 'ai'); svg.replaceWith(n);
      const tile = n.parentElement; if (tile && tile.classList.contains('ic')) tile.classList.add('ico3');
    });
  }
  // تموّج الأزرار مثل المنصة
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.btn,.svt,.svc,.cta,.wk'); if (!b) return;
    const r = b.getBoundingClientRect(); const d = Math.max(r.width, r.height);
    const w = document.createElement('span'); w.className = 'rip3';
    w.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.style.overflow = b.style.overflow || 'hidden'; b.appendChild(w); setTimeout(() => w.remove(), 650);
  }, { passive: true });
  // ---------- الأسهم المجسّمة ثلاثية الأبعاد (الشكل الخاص بالتسويق) ----------
  const C3 = ['#18566D', '#D06429', '#338C89', '#DB9C47'];
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); return `rgb(${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f)).join(',')})`; };
  function chev3d(color, size) {
    const depth = Math.max(10, Math.round(size / 5)); const gap = Math.max(0.9, size / 60);
    let h = '';
    for (let i = 0; i < depth; i++) {
      const f = 0.38 + 0.5 * (i / (depth - 1));
      h += `<svg viewBox="0 0 100 64" style="transform:translateZ(${((i - depth + 1) * gap).toFixed(1)}px)"><polyline points="12,52 50,14 88,52" fill="none" stroke="${i === depth - 1 ? color : shade(color, f)}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    return `<div class="c3d" style="--w:${size}px">${h}</div>`;
  }
  const col3d = (size, colors = C3, cls = '') => `<div class="c3d-col ${cls}" aria-hidden="true"><div class="c3d-rig">${colors.map((c, i) => `<div class="c3d-item" style="--i:${i}">${chev3d(c, size)}</div>`).join('')}</div></div>`;
  window.nubl3d = { chev3d, col3d };
  function tilt(el) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || el.dataset.tilt) return; el.dataset.tilt = 1;
    const rig = el.querySelector('.c3d-rig');
    addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
      rig.style.setProperty('--ry', (((e.clientX - (r.left + r.width / 2)) / innerWidth) * 60).toFixed(1) + 'deg');
      rig.style.setProperty('--rx', ((-(e.clientY - (r.top + r.height / 2)) / innerHeight) * 36).toFixed(1) + 'deg'); }, { passive: true });
  }
  function make3d(root) {
    root.querySelectorAll('svg.chev3').forEach((svg) => {
      const slot = svg.closest('.slot'); const w = slot ? slot.getBoundingClientRect().width : 200;
      const size = Math.max(54, Math.min(170, Math.round((w || 300) * 0.34)));
      const onDark = !!svg.closest('.dark,.terra,.hero,.s-end,.sec-navy,.slide');
      const t = document.createElement('template'); t.innerHTML = col3d(size, onDark ? ['#D06429', '#338C89', '#DB9C47', '#FFFFFF'] : C3, 'in-slot');
      const el = t.content.firstChild; svg.replaceWith(el); tilt(el);
    });
    // زاوية صغيرة تظهر في ركن البطاقات عند المرور
    root.querySelectorAll('.svt,.svc,.card,.tc,.wk,.pc,.glass').forEach((c) => {
      if (c.querySelector(':scope > .cv-corner')) return;
      if (getComputedStyle(c).position === 'static') c.style.position = 'relative';
      c.insertAdjacentHTML('beforeend', '<i class="cv-corner" aria-hidden="true"></i>');
    });
  }
  // ستارة الانتقال بين الصفحات: أسهم مجسّمة تمرّ عبر الشاشة
  function curtain() {
    const cu = document.getElementById('curtain'); if (!cu || cu.querySelector('.csweep')) return;
    cu.insertAdjacentHTML('beforeend', `<div class="csweep" aria-hidden="true">${C3.map((c, i) => `<div class="sw" style="--i:${i}">${chev3d(i === 0 ? '#FFFFFF' : c, Math.round(Math.min(innerWidth, 900) * 0.26))}</div>`).join('')}</div>`);
  }
  const go = () => { upgrade(document); make3d(document); curtain(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  // بعد كل تنقّل داخلي (يستبدل الموقع محتوى #main دون إعادة تحميل)
  let pend = false;
  new MutationObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; upgrade(document); make3d(document); }); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();
