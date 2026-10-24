/* نافذة المحادثة لموقعَي «نُبل وابتكار للتسويق» و«مروج الحجاز» (24 أكتوبر 2026)
   التركيب: <script src="https://nubl-ebtikar.online/marketing/chat-widget.js" data-site="nubl|morooj" defer></script>
   الزائر يكتب هنا → المساعد الذكي يرد بمعرفة الخط → الفريق يتابع من صندوق واتساب في المنصة (خط «موقع التسويق/موقع مروج»).
   معزولة داخل Shadow DOM فلا تتأثر بتنسيقات القالب (مهم في متجر سلة). */
(function () {
  'use strict';
  var me = document.currentScript || document.querySelector('script[src*="chat-widget.js"]');
  if (!me || window.__nublChat) return; window.__nublChat = 1;
  var SITE = me.getAttribute('data-site') === 'morooj' ? 'morooj' : 'nubl';
  var BASE = (function () { try { return new URL(me.src).origin; } catch (e) { return 'https://nubl-ebtikar.online'; } })();
  var CFG = {
    nubl: { brand: 'نُبل وابتكار للتسويق', sub: 'فريق التسويق · نرد عادةً خلال دقائق', c1: '#18566D', c2: '#D06429', wa: '966563413040',
      hi: 'حياك الله 👋 أنا مساعد نُبل وابتكار للتسويق. اسألني عن الخدمات أو الباقات، أو احجز جلسة تشخيص مجانية.', teaser: 'عندك سؤال عن تسويق نشاطك؟' },
    morooj: { brand: 'مروج الحجاز', sub: 'خدمة العملاء · نرد عادةً خلال دقائق', c1: '#1F7C79', c2: '#E08A1E', wa: '966544004650',
      hi: 'حياك الله في مروج الحجاز 🌿 كيف نقدر نخدمك؟ اسألنا عن الطلبات أو التوزيع أو حالة طلبك.', teaser: 'تحتاج مساعدة في طلبك؟' },
  }[SITE];
  var side = me.getAttribute('data-side') === 'right' ? 'right' : 'left';
  var KEY = 'nubl_chat_' + SITE;
  var store = { get: function () { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
    set: function (v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* */ } } };
  var S = store.get() || {}; // {v, t, name, last, seen}
  var msgs = [], open = false, waiting = 0, timer = null, sending = false;

  var host = document.createElement('div'); host.setAttribute('data-nubl-chat', SITE);
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  var css = ':host{all:initial}*{box-sizing:border-box;font-family:Tajawal,"IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif}' +
    '.b{position:fixed;bottom:22px;' + side + ':22px;z-index:2147483000;width:58px;height:58px;border-radius:50%;border:0;cursor:pointer;background:' + CFG.c1 + ';color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.22);transition:transform .2s}' +
    '.b:hover{transform:scale(1.06)}.b svg{width:28px;height:28px}.b .n{position:absolute;top:-2px;' + (side === 'left' ? 'right' : 'left') + ':-2px;min-width:20px;height:20px;border-radius:10px;background:' + CFG.c2 + ';font:700 12px/20px sans-serif;text-align:center;padding:0 5px;display:none}' +
    '.tz{position:fixed;bottom:90px;' + side + ':22px;z-index:2147483000;background:#fff;color:#123;border-radius:14px;padding:10px 14px;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.15);direction:rtl;cursor:pointer;max-width:240px;display:none}' +
    '.tz i{position:absolute;top:-8px;' + (side === 'left' ? 'right' : 'left') + ':-8px;width:22px;height:22px;border-radius:50%;background:#eee;font-style:normal;text-align:center;line-height:22px;font-size:13px;color:#555}' +
    '.p{position:fixed;bottom:92px;' + side + ':22px;z-index:2147483001;width:370px;max-width:calc(100vw - 24px);height:560px;max-height:calc(100vh - 120px);background:#fff;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;direction:rtl;color:#1d2a30}' +
    '.p.on{display:flex}.h{background:' + CFG.c1 + ';color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}.h .av{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-weight:700}' +
    '.h b{display:block;font-size:15px}.h small{opacity:.85;font-size:12px}.h .x{margin-inline-start:auto;background:none;border:0;color:#fff;font-size:24px;cursor:pointer;line-height:1}' +
    '.m{flex:1;overflow-y:auto;padding:14px;background:#f4f6f7;display:flex;flex-direction:column;gap:8px}' +
    '.g{max-width:82%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.6;white-space:pre-wrap;word-wrap:break-word}' +
    '.g.me{align-self:flex-end;background:' + CFG.c1 + ';color:#fff;border-bottom-left-radius:4px}.g.bot,.g.team{align-self:flex-start;background:#fff;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.06);border-bottom-right-radius:4px}' +
    '.g a{color:inherit;text-decoration:underline}.g .by{display:block;font-size:11px;color:' + CFG.c2 + ';font-weight:700;margin-bottom:2px}.g.err{background:#fde8e8;color:#8a1c1c;align-self:center;font-size:12.5px}' +
    '.ty{align-self:flex-start;background:#fff;border-radius:14px;padding:10px 14px;display:none}.ty span{display:inline-block;width:7px;height:7px;margin:0 2px;border-radius:50%;background:#9aa;animation:d 1.2s infinite}.ty span:nth-child(2){animation-delay:.2s}.ty span:nth-child(3){animation-delay:.4s}' +
    '@keyframes d{0%,60%,100%{opacity:.3}30%{opacity:1}}' +
    '.f{padding:14px;display:flex;flex-direction:column;gap:8px;background:#fff;border-top:1px solid #eef1f2}.f p{margin:0;font-size:13px;color:#56656b}' +
    'input,textarea{width:100%;border:1px solid #d6dee1;border-radius:10px;padding:10px 12px;font-size:14px;outline:none;background:#fff;color:#1d2a30;direction:rtl}input:focus,textarea:focus{border-color:' + CFG.c1 + '}' +
    '.go{background:' + CFG.c2 + ';color:#fff;border:0;border-radius:10px;padding:11px;font-size:15px;font-weight:700;cursor:pointer}.go:disabled{opacity:.6}' +
    '.c{display:flex;gap:8px;padding:10px;border-top:1px solid #eef1f2;background:#fff;align-items:flex-end}.c textarea{resize:none;max-height:110px;min-height:42px}' +
    '.c button{flex:none;width:42px;height:42px;border-radius:50%;border:0;background:' + CFG.c1 + ';color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}.c button svg{width:20px;height:20px;transform:scaleX(-1)}' +
    '.w{display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;font-size:12.5px;color:#1fa855;text-decoration:none;background:#fff;border-top:1px solid #eef1f2}.w svg{width:15px;height:15px}' +
    '.hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}' +
    '@media (max-width:720px){.b{bottom:84px;' + side + ':16px;width:52px;height:52px}.tz{bottom:146px;' + side + ':16px}.p{bottom:0;' + side + ':0;width:100vw;max-width:100vw;height:100%;max-height:100%;border-radius:0}}';
  var IC = {
    chat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.5 1.2 4.7 3.2 6.3L4.5 22l4.3-2.2c1 .3 2.1.4 3.2.4 5.5 0 10-3.9 10-8.7S17.5 3 12 3zm-4 10a1.3 1.3 0 1 1 0-2.6A1.3 1.3 0 0 1 8 13zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3.5A11.9 11.9 0 0 0 12 0C5.4 0 .1 5.3.1 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.4-1.7a11.9 11.9 0 0 0 5.6 1.4c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.4-8.3z"/></svg>',
  };
  root.innerHTML = '<style>' + css + '</style>' +
    '<div class="tz" id="tz"><i id="tzx">×</i>' + CFG.teaser + '</div>' +
    '<button class="b" id="b" aria-label="محادثة ' + CFG.brand + '">' + IC.chat + '<span class="n" id="n"></span></button>' +
    '<div class="p" id="p" role="dialog" aria-label="محادثة"><div class="h"><div class="av">' + CFG.brand.replace(/^[^ء-ي]*/, '').charAt(0) + '</div><div><b>' + CFG.brand + '</b><small>' + CFG.sub + '</small></div><button class="x" id="x" aria-label="إغلاق">×</button></div>' +
    '<div class="m" id="m"></div>' +
    '<form class="f" id="f"><p>عرّفنا بك لنكمل المحادثة — رقم الجوال اختياري ويساعدنا نتواصل معك إن انقطعت المحادثة.</p>' +
    '<input id="fn" placeholder="اسمك" maxlength="60" autocomplete="name" required><input id="fp" placeholder="رقم الجوال (اختياري)" inputmode="tel" maxlength="20" autocomplete="tel" dir="ltr" style="text-align:right">' +
    '<input class="hp" id="fw" tabindex="-1" autocomplete="off"><button class="go" id="fg">ابدأ المحادثة</button></form>' +
    '<form class="c" id="c" style="display:none"><textarea id="t" rows="1" placeholder="اكتب رسالتك…" maxlength="1000"></textarea><button id="s" aria-label="إرسال">' + IC.send + '</button></form>' +
    '<a class="w" href="https://wa.me/' + CFG.wa + '" target="_blank" rel="noopener">' + IC.wa + ' أكمل المحادثة على واتساب</a></div>';
  (document.body || document.documentElement).appendChild(host);
  var $ = function (id) { return root.getElementById ? root.getElementById(id) : root.querySelector('#' + id); };

  function esc(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(s) {
    return esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,،!؟])/g, '$1<b>$2</b>').replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,،!؟])/g, '$1<i>$2</i>');
  }
  function draw() {
    var m = $('m');
    var h = '<div class="g bot">' + fmt(CFG.hi) + '</div>';
    for (var i = 0; i < msgs.length; i++) {
      var x = msgs[i];
      h += '<div class="g ' + x.from + '">' + (x.from === 'team' ? '<span class="by">' + esc(x.by || 'الفريق') + '</span>' : '') + fmt(x.text) + '</div>';
    }
    h += '<div class="ty" id="ty"><span></span><span></span><span></span></div>';
    m.innerHTML = h;
    $('ty').style.display = waiting && Date.now() - waiting < 90000 ? 'block' : 'none';
    m.scrollTop = m.scrollHeight;
  }
  function stage() {
    var started = !!(S.v && S.t);
    $('f').style.display = started ? 'none' : 'flex';
    $('c').style.display = started ? 'flex' : 'none';
  }
  function badge(n) { var el = $('n'); el.textContent = n > 9 ? '9+' : String(n); el.style.display = n ? 'block' : 'none'; }
  function api(path, body) {
    var o = body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {};
    return fetch(BASE + '/wa/web/' + SITE + '/' + path, o).then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.error || 'تعذّر الاتصال'); e.status = r.status; throw e; } return j; }); });
  }
  function errMsg(t) { var m = $('m'); var d = document.createElement('div'); d.className = 'g err'; d.textContent = t; m.appendChild(d); m.scrollTop = m.scrollHeight; }

  function poll() {
    if (!S.v || document.hidden) return schedule();
    var real = msgs.filter(function (x) { return !x.tmp; }); var after = real.length ? real[real.length - 1].id : 0;
    api('poll?v=' + S.v + '&t=' + S.t + '&after=' + after).then(function (d) {
      if (d.messages && d.messages.length) {
        msgs = msgs.filter(function (x) { return !x.tmp; }).concat(d.messages);
        var fresh = d.messages.filter(function (x) { return x.from !== 'me'; });
        if (fresh.length) waiting = 0;
        S.last = msgs[msgs.length - 1].id; store.set(S);
        if (open) { S.seen = S.last; store.set(S); draw(); } else badge(msgs.filter(function (x) { return x.from !== 'me' && x.id > (S.seen || 0); }).length);
      } else if (open && waiting) draw();
    }).catch(function (e) { if (e.status === 403) { S = {}; store.set(S); msgs = []; stage(); draw(); } }).then(schedule);
  }
  function schedule() {
    clearTimeout(timer);
    var ms = !S.v ? 0 : open ? (waiting ? 2500 : 8000) : 40000;
    if (ms) timer = setTimeout(poll, ms);
  }
  function toggle(on) {
    open = on; $('p').classList.toggle('on', on); $('tz').style.display = 'none';
    if (on) { S.seen = S.last || 0; store.set(S); badge(0); draw(); stage(); setTimeout(function () { (S.v ? $('t') : $('fn')).focus(); }, 50); }
    schedule(); if (on && S.v) poll();
  }
  $('b').onclick = function () { toggle(!open); };
  $('x').onclick = function () { toggle(false); };
  $('tz').onclick = function (e) { if (e.target.id === 'tzx') { $('tz').style.display = 'none'; try { sessionStorage.setItem(KEY + '_tz', 1); } catch (x) { /* */ } return; } toggle(true); };
  $('f').onsubmit = function (e) {
    e.preventDefault(); var name = $('fn').value.trim(); if (name.length < 2) { $('fn').focus(); return; }
    $('fg').disabled = true;
    api('start', { name: name, phone: $('fp').value.trim(), page: location.href.slice(0, 300), website: $('fw').value })
      .then(function (d) { if (!d.v) throw new Error('تعذّر البدء'); S = { v: d.v, t: d.t, name: name, last: 0, seen: 0 }; store.set(S); stage(); $('t').focus(); schedule(); })
      .catch(function (err) { errMsg(err.message); }).then(function () { $('fg').disabled = false; });
  };
  var ta = $('t');
  function grow() { ta.style.height = 'auto'; ta.style.height = Math.min(110, ta.scrollHeight) + 'px'; }
  ta.addEventListener('input', grow);
  ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.innerWidth > 720) { e.preventDefault(); $('c').requestSubmit ? $('c').requestSubmit() : $('s').click(); } });
  $('c').onsubmit = function (e) {
    e.preventDefault(); var text = ta.value.trim(); if (!text || sending) return;
    sending = true; ta.value = ''; grow();
    var tmp = { id: (msgs.length ? msgs[msgs.length - 1].id : 0), from: 'me', text: text, tmp: 1 };
    msgs.push(tmp); waiting = Date.now(); draw();
    api('send', { v: S.v, t: S.t, text: text }).then(function () {
      poll(); // الرسالة الحقيقية تعود من الاستطلاع بمعرّفها وتحل محل المؤقتة
    }).catch(function (err) { msgs.splice(msgs.indexOf(tmp), 1); waiting = 0; ta.value = text; draw(); errMsg(err.message); })
      .then(function () { sending = false; });
  };

  // دعوة لطيفة بعد 12 ثانية — مرة في الجلسة، ولمن لم يبدأ محادثة
  try { if (!S.v && !sessionStorage.getItem(KEY + '_tz')) setTimeout(function () { if (!open) $('tz').style.display = 'block'; }, 12000); } catch (e) { /* */ }
  if (S.v) { // استرجاع المحادثة السابقة
    api('poll?v=' + S.v + '&t=' + S.t + '&after=0').then(function (d) {
      msgs = d.messages || []; if (msgs.length) S.last = msgs[msgs.length - 1].id; store.set(S);
      badge(msgs.filter(function (x) { return x.from !== 'me' && x.id > (S.seen || 0); }).length);
    }).catch(function (e) { if (e.status === 403) { S = {}; store.set(S); } }).then(schedule);
  }
  stage();
})();
