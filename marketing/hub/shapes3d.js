/* =====================================================================
   أشكال ثلاثية الأبعاد بعنصر الهوية (السهم ^) — بلا مكتبات ولا WebGL
   كل سهم مجسّم من طبقات SVG متراصّة في فضاء CSS ثلاثي الأبعاد (preserve-3d) فيظهر بعمق حقيقي،
   يتمايل ويطفو، ويميل مع حركة المؤشر. ألوان الهوية بالترتيب: كحلي، برتقالي، تركوازي، ذهبي.
   المواضع: شاشة الدخول · مؤشر التحميل · انتظار ذكاء نُبل · الحالات الفارغة.
   يُحمَّل بعد ui.js، ويحترم prefers-reduced-motion.
   ===================================================================== */
(function () {
  const COLORS = ['#18566D', '#D06429', '#338C89', '#DB9C47'];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f)); return `rgb(${c.join(',')})`; };

  // سهم مجسّم واحد: depth طبقة، الأمامية بلون الهوية والخلفية أغمق تدريجياً
  function chevron(color, { size = 64, depth, gap, stroke = 13 } = {}) {
    depth = Math.max(10, Math.round(size / 5)); gap = gap || Math.max(0.9, size / 60);
    const layers = Array.from({ length: depth }, (_, i) => {
      const f = 0.38 + 0.5 * (i / (depth - 1));
      return `<svg viewBox="0 0 100 64" style="transform:translateZ(${((i - depth + 1) * gap).toFixed(1)}px)"><polyline points="12,52 50,14 88,52" fill="none" stroke="${i === depth - 1 ? color : shade(color, f)}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }).join('');
    return `<div class="c3d" style="--w:${size}px">${layers}</div>`;
  }
  // عمود من الأسهم المجسّمة (الشكل الأساسي للهوية)
  function column({ size = 64, colors = COLORS, depth = 12, cls = '' } = {}) {
    return `<div class="c3d-col ${cls}" aria-hidden="true"><div class="c3d-rig">${colors.map((c, i) => `<div class="c3d-item" style="--i:${i}">${chevron(c, { size, depth })}</div>`).join('')}</div></div>`;
  }
  // مؤشر تحميل: سهم مجسّم يدور
  const loader = (size = 34) => `<div class="c3d-load" aria-hidden="true"><div class="c3d-spin">${chevron(COLORS[1], { size, depth: 10 })}</div></div>`;
  window.nubl3d = { chevron, column, loader };

  // ميلان مع حركة المؤشر
  function tilt(el) {
    if (reduce || !el || el.dataset.tilt) return; el.dataset.tilt = 1;
    const rig = el.querySelector('.c3d-rig'); if (!rig) return;
    const host = el.closest('.login') || document;
    host.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect(); const x = (e.clientX - (r.left + r.width / 2)) / innerWidth; const y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      rig.style.setProperty('--ry', (x * 50).toFixed(1) + 'deg'); rig.style.setProperty('--rx', (-y * 30).toFixed(1) + 'deg');
    }, { passive: true });
  }

  document.head.insertAdjacentHTML('beforeend', `<style id="c3d-css">
  .c3d{position:relative;width:var(--w);height:calc(var(--w) * .64);transform-style:preserve-3d}
  .c3d svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;backface-visibility:visible}
  .c3d-col{perspective:700px;display:inline-block;pointer-events:none}
  .c3d-rig{transform-style:preserve-3d;transform:rotateX(var(--rx,-18deg)) rotateY(var(--ry,-34deg));transition:transform .6s cubic-bezier(.2,.8,.2,1);display:flex;flex-direction:column;align-items:center}
  .c3d-item{transform-style:preserve-3d;margin-top:calc(var(--i) * -2px);animation:c3d-float 5s ease-in-out infinite;animation-delay:calc(var(--i) * -.6s)}
  .c3d-item .c3d{animation:c3d-sway 7s ease-in-out infinite;animation-delay:calc(var(--i) * -.9s)}
  @keyframes c3d-float{0%,100%{transform:translateY(0) translateZ(0)}50%{transform:translateY(-8px) translateZ(14px)}}
  @keyframes c3d-sway{0%,100%{transform:rotateY(-14deg) rotateX(6deg)}50%{transform:rotateY(18deg) rotateX(-6deg)}}
  .c3d-load{perspective:400px;display:inline-block;margin-bottom:6px}.c3d-spin{transform-style:preserve-3d;animation:c3d-turn 2.4s cubic-bezier(.45,.05,.55,.95) infinite}
  @keyframes c3d-turn{0%{transform:rotateX(-12deg) rotateY(0)}50%{transform:rotateX(-12deg) rotateY(180deg) translateY(-4px)}100%{transform:rotateX(-12deg) rotateY(360deg)}}
  .login{position:relative;overflow:hidden}
  .login .c3d-col{position:absolute;z-index:0}
  .login .c3d-col.l1{inset-inline-start:7%;top:50%;transform:translateY(-50%)}
  .login .c3d-col.l2{inset-inline-end:6%;bottom:8%;opacity:.55}
  .login .login-card{position:relative;z-index:1}
  .c3d-side{display:flex;justify-content:center;padding:18px 0 10px;margin-top:auto;opacity:.9}
  .empty.e3d{display:flex;flex-direction:column;align-items:center;gap:6px}
  .st-busy .c3d-col{margin:4px auto 8px;display:block;width:max-content}
  @media (max-width:860px){.login .c3d-col.l1{inset-inline-start:50%;top:5%;transform:translateX(50%) scale(.55);transform-origin:top center}.login .c3d-col.l2{display:none}}
  @media (prefers-reduced-motion:reduce){.c3d-item,.c3d-item .c3d,.c3d-spin{animation:none!important}}
  </style>`);

  // شاشة الدخول
  function decorateLogin() {
    const l = document.querySelector('.login'); if (!l || l.querySelector('.c3d-col')) return;
    l.insertAdjacentHTML('afterbegin', column({ size: 120, cls: 'l1', colors: [COLORS[1], COLORS[2], COLORS[3], '#FFFFFF'] }) + column({ size: 64, colors: [COLORS[3], COLORS[2]], cls: 'l2' }));
    tilt(l.querySelector('.c3d-col.l1'));
  }
  const baseLogin = renderLogin;
  renderLogin = function () { baseLogin.apply(this, arguments); decorateLogin(); };
  decorateLogin();

  // الشريط الجانبي: عمود أسهم مجسّم صغير أسفل القائمة (ألوان مناسبة للخلفية الداكنة)
  function decorateSide() {
    const side = document.querySelector('.side'); if (!side || side.querySelector('.c3d-side')) return;
    side.insertAdjacentHTML('beforeend', `<div class="c3d-side">${column({ size: 38, depth: 9, colors: [COLORS[1], COLORS[2], COLORS[3], '#FFFFFF'] })}</div>`);
  }
  const baseShell = renderShell;
  renderShell = function () { baseShell.apply(this, arguments); decorateSide(); };
  decorateSide();

  // التحميل والحالات الفارغة وانتظار الذكاء
  function decorate(root) {
    root.querySelectorAll('.empty:not([data-c3d])').forEach((e) => {
      e.dataset.c3d = 1;
      if (/^\s*جار/.test(e.textContent)) { e.classList.add('e3d'); e.insertAdjacentHTML('afterbegin', loader()); }
    });
    root.querySelectorAll('.st-orb:not([data-c3d])').forEach((o) => { o.dataset.c3d = 1; o.outerHTML = column({ size: 46, depth: 10 }); });
  }
  new MutationObserver(() => decorate(document.body)).observe(document.body, { childList: true, subtree: true });
  decorate(document.body);
})();
