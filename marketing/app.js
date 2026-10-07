/* نُبل وابتكار للتسويق — سلوك الموقع: تنقّل سلس بالنجمة، شرائح، سلايدرات، أدوات */
(function () {
  var NB = (window.NB = window.NB || {});
  var BASE = '/marketing/';
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var num = function (x) { return Number(x).toLocaleString('en-US'); };

  /* ---------- عناصر دائمة (تُربط مرة واحدة) ---------- */
  var burger = $('.burger'), mnav = $('.mnav');
  if (burger && mnav) burger.addEventListener('click', function () { mnav.classList.toggle('open'); burger.setAttribute('aria-expanded', mnav.classList.contains('open')); });

  var lb = $('.lightbox');
  if (lb) {
    var lbimg = $('img', lb);
    lb.addEventListener('click', function (ev) { if (ev.target === lb || ev.target.tagName === 'BUTTON') { lb.classList.remove('open'); lbimg.src = ''; } });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') lb.classList.remove('open'); });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-lb]');
    if (a && lb) { e.preventDefault(); lbimg.src = a.getAttribute('href'); lb.classList.add('open'); }
    if (e.target.closest('#restart') && NB.quizRestart) NB.quizRestart();
  });

  /* شريط تقدّم الصفحة + زر النجمة في الزاوية + شريط التحويل */
  var bar = $('#pbar'), cbar = $('#cbar'), dockEl = $('#dock');
  function onScroll() {
    var h = document.documentElement.scrollHeight - innerHeight;
    var p = h > 0 ? Math.min(1, scrollY / h) : 0;
    if (bar) bar.style.transform = 'scaleX(' + p + ')';
    if (dockEl) dockEl.style.setProperty('--p', p);
    if (cbar) cbar.classList.toggle('show', scrollY > innerHeight * .9);
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if (dockEl) dockEl.addEventListener('click', function () { if (NB.pulse) NB.pulse(12); window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });
  var cclose = $('#cbar .x'); if (cclose) cclose.addEventListener('click', function () { cbar.classList.add('dismissed'); });

  /* ---------- التنقّل بين الصفحات: ستارة + طيران النجمة ---------- */
  var curtain = $('#curtain'), busy = false;
  function sameSite(a) {
    if (!a || a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-lb')) return false;
    var u; try { u = new URL(a.href, location.href); } catch (e) { return false; }
    if (u.origin !== location.origin || u.pathname.indexOf(BASE) !== 0) return false;
    if (/\.(jpg|jpeg|png|svg|glb|pdf|json|xml|txt)$/i.test(u.pathname)) return false;
    return true;
  }
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  function go(url, push) {
    if (busy) return; busy = true;
    var u = new URL(url, location.href);
    var samePage = u.pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '');
    if (samePage && u.hash) { busy = false; var t = document.getElementById(u.hash.slice(1)); if (t) t.scrollIntoView({ behavior: 'smooth' }); if (push) history.pushState({}, '', u.href); return; }
    var fetchP = fetch(u.pathname + u.search, { headers: { 'X-NB': '1' } }).then(function (r) { if (!r.ok) throw 0; return r.text(); });
    if (mnav) mnav.classList.remove('open');
    root.classList.add('leaving'); NB.flying = true; if (NB.pulse) NB.pulse(16);
    Promise.all([fetchP, wait(reduce ? 0 : 650)]).then(function (res) {
      var doc = new DOMParser().parseFromString(res[0], 'text/html');
      var nm = doc.getElementById('main'); if (!nm) throw 0;
      swap(doc, nm, u, push);
      return wait(reduce ? 0 : 120);
    }).then(function () {
      root.classList.remove('leaving'); root.classList.add('entering');
      return wait(reduce ? 0 : 750);
    }).then(function () { root.classList.remove('entering'); NB.flying = false; busy = false; })
      .catch(function () { location.href = u.href; });
  }

  function swap(doc, nm, u, push) {
    document.title = doc.title;
    ['description'].forEach(function (n) { var a = $('meta[name=' + n + ']'), b = doc.querySelector('meta[name=' + n + ']'); if (a && b) a.content = b.content; });
    var can = $('link[rel=canonical]'), can2 = doc.querySelector('link[rel=canonical]'); if (can && can2) can.href = can2.href;
    document.body.setAttribute('data-page', doc.body.getAttribute('data-page') || '');
    var main = $('#main'); main.innerHTML = nm.innerHTML;
    // قوائم التنقّل (الرابط النشط)
    ['.hdr ul', '.mnav'].forEach(function (sel) { var a = $(sel), b = doc.querySelector(sel); if (a && b) a.innerHTML = b.innerHTML; });
    // الذيل (footer) والشريط
    var f = $('footer'), f2 = doc.querySelector('footer'); if (f && f2) f.innerHTML = f2.innerHTML;
    // JSON-LD الخاص بالصفحة
    $$('script[data-pg-ld]').forEach(function (s) { s.remove(); });
    // تشغيل السكربتات المضمّنة داخل الصفحة (بيانات الباقات والأدوات)
    $$('script', main).forEach(function (old) {
      if (old.type && old.type.indexOf('json') > -1) return;
      var s = document.createElement('script'); s.text = old.textContent; old.parentNode.replaceChild(s, old);
    });
    if (push) history.pushState({}, '', u.href);
    window.scrollTo(0, 0);
    if (u.hash) setTimeout(function () { var t = document.getElementById(u.hash.slice(1)); if (t) t.scrollIntoView(); }, 50);
    init();
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest('a[href]');
    if (a && sameSite(a)) { e.preventDefault(); go(a.href, true); }
  });
  addEventListener('popstate', function () { go(location.href, false); });

  /* ---------- تهيئة الصفحة (تُستدعى عند كل تحميل/تنقّل) ---------- */
  var ios = [];
  function init() {
    ios.forEach(function (o) { o.disconnect(); }); ios = [];
    var hasSlides = $$('.slide').length > 0;
    root.classList.toggle('has-slides', hasSlides);
    root.dataset.page = document.body.getAttribute('data-page') || '';

    // كشف العناصر عند الظهور
    var els = $$('.rv');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .08, rootMargin: '0px 0px -40px 0px' });
      els.forEach(function (el, i) { el.style.transitionDelay = (Math.min(i % 4, 3) * 70) + 'ms'; io.observe(el); }); ios.push(io);
    } else els.forEach(function (el) { el.classList.add('in'); });

    initSlides(); initPackages(); initFilters(); initForm(); initQuiz(); initCarousels(); initCounters(); initTilt();
    onScroll();
  }

  /* ---------- الشرائح (Slides) ---------- */
  function initSlides() {
    var slides = $$('.slide'), rail = $('#rail');
    if (rail) rail.innerHTML = '';
    if (!slides.length) { if (rail) rail.hidden = true; return; }
    if (rail) {
      rail.hidden = false;
      slides.forEach(function (s, i) {
        var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', s.dataset.label || ('شريحة ' + (i + 1)));
        b.innerHTML = '<i></i><span>' + (s.dataset.label || '') + '</span>';
        b.addEventListener('click', function () { s.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); if (NB.pulse) NB.pulse(8); });
        rail.appendChild(b);
      });
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio > .5) {
          slides.forEach(function (s) { s.classList.remove('on'); }); e.target.classList.add('on'); e.target.classList.add('seen');
          var i = slides.indexOf(e.target); if (rail) $$('button', rail).forEach(function (b, k) { b.classList.toggle('on', k === i); });
          root.dataset.slide = i; root.classList.toggle('slide-dark', e.target.classList.contains('dark'));
        }
      });
    }, { threshold: [.5, .6] });
    slides.forEach(function (s) { io.observe(s); }); ios.push(io);
    // إتاحة التنقل بالأسهم/المسافة بين الشرائح
    NB.slideNext = function (d) { var i = +root.dataset.slide || 0; var n = slides[Math.max(0, Math.min(slides.length - 1, i + d))]; n.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); };
    $$('.slide-next').forEach(function (b) { b.onclick = function () { NB.slideNext(1); }; });
  }
  document.addEventListener('keydown', function (e) {
    if (!root.classList.contains('has-slides') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { /* التمرير الأصلي مع snap */ }
  });

  /* ---------- سلايدر عام: scroll-snap + أسهم + سحب ---------- */
  function initCarousels() {
    $$('.car').forEach(function (car) {
      if (car._on) return; car._on = true;
      var tr = $('.car-track', car), prev = $('.car-prev', car), next = $('.car-next', car), dots = $('.car-dots', car);
      if (!tr) return;
      function step() { var c = tr.firstElementChild; return c ? c.getBoundingClientRect().width + (parseFloat(getComputedStyle(tr).columnGap) || 16) : 300; }
      function go2(d) { tr.scrollBy({ left: -d * step(), behavior: reduce ? 'auto' : 'smooth' }); if (NB.pulse) NB.pulse(4); }
      if (prev) prev.onclick = function () { go2(-1); }; if (next) next.onclick = function () { go2(1); };
      // سحب بالماوس
      var down = false, sx = 0, sl = 0, moved = 0;
      tr.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; moved = 0; sx = e.clientX; sl = tr.scrollLeft; tr.classList.add('drag'); });
      addEventListener('pointermove', function (e) { if (!down) return; var dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); tr.scrollLeft = sl - dx; });
      addEventListener('pointerup', function () { if (down) { down = false; tr.classList.remove('drag'); } });
      tr.addEventListener('click', function (e) { if (moved > 6) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
      function upd() {
        var max = tr.scrollWidth - tr.clientWidth, pos = Math.abs(tr.scrollLeft);
        if (prev) prev.disabled = pos < 4; if (next) next.disabled = pos > max - 4;
        if (dots) { var n = tr.children.length, i = Math.round(pos / Math.max(1, max) * (n - 1)); $$('i', dots).forEach(function (d, k) { d.classList.toggle('on', k === i); }); }
      }
      if (dots) { dots.innerHTML = Array.prototype.map.call(tr.children, function () { return '<i></i>'; }).join(''); }
      tr.addEventListener('scroll', upd, { passive: true }); upd(); setTimeout(upd, 300);
    });
  }

  /* ---------- الباقات: تبويب القطاع + سلايدر المدد ---------- */
  function initPackages() {
    var tabs = $('#sector-tabs'); if (!tabs || !window.SECTORS) return;
    var S = window.SECTORS, T = window.TERMS, compact = tabs.hasAttribute('data-compact');
    function feat(r, months) {
      var L = [];
      L.push('<b class="num">' + r[2] + '</b> منشوراً شهرياً');
      L.push('<b class="num">' + r[3] + '</b> تصميماً شهرياً');
      L.push('<b class="num">' + r[4] + '</b> منصات مُدارة');
      L.push('إدارة إعلانات حتى <b class="num">' + num(r[5]) + '</b> ر.س شهرياً');
      if (!compact) {
        L.push('مطبوعات وإنتاج بقيمة <b class="num">' + num(r[6]) + '</b> ر.س ' + (months > 1 ? 'خلال العقد' : 'في الشهر'));
        L.push(months >= 6 ? 'تقرير شهري + مراجعة استراتيجية' : 'تقرير شهري بمؤشرات أداء');
      } else L.push('إنتاج ومطبوعات بقيمة <b class="num">' + num(r[6]) + '</b> ر.س');
      return L.map(function (x) { return '<li><i class="star"></i><span>' + x + '</span></li>'; }).join('');
    }
    function render(i) {
      var s = S[i], body = $('#sector-body');
      var cards = s.rows.map(function (r, ri) {
        var t = T[ri], disc = [0, 5, 10, 15][ri];
        return '<div class="pc' + (ri === 2 ? ' best' : '') + '">' + (ri === 2 ? '<span class="badge">الأفضل قيمة</span>' : '') +
          '<div class="nm">' + t[0] + '</div><div class="tg">' + t[3] + '</div>' +
          '<div class="pr num">' + num(r[0]) + '<small>ر.س / شهر</small></div>' +
          '<div class="tot">' + (t[1] === 1 ? 'شهر واحد · بلا التزام طويل' : 'إجمالي العقد <b class="num">' + num(r[1]) + '</b> ر.س · <span class="num">' + t[1] + '</span> أشهر') + (disc ? '<br><span class="disc">توفير ' + disc + '% عن السعر الشهري</span>' : '') + '</div>' +
          '<ul>' + feat(r, t[1]) + '</ul>' +
          (compact ? '' : '<div class="allow">قيمة إنتاج ومطبوعات مشمولة خلال العقد: <b class="num">' + num(r[6]) + ' ر.س</b></div><div class="pay">الدفع: ' + t[5] + '</div>') +
          '<a class="btn btn-p" href="https://wa.me/' + window.WA + '?text=' + encodeURIComponent('السلام عليكم، أرغب بالاستفسار عن باقة «' + t[0] + '» لقطاع ' + s.name + '.') + '" target="_blank" rel="noopener">' + (ri === 2 ? 'ابدأ بهذه الباقة' : 'اسأل عن هذه الباقة') + '</a></div>';
      }).join('');
      var slider = '<div class="car pk-car"><button class="car-btn car-prev" aria-label="السابق">›</button><div class="car-track cards">' + cards + '</div><button class="car-btn car-next" aria-label="التالي">‹</button><div class="car-dots"></div></div>';
      if (compact) { body.innerHTML = '<p class="pk-pain"><b>ألم القطاع:</b> ' + s.pain.replace(/<[^>]+>/g, '') + '</p>' + slider; }
      else {
        body.innerHTML = '<div class="painbox"><div class="pb a"><h4>الألم في هذا القطاع</h4>' + s.pain + '</div><div class="pb b"><h4>ما نغيّره</h4>' + s.win + '</div></div>' + slider +
          '<div class="incl"><h4>ما يميّز باقات هذا القطاع</h4><ul>' + s.special.map(function (x) { return '<li><i class="star"></i><span>' + x + '</span></li>'; }).join('') + '</ul><div class="kit"><b>حزمة المطبوعات المخصّصة:</b> ' + s.kit + '</div></div>';
      }
      initCarousels();
      // ابدأ السلايدر على الباقة الأفضل قيمة بصرياً (الثالثة) على الشاشات الصغيرة
      var tr = $('.pk-car .car-track'); if (tr && innerWidth < 900 && !reduce) { var c = tr.children[2]; if (c) setTimeout(function () { tr.scrollTo({ left: -(tr.scrollWidth - tr.clientWidth) * 0 + c.offsetLeft - (tr.clientWidth - c.offsetWidth) / 2 + 0, behavior: 'smooth' }); }, 400); }
    }
    tabs.innerHTML = S.map(function (s, i) { return '<button class="tab' + (i ? '' : ' on') + '" data-i="' + i + '">' + s.name + '</button>'; }).join('');
    tabs.onclick = function (e) { var t = e.target.closest('.tab'); if (!t) return; $$('.tab', tabs).forEach(function (x) { x.classList.remove('on'); }); t.classList.add('on'); render(+t.dataset.i); if (NB.pulse) NB.pulse(5); };
    var h = location.hash.replace('#', ''); var idx = compact ? 0 : Math.max(0, S.findIndex(function (s) { return s.id === h; }));
    $$('.tab', tabs).forEach(function (x, i) { x.classList.toggle('on', i === idx); });
    render(idx);
  }

  function initFilters() {
    var f = $('.filters'); if (!f) return;
    f.onclick = function (e) { var t = e.target.closest('.tab'); if (!t) return; $$('.tab', f).forEach(function (x) { x.classList.remove('on'); }); t.classList.add('on'); var k = t.dataset.f; $$('.wk').forEach(function (w) { w.style.display = (k === 'all' || w.dataset.cat === k) ? '' : 'none'; }); };
  }

  function initForm() {
    var form = $('#lead-form'); if (!form) return;
    form.onsubmit = function (e) {
      e.preventDefault(); var d = new FormData(form);
      var msg = 'السلام عليكم، أرغب بحجز جلسة تشخيص مجانية.\nالاسم: ' + d.get('name') + '\nالنشاط: ' + d.get('biz') + '\nالقطاع: ' + d.get('sector') + '\nالهدف الأهم: ' + d.get('goal') + (d.get('note') ? '\nملاحظة: ' + d.get('note') : '');
      window.open('https://wa.me/' + window.WA + '?text=' + encodeURIComponent(msg), '_blank');
    };
  }

  function initQuiz() {
    var quiz = $('#quiz'); if (!quiz || !window.QUIZ) return;
    var Q = window.QUIZ, i = 0, ans = [];
    var qEl = $('.q', quiz), oEl = $('.opts', quiz), bar2 = $('.prog .bar i', quiz), lab = $('.prog span', quiz), back = $('.back', quiz), next = $('.next', quiz), res = $('#result');
    function show() {
      var q = Q.questions[i]; qEl.textContent = q[0]; lab.textContent = 'الخطوة ' + (i + 1) + ' من ' + Q.questions.length; bar2.style.width = (i / Q.questions.length * 100) + '%';
      oEl.innerHTML = q[1].map(function (o, k) { return '<button type="button" class="opt' + (ans[i] === k ? ' on' : '') + '" data-k="' + k + '">' + o + '</button>'; }).join('');
      back.disabled = i === 0; next.textContent = i === Q.questions.length - 1 ? 'اعرض النتيجة' : 'التالي'; next.disabled = ans[i] === undefined;
    }
    oEl.onclick = function (e) { var b = e.target.closest('.opt'); if (!b) return; ans[i] = +b.dataset.k; $$('.opt', oEl).forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); next.disabled = false; if (NB.pulse) NB.pulse(4); };
    back.onclick = function () { if (i > 0) { i--; show(); } };
    next.onclick = function () {
      if (ans[i] === undefined) return;
      if (i < Q.questions.length - 1) { i++; show(); } else { quiz.style.display = 'none'; res.classList.add('show'); res.innerHTML = Q.result(ans); if (NB.pulse) NB.pulse(14); res.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    };
    NB.quizRestart = function () { i = 0; ans = []; res.classList.remove('show'); quiz.style.display = ''; show(); window.scrollTo({ top: quiz.getBoundingClientRect().top + scrollY - 120, behavior: 'smooth' }); };
    show();
  }

  /* عدّادات الأرقام */
  function initCounters() {
    var els = $$('[data-count]'); if (!els.length || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; io.unobserve(e.target);
        var el = e.target, to = +el.dataset.count, dec = +(el.dataset.dec || 0), t0 = performance.now(), d = 1400;
        if (reduce) { el.textContent = to.toLocaleString('en-US', { minimumFractionDigits: dec }); return; }
        (function tick(t) { var p = Math.min(1, (t - t0) / d), v = to * (1 - Math.pow(1 - p, 3)); el.textContent = v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); if (p < 1) requestAnimationFrame(tick); })(t0);
      });
    }, { threshold: .4 });
    els.forEach(function (el) { io.observe(el); }); ios.push(io);
  }

  /* إمالة ثلاثية الأبعاد خفيفة للبطاقات */
  function initTilt() {
    if (reduce || matchMedia('(hover:none)').matches) return;
    $$('.tilt').forEach(function (el) {
      if (el._t) return; el._t = 1;
      el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.transform = 'perspective(800px) rotateY(' + (x * 8) + 'deg) rotateX(' + (-y * 8) + 'deg) translateY(-4px)'; });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  init();
})();
