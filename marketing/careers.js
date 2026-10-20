/* صفحة «انضم إلينا»: قائمة الوظائف المفتوحة + نموذج تقديم من ثلاث خطوات
   - الوظائف وخياراتها (المهارات، البرامج، أنواع الدوام، سؤال الختام) تأتي من المنصة: GET /marketing/hub/api/public/jobs
   - مسودة تُحفظ تلقائياً على الجهاز (عدا الملف) وتُستعاد عند العودة
   - رابط مباشر لوظيفة: /marketing/careers?job=<slug> */
(() => {
  const API = '/marketing/hub/api/public/';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STEP_OF = { name: 1, phone: 1, email: 1, city: 1, experience: 2, mode: 2, salary: 2, start_when: 2, portfolio: 3, cv: 3, consent: 3 };
  const MAX = 5 * 1024 * 1024;
  const OK_EXT = /\.(pdf|docx?|jpe?g|png)$/i;
  let data = null, job = null, step = 1, cv = null, cvMode = 'file', t0 = Date.now(), sending = false;
  const sel = { experience: '', mode: '', start_when: '', skills: new Set(), tools: new Set() };
  const form = $('#cr-form');
  const key = () => 'nubl_apply_' + (job?.slug || job?.id);
  const store = { get: (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* وضع خاص */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch { /* */ } } };

  /* ---------- الوظائف ---------- */
  async function boot() {
    try { const r = await fetch(API + 'jobs'); if (!r.ok) throw 0; data = await r.json(); }
    catch { $('#cr-jobs').innerHTML = `<div class="cr-none">تعذّر تحميل الوظائف الآن. حدّث الصفحة، أو راسلنا على واتساب <a class="num" href="https://wa.me/${window.WA || '966563413040'}">0563413040</a>.</div>`; return; }
    const jobs = data.jobs || [];
    if (!jobs.length) { $('#cr-jobs').innerHTML = '<div class="cr-none"><b>لا توجد وظائف مفتوحة حالياً.</b><br>تابع حساباتنا — نعلن فيها عن أي فرصة جديدة.</div>'; return; }
    const want = new URLSearchParams(location.search).get('job');
    const pick = jobs.find((j) => j.slug === want) || (jobs.length === 1 ? jobs[0] : null);
    renderJobs(jobs);
    if (pick) open(pick, jobs.length > 1);
  }
  function renderJobs(jobs) {
    $('#cr-jobs').innerHTML = `<h2 style="font-size:clamp(22px,3vw,30px)">الوظائف المتاحة</h2>` + jobs.map((j) => `<button type="button" class="cr-job" data-j="${j.id}">
      <h3>${esc(j.title)}</h3><p>${esc(j.summary || '')}</p>
      <div class="cr-meta">${j.location ? `<span>${esc(j.location)}</span>` : ''}${j.modes.map((m) => `<span>${esc(m)}</span>`).join('')}</div><span class="go">قدّم الآن ←</span></button>`).join('');
    $$('[data-j]').forEach((b) => b.onclick = () => { open(jobs.find((j) => j.id == b.dataset.j), true); history.replaceState(null, '', '?job=' + encodeURIComponent(job.slug)); });
  }
  function open(j, many) {
    job = j; $('#cr-jobs').hidden = true; $('#cr-app').hidden = false; $('#cr-change').hidden = !many;
    $('#cr-title').textContent = j.title; $('#cr-sum').textContent = [j.summary, j.details].filter(Boolean).join(' ');
    $('#cr-meta').innerHTML = [j.location, ...j.modes].filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join('');
    opts('experience', data.experience); opts('mode', j.modes); opts('start_when', data.start_when);
    chips('skills', j.skills); chips('tools', j.tools);
    $('#f-skills').hidden = !j.skills.length; $('#f-tools').hidden = !j.tools.length;
    $('#l-answer').textContent = j.extra_q || 'أخبرنا عن أفضل عمل قدّمته ولماذا (اختياري)';
    restore(); go(1, false);
    document.title = `التقديم على وظيفة ${j.title} | نُبل وابتكار للخدمات التسويقية`;
  }
  $('#cr-change').onclick = () => { $('#cr-app').hidden = true; $('#cr-jobs').hidden = false; history.replaceState(null, '', location.pathname); $('#cr-jobs').scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  /* ---------- الخيارات ---------- */
  function opts(k, list) {
    $('#o-' + k).innerHTML = list.map((o) => `<button type="button" aria-pressed="${sel[k] === o}" data-v="${esc(o)}">${esc(o)}</button>`).join('');
    $$('#o-' + k + ' button').forEach((b) => b.onclick = () => { sel[k] = b.dataset.v; $$('#o-' + k + ' button').forEach((x) => x.setAttribute('aria-pressed', x === b)); clearBad(k); save(); });
  }
  function chips(k, list) {
    $('#o-' + k).innerHTML = list.map((o) => `<button type="button" aria-pressed="${sel[k].has(o)}" data-v="${esc(o)}">${esc(o)}</button>`).join('');
    $$('#o-' + k + ' button').forEach((b) => b.onclick = () => { const v = b.dataset.v; sel[k].has(v) ? sel[k].delete(v) : sel[k].add(v); b.setAttribute('aria-pressed', sel[k].has(v)); save(); });
  }

  /* ---------- المسودة ---------- */
  const TEXT = ['name', 'phone', 'email', 'city', 'salary', 'portfolio', 'cv_link', 'answer'];
  function save() {
    if (!job) return;
    const d = { v: 1 }; TEXT.forEach((k) => d[k] = form.elements[k].value);
    Object.assign(d, { experience: sel.experience, mode: sel.mode, start_when: sel.start_when, skills: [...sel.skills], tools: [...sel.tools], cvMode });
    store.set(key(), d);
  }
  function restore() {
    const d = store.get(key()); reset();
    if (!d) { $('#cr-restored').hidden = true; return; }
    TEXT.forEach((k) => { if (d[k]) form.elements[k].value = d[k]; });
    ['experience', 'mode', 'start_when'].forEach((k) => { sel[k] = d[k] || ''; $$('#o-' + k + ' button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === sel[k])); });
    ['skills', 'tools'].forEach((k) => { sel[k] = new Set(d[k] || []); $$('#o-' + k + ' button').forEach((b) => b.setAttribute('aria-pressed', sel[k].has(b.dataset.v))); });
    setCvMode(d.cvMode || 'file');
    $('#cr-restored').hidden = !TEXT.some((k) => d[k]);
  }
  function reset() {
    form.reset(); sel.experience = sel.mode = sel.start_when = ''; sel.skills = new Set(); sel.tools = new Set(); setFile(null); setCvMode('file');
    $$('.cr-opts button,.cr-chips button').forEach((b) => b.setAttribute('aria-pressed', 'false')); $$('.cr-f.bad').forEach((f) => f.classList.remove('bad'));
  }
  $('#cr-clear').onclick = () => { store.del(key()); reset(); $('#cr-restored').hidden = true; go(1); };
  form.addEventListener('input', (e) => { if (e.target.name) clearBad(e.target.name === 'cv_link' ? 'cv' : e.target.name); save(); });

  /* ---------- السيرة الذاتية ---------- */
  function setCvMode(m) {
    cvMode = m; $$('[data-cv]').forEach((b) => { b.classList.toggle('on', b.dataset.cv === m); b.setAttribute('aria-selected', b.dataset.cv === m); });
    $('#cv-file').hidden = m !== 'file'; $('#cv-link').hidden = m !== 'link';
  }
  $$('[data-cv]').forEach((b) => b.onclick = () => { setCvMode(b.dataset.cv); clearBad('cv'); save(); });
  function setFile(f) {
    cv = f; $('#cr-file').hidden = !f; $('#cr-drop').hidden = !!f;
    if (f) $('#cr-fname').textContent = `📎 ${f.name} — ${(f.size / 1048576).toFixed(f.size < 1048576 ? 2 : 1)} MB`;
    $('#cv-input').value = '';
  }
  function takeFile(f) {
    if (!f) return;
    if (!OK_EXT.test(f.name)) return bad('cv', 'صيغة الملف غير مدعومة — PDF أو Word أو صورة');
    if (f.size > MAX) return bad('cv', 'حجم الملف أكبر من 5MB — صغّره أو ضع رابطاً بدلاً منه');
    clearBad('cv'); setFile(f);
  }
  $('#cv-input').onchange = (e) => takeFile(e.target.files[0]);
  $('#cr-frm').onclick = () => setFile(null);
  const drop = $('#cr-drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => takeFile(e.dataTransfer.files[0]));
  const b64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });

  /* ---------- التحقق والتنقل ---------- */
  const fieldEl = (k) => (form.elements[k] && !form.elements[k].length ? form.elements[k].closest('.cr-f') : $(`.cr-f[data-f="${k}"]`));
  function bad(k, msg) { const f = fieldEl(k); if (!f) return; f.classList.add('bad'); const em = $('em', f); if (em) em.textContent = msg; }
  function clearBad(k) { const f = fieldEl(k); if (f) f.classList.remove('bad'); }
  const digits = (v) => String(v).replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c));
  function check(n) {
    const v = (k) => form.elements[k].value.trim(); const e = {};
    if (n === 1) {
      if (v('name').split(/\s+/).filter(Boolean).length < 2) e.name = 'اكتب الاسم الثنائي على الأقل';
      const ph = digits(v('phone')).replace(/[^\d]/g, ''); if (!/^(05\d{8}|5\d{8}|9665\d{8}|\d{9,15})$/.test(ph)) e.phone = 'رقم الجوال غير صحيح — مثال: 05XXXXXXXX';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email'))) e.email = 'البريد الإلكتروني غير صحيح';
      if (v('city').length < 2) e.city = 'اكتب المدينة والحي';
    }
    if (n === 2) {
      if (!sel.experience) e.experience = 'اختر سنوات الخبرة';
      if (!sel.mode) e.mode = 'اختر نوع الدوام';
      if (!/\d/.test(digits(v('salary')))) e.salary = 'اكتب الراتب المتوقع بالأرقام';
      if (!sel.start_when) e.start_when = 'اختر موعد المباشرة';
    }
    if (n === 3) {
      if (!/^https?:\/\/\S+\.\S+/i.test(v('portfolio'))) e.portfolio = 'أضف الرابط كاملاً ويبدأ بـ https://';
      if (cvMode === 'file' && !cv) e.cv = 'ارفع ملف السيرة الذاتية أو اختر «وضع رابط»';
      if (cvMode === 'link' && !/^https?:\/\/\S+\.\S+/i.test(v('cv_link'))) e.cv = 'ضع رابط السيرة كاملاً ويبدأ بـ https://';
      if (!form.elements.consent.checked) e.consent = 'الموافقة مطلوبة لإرسال الطلب';
    }
    Object.entries(e).forEach(([k, m]) => bad(k, m));
    const first = Object.keys(e)[0];
    if (first) { const f = fieldEl(first); f?.scrollIntoView({ behavior: 'smooth', block: 'center' }); (f?.querySelector('input,button,textarea'))?.focus({ preventScroll: true }); }
    return !first;
  }
  function go(n, scroll = true) {
    step = n;
    $$('.cr-step').forEach((s) => s.hidden = +s.dataset.step !== n);
    $$('.cr-steps li').forEach((li, i) => { li.classList.toggle('on', i + 1 === n); li.classList.toggle('done', i + 1 < n); });
    $('#cr-bar').style.width = (n / 3 * 100) + '%';
    $('#cr-prev').hidden = n === 1; $('#cr-next').hidden = n === 3; $('#cr-send').hidden = n !== 3; $('#cr-err').hidden = true;
    if (scroll) $('#cr-app').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('#cr-next').onclick = () => { if (check(step)) go(step + 1); };
  $('#cr-prev').onclick = () => go(step - 1);
  form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && step < 3) { e.preventDefault(); $('#cr-next').click(); } });

  /* ---------- الإرسال ---------- */
  form.onsubmit = async (e) => {
    e.preventDefault(); if (sending) return;
    for (const n of [1, 2, 3]) if (!check(n)) { if (n !== step) { go(n); check(n); } return; }
    sending = true; const btn = $('#cr-send'); btn.disabled = true; btn.textContent = cv && cvMode === 'file' ? 'جارٍ رفع الملف…' : 'جارٍ الإرسال…';
    const el = form.elements; const body = { job_id: job.id, website: el.website.value, elapsed: Date.now() - t0, consent: el.consent.checked,
      name: el.name.value.trim(), phone: digits(el.phone.value), email: el.email.value.trim(), city: el.city.value.trim(), salary: digits(el.salary.value.trim()),
      portfolio: el.portfolio.value.trim(), answer: el.answer.value.trim(), experience: sel.experience, mode: sel.mode, start_when: sel.start_when,
      skills: [...sel.skills], tools: [...sel.tools], cv_link: cvMode === 'link' ? el.cv_link.value.trim() : '' };
    try {
      if (cvMode === 'file' && cv) body.cv = { name: cv.name, mime: cv.type || mimeOf(cv.name), data: await b64(cv) };
      const r = await fetch(API + 'apply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (d.fields) { const ks = Object.keys(d.fields); go(Math.min(...ks.map((k) => STEP_OF[k] || 3))); ks.forEach((k) => bad(k, d.fields[k])); }
        throw new Error(d.error || 'تعذّر الإرسال — أعد المحاولة');
      }
      store.del(key());
      $('#cr-num').textContent = d.number; $('#cr-done-t').textContent = d.updated ? 'حدّثنا طلبك السابق، شكراً لك' : 'وصلنا طلبك، شكراً لك';
      form.hidden = true; $('.cr-head').hidden = true; $('#cr-done').hidden = false; $('#cr-done').focus(); $('#cr-done').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      const m = $('#cr-err'); m.textContent = err.message === 'Failed to fetch' ? 'لا يوجد اتصال بالإنترنت — بياناتك محفوظة، أعد المحاولة' : err.message; m.hidden = false;
    } finally { sending = false; btn.disabled = false; btn.textContent = 'إرسال الطلب'; }
  };
  const mimeOf = (n) => ({ pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }[String(n).split('.').pop().toLowerCase()] || '');

  boot();
})();
