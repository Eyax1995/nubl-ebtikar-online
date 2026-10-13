/* منصة نُبل وابتكار للتسويق — صندوق ردود واتساب (رقم التسويق 0563413040) */
'use strict';

const WA_ROLES = ['admin', 'manager', 'sales', 'account'];
const WA_ADMIN = ['admin', 'manager'];
let waTimer = null;

function waTime(at) {
  if (!at) return '';
  const d = new Date(String(at).replace(' ', 'T') + (String(at).includes('Z') || String(at).includes('+') ? '' : 'Z'));
  const ksa = new Date(d.getTime() + 3 * 3600e3);
  const same = ksa.toISOString().slice(0, 10) === todayStr();
  const hm = ksa.toISOString().slice(11, 16);
  return same ? `<span class="num">${hm}</span>` : `${fdate(ksa.toISOString().slice(0, 10))} <span class="num">${hm}</span>`;
}
const waPhone = (id) => (String(id).startsWith('966') ? '0' + String(id).slice(3) : '+' + id);
const waBotOn = (until) => !until || Date.parse(until) <= Date.now();

async function waView(id) {
  clearInterval(waTimer);
  if (!WA_ROLES.includes(me().role)) { V().innerHTML = '<div class="empty">لا تملك صلاحية صندوق واتساب</div>'; return; }
  V().innerHTML = `<div class="wa-box ${id ? 'has-thread' : ''}"><div class="wa-list card"><div class="wa-lh"><div><b>${I.wa} محادثات رقم التسويق</b>
      <div class="small muted num" dir="ltr">0563413040</div></div>
      <div class="wa-acts">${WA_ADMIN.includes(me().role) ? '<button class="btn btn-g btn-s" id="wa-set" title="إعدادات واتساب">⚙︎ الإعدادات</button>' : ''}
      <button class="btn btn-wa btn-s" id="wa-new">+ محادثة جديدة</button></div></div><div id="wa-threads" class="wa-threads"><div class="empty">جارٍ التحميل…</div></div></div>
    <div class="wa-thread card" id="wa-thread">${id ? '<div class="empty">جارٍ التحميل…</div>' : '<div class="empty">اختر محادثة من القائمة</div>'}</div></div>`;
  $('#wa-new').onclick = () => waStartModal();
  if ($('#wa-set')) $('#wa-set').onclick = () => waSettingsModal();
  await waLoadThreads(id);
  if (id) await waLoadThread(id);
  waTimer = setInterval(async () => {
    if (S.route !== 'wa') { clearInterval(waTimer); return; }
    await waLoadThreads(id, true).catch(() => {});
    if (id && !($('#wa-text') && $('#wa-text').value)) await waLoadThread(id, true).catch(() => {});
  }, 15000);
}

async function waLoadThreads(active, quiet) {
  const d = await api('wa/threads');
  const el = $('#wa-threads'); if (!el) return;
  el.innerHTML = d.threads.length ? d.threads.map((t) => {
    const who = t.last_kind === 'message' ? '' : t.last_kind === 'reply' ? '🤖 ' : '👤 ';
    return `<a class="wa-ti ${t.wa_id === active ? 'on' : ''}" href="#/wa/${esc(t.wa_id)}">
      <div class="wa-tn"><b>${esc(t.name || waPhone(t.wa_id))}</b><span class="small muted">${waTime(t.last_at)}</span></div>
      <div class="wa-tp small muted">${who}${esc(String(t.last_text || '').slice(0, 80))}</div>
      <div class="wa-tf">${t.name ? `<span class="small muted num" dir="ltr">${esc(waPhone(t.wa_id))}</span>` : '<span></span>'}
        ${waBotOn(t.bot_paused_until) ? '<span class="pill t">الرد الآلي يعمل</span>' : '<span class="pill o">موظف يتولى</span>'}</div></a>`;
  }).join('') : '<div class="empty">لا توجد محادثات بعد</div>';
}

async function waLoadThread(id, quiet) {
  const d = await api('wa/thread/' + encodeURIComponent(id));
  const el = $('#wa-thread'); if (!el) return;
  const on = waBotOn(d.bot_paused_until);
  const draft = $('#wa-text') ? $('#wa-text').value : '';
  el.innerHTML = `<div class="wa-th"><a class="btn btn-g btn-s wa-back" href="#/wa">→ المحادثات</a>
      <div><b>${esc(d.name || waPhone(d.wa_id))}</b><div class="small muted num" dir="ltr">${esc(waPhone(d.wa_id))}</div></div><span class="sp"></span>
      <button class="btn btn-s ${on ? 'btn-g' : 'btn-p'}" id="wa-bot">${on ? 'إيقاف الرد الآلي' : 'تشغيل الرد الآلي'}</button>
      <a class="btn btn-wa btn-s" href="tel:${esc(waPhone(d.wa_id))}">اتصال</a></div>
    <div class="small ${on ? 'muted' : ''}" style="padding:6px 14px;${on ? '' : 'color:var(--terra)'}">${on ? 'الرد الآلي يعمل لهذه المحادثة.' : `الرد الآلي متوقف لهذه المحادثة حتى ${waTime(d.bot_paused_until)} — أنت من يرد.`}</div>
    <div class="wa-msgs" id="wa-msgs">${d.messages.map((m) => `<div class="wa-m ${m.from}"><div class="wa-b">${esc(m.text).replace(/\n/g, '<br>')}</div>
      <div class="wa-meta small muted">${m.from === 'bot' ? '🤖 الرد الآلي · ' : m.from === 'staff' ? `👤 ${esc(m.by || 'موظف')} · ` : ''}${waTime(m.at)}${m.status === 'send_failed' ? ' · <b style="color:var(--red)">لم يُرسل</b>' : ''}</div></div>`).join('') || '<div class="empty">لا رسائل</div>'}</div>
    ${d.window_open ? `<form class="wa-compose" id="wa-form"><textarea class="inp" id="wa-text" rows="2" placeholder="اكتب ردك للعميل… (Enter للإرسال، Shift+Enter لسطر جديد)">${esc(draft)}</textarea>
      <button class="btn btn-wa">${I.wa} إرسال</button></form>
      <div class="small muted" style="padding:0 14px 10px">إرسال ردك يوقف الرد الآلي لهذه المحادثة 12 ساعة تلقائياً.</div>`
    : '<div class="wa-closed small"><span>مرّ أكثر من 24 ساعة على آخر رسالة من العميل، وواتساب لا يسمح بالرد الحر الآن. ابدأ برسالة قالب معتمد، ومتى ردّ العميل يُفتح الرد الحر 24 ساعة.</span><button class="btn btn-wa btn-s" id="wa-tpl">إرسال قالب</button></div>'}`;
  if ($('#wa-tpl')) $('#wa-tpl').onclick = () => waStartModal({ to: waPhone(d.wa_id), name: d.name });
  const box = $('#wa-msgs'); if (box) box.scrollTop = box.scrollHeight;
  $('#wa-bot').onclick = async () => {
    try { await api('wa/bot/' + encodeURIComponent(id), { method: 'POST', body: { on: !on } }); toast(on ? 'أُوقف الرد الآلي لهذه المحادثة' : 'عاد الرد الآلي للعمل'); waLoadThread(id); waLoadThreads(id); }
    catch (e) { toast(e.message, 1); }
  };
  const f = $('#wa-form');
  if (f) {
    const ta = $('#wa-text');
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } });
    f.onsubmit = async (e) => {
      e.preventDefault(); const text = ta.value.trim(); if (!text) return;
      const b = $('button', f); b.disabled = true;
      try { await api('wa/send/' + encodeURIComponent(id), { method: 'POST', body: { text } }); ta.value = ''; toast('أُرسل الرد'); await waLoadThread(id); waLoadThreads(id); }
      catch (err) { toast(err.message, 1); b.disabled = false; }
    };
    if (!quiet) ta.focus();
  }
}

// بدء محادثة جديدة (أو إعادة فتح محادثة مغلقة) برسالة قالب معتمد
let waTplCache = null;
async function waStartModal(pre = {}) {
  const m = modal({ title: 'محادثة جديدة عبر واتساب', wide: true, body: '<div class="empty">جارٍ تحميل القوالب المعتمدة…</div>' });
  let d;
  try { d = waTplCache || (waTplCache = await api('wa/templates')); } catch (e) { $('.modal-b', m.el).innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  const list = d.templates.filter((t) => t.name !== 'hello_world');
  if (!list.length) {
    $('.modal-b', m.el).innerHTML = `<div class="wa-note">لا توجد قوالب معتمدة بعد. واتساب يشترط أن تبدأ الشركة أي محادثة بقالب تعتمده Meta مسبقاً.
      ${d.pending.length ? `<br><br>قيد المراجعة الآن: <b class="num">${d.pending.length}</b> قالباً، وتُعتمد عادةً خلال دقائق إلى 24 ساعة.` : ''}</div>`;
    return;
  }
  const catAr = { UTILITY: 'خدمي', MARKETING: 'تسويقي', AUTHENTICATION: 'تحقق' };
  $('.modal-b', m.el).innerHTML = `<form class="fgrid" id="wa-sf" novalidate>
    <label class="f"><span>رقم الجوال <i>*</i></span><input class="inp" name="to" dir="ltr" placeholder="05XXXXXXXX" value="${esc(pre.to || '')}"></label>
    <label class="f"><span>اسم العميل</span><input class="inp" name="cname" value="${esc(pre.name || '')}" placeholder="يظهر في صندوق المحادثات"></label>
    <label class="f full"><span>القالب <i>*</i></span><select class="inp" name="tpl">${list.map((t, i) => `<option value="${i}">${esc(t.name.replace(/^nubl_/, '').replace(/_/g, ' '))} — ${catAr[t.category] || t.category}</option>`).join('')}</select></label>
    <div class="full" id="wa-params"></div>
    <div class="full"><span class="small muted">معاينة الرسالة</span><div class="wa-prev" id="wa-prev"></div></div></form>
    <div class="small muted">الرسالة تُرسل من رقم التسويق 0563413040. القوالب التسويقية تُحتسب بسعر أعلى من الخدمية لدى Meta، فاستخدم الخدمي متى ناسب.</div>`;
  $('.modal-f', m.el) || m.el.querySelector('.modal').insertAdjacentHTML('beforeend', '<div class="modal-f"><button class="btn btn-wa" id="wa-sgo">إرسال</button><button class="btn btn-g" id="wa-sx">إلغاء</button></div>');
  const f = $('#wa-sf', m.el);
  const cur = () => list[+f.tpl.value];
  const vals = () => $$('[data-p]', f).map((x) => x.value.trim());
  const render = () => {
    const t = cur(); let txt = esc(t.text);
    vals().forEach((v, i) => { txt = txt.split(`{{${i + 1}}}`).join(v ? `<b>${esc(v)}</b>` : `<span class="wa-ph">{{${i + 1}}}</span>`); });
    $('#wa-prev', m.el).innerHTML = txt.replace(/\n/g, '<br>') + (t.buttons.length ? `<div class="wa-pbtns">${t.buttons.map((b) => `<span>${esc(b)}</span>`).join('')}</div>` : '');
  };
  const build = () => {
    const t = cur();
    $('#wa-params', m.el).innerHTML = t.params ? `<div class="fgrid">${Array.from({ length: t.params }, (_, i) => `<label class="f"><span>المتغير {{${i + 1}}} <i>*</i></span><input class="inp" data-p="${i}" value="${i === 0 && f.elements.cname.value ? esc(f.elements.cname.value) : ''}"></label>`).join('')}</div>` : '';
    $$('[data-p]', f).forEach((x) => (x.oninput = render)); render();
  };
  f.tpl.onchange = build;
  f.elements.cname.oninput = () => { const p0 = $('[data-p="0"]', f); if (p0 && !p0.dataset.touched) { p0.value = f.elements.cname.value; render(); } };
  f.addEventListener('input', (e) => { if (e.target.dataset.p === '0') e.target.dataset.touched = 1; });
  build();
  $('#wa-sx', m.el).onclick = m.close;
  $('#wa-sgo', m.el).onclick = async (e) => {
    const t = cur(); const params = vals();
    if (params.some((x) => !x)) return toast('املأ كل متغيرات القالب', 1);
    let preview = t.text; params.forEach((v, i) => { preview = preview.split(`{{${i + 1}}}`).join(v); });
    e.target.disabled = true;
    try {
      const r = await api('wa/start', { method: 'POST', body: { to: f.to.value, name: f.elements.cname.value, template: t.name, lang: t.lang, params, preview } });
      m.close(); toast('أُرسلت الرسالة'); location.hash = '#/wa/' + r.wa_id;
    } catch (err) { toast(err.message, 1); e.target.disabled = false; }
  };
}

// إعدادات الملف التجاري على واتساب (للمدير)
async function waSettingsModal() {
  const m = modal({ title: 'إعدادات واتساب — رقم التسويق', wide: true, body: '<div class="empty">جارٍ التحميل…</div>' });
  let d; try { d = await api('wa/profile'); } catch (e) { $('.modal-b', m.el).innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  const p = d.profile, n = d.phone;
  const VAR = { PROF_SERVICES: 'خدمات مهنية', OTHER: 'أخرى', RETAIL: 'تسوق وبيع بالتجزئة', EDU: 'تعليم', EVENT_PLAN: 'تخطيط فعاليات', FINANCE: 'خدمات مالية', APPAREL: 'ملابس', BEAUTY: 'تجميل', ENTERTAIN: 'ترفيه', GROCERY: 'بقالة', HEALTH: 'صحة', HOTEL: 'فنادق', NONPROFIT: 'غير ربحي', RESTAURANT: 'مطاعم', TRAVEL: 'سفر', AUTO: 'سيارات' };
  const nameSt = { APPROVED: 'معتمد', PENDING_REVIEW: 'قيد المراجعة', DECLINED: 'مرفوض', NONE: '—' };
  const ws = p.websites || [];
  $('.modal-b', m.el).innerHTML = `<div class="wa-prof">
    <div class="wa-ph-box"><div class="wa-avatar" id="wa-av">${p.profile_picture_url ? `<img src="${esc(p.profile_picture_url)}" alt="">` : I.wa}</div>
      <label class="btn btn-g btn-s">تغيير الصورة<input type="file" id="wa-file" accept="image/jpeg,image/png" hidden></label>
      <div class="small muted">مربعة، 640×640 بكسل على الأقل، JPG أو PNG، حتى 5 ميجابايت.</div></div>
    <div><b>${esc(n.verified_name || '')}</b> <span class="pill ${n.name_status === 'APPROVED' ? 't' : 'o'}">الاسم: ${nameSt[n.name_status] || esc(n.name_status || '')}</span>
      <div class="small muted num" dir="ltr">${esc(n.display_phone_number || '')}</div>
      <div class="small muted">جودة الرقم: ${esc(n.quality_rating || '—')}</div>
      <div class="small muted">تغيير اسم العرض يتم من مدير واتساب في Meta ويخضع لمراجعة.</div></div></div>
    <form class="fgrid" id="wa-pf" novalidate>
      <label class="f full"><span>النبذة (About) — تظهر تحت الاسم</span><input class="inp" name="about" maxlength="139" value="${esc(p.about || '')}"></label>
      <label class="f full"><span>وصف النشاط</span><textarea class="inp" name="description" maxlength="512" rows="3">${esc(p.description || '')}</textarea></label>
      <label class="f"><span>التصنيف</span><select class="inp" name="vertical">${d.verticals.map((v) => `<option value="${v}" ${p.vertical === v ? 'selected' : ''}>${VAR[v] || v}</option>`).join('')}</select></label>
      <label class="f"><span>البريد الإلكتروني</span><input class="inp" name="email" type="email" dir="ltr" value="${esc(p.email || '')}"></label>
      <label class="f full"><span>العنوان</span><input class="inp" name="address" maxlength="256" value="${esc(p.address || '')}"></label>
      <label class="f"><span>الموقع 1</span><input class="inp" name="w1" dir="ltr" placeholder="https://" value="${esc(ws[0] || '')}"></label>
      <label class="f"><span>الموقع 2</span><input class="inp" name="w2" dir="ltr" placeholder="https://" value="${esc(ws[1] || '')}"></label></form>`;
  m.el.querySelector('.modal').insertAdjacentHTML('beforeend', '<div class="modal-f"><button class="btn btn-p" id="wa-psave">حفظ التعديلات</button><button class="btn btn-g" id="wa-px">إغلاق</button></div>');
  $('#wa-px', m.el).onclick = m.close;
  $('#wa-psave', m.el).onclick = async (e) => {
    const f = $('#wa-pf', m.el);
    const body = { about: f.about.value, description: f.description.value, vertical: f.vertical.value, email: f.email.value, address: f.address.value, websites: [f.w1.value, f.w2.value].filter(Boolean) };
    e.target.disabled = true;
    try { await api('wa/profile', { method: 'POST', body }); toast('حُفظت إعدادات واتساب'); } catch (err) { toast(err.message, 1); }
    e.target.disabled = false;
  };
  $('#wa-file', m.el).onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!/^image\/(jpeg|png)$/.test(file.type)) return toast('الصورة يجب أن تكون JPG أو PNG', 1);
    if (file.size > 5 * 1024 * 1024) return toast('الحد الأقصى 5 ميجابايت', 1);
    const data = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(file); });
    $('#wa-av', m.el).innerHTML = `<img src="data:${file.type};base64,${data}" alt="" style="opacity:.5">`;
    try { await api('wa/photo', { method: 'POST', body: { data, type: file.type } }); toast('تم تحديث الصورة — قد تستغرق دقائق لتظهر للعملاء'); $('img', $('#wa-av', m.el)).style.opacity = 1; }
    catch (err) { toast(err.message, 1); }
  };
}

// التسجيل في القائمة والمسارات
ROUTES.wa = { title: 'صندوق واتساب', render: waView };
(() => {
  const g = NAV.find((x) => x[0] === 'المبيعات و CRM');
  if (g && !g[1].some((i) => i[0] === 'wa')) g[1].unshift(['wa', 'صندوق واتساب', 'wa', '#wa']);
  const orig = navAllowed;
  // eslint-disable-next-line no-global-assign
  navAllowed = (perm) => (perm === '#wa' ? WA_ROLES.includes(me().role) : orig(perm));
})();

(() => {
  const css = `.wa-box{display:grid;grid-template-columns:340px 1fr;gap:14px;height:calc(100vh - 120px);min-height:480px}
  .wa-list,.wa-thread{padding:0;display:flex;flex-direction:column;overflow:hidden}
  .wa-lh{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid var(--line)}
  .wa-lh svg{width:16px;height:16px;color:#1FA855;vertical-align:-3px}
  .wa-threads{overflow:auto;flex:1}
  .wa-ti{display:block;padding:10px 14px;border-bottom:1px solid var(--line);color:inherit}
  .wa-ti:hover{background:var(--soft)}.wa-ti.on{background:#E3F2F1}
  .wa-tn,.wa-tf{display:flex;justify-content:space-between;align-items:center;gap:8px}
  .wa-tp{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:2px 0}
  .wa-th{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line)}
  .wa-th .sp{flex:1}.wa-back{display:none}
  .wa-msgs{flex:1;overflow:auto;padding:14px;background:#EFE9DE;display:flex;flex-direction:column;gap:8px}
  .wa-m{max-width:78%;display:flex;flex-direction:column}
  .wa-m.customer{align-self:flex-start}.wa-m.bot,.wa-m.staff{align-self:flex-end}
  .wa-b{padding:8px 12px;border-radius:12px;background:#fff;box-shadow:0 1px 1px rgba(0,0,0,.06);white-space:normal;word-break:break-word}
  .wa-m.bot .wa-b{background:#DCF5E3}.wa-m.staff .wa-b{background:#D7ECF4}
  .wa-meta{padding:2px 6px}
  .wa-compose{display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--line);align-items:flex-end}
  .wa-compose textarea{flex:1;resize:vertical;min-height:44px}
  .wa-closed{padding:12px 14px;border-top:1px solid var(--line);background:#FBEEE8;color:#A04A1F;display:flex;gap:12px;align-items:center;justify-content:space-between}
  .wa-acts{display:flex;gap:6px}
  .wa-prev{margin-top:6px;padding:12px 14px;border-radius:12px;background:#DCF5E3;line-height:1.8;max-width:520px}
  .wa-ph{color:#A04A1F;background:#FBEEE8;border-radius:4px;padding:0 3px}
  .wa-pbtns{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.wa-pbtns span{background:#fff;border-radius:8px;padding:4px 10px;font-size:.85em;color:#1F8A4C}
  .wa-note{padding:14px;background:var(--soft);border-radius:10px;line-height:1.9}
  .wa-prof{display:flex;gap:18px;align-items:flex-start;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--line)}
  .wa-ph-box{display:flex;flex-direction:column;align-items:center;gap:8px;width:170px;text-align:center}
  .wa-avatar{width:110px;height:110px;border-radius:50%;overflow:hidden;background:var(--soft);display:grid;place-items:center}
  .wa-avatar img{width:100%;height:100%;object-fit:cover}.wa-avatar svg{width:44px;height:44px;color:#1FA855}
  @media(max-width:860px){.wa-prof{flex-direction:column;align-items:center}.wa-closed{flex-direction:column;align-items:stretch}.wa-box{grid-template-columns:1fr;height:auto}.wa-box.has-thread .wa-list{display:none}
    .wa-box:not(.has-thread) .wa-thread{display:none}.wa-back{display:inline-flex}.wa-msgs{max-height:60vh}}`;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
})();
