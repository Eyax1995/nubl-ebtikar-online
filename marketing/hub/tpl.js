/* منصة نُبل وابتكار للتسويق — القوالب وبوت تلجرام (تُحمَّل بعد views.js) */
'use strict';

/* ====================== مهمة جديدة = اختيار قالب ====================== */
async function newFromTemplate(preset = {}, onDone, kinds = ['task']) {
  const { rows } = await api('templates/mine');
  const list = rows.filter((t) => kinds.includes(t.kind || 'task'));
  if (!list.length) return toast('لا توجد قوالب متاحة لدورك — راجع مدير القطاع', 1);
  const cats = [...new Set([...L.tplCat, ...list.map((t) => t.category || 'عام')])].filter((c) => list.some((t) => (t.category || 'عام') === c));
  const card = (t) => `<button type="button" class="tpl" data-t="${t.id}"><span class="e">${esc(t.emoji || '📌')}</span><b>${esc(t.name)}</b>
    ${t.description ? `<span class="small muted">${esc(t.description)}</span>` : ''}
    <span class="m">${t.checklist?.length ? `<span>${t.checklist.length} خطوات</span>` : ''}${t.due_days ? `<span>· تسليم ${t.due_days} يوم</span>` : ''}${t.role ? `<span>· ${esc(optLabel(L.role, t.role))}</span>` : ''}</span></button>`;
  const m = modal({ title: 'اختر القالب', wide: true,
    body: `<div class="search" style="margin-bottom:12px">${I.search}<input class="inp" id="tq" placeholder="ابحث في القوالب…"></div><div id="tl">${cats.map((c) =>
      `<div class="tpl-cat" data-c="${esc(c)}">${esc(c)}</div><div class="tpl-grid" data-g="${esc(c)}">${list.filter((t) => (t.category || 'عام') === c).map(card).join('')}</div>`).join('')}</div>` });
  $('#tq', m.el).oninput = (e) => {
    const q = e.target.value.trim();
    $$('.tpl', m.el).forEach((b) => { b.style.display = !q || b.textContent.includes(q) ? '' : 'none'; });
    $$('.tpl-grid', m.el).forEach((g) => { const any = $$('.tpl', g).some((b) => b.style.display !== 'none'); g.style.display = any ? '' : 'none'; g.previousElementSibling.style.display = any ? '' : 'none'; });
  };
  $$('.tpl', m.el).forEach((b) => b.onclick = () => { m.close(); runTplForm(list.find((t) => t.id == b.dataset.t), preset, onDone); });
}

// تحويل سؤال القالب إلى حقل نموذج
function qToField(q, tpl) {
  const map = { text: 'text', long: 'textarea', client: 'ref', lead: 'ref', date: 'date', select: 'select', user: 'ref', number: 'number', phone: 'phone', link: 'url', sector: 'sector' };
  const f = F(q.k, q.l, map[q.t] || 'text', { req: q.req, w: ['long'].includes(q.t) ? 'full' : undefined });
  if (q.t === 'client') f.ref = 'clients';
  if (q.t === 'lead') f.ref = 'leads';
  if (q.t === 'user') f.ref = 'users';
  if (q.t === 'select') f.o = q.o || [];
  if (q.k === 'due' && tpl.due_days) f.hint = `فارغ = تلقائياً بعد ${tpl.due_days} يوم`;
  if (q.t === 'user') f.hint = 'فارغ = تلقائياً حسب الدور' + (tpl.role ? ` (${optLabel(L.role, tpl.role)})` : '');
  return f;
}

async function runTplForm(tpl, preset = {}, onDone) {
  const qs = tpl.fields || [];
  const fields = qs.filter((q) => !['location', 'photo'].includes(q.t)).map((q) => qToField(q, tpl));
  const hasLoc = qs.some((q) => q.t === 'location'); const photoQ = qs.find((q) => q.t === 'photo');
  await Promise.all([...new Set(fields.filter((f) => f.t === 'ref' && f.ref !== 'users').map((f) => f.ref))].map((r) => refs(r).catch(() => [])));
  const m = modal({ title: `${esc(tpl.emoji || '📌')} ${esc(tpl.name)}`, wide: fields.length > 5,
    body: `${tpl.description ? `<div class="notice">${esc(tpl.description)}</div>` : ''}
      <form class="fgrid" novalidate>${fields.map((f) => `<label class="f ${f.w === 'full' ? 'full' : ''}"><span>${f.l}${f.req ? ' <i>*</i>' : ''}</span>${input(f, preset[f.k])}${f.hint ? `<small class="muted">${esc(f.hint)}</small>` : ''}</label>`).join('')}
      ${photoQ ? `<label class="f"><span>${esc(photoQ.l)}</span><input class="inp" type="file" accept="image/*" capture="environment" name="__photo"></label>` : ''}
      ${hasLoc ? '<div class="f"><span class="small muted" style="display:block;margin-bottom:6px">الموقع الجغرافي</span><button type="button" class="btn btn-g" id="geo">📍 التقاط موقعي</button> <span id="geot" class="small muted"></span></div>' : ''}</form>
      ${tpl.checklist?.length ? `<div class="card" style="margin-top:12px"><h3>${I.check} خطوات هذا القالب</h3><ol class="steps">${tpl.checklist.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}`,
    foot: `<button class="btn btn-p" data-s>${tpl.kind === 'task' || !tpl.kind ? 'إنشاء المهمة' : 'حفظ'}</button><button class="btn btn-g" data-back>→ قالب آخر</button>` });
  let geo = null;
  if (hasLoc) {
    const grab = () => { if (!navigator.geolocation) return; $('#geot', m.el).textContent = 'جارٍ التحديد…';
      navigator.geolocation.getCurrentPosition((p) => { geo = p.coords; $('#geot', m.el).innerHTML = `<span class="num">${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)}</span>`; },
        (e) => { $('#geot', m.el).textContent = 'تعذّر: ' + e.message; }, { enableHighAccuracy: true, timeout: 15000 }); };
    $('#geo', m.el).onclick = grab; grab();
  }
  $('[data-back]', m.el).onclick = () => { m.close(); newFromTemplate(preset, onDone, [tpl.kind || 'task']); };
  $('[data-s]', m.el).onclick = async (e) => {
    const b = e.target; const form = $('form', m.el);
    try {
      const answers = readForm(form, fields);
      for (const f of fields) if (f.req && (answers[f.k] == null || answers[f.k] === '')) throw new Error(`«${f.l}» مطلوب`);
      for (const k of Object.keys(answers)) if (answers[k] == null) delete answers[k];
      b.disabled = true;
      if (photoQ && form.__photo.files[0]) {
        const file = form.__photo.files[0]; const data = await compressImage(file);
        answers[photoQ.k] = (await api('files', { method: 'POST', body: { name: file.name, mime: 'image/jpeg', data } })).id;
      }
      const lq = qs.find((q) => q.t === 'location'); if (lq && geo) answers[lq.k] = { lat: geo.latitude, lng: geo.longitude, acc: geo.accuracy };
      const r = await api(`templates/${tpl.id}/run`, { method: 'POST', body: { answers } });
      invalidate(r.entity); m.close();
      toast(r.entity === 'tasks' ? `أُنشئت المهمة وأُسندت لـ ${userName(r.assignee_id) || 'المكلّف'}` : r.duplicate ? 'الرقم مسجل مسبقاً — أُضيفت ملاحظة لسجله' : 'تم الحفظ');
      onDone ? onDone(r) : rerender();
    } catch (err) { toast(err.message, 1); b.disabled = false; }
  };
}

/* ====================== مكتبة القوالب ====================== */
async function templatesView() {
  const { rows } = await api('e/templates?limit=500');
  const all = rows.map((t) => ({ ...t, fields: parseJ(t.fields, []), checklist: parseJ(t.checklist, []) }));
  const w = can('templates', 'w');
  const kindL = (k) => optLabel(L.tplKind, k || 'task');
  const cats = [...new Set([...L.tplCat, ...all.map((t) => t.category || 'عام')])].filter((c) => all.some((t) => (t.category || 'عام') === c));
  const used = all.reduce((a, t) => a + (Number(t.uses) || 0), 0);
  V().innerHTML = `<div class="grid g4" style="margin-bottom:14px">${kpi('القوالب المفعّلة', n0(all.filter((t) => t.active).length), `${cats.length} أقسام`)}
      ${kpi('مرات الاستخدام', n0(used), 'من المنصة وتلجرام')}${kpi('الأكثر استخداماً', `<span style="font-size:16px;line-height:1.5">${esc([...all].sort((a, b) => (b.uses || 0) - (a.uses || 0))[0]?.name || '—')}</span>`)}
      ${kpi('بوت تلجرام', S.meta.settings.tg_connected ? '<span style="color:var(--teal)">مفعّل</span>' : '<span class="muted">غير مفعّل</span>', S.meta.settings.tg_bot_username ? '@' + esc(S.meta.settings.tg_bot_username) : 'من الإعدادات')}</div>
    <div class="toolbar"><span class="muted">كل مهمة في القطاع تبدأ من قالب: أسئلة ثابتة + خطوات + مسؤول + مدة تسليم. القالب نفسه يعمل في المنصة وفي بوت تلجرام.</span><span class="sp"></span>
      <button class="btn btn-g" id="use">${I.plus} مهمة من قالب</button>${w ? `<button class="btn btn-p" id="add">${I.plus} قالب جديد</button>` : ''}</div>
    ${cats.map((c) => `<div class="tpl-cat">${esc(c)} <span class="pill">${all.filter((t) => (t.category || 'عام') === c).length}</span></div><div class="tpl-grid">${all.filter((t) => (t.category || 'عام') === c).map((t) =>
      `<button type="button" class="tpl ${t.active ? '' : 'off'}" data-t="${t.id}"><span class="e">${esc(t.emoji || '📌')}</span><b>${esc(t.name)}</b>
       ${t.description ? `<span class="small muted">${esc(t.description)}</span>` : ''}
       <span class="m"><span class="pill b">${esc(kindL(t.kind))}</span><span>${t.fields.length} سؤال</span>${t.checklist.length ? `<span>· ${t.checklist.length} خطوات</span>` : ''}${t.due_days ? `<span>· ${t.due_days} يوم</span>` : ''}
       ${t.role ? `<span>· ${esc(optLabel(L.role, t.role))}</span>` : ''}<span>· استُخدم ${t.uses || 0}</span>${t.active ? '' : '<span class="pill x">موقوف</span>'}</span></button>`).join('')}</div>`).join('')}`;
  $('#use').onclick = () => newFromTemplate({}, () => go('#/tasks'));
  $('#add') && ($('#add').onclick = () => openForm('templates', null, { fields: JSON.stringify([{ k: 'client', l: 'العميل', t: 'client' }, { k: 'brief', l: 'المطلوب', t: 'long', req: 1 }, { k: 'due', l: 'موعد التسليم', t: 'date' }, { k: 'assignee', l: 'المكلّف', t: 'user' }]) }, templatesView));
  $$('.tpl').forEach((b) => b.onclick = () => tplDetail(all.find((t) => t.id == b.dataset.t)));
}
function tplDetail(t) {
  const w = can('templates', 'w');
  const m = modal({ title: `${esc(t.emoji || '📌')} ${esc(t.name)}`, wide: true,
    body: `<div class="grid g2"><div class="card"><h3>الأسئلة (${t.fields.length})</h3><ol class="steps">${t.fields.map((q) => `<li>${esc(q.l)} <span class="small muted">— ${esc(optLabel(L.qType, q.t))}${q.req ? ' · مطلوب' : ''}${q.o ? ' · ' + esc(q.o.join('، ')) : ''}</span></li>`).join('')}</ol></div>
      <div class="card"><h3>الخطوات (${t.checklist.length})</h3>${t.checklist.length ? `<ol class="steps">${t.checklist.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : '<div class="empty small">بلا خطوات</div>'}
      <dl class="dl" style="margin-top:12px"><dt>ينشئ</dt><dd>${esc(optLabel(L.tplKind, t.kind || 'task'))}</dd><dt>يُسند إلى</dt><dd>${esc(t.default_assignee_id ? userName(t.default_assignee_id) : optLabel(L.role, t.role || ''))}</dd>
      <dt>الأولوية</dt><dd>${pill(t.priority)}</dd><dt>التسليم</dt><dd>${t.due_days || 0} يوم</dd><dt>صيغة العنوان</dt><dd>${esc(t.title_tpl || '—')}</dd><dt>استُخدم</dt><dd class="num">${t.uses || 0}</dd></dl></div></div>`,
    foot: `${t.active ? '<button class="btn btn-p" data-use>استخدام القالب</button>' : ''}${w ? '<button class="btn btn-g" data-edit>تعديل</button><button class="btn btn-g" data-dup>نسخ</button>' : ''}` });
  $('[data-use]', m.el) && ($('[data-use]', m.el).onclick = async () => { m.close(); const { rows } = await api('templates/mine'); const tt = rows.find((x) => x.id === t.id); if (!tt) return toast('القالب غير متاح لدورك', 1); runTplForm(tt, {}, () => go(t.kind === 'task' || !t.kind ? '#/tasks' : '#/' + ({ lead: 'leads', activity: 'activities', visit: 'visits' }[t.kind]))); });
  $('[data-edit]', m.el) && ($('[data-edit]', m.el).onclick = () => { m.close(); openForm('templates', { ...t, fields: JSON.stringify(t.fields), checklist: JSON.stringify(t.checklist) }, {}, templatesView); });
  $('[data-dup]', m.el) && ($('[data-dup]', m.el).onclick = async () => { await api(`templates/${t.id}/duplicate`, { method: 'POST' }); m.close(); toast('أُنشئت نسخة'); templatesView(); });
}

/* ====================== ربط حسابي بتلجرام ====================== */
async function telegramMine() {
  const u = me();
  if (u.tg_linked) {
    const m = modal({ title: `${I.tg} تلجرام`, body: `<p>حسابك مربوط${u.tg_username ? ` بـ <b dir="ltr">@${esc(u.tg_username)}</b>` : ''}. تصلك إشعارات المهام وملخص الصباح، وتستطيع إنشاء المهام من القوالب داخل البوت.</p>`,
      foot: '<button class="btn btn-p" data-test>إرسال رسالة اختبار</button><button class="btn btn-d" data-un>فك الربط</button>' });
    $('[data-test]', m.el).onclick = async () => { try { await api('telegram/test', { method: 'POST' }); toast('أُرسلت — افتح تلجرام'); } catch (e) { toast(e.message, 1); } };
    $('[data-un]', m.el).onclick = async () => { if (!(await confirmBox('فك ربط تلجرام عن حسابك؟'))) return; await api('telegram/unlink', { method: 'POST' }); S.meta = await api('meta'); m.close(); renderShell(); rerender(); };
    return;
  }
  try {
    const r = await api('telegram/link', { method: 'POST' });
    const m = modal({ title: `${I.tg} ربط حسابك بتلجرام`, body: `<ol class="steps"><li>اضغط الزر بالأسفل (من الجوال أو الكمبيوتر وعليه تلجرام).</li><li>سيُفتح بوت <b dir="ltr">@${esc(r.bot)}</b> — اضغط <b>Start / ابدأ</b>.</li><li>تصلك رسالة «تم ربط حسابك» — ثم ارجع هنا واضغط «تم».</li></ol>
      <p class="small muted" style="margin-top:10px">الرابط شخصي وصالح ${r.expires_in} دقيقة — لا تشاركه.</p>`,
      foot: `<a class="btn btn-p" href="${esc(r.url)}" target="_blank" rel="noopener">${I.tg} فتح البوت والربط</a><button class="btn btn-g" data-done>تم</button>` });
    $('[data-done]', m.el).onclick = async () => { S.meta = await api('meta'); m.close(); renderShell(); rerender(); toast(me().tg_linked ? 'تم الربط ✓' : 'لم يكتمل الربط بعد', !me().tg_linked); };
  } catch (e) { toast(e.message, 1); }
}

/* ====================== إعدادات البوت (للمدير) ====================== */
async function telegramAdminCard(el) {
  if (me().role !== 'admin') { el.remove(); return; }
  let st = { connected: false };
  try { st = await api('telegram/status'); } catch (e) { /* */ }
  if (!st.connected) {
    el.innerHTML = `<h3>${I.tg} بوت تلجرام للفريق</h3><div class="tg-box">
      <ol class="steps"><li>افتح تلجرام وابحث عن <b dir="ltr">@BotFather</b> ← أرسل <code style="display:inline">/newbot</code></li>
      <li>الاسم: <b>نُبل وابتكار للتسويق</b> · اسم المستخدم مثل <b dir="ltr">NublMarketingBot</b> (ينتهي بـ bot)</li>
      <li>انسخ التوكن الذي يرسله BotFather والصقه هنا ثم اضغط «تفعيل».</li></ol>
      <input class="inp" id="tgt" dir="ltr" placeholder="1234567890:AA…" autocomplete="off">
      <button class="btn btn-p" id="tgs">تفعيل البوت وربطه بالمنصة</button>
      <p class="small muted">التوكن يُحفظ في قاعدة بيانات المنصة ولا يظهر لأي مستخدم بعد الحفظ.</p></div>`;
    $('#tgs', el).onclick = async (e) => {
      e.target.disabled = true;
      try { const r = await api('telegram/setup', { method: 'POST', body: { token: $('#tgt', el).value } }); toast(`تم تفعيل @${r.bot}`); S.meta = await api('meta'); telegramAdminCard(el); }
      catch (err) { toast(err.message, 1); e.target.disabled = false; }
    };
    return;
  }
  const wh = st.webhook || {};
  el.innerHTML = `<h3>${I.tg} بوت تلجرام للفريق <span class="pill t">مفعّل</span></h3><div class="tg-box">
    <div><b dir="ltr">@${esc(st.bot)}</b> · ${esc(st.name || '')} — <a href="https://t.me/${esc(st.bot)}" target="_blank" rel="noopener">فتح البوت ↗</a></div>
    <div class="small">أعضاء مربوطون: <b class="num">${st.linked}</b> من <b class="num">${S.meta.users.filter((u) => u.active).length}</b> — كل عضو يربط حسابه من «ربط تلجرام» أسفل القائمة الجانبية.</div>
    ${wh.last_error ? `<div class="notice" style="border-color:var(--red)">آخر خطأ من تلجرام: ${esc(wh.last_error)}</div>` : '<div class="small" style="color:var(--teal)">✓ الاتصال سليم</div>'}
    <div class="small muted">رابط ملخص الصباح (يُستدعى يومياً 7:30 صباحاً من n8n أو أي جدولة):</div><code>${esc(st.digest_url)}</code>
    <div><button class="btn btn-g btn-s" id="tgd">إرسال ملخص الصباح الآن</button> <button class="btn btn-g btn-s" id="tgr">إعادة الضبط</button> <button class="btn btn-d btn-s" id="tgx">إيقاف البوت</button></div></div>`;
  $('#tgd', el).onclick = async () => { const r = await api('telegram/digest', { method: 'POST' }); toast(`أُرسل لـ ${r.sent} عضو`); };
  $('#tgr', el).onclick = async () => { const tok = prompt('الصق التوكن مرة أخرى لإعادة ضبط الاتصال:'); if (!tok) return; try { await api('telegram/setup', { method: 'POST', body: { token: tok } }); toast('أُعيد الضبط'); telegramAdminCard(el); } catch (e) { toast(e.message, 1); } };
  $('#tgx', el).onclick = async () => { if (!(await confirmBox('إيقاف البوت وفصله عن المنصة؟ (روابط الأعضاء تبقى محفوظة)'))) return; await api('telegram/disconnect', { method: 'POST' }); S.meta = await api('meta'); telegramAdminCard(el); };
}

/* ====================== ربط الشاشات القائمة بالقوالب ====================== */
(function patchViews() {
  // المهام: «مهمة جديدة» تفتح مكتبة القوالب + مؤشر الخطوات ومصدر الإنشاء على البطاقة + فلتر القالب
  const baseTasks = tasksView;
  tasksView = async function () {
    const st = (S.tk ||= { who: isBoss() ? '' : String(me().id), mode: 'board' });
    if (st.mode === 'list') {
      await listView('tasks', { extra: '<button class="btn btn-g btn-s" id="tm">عرض لوحة</button>', onAdd: () => newFromTemplate({}, tasksView) });
      $('#tm').onclick = () => { st.mode = 'board'; tasksView(); }; return;
    }
    await refs('templates').catch(() => []);
    await baseTasks();
    const tpls = S.cache.templates?.rows || [];
    const add = $('#add'); if (add) { add.innerHTML = `${I.plus} مهمة من قالب`; add.onclick = () => newFromTemplate({}, tasksView); }
    const { rows } = await api(`e/tasks?limit=1000${st.who ? `&f_assignee_id=${st.who}` : ''}`);
    $$('.kc').forEach((c) => {
      const r = rows.find((x) => x.id == c.dataset.id); if (!r) return;
      const cl = parseJ(r.checklist, []); const d = cl.filter((x) => x.d).length;
      const t = tpls.find((x) => x.id == r.template_id);
      const meta = $('.m', c);
      if (t) meta.insertAdjacentHTML('afterbegin', `<span title="${esc(t.name)}">${esc(t.emoji || '📌')}</span>`);
      if (cl.length) meta.insertAdjacentHTML('beforeend', `<span class="prog"><i style="width:${(d / cl.length) * 100}%"></i></span><span class="num small">${d}/${cl.length}</span>`);
      if (r.source === 'تلجرام') meta.insertAdjacentHTML('beforeend', `<span class="src tgi" title="أُنشئت من تلجرام">${I.tg}</span>`);
    });
    if (st.tpl) $$('.kc').forEach((c) => { const r = rows.find((x) => x.id == c.dataset.id); if (r && String(r.template_id) !== st.tpl) c.remove(); });
    const tb = $('.toolbar'); const sel = document.createElement('select'); sel.className = 'inp';
    sel.innerHTML = `<option value="">كل القوالب</option>${tpls.filter((t) => (t.kind || 'task') === 'task').map((t) => `<option value="${t.id}" ${st.tpl == t.id ? 'selected' : ''}>${esc((t.emoji || '') + ' ' + t.name)}</option>`).join('')}`;
    sel.onchange = () => { st.tpl = sel.value; tasksView(); };
    tb.insertBefore(sel, tb.children[1]);
    $$('.col').forEach((col) => { const n = $$('.kc', col).length; const c = $('.c', col); if (c) c.textContent = n; });
  };

  // يومي: زر سريع
  const baseDay = myDayView;
  myDayView = async function () {
    await baseDay();
    const p = $('#view > p'); if (p && can('tasks', 'w')) p.insertAdjacentHTML('beforeend', ` <button class="btn btn-p btn-s" id="ntpl" style="margin-inline-start:8px">${I.plus} مهمة من قالب</button>`);
    $('#ntpl') && ($('#ntpl').onclick = () => newFromTemplate({}, myDayView));
  };

  // العميل: زر مهمة من قالب داخل تبويب المهام
  const baseClient = clientView;
  clientView = async function (id, tab = 'over') {
    await baseClient(id, tab);
    if (tab === 'tasks' && can('tasks', 'w')) {
      $('#tc').insertAdjacentHTML('afterbegin', `<div class="toolbar"><span class="sp"></span><button class="btn btn-p" id="ctpl">${I.plus} مهمة من قالب لهذا العميل</button></div>`);
      $('#ctpl').onclick = () => newFromTemplate({ client: Number(id) }, () => clientView(id, 'tasks'));
    }
  };

  // الإعدادات: بطاقة البوت
  const baseSettings = settingsView;
  settingsView = async function () {
    await baseSettings();
    const col = $('#view .grid > div:last-child');
    if (col && me().role === 'admin') { col.insertAdjacentHTML('afterbegin', '<div class="card" id="tgcard" style="margin-bottom:14px"><div class="empty small">جارٍ التحميل…</div></div>'); telegramAdminCard($('#tgcard')); }
  };

  // الفريق: عمود تلجرام
  const baseTeam = teamView;
  teamView = async function () {
    await baseTeam();
    const { rows } = await api('e/users');
    const th = $('#view table.t thead tr'); if (!th) return;
    th.children[1].insertAdjacentHTML('afterend', '<th>تلجرام</th>');
    $$('#view table.t tbody tr[data-id]').forEach((tr) => { const u = rows.find((x) => x.id == tr.dataset.id);
      tr.children[1].insertAdjacentHTML('afterend', `<td>${u?.tg_linked ? `<span class="tgi">${I.tg}</span> ${u.tg_username ? `<span dir="ltr" class="small">@${esc(u.tg_username)}</span>` : '✓'}` : '<span class="muted small">غير مربوط</span>'}</td>`); });
  };

  Object.assign(ROUTES, {
    tasks: { ent: 'tasks', render: () => tasksView() },
    myday: { title: 'يومي', render: () => myDayView() },
    client: { title: 'العميل', render: (id, t) => clientView(id, t) },
    settings: { title: 'الإعدادات', render: () => settingsView() },
    team: { title: 'الفريق والصلاحيات', render: () => teamView() },
    templates: { title: 'مكتبة القوالب', render: templatesView },
  });
})();

boot();
