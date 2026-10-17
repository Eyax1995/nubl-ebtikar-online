/* نُبل وابتكار للتسويق — بطاقات زجاجية تفاعلية، مؤشر الهوية، أزرار مغناطيسية، وحركة مرتبطة بالتمرير */
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const CARDS = '.card,.svc,.svt,.tc,.wk,.step,.pc,.glass,.gbox,.stat,.tile';
  const ORB_C = ['#8CAAB6', '#E8B294', '#99C6C4', '#EDCEA3'];
  root.classList.add('gx-on');

  // ---------- أدوات ----------
  const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g); if (!m) return 1; const [r, g, b, a = 1] = m.map(Number); if (a < 0.35) return null; return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  function isDark(el) { for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const v = lum(getComputedStyle(n).backgroundColor); if (v !== null) return v < 0.45; if (n.matches && n.matches('.dark,.terra,.hero,.s-end,.sec-navy')) return true; } return false; }

  // ---------- البطاقات ----------
  function glass(card) {
    if (card._gx) return; card._gx = 1;
    card.classList.add('gx'); card.classList.remove('tilt');
    const host = card.parentElement && card.parentElement.parentElement;
    const dark = isDark(card.parentElement || card);
    card.classList.toggle('gx-dark', dark);
    const clip = document.createElement('span'); clip.className = 'gx-clip'; clip.setAttribute('aria-hidden', 'true');
    const gl = document.createElement('span'); gl.className = 'gx-glare'; gl.setAttribute('aria-hidden', 'true');
    card.prepend(gl); card.prepend(clip);
    if (!dark && host) orbs(card.closest('section') || host);
    if (reduce) return;
    let raf = 0, rx = 0, ry = 0;
    const apply = () => { raf = 0; card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px) scale(1.015)`; };
    if (fine) {
      card.addEventListener('pointerenter', () => { card.style.transitionDelay = '0s'; if (!card.matches('.rv:not(.in)')) card.classList.add('gx-hot', 'gx-move'); root.classList.add('gx-card'); });
      card.addEventListener('pointermove', (e) => {
        if (card.matches('.rv:not(.in)')) return;
        const r = card.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        const k = Math.min(1, 380 / Math.max(r.width, r.height)) * 12;
        ry = +((x - 0.5) * k).toFixed(2); rx = +(-(y - 0.5) * k).toFixed(2);
        card.classList.add('gx-hot', 'gx-move'); if (!raf) raf = requestAnimationFrame(apply);
      });
      card.addEventListener('pointerleave', () => { card.classList.remove('gx-hot', 'gx-move'); root.classList.remove('gx-card'); card.style.transform = ''; });
    }
    card.addEventListener('pointerdown', (e) => {
      const r = card.getBoundingClientRect(); const w = document.createElement('i'); w.className = 'gx-wave';
      w.style.left = e.clientX - r.left + 'px'; w.style.top = e.clientY - r.top + 'px';
      clip.appendChild(w); setTimeout(() => w.remove(), 800);
      card.classList.add('gx-press');
    });
    const up = () => card.classList.remove('gx-press');
    card.addEventListener('pointerup', up); card.addEventListener('pointercancel', up); card.addEventListener('pointerleave', up);
  }
  function orbs(sec) {
    if (!sec || sec._gxo || sec.matches('.hero,header,footer,.hdr')) return; sec._gxo = 1;
    if (getComputedStyle(sec).position === 'static') sec.classList.add('gx-host'); else sec.style.isolation = 'isolate';
    const o = document.createElement('div'); o.className = 'gx-orbs'; o.setAttribute('aria-hidden', 'true');
    const n = Math.random() * 4 | 0;
    o.innerHTML = [0, 1, 2].map((i) => `<i class="gx-par" data-pf="${(i - 1) * 0.35 + 0.2}" style="--c:${ORB_C[(n + i) % 4]};--x:${[-8, 62, 28][i]}%;--y:${[8, 30, 62][i]}%;--s:${[34, 28, 30][i]}vw;--d:${-i * 5}s"></i>`).join('');
    sec.prepend(o);
  }

  // ---------- عناوين الأقسام: خط متدرّج يُرسم عند الظهور ----------
  function ulines(rootEl) {
    rootEl.querySelectorAll('.sec-head h2,.sec-head .h2').forEach((h) => {
      if (h._gxu) return; h._gxu = 1; const u = document.createElement('span'); u.className = 'gx-uline'; u.setAttribute('aria-hidden', 'true');
      if (getComputedStyle(h).textAlign === 'center') u.style.marginInline = 'auto';
      h.after(u); if (!h.closest('.rv')) u.classList.add('in');
    });
  }

  // ---------- المؤشر وأزرار المغناطيس ----------
  let cur, dot, cx = -100, cy = -100, tx = -100, ty = -100;
  // مؤشر الزاوية (^) فقط — يتبع الماوس، يميل مع الحركة، يتلوّن حسب خلفية القسم، ويتفاعل مع الروابط والبطاقات والضغط
  if (fine && !reduce) {
    const ch = document.createElement('div'); ch.className = 'gx-chev'; ch.setAttribute('aria-hidden', 'true');
    ch.innerHTML = '<svg viewBox="0 0 28 28"><polyline points="5,21 14,7 23,21"/></svg>';
    let px = -100, py = -100, x = -100, y = -100, vx = 0, ang = -40, last = 0, on = false;
    const mount = () => { if (!ch.isConnected) document.body.appendChild(ch); };
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return; mount();
      px = e.clientX; py = e.clientY; if (!on) { x = px; y = py; on = true; root.classList.add('gx-chevon'); }
      const now = performance.now(); if (now - last < 90) return; last = now;
      const t = e.target; const typing = !!(t.closest && t.closest('input,textarea,select,[contenteditable]'));
      root.classList.toggle('gx-typing', typing);
      root.classList.toggle('gx-link', !!(t.closest && t.closest('a,button,[role=button],label,summary,.tab,.btn,[data-tool]')) && !(t.closest && t.closest(CARDS)));
      root.classList.toggle('gx-card', !!(t.closest && t.closest(CARDS)));
      root.classList.toggle('gx-ondark', isDark(t));
    }, { passive: true });
    document.addEventListener('pointerleave', () => { on = false; root.classList.remove('gx-chevon'); });
    addEventListener('pointerdown', () => root.classList.add('gx-down')); addEventListener('pointerup', () => root.classList.remove('gx-down'));
    (function loop() {
      requestAnimationFrame(loop); if (!on) return;
      const dx = px - x; x += dx * 0.45; y += (py - y) * 0.45; vx += (dx - vx) * 0.2;
      const target = -40 + Math.max(-28, Math.min(28, vx * 1.6)); ang += (target - ang) * 0.2;
      ch.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${ang.toFixed(1)}deg)`;
    })();
  }
  function magnets(rootEl) {
    if (!fine || reduce) return;
    rootEl.querySelectorAll('.btn,.wa-float').forEach((b) => {
      if (b._gxm) return; b._gxm = 1; b.classList.add('gx-mag');
      b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); b.classList.add('gx-pull'); b.style.translate = `${(dx * 0.22).toFixed(1)}px ${(dy * 0.32).toFixed(1)}px`; });
      b.addEventListener('pointerleave', () => { b.classList.remove('gx-pull'); b.style.translate = ''; });
    });
  }

  // ---------- إضاءة تتبع المؤشر في الأقسام الداكنة ----------
  function spots(rootEl) {
    if (!fine || reduce) return;
    rootEl.querySelectorAll('.hero,.slide.dark,.slide.terra,.sec-navy,.s-end').forEach((s) => {
      if (s._gxs) return; s._gxs = 1; if (getComputedStyle(s).position === 'static') s.style.position = 'relative';
      const sp = document.createElement('div'); sp.className = 'gx-spot'; sp.setAttribute('aria-hidden', 'true'); s.prepend(sp);
      s.addEventListener('pointermove', (e) => { const r = s.getBoundingClientRect(); sp.style.setProperty('--hx', e.clientX - r.left + 'px'); sp.style.setProperty('--hy', e.clientY - r.top + 'px'); sp.classList.add('on'); }, { passive: true });
      s.addEventListener('pointerleave', () => sp.classList.remove('on'));
    });
  }

  // ---------- حركة مرتبطة بالتمرير: عمق (parallax) + ارتداد حسب سرعة التمرير ----------
  function parallax(rootEl) {
    rootEl.querySelectorAll('.hero .pattern,.slide-bg').forEach((el) => { if (!el.dataset.pf) { el.dataset.pf = '0.18'; el.classList.add('gx-par'); } });
    rootEl.querySelectorAll('.sec-head').forEach((el) => { if (!el.dataset.pf) { el.dataset.pf = '-0.06'; el.classList.add('gx-par'); } });
    rootEl.querySelectorAll('.wk .img img').forEach((el) => { if (!el.dataset.pf) { el.dataset.pf = '0.08'; el.dataset.sc = '1'; el.classList.add('gx-par'); } });
  }
  let lastY = scrollY, vel = 0;
  function frame() {
    requestAnimationFrame(frame);
    if (cur) { cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2; cur.style.transform = `translate3d(${cx}px,${cy}px,0)`; dot.style.transform = `translate3d(${tx}px,${ty}px,0)`; }
    if (reduce) return;
    const y = scrollY; vel += ((y - lastY) - vel) * 0.18; lastY = y;
    const H = innerHeight;
    document.querySelectorAll('.gx-par').forEach((el) => {
      const r = el.getBoundingClientRect(); if (r.bottom < -200 || r.top > H + 200) return;
      const p = (r.top + r.height / 2 - H / 2) / H; const f = parseFloat(el.dataset.pf) || 0;
      el.style.translate = `0 ${(-p * f * H).toFixed(1)}px`;
      if (el.dataset.sc) el.style.scale = (1.12 - Math.abs(p) * 0.08).toFixed(3);
    });
    const v = Math.max(-1, Math.min(1, vel / 40));
    if (Math.abs(v) > 0.01 || root._gxv) {
      root._gxv = Math.abs(v) > 0.01;
      document.querySelectorAll('.gx').forEach((c, i) => { if (c.classList.contains('gx-hot')) return; c.style.translate = Math.abs(v) > 0.01 ? `0 ${(-v * (6 + (i % 3) * 5)).toFixed(1)}px` : ''; });
    }
  }


  // ---------- نافذة الأدوات: تعمل الأداة داخل الصفحة دون مغادرتها ----------
  let tm;
  function openTool(url, title) {
    if (!tm) {
      tm = document.createElement('div'); tm.className = 'tm'; tm.setAttribute('role', 'dialog'); tm.setAttribute('aria-modal', 'true');
      tm.innerHTML = '<div class="tm-box"><div class="tm-bar"><span class="tm-t"></span><a class="tm-full" target="_top">فتح في صفحة مستقلة</a><button type="button" aria-label="إغلاق">×</button></div><div class="tm-body"><div class="tm-load">جارٍ تحميل الأداة…</div><iframe title="أداة"></iframe></div></div>';
      document.body.appendChild(tm);
      const close = () => { tm.classList.remove('open'); root.classList.remove('tm-lock'); setTimeout(() => { if (!tm.classList.contains('open')) tm.querySelector('iframe').src = 'about:blank'; }, 400); };
      tm.querySelector('button').addEventListener('click', close);
      tm.addEventListener('click', (e) => { if (e.target === tm) close(); });
      addEventListener('keydown', (e) => { if (e.key === 'Escape' && tm.classList.contains('open')) close(); });
      tm.querySelector('iframe').addEventListener('load', () => { tm.querySelector('.tm-load').style.display = 'none'; });
    }
    tm.querySelector('.tm-t').textContent = title || '';
    tm.querySelector('.tm-full').href = url;
    tm.querySelector('.tm-load').style.display = '';
    tm.querySelector('iframe').src = url + (url.indexOf('?') > -1 ? '&' : '?') + 'embed=1';
    root.classList.add('tm-lock'); requestAnimationFrame(() => tm.classList.add('open'));
    tm.querySelector('button').focus({ preventScroll: true });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-tool]'); if (!b) return;
    e.preventDefault(); openTool(b.dataset.tool, b.dataset.title);
  });

  function run(rootEl) { rootEl.querySelectorAll('.note').forEach((n) => n.classList.toggle('note-dark', isDark(n))); rootEl.querySelectorAll(CARDS).forEach(glass); ulines(rootEl); magnets(rootEl); spots(rootEl); parallax(rootEl); }
  function boot() {
    if (cur) { document.body.append(cur, dot); }
    run(document); requestAnimationFrame(frame);
    let pend = false;
    new MutationObserver(() => { if (pend) return; pend = true; setTimeout(() => { pend = false; run(document); }, 80); })
      .observe(document.getElementById('main') || document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
