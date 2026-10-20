/* النواة المشتركة لبوابتي المندوب والعميل: الطلبات، التنسيق، الدخول برمز واتساب، النوافذ */
'use strict';
const P = (() => {
  const API = '/marketing/hub/api/portal/';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const url = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? esc(String(u).trim()) : '#'); // روابط خارجية آمنة فقط
  const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const money = (v) => `<span><span class="num">${nf.format(Number(v) || 0)}</span> ر.س</span>`;
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const date = (d) => { if (!d) return '—'; const [y, mo, da] = String(d).slice(0, 10).split('-'); if (!mo) return esc(d); return `<span><span class="num">${+da}</span> ${MONTHS[+mo - 1]} <span class="num">${y}</span></span>`; };
  const PILLS = { g: ['مصروفة', 'مدفوعة', 'مقبول', 'معتمد', 'منشور', 'منجز', 'مكتمل', 'مكسوبة', 'محوّل لعميل', 'نشط', 'موقّع', 'تمت المعالجة'],
    y: ['مستحقة', 'مدفوعة جزئياً', 'مرسل', 'بانتظار اعتماد العميل', 'جديد', 'جديدة', 'تفاوض', 'عرض سعر'], r: ['مرفوض', 'خاسرة', 'منتهي', 'متأخرة', 'تعديلات', 'غير مهتم', 'غير صالح', 'ملغي'] };
  const pill = (s) => { const k = Object.keys(PILLS).find((x) => PILLS[x].includes(s)) || 'b'; return `<span class="pill ${k}">${esc(s || '—')}</span>`; };

  async function api(path, body, method) {
    const opt = { method: method || (body ? 'POST' : 'GET'), headers: {}, credentials: 'same-origin', cache: 'no-store' };
    if (body) { opt.headers['content-type'] = 'application/json'; opt.body = JSON.stringify(body); }
    let r; try { r = await fetch(API + path, opt); } catch { throw Object.assign(new Error('تعذّر الاتصال — تحقق من الإنترنت وحاول مجدداً'), { status: 0 }); }
    let d = {}; try { d = await r.json(); } catch { /* */ }
    if (!r.ok) throw Object.assign(new Error(d.error || 'حدث خطأ — حاول مرة أخرى'), { status: r.status });
    return d;
  }

  function toast(msg, bad) {
    const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 3600);
  }
  function modal(title, html, onMount) {
    const m = document.createElement('div'); m.className = 'mask';
    m.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="x" aria-label="إغلاق">×</button><h3>${esc(title)}</h3>${html}</div>`;
    const close = () => { m.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('.x')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(m); onMount && onMount(m.firstElementChild, close);
    const f = m.querySelector('input,textarea,select'); f && setTimeout(() => f.focus(), 60);
    return close;
  }
  // يمنع الضغط المزدوج ويعرض الخطأ في النموذج
  async function busy(btn, fn) {
    if (btn.disabled) return; const t = btn.innerHTML; btn.disabled = true; btn.innerHTML = 'لحظة…';
    try { return await fn(); } catch (e) { toast(e.message, true); } finally { btn.disabled = false; btn.innerHTML = t; }
  }

  // ---------- الدخول برمز واتساب ----------
  function login(kind, cfg, onIn) {
    const root = $('#app'); let phone = '';
    const savedPhone = (() => { try { return localStorage.getItem('np_phone_' + kind) || ''; } catch { return ''; } })();
    const step1 = () => {
      root.innerHTML = `<div class="login"><form class="lcard" id="f1" novalidate>
        <img src="/marketing/logo.png" alt="نُبل وابتكار">
        <h1>${esc(cfg.title)}</h1><p>${esc(cfg.sub)}</p>
        <input class="inp num" id="ph" type="tel" inputmode="tel" autocomplete="tel" placeholder="05XXXXXXXX" value="${esc(savedPhone)}" aria-label="رقم الجوال">
        <button class="btn gold" type="submit">أرسل رمز الدخول على واتساب</button>
        <div class="err" id="er"></div>
        <p class="small" style="margin:14px 0 0">الرقم المسجّل لدى فريق نُبل وابتكار للتسويق. ${cfg.help || ''}</p></form></div>`;
      $('#f1').onsubmit = (e) => { e.preventDefault(); send($('#f1 .btn')); };
    };
    const send = (btn) => {
      phone = ($('#ph') || {}).value || phone;
      $('#er') && ($('#er').textContent = '');
      return busy(btn, async () => {
        try { await api('otp', { kind, phone }); } catch (e) { if ($('#er')) { $('#er').textContent = e.message; return; } throw e; }
        try { localStorage.setItem('np_phone_' + kind, phone); } catch { /* */ }
        step2();
      });
    };
    const step2 = () => {
      root.innerHTML = `<div class="login"><form class="lcard" id="f2" novalidate>
        <img src="/marketing/logo.png" alt="نُبل وابتكار">
        <h1>أدخل رمز الدخول</h1><p>أرسلنا رمزاً من 6 أرقام إلى واتساب <b class="num">${esc(phone)}</b> إن كان مسجلاً لدينا.</p>
        <input class="inp num otp" id="cd" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" aria-label="الرمز">
        <button class="btn gold" type="submit">دخول</button>
        <div class="err" id="er"></div>
        <button class="lnk" type="button" id="rs" disabled>إعادة الإرسال بعد <span class="num">60</span> ث</button><br>
        <button class="lnk" type="button" id="bk">تغيير الرقم</button></form></div>`;
      let left = 60; const rs = $('#rs');
      const iv = setInterval(() => { left--; if (left <= 0) { clearInterval(iv); rs.disabled = false; rs.textContent = 'إعادة إرسال الرمز'; } else rs.querySelector('span').textContent = left; }, 1000);
      rs.onclick = () => { clearInterval(iv); send(rs); };
      $('#bk').onclick = () => { clearInterval(iv); step1(); };
      const cd = $('#cd');
      cd.oninput = () => { cd.value = cd.value.replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\D/g, '').slice(0, 6); if (cd.value.length === 6) $('#f2').requestSubmit(); };
      $('#f2').onsubmit = (e) => {
        e.preventDefault(); $('#er').textContent = '';
        busy($('#f2 .btn'), async () => {
          try { await api('verify', { kind, phone, code: cd.value }); } catch (er) { $('#er').textContent = er.message; cd.select(); return; }
          clearInterval(iv); onIn();
        });
      };
      setTimeout(() => cd.focus(), 50);
    };
    step1();
  }

  async function boot(kind, cfg, render) {
    const start = async () => {
      try { await render(); } catch (e) {
        if (e.status === 401 || e.status === 403) return login(kind, cfg, start);
        $('#app').innerHTML = `<div class="login"><div class="lcard"><img src="/marketing/logo.png" alt=""><h1>تعذّر التحميل</h1><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">إعادة المحاولة</button></div></div>`;
      }
    };
    start();
  }
  async function logout() { try { await api('logout', {}); } catch { /* */ } location.reload(); }

  // صورة → base64 مصغّرة (أقل من 1.4MB) · PDF كما هو
  function fileB64(file) {
    return new Promise((res, rej) => {
      if (file.type === 'application/pdf') {
        if (file.size > 1_350_000) return rej(new Error('ملف PDF أكبر من 1.3MB — صوّر الإيصال بدلاً منه'));
        const fr = new FileReader(); fr.onload = () => res({ data: String(fr.result).split(',')[1], mime: file.type, name: file.name }); fr.onerror = () => rej(new Error('تعذّرت قراءة الملف')); fr.readAsDataURL(file); return;
      }
      if (!/^image\//.test(file.type)) return rej(new Error('أرفق صورة أو PDF'));
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        let q = 0.85, out = cv.toDataURL('image/jpeg', q);
        while (out.length > 1_800_000 && q > 0.4) { q -= 0.15; out = cv.toDataURL('image/jpeg', q); }
        res({ data: out.split(',')[1], mime: 'image/jpeg', name: file.name.replace(/\.\w+$/, '') + '.jpg' });
      };
      img.onerror = () => rej(new Error('تعذّرت قراءة الصورة')); img.src = url;
    });
  }
  const waLink = (num, text) => `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  const tabs = (list, cur) => `<nav class="tabs" role="tablist">${list.map(([k, t, n]) => `<button class="tab${k === cur ? ' on' : ''}" role="tab" data-tab="${k}">${esc(t)}${n ? `<span class="bd num">${n}</span>` : ''}</button>`).join('')}</nav>`;
  const accountPicker = (accounts, cur) => accounts.length > 1 ? `<select class="acct" id="acct" aria-label="الحساب">${accounts.map((a) => `<option value="${a.id}"${a.id === cur ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select>` : '';
  function bindPicker(onDone) { const s = $('#acct'); if (s) s.onchange = async () => { try { await api('switch', { id: Number(s.value) }); onDone(); } catch (e) { toast(e.message, true); } }; }

  return { $, esc, url, money, date, pill, api, toast, modal, busy, boot, logout, fileB64, waLink, tabs, accountPicker, bindPicker, nf };
})();
