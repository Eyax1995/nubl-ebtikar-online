/* منصة نُبل وابتكار للتسويق — الشاشات الخاصة */
'use strict';
const V = () => $('#view');
const kpi = (l, v, h = '', cls = '') => `<div class="kpi ${cls}"><div class="l">${l}</div><div class="v">${v}</div>${h ? `<div class="h">${h}</div>` : ''}</div>`;
const n0 = (x) => `<span class="num">${nf.format(Number(x) || 0)}</span>`;
function bars(rows, { label = (r) => r.k, val = (r) => r.n, fmt = (x) => nf.format(x), color } = {}) {
  if (!rows?.length) return '<div class="empty small">لا توجد بيانات بعد</div>';
  const max = Math.max(...rows.map(val), 1);
  return `<div class="bars">${rows.map((r) => `<div class="bar"><span>${esc(label(r))}</span><div class="tr"><div class="fl" style="width:${(val(r) / max) * 100}%;${color ? 'background:' + color : ''}"></div></div><span class="val num">${fmt(val(r))}</span></div>`).join('')}</div>`;
}
function seasonLine(s) {
  const planBy = addDays(s.date, -(s.plan_days || 42)); const printBy = addDays(s.date, -(s.print_days || 28));
  const t = todayStr(); const warn = planBy <= t ? 'color:var(--red)' : '';
  return `<div class="list-i"><span class="star" style="color:var(--gold)"></span><div class="g"><b>${esc(s.name)}</b>
    <span class="small muted">${fdate(s.date)} · الخطة قبل <span style="${warn}">${fdate(planBy)}</span> · المطبوعات قبل ${fdate(printBy)}</span></div>
    <span class="pill g">${relDays(s.date)}</span></div>`;
}

/* ====================== لوحة القيادة ====================== */
async function dashboardView() {
  const d = await api('dashboard');
  const st = Object.fromEntries((d.pipeline || []).map((p) => [p.k, p]));
  const winRate = d.deals && (d.deals.won90 + d.deals.lost90) ? Math.round(d.deals.won90 * 100 / (d.deals.won90 + d.deals.lost90)) + '%' : '—';
  const k = [];
  if (d.leads) k.push(kpi('عملاء محتملون', n0(d.leads.total), `${n0(d.leads.month)} جديد هذا الشهر`), kpi('متابعات مستحقة', n0(d.leads.due), 'اليوم وما قبله', d.leads.due ? 'warn' : ''));
  if (d.deals) k.push(kpi('قيمة خط المبيعات', n0(d.deals.open_value) + '<small>ر.س</small>', `المرجّح ${moneyTxt(d.deals.weighted)} ر.س`), kpi('مكسوب هذا الشهر', n0(d.deals.won_month_value) + '<small>ر.س</small>', `${d.deals.won_month} صفقة · نسبة الفوز (90 يوماً) ${winRate}`, 'good'));
  if (d.contracts) k.push(kpi('الإيراد الشهري المتكرر', n0(d.contracts.mrr) + '<small>ر.س</small>', `${d.contracts.active} عقد نشط`));
  if (d.money) k.push(kpi('المستحقات', n0(d.money.receivable) + '<small>ر.س</small>', `متأخر ${moneyTxt(d.money.overdue)} ر.س (${d.money.overdue_n})`, d.money.overdue ? 'warn' : ''),
    kpi('المحصّل هذا الشهر', n0(d.collected.s) + '<small>ر.س</small>', `مصروفات ${moneyTxt(d.expensesMonth.s)} ر.س`, 'good'));
  if (d.tasks) k.push(kpi('مهام مفتوحة', n0(d.tasks.open), `${d.tasks.overdue || 0} متأخرة · ${d.tasks.week || 0} هذا الأسبوع`, d.tasks.overdue ? 'warn' : ''));
  if (d.content) k.push(kpi('محتوى هذا الأسبوع', n0(d.content.week), `${d.content.approval || 0} بانتظار اعتماد · ${d.content.late || 0} متأخر`, d.content.late ? 'warn' : ''));
  if (d.tasks && d.tasks.done_month) k.push(kpi('الالتزام بالمواعيد', Math.round((d.tasks.ontime_month / d.tasks.done_month) * 100) + '%', 'المستهدف ≥ 95%', d.tasks.ontime_month / d.tasks.done_month >= 0.95 ? 'good' : 'warn'));
  const cards = [];
  if (d.pipeline) cards.push(`<div class="card"><h3>${I.funnel} خط المبيعات حسب المرحلة<span class="sp"></span><a href="#/pipeline" class="small">فتح ←</a></h3>
    ${bars(L.stages.map((s) => ({ k: s, n: st[s]?.n || 0, v: st[s]?.v || 0 })), { val: (r) => r.v, fmt: (x) => moneyTxt(x), label: (r) => `${r.k} (${r.n})` })}</div>`);
  if (d.revenue) cards.push(`<div class="card"><h3>${I.cash} التحصيل — آخر 6 أشهر</h3>${d.revenue.length ? `<div class="vbars">${(() => { const mx = Math.max(...d.revenue.map((r) => r.v), 1);
    return d.revenue.map((r) => `<div class="vb"><span class="num">${moneyTxt(Math.round(r.v))}</span><i style="height:${(r.v / mx) * 100}%"></i><span>${MONTHS[+r.k.slice(5) - 1]}</span></div>`).join(''); })()}</div>` : '<div class="empty small">لا مدفوعات مسجلة بعد</div>'}</div>`);
  if (d.leadSources) cards.push(`<div class="card"><h3>${I.users} مصادر العملاء المحتملين</h3>${bars(d.leadSources, { color: 'var(--teal)' })}</div>`);
  if (d.stale?.length) cards.push(`<div class="card"><h3>${I.funnel} صفقات راكدة<span class="sp"></span><span class="pill r">${d.stale.length}</span></h3>${d.stale.map((x) =>
    `<a class="list-i" href="#/pipeline"><div class="g"><b>${esc(x.title)}</b><span class="small muted">${esc(x.stage)} · آخر تحديث ${fdate(x.updated_at)}</span></div>${money(x.value)}</a>`).join('')}</div>`);
  if (d.renewals) cards.push(`<div class="card"><h3>${I.sign} تجديدات خلال 30 يوماً</h3>${d.renewals.length ? d.renewals.map((x) =>
    `<a class="list-i" href="#/contract/${x.id}"><div class="g"><b>${esc(x.client || '')}</b><span class="small muted">${esc(x.number)} · ينتهي ${fdate(x.end_date)}</span></div>${money(x.monthly_value)}</a>`).join('') : '<div class="empty small">لا تجديدات قريبة</div>'}</div>`);
  cards.push(`<div class="card"><h3>${I.star} المواسم القادمة<span class="sp"></span><a href="#/seasons" class="small">الكل ←</a></h3>${(d.seasons || []).map(seasonLine).join('') || '<div class="empty small">—</div>'}</div>`);
  V().innerHTML = `<div class="grid g4">${k.join('')}</div><div class="grid g2" style="margin-top:14px">${cards.join('')}</div>`;
}

/* ====================== يومي ====================== */
async function myDayView() {
  const d = await api('myday');
  const sec = (title, icon, items, empty) => `<div class="card"><h3>${I[icon]} ${title}<span class="sp"></span>${items.length ? `<span class="pill o">${items.length}</span>` : ''}</h3>${items.length ? items.join('') : `<div class="empty small">${empty}</div>`}</div>`;
  const cards = [];
  cards.push(sec('مهامي المستحقة', 'check', d.tasks.map((t) => `<div class="list-i" data-task="${t.id}"><div class="g"><b>${esc(t.title)}</b><span class="small muted">${esc(t.client || '')} · ${t.due_date ? relDays(t.due_date) : 'بلا موعد'}</span></div>${pill(t.status)}
    <button class="btn btn-g btn-s" data-done="${t.id}">✓ إنجاز</button></div>`), 'لا مهام مستحقة — يوم موفّق'));
  if (d.followups) cards.push(sec('متابعات العملاء المحتملين', 'users', d.followups.map((l) => `<div class="list-i"><div class="g"><a href="#/lead/${l.id}"><b>${esc(l.company || l.name)}</b></a><span class="small muted">${esc(l.name || '')} · ${relDays(l.next_followup)}</span></div>
    ${l.phone ? `<a class="btn btn-wa btn-s" target="_blank" rel="noopener" href="${waLink(l.phone)}">${I.wa}</a>` : ''}<a class="btn btn-g btn-s" href="#/lead/${l.id}">فتح</a></div>`), 'لا متابعات مستحقة'));
  cards.push(sec('محتوى خلال 3 أيام', 'cal', d.content.map((c) => `<div class="list-i"><div class="g"><b>${esc(c.title)}</b><span class="small muted">${esc(c.client || '')} · ${esc(c.platform || '')} · ${relDays(c.publish_date)}</span></div>${pill(c.status)}</div>`), 'لا محتوى مستحق عليك'));
  if (d.invoices) cards.push(sec('فواتير مستحقة', 'bill', d.invoices.map((i) => `<a class="list-i" href="#/invoice/${i.id}"><div class="g"><b>${esc(i.client || '')}</b><span class="small muted">${esc(i.number)} · ${relDays(i.due_date)}</span></div>${money(i.total - i.paid)}</a>`), 'لا فواتير مستحقة'));
  if (d.reports) cards.push(sec('تقارير شهرية مستحقة', 'chart', d.reports.map((c) => `<a class="list-i" href="#/client/${c.id}"><div class="g"><b>${esc(c.name)}</b><span class="small muted">يوم التقرير: ${c.report_day}</span></div></a>`), 'لا تقارير مستحقة هذه الأيام'));
  if (d.seasons.length) cards.push(sec('مواعيد مواسم حرجة', 'star', d.seasons.map(seasonLine), ''));
  V().innerHTML = `<p class="muted" style="margin-bottom:12px">صباح الخير ${esc(me().name)} — هذا ما يحتاج انتباهك اليوم ${fdate(d.today)}.</p><div class="grid g2">${cards.join('')}</div>`;
  $$('[data-done]').forEach((b) => b.onclick = async () => { await api(`e/tasks/${b.dataset.done}`, { method: 'PUT', body: { status: 'منجزة' } }); toast('أحسنت ✓'); myDayView(); });
}

/* ====================== العميل المحتمل ====================== */
function logActivity(preset, onDone) {
  return openForm('activities', null, { at: new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 16).replace('T', ' '), ...preset }, onDone);
}
async function leadView(id) {
  await Promise.all([refs('clients').catch(() => []), refs('deals').catch(() => [])]);
  const { row: l } = await api(`e/leads/${id}`);
  const tl = await api(`timeline/lead/${id}`);
  const deals = (S.cache.deals?.rows || []).filter((x) => x.lead_id == id);
  $('#ptitle').textContent = l.company || l.name;
  const dl = ENT.leads.fields.filter((f) => f.k !== 'notes').map((f) => `<dt>${f.l}</dt><dd>${cell(f, l) || '—'}</dd>`).join('');
  V().innerHTML = `<div class="toolbar"><a href="#/leads" class="btn btn-g btn-s">→ العملاء المحتملون</a><span class="sp"></span>
    ${l.phone ? `<a class="btn btn-wa" target="_blank" rel="noopener" href="${waLink(l.phone)}">${I.wa} واتساب</a><a class="btn btn-g" href="tel:+${esc(l.phone)}">${I.phone} اتصال</a>` : ''}
    <button class="btn btn-n" id="log">${I.chat} توثيق تواصل</button>
    ${can('deals', 'w') ? '<button class="btn btn-g" id="deal">+ صفقة</button>' : ''}
    ${can('quotes', 'w') ? '<button class="btn btn-g" id="quote">+ عرض سعر</button>' : ''}
    ${!l.client_id && can('clients', 'w') ? '<button class="btn btn-g" id="conv">تحويل لعميل</button>' : l.client_id ? `<a class="btn btn-g" href="#/client/${l.client_id}">ملف العميل ←</a>` : ''}
    <button class="btn btn-g" id="edit">تعديل</button></div>
    <div class="grid g2"><div class="card"><h3>${esc(l.name || '')} ${pill(l.status)} ${pill(l.interest)}</h3><dl class="dl">${dl}</dl>
      ${l.notes ? `<p style="margin-top:12px;white-space:pre-wrap" class="muted">${esc(l.notes)}</p>` : ''}</div>
    <div><div class="card"><h3>${I.funnel} الصفقات</h3>${deals.length ? deals.map((x) => `<div class="list-i"><div class="g"><b>${esc(x.title)}</b><span class="small muted">${esc(x.stage)}</span></div>${money(x.value)}</div>`).join('') : '<div class="empty small">لا صفقات بعد</div>'}</div>
      <div class="card" style="margin-top:14px"><h3>${I.spark} ذكاء نُبل<span class="sp"></span><button class="btn btn-g btn-s" data-ai="followup">رسالة متابعة</button><button class="btn btn-g btn-s" data-ai="summary">تلخيص السجل</button></h3><div id="aiout" class="muted small">اقتراحات مولّدة آلياً — راجعها قبل الإرسال.</div></div></div></div>
    <div class="card" style="margin-top:14px"><h3>${I.chat} السجل الزمني</h3>${timelineHtml(tl)}</div>`;
  $('#edit').onclick = () => openForm('leads', l, {}, () => leadView(id));
  $('#log').onclick = () => logActivity({ lead_id: l.id }, () => leadView(id));
  $('#deal') && ($('#deal').onclick = () => openForm('deals', null, { lead_id: l.id, title: `${l.company || l.name} — باقة تسويق`, sector: l.sector, owner_id: l.owner_id || me().id }, () => { invalidate('deals'); leadView(id); }));
  $('#quote') && ($('#quote').onclick = () => go(`#/quote/new?lead=${l.id}`));
  $('#conv') && ($('#conv').onclick = async () => { if (!(await confirmBox('تحويل هذا العميل المحتمل إلى عميل فعلي؟'))) return; const r = await api(`leads/${l.id}/convert`, { method: 'POST' }); invalidate('clients'); toast('تم إنشاء ملف العميل'); go(`#/client/${r.client_id}`); });
  $$('[data-ai]').forEach((b) => b.onclick = () => runAi(b.dataset.ai, `الاسم: ${l.name || ''}\nالمنشأة: ${l.company || ''}\nالقطاع: ${sectorName(l.sector)}\nالحالة: ${l.status}\nملاحظات: ${l.notes || ''}\nآخر التواصل:\n${tl.activities.slice(0, 8).map((a) => `- ${a.at?.slice(0, 10)} ${a.kind}: ${a.outcome || ''} ${a.notes || ''}`).join('\n')}`, '#aiout'));
}
function timelineHtml(tl) {
  const items = [...tl.activities.map((a) => ({ at: a.at, h: `${esc(a.kind || '')}${a.outcome ? ' · ' + esc(a.outcome) : ''} — ${esc(a.user_name || '')}`, b: [a.subject, a.notes, a.next_step && `الخطوة التالية: ${a.next_step}${a.next_date ? ' (' + a.next_date + ')' : ''}`].filter(Boolean).join('\n') })),
    ...tl.visits.map((v) => ({ at: v.at, h: `زيارة ميدانية — ${esc(v.user_name || '')}`, b: `${v.place_name || ''}${v.notes ? '\n' + v.notes : ''}`, photo: v.photo_id, geo: v.lat && `${v.lat},${v.lng}` }))]
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  if (!items.length) return '<div class="empty small">لا يوجد تواصل موثّق بعد — القاعدة: كل تواصل يُوثَّق في اليوم نفسه.</div>';
  return `<div class="tl">${items.map((i) => `<div class="tl-i"><div class="h">${fdate(i.at)} · ${i.h}</div><div class="b">${esc(i.b || '—')}${i.geo ? `\n<a target="_blank" rel="noopener" href="https://maps.google.com/?q=${i.geo}">📍 الموقع</a>` : ''}${i.photo ? ` · <a target="_blank" href="${API}files/${i.photo}">صورة الإثبات</a>` : ''}</div></div>`).join('')}</div>`;
}
async function runAi(action, context, target) {
  const el = $(target); el.className = 'ai-box'; el.textContent = 'جارٍ التوليد…';
  try { const r = await api('ai', { method: 'POST', body: { action, context } }); el.textContent = r.text || '—'; }
  catch (e) { el.className = 'muted small'; el.textContent = e.message; }
}

/* ====================== خط المبيعات (كانبان) ====================== */
async function pipelineView() {
  await refs('leads').catch(() => []); await refs('clients').catch(() => []);
  const st = (S.pipe ||= { owner: '', mode: 'board' });
  const qs = st.owner ? `&f_owner_id=${st.owner}` : '';
  const { rows } = await api(`e/deals?limit=1000${qs}`);
  V().innerHTML = `<div class="toolbar"><select class="inp" id="own"><option value="">كل المسؤولين</option>${S.meta.users.filter((u) => u.active).map((u) => `<option value="${u.id}" ${st.owner == u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>
    <button class="btn btn-g btn-s" id="mode">${st.mode === 'board' ? 'عرض جدول' : 'عرض لوحة'}</button><span class="sp"></span>
    <span class="muted small">اسحب البطاقة لتغيير المرحلة</span>${can('deals', 'w') ? `<button class="btn btn-p" id="add">${I.plus} صفقة جديدة</button>` : ''}</div><div id="board"></div>`;
  $('#own').onchange = (e) => { st.owner = e.target.value; pipelineView(); };
  $('#mode').onclick = () => { st.mode = st.mode === 'board' ? 'list' : 'board'; st.mode === 'list' ? listView('deals') : pipelineView(); };
  $('#add') && ($('#add').onclick = () => openForm('deals', null, { owner_id: me().id }, () => pipelineView()));
  const cols = L.stages.map((s) => { const items = rows.filter((r) => r.stage === s); const sum = items.reduce((a, r) => a + (+r.value || 0), 0);
    return `<div class="col" data-stage="${s}"><div class="col-h">${pill(s)}<span class="c num">${items.length}</span><span class="s num">${moneyTxt(sum)}</span></div>
      ${items.map((r) => `<div class="kc" draggable="true" data-id="${r.id}"><b>${esc(r.title)}</b><div class="m">${money(r.value)}<span>·</span><span>${esc(userName(r.owner_id))}</span>
      ${r.expected_close ? `<span>· ${fdate(r.expected_close)}</span>` : ''}${r.lead_id ? `<span>· ${esc(refLabel('leads', r.lead_id))}</span>` : ''}</div></div>`).join('')}</div>`; }).join('');
  $('#board').innerHTML = `<div class="kanban">${cols}</div>`;
  kanbanDnD('#board', 'deals', 'stage', rows, async (row, to) => {
    const body = { stage: to };
    if (to === 'خاسرة') { const r = await pickOne('سبب الخسارة', L.loss); if (!r) return false; body.loss_reason = r; }
    return body;
  }, pipelineView);
}
function pickOne(title, opts) {
  return new Promise((res) => {
    const m = modal({ title, body: `<select class="inp">${opts.map((o) => `<option>${esc(o)}</option>`).join('')}</select>`, foot: '<button class="btn btn-p">تأكيد</button>' });
    $('.btn-p', m.el).onclick = () => { const v = $('select', m.el).value; m.close(); res(v); };
    $('.x', m.el).addEventListener('click', () => res(null));
  });
}
function kanbanDnD(root, ent, field, rows, beforeMove, reload) {
  let dragId = null;
  $$(`${root} .kc`).forEach((c) => {
    c.addEventListener('dragstart', () => { dragId = c.dataset.id; c.style.opacity = .5; });
    c.addEventListener('dragend', () => { c.style.opacity = 1; });
    c.addEventListener('click', () => openForm(ent, rows.find((r) => r.id == c.dataset.id), {}, reload));
  });
  $$(`${root} .col`).forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault(); col.classList.remove('over');
      const row = rows.find((r) => r.id == dragId); const to = col.dataset.stage;
      if (!row || row[field] === to) return;
      try {
        const body = beforeMove ? await beforeMove(row, to) : { [field]: to };
        if (body === false) return;
        await api(`e/${ent}/${row.id}`, { method: 'PUT', body }); invalidate(ent); toast('تم النقل'); reload();
      } catch (err) { toast(err.message, 1); }
    });
  });
}

/* ====================== المهام (كانبان) ====================== */
async function tasksView() {
  await refs('clients').catch(() => []);
  const st = (S.tk ||= { who: isBoss() ? '' : String(me().id), mode: 'board' });
  if (st.mode === 'list') { await listView('tasks', { extra: '<button class="btn btn-g btn-s" id="tm">عرض لوحة</button>' }); $('#tm').onclick = () => { st.mode = 'board'; tasksView(); }; return; }
  const qs = st.who ? `&f_assignee_id=${st.who}` : '';
  const { rows } = await api(`e/tasks?limit=1000${qs}`);
  const t = todayStr();
  V().innerHTML = `<div class="toolbar"><select class="inp" id="who"><option value="">كل الفريق</option>${S.meta.users.filter((u) => u.active).map((u) => `<option value="${u.id}" ${st.who == u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>
    <button class="btn btn-g btn-s" id="tm">عرض جدول</button><span class="sp"></span>${can('tasks', 'w') ? `<button class="btn btn-p" id="add">${I.plus} مهمة</button>` : ''}</div>
    <div class="kanban" id="kb">${L.taskStatus.map((s) => { const items = rows.filter((r) => r.status === s && (s !== 'منجزة' || !r.done_at || r.done_at >= addDays(t, -14)));
      return `<div class="col" data-stage="${s}"><div class="col-h">${pill(s)}<span class="c num">${items.length}</span></div>${items.map((r) =>
      `<div class="kc ${r.due_date && r.due_date < t && s !== 'منجزة' ? 'late' : ''}" draggable="true" data-id="${r.id}"><b>${esc(r.title)}</b><div class="m">${pill(r.priority)}
      <span>${esc(refLabel('clients', r.client_id))}</span>${r.due_date ? `<span>· ${relDays(r.due_date)}</span>` : ''}<span>· ${esc(userName(r.assignee_id))}</span>${r.revisions ? `<span class="pill r">تعديل ${r.revisions}</span>` : ''}</div></div>`).join('')}</div>`; }).join('')}</div>`;
  $('#who').onchange = (e) => { st.who = e.target.value; tasksView(); };
  $('#tm').onclick = () => { st.mode = 'list'; tasksView(); };
  $('#add') && ($('#add').onclick = () => openForm('tasks', null, { assignee_id: me().id }, tasksView));
  kanbanDnD('#view', 'tasks', 'status', rows, null, tasksView);
}

/* ====================== تقويم المحتوى ====================== */
async function contentView() {
  await refs('clients').catch(() => []);
  const st = (S.ct ||= { month: todayStr().slice(0, 7), client: '' });
  const [y, m] = st.month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)); const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = `${st.month}-01`; const to = `${st.month}-${String(days).padStart(2, '0')}`;
  const qs = new URLSearchParams({ limit: 2000, gte_publish_date: addDays(from, -7), lte_publish_date: addDays(to, 7) });
  if (st.client) qs.set('f_client_id', st.client);
  const [{ rows }, seas] = await Promise.all([api(`e/content?${qs}`), api(`e/seasons?gte_date=${from}&lte_date=${to}`).catch(() => ({ rows: [] }))]);
  const startDow = (first.getUTCDay() + 1) % 7; // السبت أول الأسبوع
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push('<div class="d o"></div>');
  for (let d = 1; d <= days; d++) {
    const ds = `${st.month}-${String(d).padStart(2, '0')}`;
    const evs = rows.filter((r) => r.publish_date?.slice(0, 10) === ds);
    const ss = seas.rows.filter((s) => s.date === ds);
    cells.push(`<div class="d ${ds === todayStr() ? 'today' : ''}"><div class="dn"><span class="num">${d}</span>${can('content', 'w') ? `<button data-add="${ds}" title="إضافة">+</button>` : ''}</div>
      ${ss.map((s) => `<span class="ev season">${esc(s.name)}</span>`).join('')}
      ${evs.map((e) => `<span class="ev s-${esc(e.status)}" data-id="${e.id}" title="${esc(e.title)}">${esc(refLabel('clients', e.client_id))}: ${esc(e.title)}</span>`).join('')}</div>`);
  }
  while (cells.length % 7) cells.push('<div class="d o"></div>');
  const monthRows = rows.filter((r) => r.publish_date >= from && r.publish_date <= to);
  const byStatus = L.contentStatus.map((s) => [s, monthRows.filter((r) => r.status === s).length]).filter(([, n]) => n);
  V().innerHTML = `<div class="toolbar"><button class="btn btn-g btn-s" data-mv="-1">→</button><b style="min-width:120px;text-align:center">${MONTHS[m - 1]} <span class="num">${y}</span></b><button class="btn btn-g btn-s" data-mv="1">←</button>
    <select class="inp" id="cl"><option value="">كل العملاء</option>${(S.cache.clients?.rows || []).map((c) => `<option value="${c.id}" ${st.client == c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <span class="sp"></span>${byStatus.map(([s, n]) => `${pill(s)}<span class="num small">${n}</span>`).join(' ')}
    <button class="btn btn-g btn-s" id="lst">عرض جدول</button>${can('content', 'w') ? `<button class="btn btn-p" id="add">${I.plus} منشور</button>` : ''}</div>
    <div class="cal">${['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((d) => `<div class="dh">${d}</div>`).join('')}${cells.join('')}</div>`;
  $$('[data-mv]').forEach((b) => b.onclick = () => { const d = new Date(Date.UTC(y, m - 1 + +b.dataset.mv, 1)); st.month = d.toISOString().slice(0, 7); contentView(); });
  $('#cl').onchange = (e) => { st.client = e.target.value; contentView(); };
  $('#lst').onclick = () => listView('content', { fixed: st.client ? { client_id: st.client } : {} });
  $('#add') && ($('#add').onclick = () => openForm('content', null, { client_id: st.client || undefined, publish_date: todayStr(), assignee_id: me().id }, contentView));
  $$('[data-add]').forEach((b) => b.onclick = () => openForm('content', null, { client_id: st.client || undefined, publish_date: b.dataset.add, assignee_id: me().id }, contentView));
  $$('.ev[data-id]').forEach((e) => e.onclick = () => openForm('content', rows.find((r) => r.id == e.dataset.id), {}, contentView));
}

/* ====================== الزيارات الميدانية ====================== */
async function visitsView() {
  await listView('visits', {
    onAdd: newVisit,
    rowActions: (r) => (r.lat ? `<a class="btn btn-g btn-s" target="_blank" rel="noopener" href="https://maps.google.com/?q=${r.lat},${r.lng}">📍</a>` : '') + (r.photo_id ? ` <a class="btn btn-g btn-s" target="_blank" href="${API}files/${r.photo_id}">صورة</a>` : ''),
  });
}
async function compressImage(file, max = 1280, q = 0.7) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q).split(',')[1];
}
async function newVisit() {
  await refs('leads').catch(() => []); await refs('clients').catch(() => []);
  const fields = ENT.visits.fields.filter((f) => !['at', 'user_id'].includes(f.k));
  const m = modal({ title: 'تسجيل زيارة ميدانية', wide: true,
    body: `<div class="notice">الزيارة تُثبت بالموقع الجغرافي وصورة من المكان — افتح الصفحة من جوالك أثناء الزيارة.</div>
      <form class="fgrid">${fields.map((f) => `<label class="f ${f.w === 'full' ? 'full' : ''}"><span>${f.l}${f.req ? ' <i>*</i>' : ''}</span>${input(f, '')}</label>`).join('')}
      <label class="f"><span>صورة الإثبات</span><input class="inp" type="file" accept="image/*" capture="environment" name="photo"></label>
      <div class="f"><span class="small muted" style="display:block;margin-bottom:6px">الموقع الجغرافي</span><button type="button" class="btn btn-g" id="geo">📍 التقاط موقعي</button> <span id="geot" class="small muted"></span></div></form>`,
    foot: '<button class="btn btn-p" data-s>حفظ الزيارة</button>' });
  let geo = null;
  const grab = () => { if (!navigator.geolocation) return; $('#geot', m.el).textContent = 'جارٍ التحديد…';
    navigator.geolocation.getCurrentPosition((p) => { geo = p.coords; $('#geot', m.el).innerHTML = `<span class="num">${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)}</span> (±${Math.round(geo.accuracy)}م)`; },
      (e) => { $('#geot', m.el).textContent = 'تعذّر: ' + e.message; }, { enableHighAccuracy: true, timeout: 15000 }); };
  $('#geo', m.el).onclick = grab; grab();
  $('[data-s]', m.el).onclick = async (e) => {
    const b = e.target; const f = $('form', m.el);
    try {
      const vals = readForm(f, fields); if (!vals.place_name) throw new Error('اسم المنشأة مطلوب');
      b.disabled = true;
      const file = f.photo.files[0];
      if (file) { const data = await compressImage(file); const r = await api('files', { method: 'POST', body: { name: file.name, mime: 'image/jpeg', data } }); vals.photo_id = r.id; }
      if (geo) Object.assign(vals, { lat: geo.latitude, lng: geo.longitude, accuracy: geo.accuracy });
      vals.at = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
      await api('e/visits', { method: 'POST', body: vals }); toast('تم تسجيل الزيارة'); m.close(); visitsView();
    } catch (err) { toast(err.message, 1); b.disabled = false; }
  };
}

/* ====================== العميل ====================== */
async function clientView(id, tab = 'over') {
  const { row: c } = await api(`e/clients/${id}`);
  $('#ptitle').textContent = c.name;
  const tabs = [['over', 'نظرة عامة'], can('contracts') && ['contracts', 'العقود'], can('invoices') && ['invoices', 'الفواتير'], ['tasks', 'المهام'], can('content') && ['content', 'المحتوى'], can('activities') && ['log', 'السجل']].filter(Boolean);
  V().innerHTML = `<div class="toolbar"><a href="#/clients" class="btn btn-g btn-s">→ العملاء</a><span class="sp"></span>
    ${c.phone ? `<a class="btn btn-wa" target="_blank" rel="noopener" href="${waLink(c.phone)}">${I.wa} واتساب</a>` : ''}
    ${can('activities', 'w') ? `<button class="btn btn-n" id="log">${I.chat} توثيق تواصل</button>` : ''}
    ${can('quotes', 'w') ? `<button class="btn btn-g" id="q">+ عرض سعر</button>` : ''}
    ${can('contracts', 'w') ? `<button class="btn btn-g" id="ct">+ عقد</button>` : ''}
    ${can('clients', 'w') ? '<button class="btn btn-g" id="edit">تعديل</button>' : ''}</div>
    <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${k === tab ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div><div id="tc"></div>`;
  $$('.tab').forEach((b) => b.onclick = () => clientView(id, b.dataset.t));
  $('#edit') && ($('#edit').onclick = () => openForm('clients', c, {}, () => clientView(id, tab)));
  $('#log') && ($('#log').onclick = () => logActivity({ client_id: c.id }, () => clientView(id, 'log')));
  $('#q') && ($('#q').onclick = () => go(`#/quote/new?client=${c.id}`));
  $('#ct') && ($('#ct').onclick = () => openForm('contracts', null, { client_id: c.id, start_date: todayStr(), owner_id: me().id }, () => clientView(id, 'contracts')));
  const tc = $('#tc');
  const sub = async (ent, cols, onRow) => {
    const { rows } = await api(`e/${ent}?f_client_id=${id}&limit=500`);
    const fs = ENT[ent].fields.filter((f) => cols.includes(f.k));
    tc.innerHTML = rows.length ? `<div class="tbl-wrap"><table class="t"><thead><tr>${fs.map((f) => `<th>${f.l}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr data-id="${r.id}">${fs.map((f) => `<td>${cell(f, r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      : '<div class="card"><div class="empty">لا سجلات</div></div>';
    $$('tbody tr', tc).forEach((tr) => tr.onclick = () => onRow(rows.find((r) => r.id == tr.dataset.id)));
  };
  if (tab === 'over') {
    const fs = ENT.clients.fields.filter((f) => !['notes', 'socials'].includes(f.k));
    tc.innerHTML = `<div class="grid g2"><div class="card"><h3>${esc(c.name)} ${pill(c.status)} ${pill(c.health)}</h3><dl class="dl">${fs.map((f) => `<dt>${f.l}</dt><dd>${cell(f, c) || '—'}</dd>`).join('')}</dl></div>
      <div><div class="card"><h3>حسابات التواصل</h3>${c.socials ? c.socials.split('\n').filter(Boolean).map((s) => `<div class="list-i"><a href="${esc(s.trim())}" target="_blank" rel="noopener" dir="ltr">${esc(s.trim())}</a></div>`).join('') : '<div class="empty small">لم تُسجّل بعد</div>'}</div>
      <div class="card" style="margin-top:14px"><h3>ملاحظات</h3><p style="white-space:pre-wrap" class="muted">${esc(c.notes || '—')}</p></div>
      ${can('content', 'w') ? `<div class="card" style="margin-top:14px"><h3>${I.spark} ذكاء نُبل<span class="sp"></span><button class="btn btn-g btn-s" id="ideas">أفكار محتوى للشهر القادم</button></h3><div id="aiout" class="muted small">اقتراحات أولية للنقاش — لا تُنشر دون مراجعة.</div></div>` : ''}</div></div>`;
    $('#ideas') && ($('#ideas').onclick = () => runAi('ideas', `العميل: ${c.name}\nالقطاع: ${sectorName(c.sector)}\nالباقة: ${c.package || ''}\nملاحظات: ${c.notes || ''}`, '#aiout'));
  }
  if (tab === 'contracts') await sub('contracts', ['number', 'title', 'start_date', 'end_date', 'monthly_value', 'status'], (r) => go(`#/contract/${r.id}`));
  if (tab === 'invoices') await sub('invoices', ['number', 'description', 'due_date', 'total', 'paid', 'status'], (r) => go(`#/invoice/${r.id}`));
  if (tab === 'tasks') await sub('tasks', ['title', 'assignee_id', 'status', 'due_date', 'revisions'], (r) => openForm('tasks', r, {}, () => clientView(id, 'tasks')));
  if (tab === 'content') await sub('content', ['publish_date', 'platform', 'title', 'status', 'designer_id'], (r) => openForm('content', r, {}, () => clientView(id, 'content')));
  if (tab === 'log') tc.innerHTML = `<div class="card">${timelineHtml(await api(`timeline/client/${id}`))}</div>`;
}

/* ====================== عرض السعر ====================== */
async function quoteView(id) {
  await Promise.all([refs('clients').catch(() => []), refs('leads').catch(() => []), refs('deals').catch(() => [])]);
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const s = S.meta.settings; const vatR = Number(s.vat_rate || 15) / 100;
  let q;
  if (id === 'new' || String(id).startsWith('new')) {
    q = { items: '[]', discount: 0, status: 'مسودة', client_id: params.get('client') ? +params.get('client') : null, lead_id: params.get('lead') ? +params.get('lead') : null,
      valid_until: addDays(todayStr(), Number(s.quote_validity_days || 15)), plan: 'single', months: 0, terms: '' };
  } else q = (await api(`e/quotes/${id}`)).row;
  let items = []; try { items = JSON.parse(q.items || '[]'); } catch { items = []; }
  const ro = !can('quotes', 'w');
  const render = () => {
    const sub = items.reduce((a, it) => a + (+it.qty || 0) * (+it.price || 0), 0);
    const disc = +$('#disc')?.value || +q.discount || 0;
    const vat = (sub - disc) * vatR;
    V().innerHTML = `<div class="toolbar"><a href="#/quotes" class="btn btn-g btn-s">→ عروض الأسعار</a><b>${q.number ? esc(q.number) : 'عرض سعر جديد'}</b> ${pill(q.status)}<span class="sp"></span>
      ${q.id ? `<button class="btn btn-g" id="pr">${I.print} طباعة / PDF</button>` : ''}
      ${q.id && can('contracts', 'w') && q.status !== 'مرفوض' ? '<button class="btn btn-n" id="tc">تحويل إلى عقد</button>' : ''}
      ${!ro ? '<button class="btn btn-p" id="sv">حفظ</button>' : ''}</div>
      <div class="grid g2"><div class="card"><form class="fgrid" id="qf">
        <label class="f full"><span>العنوان</span>${input({ k: 'title', t: 'text' }, q.title, ro)}</label>
        <label class="f"><span>العميل</span>${input({ k: 'client_id', t: 'ref', ref: 'clients' }, q.client_id, ro)}</label>
        <label class="f"><span>أو العميل المحتمل</span>${input({ k: 'lead_id', t: 'ref', ref: 'leads' }, q.lead_id, ro)}</label>
        <label class="f"><span>الصفقة المرتبطة</span>${input({ k: 'deal_id', t: 'ref', ref: 'deals' }, q.deal_id, ro)}</label>
        <label class="f"><span>صالح حتى</span>${input({ k: 'valid_until', t: 'date' }, q.valid_until, ro)}</label>
        <label class="f"><span>مدة التعاقد (شهور)</span>${input({ k: 'months', t: 'number' }, q.months, ro)}</label>
        <label class="f"><span>خطة الدفع</span>${input({ k: 'plan', t: 'select', o: L.plan }, q.plan, ro)}</label>
        <label class="f"><span>الحالة</span>${input({ k: 'status', t: 'select', o: L.quoteStatus }, q.status, ro)}</label>
        <label class="f full"><span>ملاحظات تظهر في العرض</span>${input({ k: 'notes', t: 'textarea' }, q.notes, ro)}</label></form></div>
      <div class="card"><h3>البنود<span class="sp"></span>${!ro ? `<button class="btn btn-g btn-s" id="pick">${I.tag} من الكتالوج</button><button class="btn btn-g btn-s" id="line">+ بند حر</button>` : ''}</h3>
        <div class="tbl-wrap"><table class="t items-t"><thead><tr><th>البند</th><th style="width:70px">الكمية</th><th style="width:110px">السعر</th><th style="width:100px">المجموع</th>${!ro ? '<th></th>' : ''}</tr></thead>
        <tbody>${items.map((it, i) => `<tr data-i="${i}"><td>${ro ? esc(it.name) : `<input value="${esc(it.name)}" data-k="name">`}${it.desc ? `<div class="small muted">${esc(it.desc)}</div>` : ''}</td>
          <td>${ro ? it.qty : `<input class="num" type="number" step="any" value="${it.qty}" data-k="qty">`}</td><td>${ro ? moneyTxt(it.price) : `<input class="num" type="number" step="any" value="${it.price}" data-k="price">`}</td>
          <td class="num">${moneyTxt((+it.qty || 0) * (+it.price || 0))}</td>${!ro ? `<td><button class="btn btn-d btn-s" data-rm="${i}">×</button></td>` : ''}</tr>`).join('') || '<tr><td colspan="5" class="empty">أضف بنداً من الكتالوج</td></tr>'}</tbody></table></div>
        <div class="totals" style="margin-top:12px"><div><span>المجموع</span><span>${money(sub)}</span></div>
          <div><span>الخصم</span><span>${ro ? money(disc) : `<input id="disc" class="inp num" style="width:120px;padding:4px 8px" type="number" step="any" value="${disc}">`}</span></div>
          <div><span>ضريبة القيمة المضافة ${s.vat_rate || 15}%</span><span>${money(vat)}</span></div><div class="g"><span>الإجمالي</span><span>${money(sub - disc + vat)}</span></div></div></div></div>`;
    $$('.items-t input').forEach((inp) => inp.onchange = () => { const i = +inp.closest('tr').dataset.i; items[i][inp.dataset.k] = inp.dataset.k === 'name' ? inp.value : +inp.value; keep(); render(); });
    $$('[data-rm]').forEach((b) => b.onclick = () => { items.splice(+b.dataset.rm, 1); keep(); render(); });
    $('#disc') && ($('#disc').onchange = () => { q.discount = +$('#disc').value || 0; keep(); render(); });
    $('#line') && ($('#line').onclick = () => { keep(); items.push({ name: 'بند جديد', qty: 1, price: 0 }); render(); });
    $('#pick') && ($('#pick').onclick = () => { keep(); catalogPicker((it) => { items.push(it); if (it.months && !q.months) { q.months = it.months; q.plan = it.plan; } if (!q.title) q.title = it.name; render(); }); });
    $('#sv') && ($('#sv').onclick = save);
    $('#pr') && ($('#pr').onclick = () => printQuote({ ...q, items: JSON.stringify(items) }));
    $('#tc') && ($('#tc').onclick = async () => { await save(true); if (!(await confirmBox('إنشاء عقد من هذا العرض وتعليم الصفقة كمكسوبة؟'))) return; const r = await api(`quotes/${q.id}/to-contract`, { method: 'POST' }); invalidate('contracts'); toast('تم إنشاء العقد ' + (r.number || '')); go(`#/contract/${r.contract_id}`); });
  };
  const keep = () => { const f = $('#qf'); if (!f || ro) return; try { Object.assign(q, readForm(f, [{ k: 'title', t: 'text' }, { k: 'client_id', t: 'ref', ref: 'clients' }, { k: 'lead_id', t: 'ref', ref: 'leads' }, { k: 'deal_id', t: 'ref', ref: 'deals' }, { k: 'valid_until', t: 'date' }, { k: 'months', t: 'number' }, { k: 'plan', t: 'select' }, { k: 'status', t: 'select' }, { k: 'notes', t: 'textarea' }])); } catch { /* */ } };
  const save = async (silent) => {
    keep();
    if (!q.client_id && !q.lead_id) { toast('اختر عميلاً أو عميلاً محتملاً', 1); throw new Error('x'); }
    const body = { title: q.title, client_id: q.client_id, lead_id: q.lead_id, deal_id: q.deal_id, valid_until: q.valid_until, months: q.months || 0, plan: q.plan, status: q.status, notes: q.notes, discount: +q.discount || 0, items: JSON.stringify(items) };
    const r = q.id ? await api(`e/quotes/${q.id}`, { method: 'PUT', body }) : await api('e/quotes', { method: 'POST', body });
    q = r.row; invalidate('quotes'); if (silent !== true) toast('تم حفظ العرض');
    if (location.hash !== `#/quote/${q.id}`) history.replaceState(null, '', `#/quote/${q.id}`);
    render();
  };
  render();
}
async function catalogPicker(onPick) {
  const { rows } = await api('e/catalog?f_active=1&limit=1000');
  const m = modal({ title: 'اختر من الكتالوج', wide: true, body: `<div class="toolbar"><input class="inp" id="cq" placeholder="ابحث…"><select class="inp" id="ck"><option value="">الكل</option>${L.kind.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
    <select class="inp" id="cs"><option value="">كل القطاعات</option>${S.meta.sectors.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div><div class="pick" id="pl"></div>` });
  const draw = () => {
    const q = $('#cq', m.el).value.trim(); const k = $('#ck', m.el).value; const sc = $('#cs', m.el).value;
    const list = rows.filter((r) => (!q || r.name.includes(q) || (r.sector || '').includes(q)) && (!k || r.kind === k) && (!sc || r.sector === sc));
    $('#pl', m.el).innerHTML = list.map((r) => `<div class="list-i" data-id="${r.id}"><div class="g"><b>${esc(r.name)}</b><span class="small muted">${esc(optLabel(L.kind, r.kind))} · ${esc(r.kind === 'package' ? `${r.months} شهر · ${moneyTxt(r.monthly)} ر.س/شهر` : (r.unit || ''))} ${r.delivery ? '· ' + esc(r.delivery) : ''}</span></div>${money(r.price)}</div>`).join('') || '<div class="empty">لا نتائج</div>';
    $$('[data-id]', m.el).forEach((el) => el.onclick = () => {
      const r = rows.find((x) => x.id == el.dataset.id); let det = {}; try { det = JSON.parse(r.details || '{}'); } catch { /* */ }
      const desc = r.kind === 'package' ? `${det.posts} منشوراً و${det.designs} تصميماً شهرياً · ${det.platforms} منصات · إدارة إعلانات حتى ${moneyTxt(det.adcap)} ر.س` : det.desc || '';
      onPick({ name: r.name, desc, qty: 1, price: +r.price, months: r.months, plan: r.plan, catalog_id: r.id }); m.close();
    });
  };
  $('#cq', m.el).oninput = draw; $('#ck', m.el).onchange = draw; $('#cs', m.el).onchange = draw; draw();
}

/* ====================== الطباعة الرسمية ====================== */
function docShell(title, inner) {
  const s = S.meta.settings;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
  <style>@page{size:A4;margin:16mm 14mm}*{box-sizing:border-box}body{font-family:Tajawal,sans-serif;color:#12333F;font-size:13.5px;line-height:1.7;margin:0}
  .hd{display:flex;align-items:center;gap:16px;border-bottom:3px solid #15556B;padding-bottom:12px;margin-bottom:18px}.hd img{height:70px}.hd .c{flex:1}.hd b{font-size:18px;color:#082A37}
  .hd .m{font-size:11.5px;color:#5D7581}.ttl{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px}.ttl h1{font-size:22px;margin:0;color:#082A37}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;background:#F8F4EC;border-radius:10px;padding:12px 16px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin:8px 0}th{background:#15556B;color:#fff;padding:8px 10px;text-align:start;font-weight:500}td{padding:8px 10px;border-bottom:1px solid #E3D9C9;vertical-align:top}
  .n{font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate}.tot{width:300px;margin-inline-start:auto}.tot div{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed #E3D9C9}
  .tot .g{font-weight:800;font-size:16px;border:0;color:#082A37}h3{color:#15556B;font-size:15px;margin:18px 0 6px}ul{margin:4px 0;padding-inline-start:20px}
  .ft{margin-top:26px;border-top:1px solid #E3D9C9;padding-top:10px;font-size:11px;color:#5D7581;text-align:center}.sig{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:34px}
  .sig div{border-top:1px solid #12333F;padding-top:6px;text-align:center}.strip{height:5px;background:repeating-linear-gradient(90deg,#15556B 0 16px,#fff 16px 20px,#D2652A 20px 36px,#fff 36px 40px,#DC9C47 40px 56px,#fff 56px 60px,#308D8B 60px 76px,#fff 76px 80px);margin-top:8px}
  @media screen{body{max-width:820px;margin:20px auto;padding:20px;box-shadow:0 0 30px rgba(0,0,0,.1)}}</style></head><body>
  <div class="hd"><img src="${location.origin}/marketing/logo.png" alt=""><div class="c"><b>${esc(s.company_name)}</b><div class="m">${esc(s.company_city)} · س.ت ${esc(s.cr_number)} · الرقم الضريبي ${esc(s.vat_number)} · ${esc(s.sales_phone || '')}</div></div></div>
  ${inner}<div class="ft">نتعامل بنُبل… ونحلّ بابتكار<div class="strip"></div></div><script>window.onload=()=>setTimeout(()=>print(),400)<\/script></body></html>`;
}
function openDoc(html) { const w = window.open('', '_blank'); if (!w) return toast('اسمح بالنوافذ المنبثقة للطباعة', 1); w.document.open(); w.document.write(html); w.document.close(); }
function partyName(q) { return q.client_id ? refLabel('clients', q.client_id) : q.lead_id ? refLabel('leads', q.lead_id) : ''; }
function printQuote(q) {
  const s = S.meta.settings; let items = []; try { items = JSON.parse(q.items || '[]'); } catch { /* */ }
  const sub = items.reduce((a, it) => a + it.qty * it.price, 0); const disc = +q.discount || 0; const vat = (sub - disc) * (Number(s.vat_rate || 15) / 100);
  openDoc(docShell(`عرض سعر ${q.number}`, `<div class="ttl"><h1>عرض سعر</h1><div class="n">${esc(q.number || '')}</div></div>
  <div class="meta"><div>مقدّم إلى: <b>${esc(partyName(q))}</b></div><div>التاريخ: <span class="n">${todayStr()}</span></div><div>الموضوع: ${esc(q.title || '')}</div><div>صالح حتى: <span class="n">${esc(q.valid_until || '')}</span></div></div>
  <table><thead><tr><th>#</th><th>البند</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr></thead><tbody>${items.map((it, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(it.name)}</b>${it.desc ? `<br><small>${esc(it.desc)}</small>` : ''}</td><td class="n">${it.qty}</td><td class="n">${moneyTxt(it.price)}</td><td class="n">${moneyTxt(it.qty * it.price)}</td></tr>`).join('')}</tbody></table>
  <div class="tot"><div><span>المجموع</span><span class="n">${moneyTxt(sub)}</span></div>${disc ? `<div><span>الخصم</span><span class="n">${moneyTxt(disc)}</span></div>` : ''}<div><span>ضريبة القيمة المضافة ${s.vat_rate}%</span><span class="n">${moneyTxt(vat)}</span></div><div class="g"><span>الإجمالي (ر.س)</span><span class="n">${moneyTxt(sub - disc + vat)}</span></div></div>
  ${q.months ? `<p>مدة التعاقد: <b>${q.months} شهر</b> · خطة الدفع: <b>${esc(optLabel(L.plan, q.plan))}</b></p>` : ''}
  ${q.notes ? `<h3>ملاحظات</h3><p style="white-space:pre-wrap">${esc(q.notes)}</p>` : ''}
  <h3>ما لا يشمله العرض</h3><ul><li>ميزانية الإعلانات الممولة — تُصرف من حساب العميل مباشرة.</li><li>أي بند غير مذكور صراحة أعلاه.</li></ul>
  <h3>الشروط</h3><ul><li>الأسعار بالريال السعودي، والضريبة 15% مضافة كما هو موضح.</li><li>جولتا تعديل مشمولتان لكل عمل، والاعتماد حكمي بعد 3 أيام عمل دون ملاحظات.</li><li>لا نضمن نتائج لا نتحكم فيها (مبيعات، متابعين، ترتيب بحث) — نلتزم بالتنفيذ والقياس والشفافية.</li><li>التنفيذ يبدأ بعد توقيع العقد وسداد الدفعة الأولى.</li></ul>
  <div class="sig"><div>${esc(s.company_name)}</div><div>اعتماد العميل</div></div>`));
}
function printContract(c, client) {
  const s = S.meta.settings;
  openDoc(docShell(`عقد ${c.number}`, `<div class="ttl"><h1>عقد تقديم خدمات تسويقية</h1><div class="n">${esc(c.number)}</div></div>
  <div class="meta"><div>الطرف الأول: <b>${esc(s.company_name)}</b></div><div>الطرف الثاني: <b>${esc(client?.name || '')}</b></div>
  <div>س.ت الطرف الثاني: <span class="n">${esc(client?.cr_number || '—')}</span></div><div>الرقم الضريبي: <span class="n">${esc(client?.vat_number || '—')}</span></div>
  <div>تاريخ البداية: <span class="n">${esc(c.start_date || '')}</span></div><div>تاريخ النهاية: <span class="n">${esc(c.end_date || '')}</span></div></div>
  <h3>1. نطاق العمل</h3><p style="white-space:pre-wrap">${esc(c.package || c.title || '')}</p>
  <h3>2. المقابل المالي</h3><p>القيمة الشهرية <b class="n">${moneyTxt(c.monthly_value)}</b> ر.س، وإجمالي العقد <b class="n">${moneyTxt(c.total_value)}</b> ر.س لمدة ${c.months} شهر، غير شاملة ضريبة القيمة المضافة ${s.vat_rate}%. خطة الدفع: ${esc(optLabel(L.plan, c.plan))}.</p>
  <h3>3. الالتزامات والبنود العامة</h3><ul>
  <li>ميزانية الإعلانات الممولة على الطرف الثاني ومنفصلة عن الأتعاب، وتُصرف من حسابه مباشرة.</li>
  <li>جولتا تعديل مجانيتان لكل عمل، ويُعدّ العمل معتمداً إذا لم ترد ملاحظات خلال 3 أيام عمل.</li>
  <li>التأخر في سداد أي دفعة 15 يوماً يمنح الطرف الأول حق إيقاف التنفيذ حتى السداد.</li>
  <li>تنتقل الملكية الفكرية للمخرجات إلى الطرف الثاني بعد السداد الكامل، ولا تشمل أدوات وأنظمة الطرف الأول.</li>
  <li>يلتزم الطرفان بسرية المعلومات لمدة سنتين بعد انتهاء العقد.</li>
  <li>${c.auto_renew ? `يتجدد العقد تلقائياً لمدة مماثلة ما لم يُشعر أحد الطرفين الآخر كتابياً قبل ${c.notice_days || 30} يوماً من انتهائه.` : 'لا يتجدد العقد تلقائياً.'}</li>
  <li>يجوز لأي طرف إنهاء العقد بإشعار كتابي مدته ${c.notice_days || 30} يوماً، مع سداد ما نُفّذ حتى تاريخ الإنهاء.</li>
  <li>لا يضمن الطرف الأول نتائج لا يتحكم فيها (حجم المبيعات، عدد المتابعين، ترتيب البحث).</li>
  <li>يسلّم الطرف الأول جميع أصول الطرف الثاني خلال 5 أيام عمل من انتهاء العقد.</li>
  <li>تختص محاكم جدة بالنظر في أي نزاع ينشأ عن هذا العقد.</li></ul>
  ${c.notes ? `<h3>4. ملاحظات</h3><p style="white-space:pre-wrap">${esc(c.notes)}</p>` : ''}
  <div class="sig"><div>الطرف الأول<br>${esc(s.company_name)}</div><div>الطرف الثاني<br>${esc(client?.name || '')}</div></div>
  <p style="font-size:11px;color:#5D7581;margin-top:18px">نموذج تشغيلي — يُراجع قانونياً قبل اعتماده كصيغة نهائية.</p>`));
}
function printInvoice(inv, client) {
  const s = S.meta.settings;
  openDoc(docShell(`مطالبة ${inv.number}`, `<div class="ttl"><h1>مطالبة مالية</h1><div class="n">${esc(inv.number)}</div></div>
  <div class="meta"><div>العميل: <b>${esc(client?.name || '')}</b></div><div>تاريخ الإصدار: <span class="n">${esc(inv.issue_date || '')}</span></div>
  <div>الرقم الضريبي للعميل: <span class="n">${esc(client?.vat_number || '—')}</span></div><div>تاريخ الاستحقاق: <span class="n">${esc(inv.due_date || '')}</span></div></div>
  <table><thead><tr><th>البيان</th><th>المبلغ</th></tr></thead><tbody><tr><td>${esc(inv.description || '')}</td><td class="n">${moneyTxt(inv.subtotal)}</td></tr></tbody></table>
  <div class="tot"><div><span>المبلغ قبل الضريبة</span><span class="n">${moneyTxt(inv.subtotal)}</span></div><div><span>ضريبة القيمة المضافة ${s.vat_rate}%</span><span class="n">${moneyTxt(inv.vat)}</span></div>
  <div class="g"><span>الإجمالي (ر.س)</span><span class="n">${moneyTxt(inv.total)}</span></div>${inv.paid ? `<div><span>المدفوع</span><span class="n">${moneyTxt(inv.paid)}</span></div><div class="g"><span>المتبقي</span><span class="n">${moneyTxt(inv.total - inv.paid)}</span></div>` : ''}</div>
  <p style="font-size:12px;color:#5D7581">${inv.tax_ref ? `الفاتورة الضريبية الرسمية رقم <b>${esc(inv.tax_ref)}</b> صادرة من النظام المحاسبي.` : 'هذه مطالبة مالية؛ تصدر الفاتورة الضريبية الإلكترونية الرسمية من النظام المحاسبي المعتمد.'}</p>`));
}

/* ====================== العقد والفاتورة ====================== */
async function contractView(id) {
  await refs('clients').catch(() => []);
  const { row: c } = await api(`e/contracts/${id}`);
  const client = S.cache.clients?.rows.find((x) => x.id == c.client_id);
  const inv = can('invoices') ? (await api(`e/invoices?f_contract_id=${id}&limit=100`)).rows : [];
  $('#ptitle').textContent = `عقد ${c.number}`;
  const fs = ENT.contracts.fields.filter((f) => !['package', 'notes'].includes(f.k));
  const daysLeft = c.end_date ? Math.round((new Date(c.end_date) - new Date(todayStr())) / 864e5) : null;
  V().innerHTML = `<div class="toolbar"><a href="#/contracts" class="btn btn-g btn-s">→ العقود</a><span class="sp"></span>
    <button class="btn btn-g" id="pr">${I.print} طباعة العقد</button>
    ${can('invoices', 'w') && !inv.length ? '<button class="btn btn-n" id="sch">توليد جدول الفواتير</button>' : ''}
    ${can('contracts', 'w') ? '<button class="btn btn-g" id="rn">تجديد</button><button class="btn btn-g" id="ed">تعديل</button>' : ''}</div>
    ${daysLeft != null && daysLeft <= 30 && daysLeft >= 0 && ['نشط', 'موقّع'].includes(c.status) ? `<div class="notice">ينتهي العقد خلال ${daysLeft} يوماً — ${c.auto_renew ? 'التجديد تلقائي ما لم يُشعر العميل' : 'تواصل مع العميل للتجديد'}.</div>` : ''}
    <div class="grid g2"><div class="card"><h3>${esc(c.title || '')} ${pill(c.status)}</h3><dl class="dl">${fs.map((f) => `<dt>${f.l}</dt><dd>${cell(f, c) || '—'}</dd>`).join('')}</dl>
      <h3 style="margin-top:14px">النطاق</h3><p style="white-space:pre-wrap">${esc(c.package || '—')}</p></div>
    <div class="card"><h3>${I.bill} الفواتير</h3>${inv.length ? inv.map((i) => `<a class="list-i" href="#/invoice/${i.id}"><div class="g"><b>${esc(i.description || i.number)}</b><span class="small muted">${esc(i.number)} · ${fdate(i.due_date)}</span></div>${pill(i.status)} ${money(i.total)}</a>`).join('') : '<div class="empty small">لم يُولَّد جدول الفواتير بعد</div>'}</div></div>`;
  $('#pr').onclick = () => printContract(c, client);
  $('#ed') && ($('#ed').onclick = () => openForm('contracts', c, {}, () => contractView(id)));
  $('#sch') && ($('#sch').onclick = async () => { try { const r = await api(`contracts/${id}/schedule`, { method: 'POST' }); toast(`تم إنشاء ${r.created} فاتورة (مسودة)`); contractView(id); } catch (e) { toast(e.message, 1); } });
  $('#rn') && ($('#rn').onclick = async () => { if (!(await confirmBox(`إنشاء عقد تجديد بزيادة ${S.meta.settings.renewal_uplift || 0}%؟`))) return; const r = await api(`contracts/${id}/renew`, { method: 'POST' }); toast('تم إنشاء ' + r.number); go(`#/contract/${r.contract_id}`); });
}
async function invoiceView(id) {
  await refs('clients').catch(() => []);
  const { row: inv } = await api(`e/invoices/${id}`);
  const client = S.cache.clients?.rows.find((x) => x.id == inv.client_id);
  const { rows: pays } = await api(`e/payments?f_invoice_id=${id}`);
  $('#ptitle').textContent = `فاتورة ${inv.number}`;
  const late = inv.due_date < todayStr() && ['مصدرة', 'مدفوعة جزئياً'].includes(inv.status);
  V().innerHTML = `<div class="toolbar"><a href="#/invoices" class="btn btn-g btn-s">→ الفواتير</a><span class="sp"></span>
    ${client?.phone && inv.total > inv.paid ? `<a class="btn btn-wa" target="_blank" rel="noopener" href="${waLink(client.phone, `السلام عليكم ${client.contact_name || ''}، نذكّركم بالمطالبة رقم ${inv.number} بمبلغ ${moneyTxt(inv.total - inv.paid)} ر.س المستحقة بتاريخ ${inv.due_date}. شاكرين تعاونكم — نُبل وابتكار.`)}">${I.wa} تذكير</a>` : ''}
    <button class="btn btn-g" id="pr">${I.print} طباعة</button>${inv.status === 'مسودة' && can('invoices', 'w') ? '<button class="btn btn-n" id="iss">إصدار</button>' : ''}
    ${can('payments', 'w') && inv.total > inv.paid ? '<button class="btn btn-p" id="pay">تسجيل دفعة</button>' : ''}<button class="btn btn-g" id="ed">تعديل</button></div>
    ${late ? '<div class="notice">الفاتورة متأخرة عن موعد استحقاقها.</div>' : ''}
    <div class="grid g2"><div class="card"><h3>${esc(inv.description || '')} ${pill(late ? 'متأخرة' : inv.status)}</h3><dl class="dl">${ENT.invoices.fields.filter((f) => f.k !== 'notes').map((f) => `<dt>${f.l}</dt><dd>${cell(f, inv) || '—'}</dd>`).join('')}</dl></div>
    <div class="card"><h3>${I.cash} الدفعات</h3>${pays.length ? pays.map((p) => `<div class="list-i"><div class="g"><b>${money(p.amount)}</b><span class="small muted">${fdate(p.paid_at)} · ${esc(p.method || '')} ${p.ref ? '· ' + esc(p.ref) : ''}</span></div></div>`).join('') : '<div class="empty small">لا دفعات بعد</div>'}
      <div class="totals" style="margin-top:10px"><div class="g"><span>المتبقي</span><span>${money(inv.total - inv.paid)}</span></div></div></div></div>`;
  $('#pr').onclick = () => printInvoice(inv, client);
  $('#ed').onclick = () => openForm('invoices', inv, {}, () => invoiceView(id));
  $('#iss') && ($('#iss').onclick = async () => { await api(`e/invoices/${id}`, { method: 'PUT', body: { status: 'مصدرة' } }); toast('تم الإصدار'); invoiceView(id); });
  $('#pay') && ($('#pay').onclick = () => {
    const m = modal({ title: 'تسجيل دفعة', body: `<form class="fgrid"><label class="f"><span>المبلغ</span><input class="inp num" name="amount" type="number" step="any" value="${inv.total - inv.paid}"></label>
      <label class="f"><span>التاريخ</span><input class="inp" type="date" name="paid_at" value="${todayStr()}"></label><label class="f"><span>الطريقة</span>${input({ k: 'method', t: 'select', o: L.payMethod }, 'تحويل بنكي')}</label>
      <label class="f"><span>المرجع</span><input class="inp" name="ref"></label></form>`, foot: '<button class="btn btn-p">حفظ</button>' });
    $('.btn-p', m.el).onclick = async () => { const f = $('form', m.el); try { await api(`invoices/${id}/pay`, { method: 'POST', body: { amount: +f.amount.value, paid_at: f.paid_at.value, method: f.method.value, ref: f.ref.value } }); toast('تم تسجيل الدفعة'); m.close(); invoiceView(id); } catch (e) { toast(e.message, 1); } };
  });
}

/* ====================== التقارير ====================== */
async function reportsView() {
  const st = (S.rp ||= { from: addDays(todayStr(), -90), to: todayStr() });
  const d = await api(`reports?from=${st.from}&to=${st.to}`);
  const f = d.funnel; const conv = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
  V().innerHTML = `<div class="toolbar"><label class="small">من <input class="inp" type="date" id="rf" value="${st.from}"></label><label class="small">إلى <input class="inp" type="date" id="rt" value="${st.to}"></label>
    <button class="btn btn-n btn-s" id="go">تحديث</button><span class="sp"></span><button class="btn btn-g btn-s" onclick="print()">${I.print} طباعة</button></div>
    <div class="grid g4">${kpi('عملاء محتملون جدد', n0(f.leads))}${kpi('تم التواصل معهم', n0(f.contacted), conv(f.contacted, f.leads))}${kpi('عروض أسعار', n0(f.quotes))}${kpi('صفقات مكسوبة', n0(f.won), `${moneyTxt(f.won_value)} ر.س · خاسرة ${f.lost}`, 'good')}</div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h3>قمع المبيعات</h3>${bars([{ k: 'عملاء محتملون', n: f.leads }, { k: 'تم التواصل', n: f.contacted }, { k: 'صفقات', n: f.deals }, { k: 'عروض', n: f.quotes }, { k: 'مكسوبة', n: f.won }])}</div>
      <div class="card"><h3>أسباب الخسارة</h3>${bars(d.lossReasons, { color: 'var(--terra)' })}</div>
      <div class="card"><h3>المصادر والتحويل</h3>${d.sources.length ? `<table class="t"><thead><tr><th>المصدر</th><th>عملاء محتملون</th><th>تحوّلوا لعملاء</th><th>نسبة</th></tr></thead><tbody>${d.sources.map((r) => `<tr><td>${esc(r.k)}</td><td class="num">${r.leads}</td><td class="num">${r.converted}</td><td class="num">${conv(r.converted, r.leads)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty small">—</div>'}</div>
      <div class="card"><h3>العقود حسب القطاع</h3>${bars(d.sectors, { label: (r) => sectorName(r.k), val: (r) => r.value, fmt: moneyTxt })}</div>
      <div class="card"><h3>التحصيل الشهري</h3>${bars(d.cash, { label: (r) => MONTHS[+r.k.slice(5) - 1] + ' ' + r.k.slice(0, 4), val: (r) => r.v, fmt: moneyTxt, color: 'var(--teal)' })}</div>
      <div class="card"><h3>المصروفات حسب البند</h3>${bars(d.expenses, { val: (r) => r.v, fmt: moneyTxt, color: 'var(--gold)' })}</div>
      <div class="card"><h3>أعمار المستحقات</h3>${bars([{ k: 'لم تستحق', n: d.aging.current }, { k: '1–30 يوماً', n: d.aging.d30 }, { k: '31–60 يوماً', n: d.aging.d60 }, { k: 'أكثر من 60', n: d.aging.d90 }], { fmt: moneyTxt, color: 'var(--red)' })}</div>
    </div>
    <div class="card" style="margin-top:14px"><h3>${I.team} أداء الفريق والعمولات</h3><div class="tbl-wrap"><table class="t"><thead><tr><th>الاسم</th><th>الدور</th><th>تواصل</th><th>زيارات</th><th>صفقات مكسوبة</th><th>قيمتها</th><th>العمولة التقديرية</th><th>مهام منجزة</th><th>في الموعد</th><th>متوسط التعديلات</th></tr></thead>
    <tbody>${d.team.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(S.meta.roles[r.role] || r.role)}</td><td class="num">${r.activities}</td><td class="num">${r.visits}</td><td class="num">${r.won}</td><td>${money(r.won_value)}</td><td>${money(r.commission)}</td><td class="num">${r.tasks_done}</td><td class="num">${conv(r.tasks_ontime, r.tasks_done)}</td><td class="num">${r.avg_rev ?? '—'}</td></tr>`).join('')}</tbody></table></div>
    <p class="small muted" style="margin-top:8px">العمولة = قيمة الصفقات المكسوبة × نسبة العضو (أو نسب المندوب الافتراضية من الإعدادات). رقم تقديري للمراجعة قبل الصرف.</p></div>`;
  $('#go').onclick = () => { st.from = $('#rf').value; st.to = $('#rt').value; reportsView(); };
}

/* ====================== الفريق والإعدادات والاستيراد ====================== */
async function teamView() {
  const { rows } = await api('e/users');
  const admin = me().role === 'admin';
  V().innerHTML = `<div class="toolbar"><span class="muted">كل عضو يرى ما يخص دوره فقط — الأرقام المالية مخفية عن التصميم.</span><span class="sp"></span>${admin ? `<button class="btn btn-p" id="add">${I.plus} عضو جديد</button>` : ''}</div>
    <div class="tbl-wrap"><table class="t"><thead><tr><th>الاسم</th><th>المسمى</th><th>الدور</th><th>البريد</th><th>الجوال</th><th>العمولة %</th><th>آخر دخول</th><th>الحالة</th>${admin ? '<th></th>' : ''}</tr></thead>
    <tbody>${rows.map((u) => `<tr data-id="${u.id}"><td><b>${esc(u.name)}</b></td><td>${esc(u.title || '')}</td><td>${esc(S.meta.roles[u.role] || u.role)}</td><td dir="ltr">${esc(u.email)}</td><td class="num">${esc(u.phone || '')}</td>
      <td class="num">${u.commission_rate || 0}</td><td>${u.last_login ? fdate(u.last_login) : '—'}</td><td>${u.active ? pill('نشط') : pill('موقوف مؤقتاً')}</td>${admin ? `<td class="n"><button class="btn btn-g btn-s" data-reset="${u.id}">كلمة مؤقتة</button></td>` : ''}</tr>`).join('')}</tbody></table></div>
    <div class="card" style="margin-top:14px"><h3>مصفوفة الصلاحيات</h3><div class="tbl-wrap"><table class="t"><thead><tr><th>الدور</th><th>يرى ويعمل على</th></tr></thead><tbody>
      <tr><td>المدير العام</td><td>كل شيء + الفريق والإعدادات والنسخ الاحتياطي</td></tr><tr><td>مدير الخدمات التسويقية</td><td>كل الوحدات التشغيلية والمالية والتقارير</td></tr>
      <tr><td>مبيعات / مندوب</td><td>عملاؤه المحتملون وغير المسندين، صفقاته، زياراته، عروضه، المهام المسندة إليه</td></tr>
      <tr><td>إدارة الحسابات والسوشيال</td><td>العملاء، المحتوى، المهام، المشاريع، المواسم، قاعدة المعرفة (قراءة العقود)</td></tr>
      <tr><td>تصميم ومونتاج</td><td>مهامه ومحتوى العملاء — بلا أرقام مالية</td></tr><tr><td>المالية</td><td>العقود، الفواتير، المدفوعات، المصروفات، التقارير</td></tr></tbody></table></div></div>`;
  const userForm = (u) => {
    const m = modal({ title: u ? 'تعديل عضو' : 'عضو جديد', body: `<form class="fgrid"><label class="f"><span>الاسم *</span><input class="inp" name="name" value="${esc(u?.name || '')}"></label>
      <label class="f"><span>البريد *</span><input class="inp" name="email" dir="ltr" type="email" value="${esc(u?.email || '')}"></label>
      <label class="f"><span>الجوال</span><input class="inp" name="phone" dir="ltr" value="${esc(u?.phone || '')}"></label><label class="f"><span>المسمى الوظيفي</span><input class="inp" name="title" value="${esc(u?.title || '')}"></label>
      <label class="f"><span>الدور</span><select class="inp" name="role">${Object.entries(S.meta.roles).map(([k, l]) => `<option value="${k}" ${u?.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="f"><span>نسبة العمولة %</span><input class="inp num" name="commission_rate" type="number" step="any" value="${u?.commission_rate || 0}"></label>
      ${u ? `<label class="f"><span>الحالة</span><select class="inp" name="active"><option value="1" ${u.active ? 'selected' : ''}>نشط</option><option value="0" ${!u.active ? 'selected' : ''}>موقوف</option></select></label>` : ''}</form>`,
      foot: '<button class="btn btn-p">حفظ</button>' });
    $('.btn-p', m.el).onclick = async () => {
      const f = $('form', m.el); const body = { name: f.name.value, email: f.email.value, phone: f.phone.value, title: f.title.value, role: f.role.value, commission_rate: +f.commission_rate.value };
      try {
        if (u) { body.active = +f.active.value; await api(`e/users/${u.id}`, { method: 'PUT', body }); toast('تم الحفظ'); }
        else { const r = await api('users', { method: 'POST', body }); showTemp(body.email, r.temp_password); }
        m.close(); S.meta = await api('meta'); teamView();
      } catch (e) { toast(e.message, 1); }
    };
  };
  const showTemp = (email, pw) => modal({ title: 'بيانات الدخول المؤقتة', body: `<p>أرسلها للعضو بشكل خاص — سيُطلب منه تغييرها عند أول دخول:</p>
    <div class="card" style="margin-top:10px" dir="ltr"><div>${location.origin}/marketing/hub/</div><div>${esc(email)}</div><div><b class="num">${esc(pw)}</b></div></div>` });
  $('#add') && ($('#add').onclick = () => userForm(null));
  if (admin) $$('tbody tr[data-id]').forEach((tr) => tr.onclick = (e) => { if (e.target.closest('button')) return; userForm(rows.find((u) => u.id == tr.dataset.id)); });
  $$('[data-reset]').forEach((b) => b.onclick = async () => { const u = rows.find((x) => x.id == b.dataset.reset); if (!(await confirmBox(`إنشاء كلمة مرور مؤقتة جديدة لـ ${u.name}؟`))) return; const r = await api(`users/${u.id}/reset`, { method: 'POST' }); showTemp(u.email, r.temp_password); });
}
async function settingsView() {
  const { settings: s } = await api('settings');
  const F2 = [['company_name', 'اسم الكيان'], ['company_city', 'العنوان'], ['cr_number', 'السجل التجاري'], ['vat_number', 'الرقم الضريبي'], ['sales_phone', 'رقم التواصل'],
    ['vat_rate', 'نسبة الضريبة %'], ['quote_validity_days', 'صلاحية عرض السعر (يوم)'], ['hour_cost', 'تكلفة ساعة الفريق (ر.س)'], ['commission_rep', 'عمولة المندوب %'],
    ['commission_close', 'عمولة الإغلاق %'], ['renewal_uplift', 'زيادة سعر التجديد %'], ['stale_days', 'الصفقة راكدة بعد (يوم)']];
  V().innerHTML = `<div class="grid g2"><div class="card"><h3>${I.gear} إعدادات الكيان والتشغيل</h3><form class="fgrid" id="sf">${F2.map(([k, l]) => `<label class="f"><span>${l}</span><input class="inp" name="${k}" value="${esc(s[k] || '')}"></label>`).join('')}</form>
    <button class="btn btn-p" id="sv">حفظ الإعدادات</button></div>
    <div><div class="card"><h3>${I.upload} البيانات</h3><p class="muted small" style="margin-bottom:10px">النسخة الاحتياطية ملف JSON بكل السجلات — احفظها أسبوعياً في Drive.</p>
      <a class="btn btn-n" href="${API}export">تنزيل نسخة احتياطية كاملة</a> <a class="btn btn-g" href="#/import">استيراد جهات اتصال (CSV)</a></div>
    <div class="card" style="margin-top:14px"><h3>ربط نموذج الموقع</h3><p class="muted small">أي نموذج في الموقع يرسل إلى هذا العنوان يُنشئ عميلاً محتملاً تلقائياً بمصدر «الموقع» وموعد متابعة اليوم:</p>
      <pre dir="ltr" class="card" style="margin-top:8px;font-size:12px;overflow:auto">POST ${location.origin}${API}public/lead
{ "name": "...", "phone": "05...", "company": "...", "sector": "food", "message": "...", "page": "..." }</pre></div></div></div>`;
  $('#sv').onclick = async () => { const f = $('#sf'); const body = {}; F2.forEach(([k]) => body[k] = f[k].value); await api('settings', { method: 'PUT', body }); S.meta = await api('meta'); toast('تم حفظ الإعدادات'); };
}
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ',' || c === '\t' || c === ';') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
async function importView() {
  const targets = [['', '— تجاهل —'], ['name', 'الاسم'], ['company', 'المنشأة'], ['phone', 'الجوال'], ['email', 'البريد'], ['city', 'المدينة'], ['sector', 'القطاع (رمز)'], ['segment', 'الشريحة'], ['source', 'المصدر'], ['notes', 'ملاحظات'], ['interest', 'الاهتمام']];
  const guess = (h) => { h = h.trim(); if (/اسم النشاط|المنشأة|الشركة|company/i.test(h)) return 'company'; if (/جوال|هاتف|رقم|phone|mobile/i.test(h)) return 'phone'; if (/^(الاسم|اسم|name)/i.test(h)) return 'name';
    if (/بريد|email/i.test(h)) return 'email'; if (/مدينة|city/i.test(h)) return 'city'; if (/شريحة|segment/i.test(h)) return 'segment'; if (/ملاحظ|notes/i.test(h)) return 'notes'; if (/مصدر|source/i.test(h)) return 'source'; return ''; };
  V().innerHTML = `<div class="card"><h3>${I.upload} استيراد قاعدة جهات الاتصال</h3>
    <p class="muted small">صدّر الورقة من Google Sheets بصيغة CSV ثم ارفعها هنا. تُوحَّد أرقام الجوال بصيغة 9665… ويُتجاهل المكرر تلقائياً.</p>
    <div class="toolbar" style="margin-top:12px"><input type="file" accept=".csv,text/csv" id="file" class="inp" style="max-width:340px">
    <select class="inp" id="seg"><option value="">الشريحة الافتراضية</option>${L.segment.map((s) => `<option>${s}</option>`).join('')}</select>
    <select class="inp" id="src">${L.source.map((s) => `<option ${s === 'قاعدة الكيان الأم' ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <select class="inp" id="own"><option value="">بدون مسؤول</option>${S.meta.users.filter((u) => u.active).map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div><div id="map"></div></div>`;
  $('#file').onchange = async (e) => {
    const rows = parseCsv(await e.target.files[0].text()); if (rows.length < 2) return toast('الملف فارغ', 1);
    const head = rows[0]; const body = rows.slice(1);
    $('#map').innerHTML = `<h3 style="margin:14px 0 8px">مطابقة الأعمدة (${body.length} صف)</h3><div class="fgrid">${head.map((h, i) => `<label class="f"><span>${esc(h)} <span class="muted">— مثال: ${esc(body[0]?.[i] || '')}</span></span><select class="inp" data-col="${i}">${targets.map(([k, l]) => `<option value="${k}" ${guess(h) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`).join('')}</div>
      <button class="btn btn-p" id="run">استيراد ${body.length} صف</button>`;
    $('#run').onclick = async () => {
      const map = $$('[data-col]').map((s) => [+s.dataset.col, s.value]).filter(([, k]) => k);
      const recs = body.map((r) => { const o = {}; map.forEach(([i, k]) => { o[k] = o[k] ? o[k] + ' ' + (r[i] || '') : r[i]; }); return o; });
      $('#run').disabled = true; let tot = { inserted: 0, duplicates: 0, invalid: 0 };
      for (let i = 0; i < recs.length; i += 500) {
        const r = await api('import/leads', { method: 'POST', body: { rows: recs.slice(i, i + 500), segment: $('#seg').value || null, source: $('#src').value, owner_id: $('#own').value ? +$('#own').value : null } });
        tot.inserted += r.inserted; tot.duplicates += r.duplicates; tot.invalid += r.invalid; $('#run').textContent = `تم ${Math.min(i + 500, recs.length)} من ${recs.length}…`;
      }
      invalidate('leads'); toast(`أُضيف ${tot.inserted} · مكرر ${tot.duplicates} · غير صالح ${tot.invalid}`); go('#/leads');
    };
  };
}

/* ====================== البحث وقاعدة المعرفة والمواسم ====================== */
async function searchView(q) {
  q = decodeURIComponent(q || ''); $('#ptitle').textContent = `نتائج: ${q}`;
  const ents = [['leads', 'lead'], ['clients', 'client'], ['deals'], ['quotes', 'quote'], ['contracts', 'contract'], ['invoices', 'invoice'], ['tasks']].filter(([e]) => can(e));
  const res = await Promise.all(ents.map(([e]) => api(`e/${e}?q=${encodeURIComponent(q)}&limit=20`).then((d) => d.rows).catch(() => [])));
  const lab = (e, r) => r.number ? `${r.number} ${r.title || r.description || ''}` : r.title || [r.company, r.name].filter(Boolean).join(' — ') || r.name;
  V().innerHTML = `<div class="grid g2">${ents.map(([e, det], i) => res[i].length ? `<div class="card"><h3>${ENT[e].title} <span class="pill">${res[i].length}</span></h3>${res[i].map((r) =>
    `<a class="list-i" href="${det ? `#/${det}/${r.id}` : '#/' + (e === 'deals' ? 'pipeline' : e)}"><div class="g"><b>${esc(lab(e, r))}</b><span class="small muted num">${esc(r.phone || '')}</span></div>${pill(r.status || r.stage)}</a>`).join('')}</div>` : '').join('') || '<div class="empty">لا نتائج</div>'}</div>`;
}
async function kbView() {
  const { rows } = await api('e/articles?limit=500');
  const cats = [...new Set(rows.map((r) => r.category || 'أخرى'))];
  V().innerHTML = `<div class="toolbar"><span class="muted">الأدلة والسكربتات والسياسات المعتمدة للفريق</span><span class="sp"></span>${can('articles', 'w') ? `<button class="btn btn-p" id="add">${I.plus} مقال</button>` : ''}</div>
    ${cats.map((c) => `<h3 style="margin:16px 0 8px;color:var(--deep)">${esc(c)}</h3><div class="grid g2">${rows.filter((r) => (r.category || 'أخرى') === c).map((r) =>
      `<div class="card" data-id="${r.id}" style="cursor:pointer"><h3>${esc(r.title)}</h3><p style="white-space:pre-wrap;font-size:14px">${esc(r.body || '')}</p></div>`).join('')}</div>`).join('')}`;
  $('#add') && ($('#add').onclick = () => openForm('articles', null, {}, kbView));
  $$('[data-id]').forEach((c) => c.onclick = () => openForm('articles', rows.find((r) => r.id == c.dataset.id), {}, kbView));
}

/* ====================== المسارات ====================== */
ROUTES = {
  dashboard: { title: 'لوحة القيادة', render: dashboardView },
  myday: { title: 'يومي', render: myDayView },
  leads: { ent: 'leads', render: () => listView('leads', { extra: isBoss() ? '<a class="btn btn-g btn-s" href="#/import">استيراد CSV</a>' : '', preset: { owner_id: me().id } }) },
  lead: { title: 'عميل محتمل', render: leadView },
  import: { title: 'استيراد جهات الاتصال', render: importView },
  pipeline: { title: 'الصفقات — خط المبيعات', render: pipelineView },
  activities: { ent: 'activities', render: () => listView('activities') },
  visits: { ent: 'visits', render: visitsView },
  clients: { ent: 'clients', render: () => listView('clients') },
  client: { title: 'العميل', render: (id, t) => clientView(id, t) },
  quotes: { ent: 'quotes', render: () => listView('quotes', { onAdd: () => go('#/quote/new') }) },
  quote: { title: 'عرض سعر', render: (id) => quoteView(id.split('?')[0]) },
  contracts: { ent: 'contracts', render: () => listView('contracts', { preset: { start_date: todayStr(), owner_id: me().id } }) },
  contract: { title: 'العقد', render: contractView },
  catalog: { ent: 'catalog', render: () => listView('catalog') },
  invoices: { ent: 'invoices', render: () => listView('invoices') },
  invoice: { title: 'الفاتورة', render: invoiceView },
  payments: { ent: 'payments', render: () => listView('payments') },
  expenses: { ent: 'expenses', render: () => listView('expenses') },
  projects: { ent: 'projects', render: () => listView('projects', { preset: { owner_id: me().id, start_date: todayStr() } }) },
  tasks: { ent: 'tasks', render: tasksView },
  content: { ent: 'content', render: contentView },
  seasons: { ent: 'seasons', render: () => listView('seasons', { after: () => {} }) },
  kb: { title: 'قاعدة المعرفة', render: kbView },
  reports: { title: 'التقارير', render: reportsView },
  team: { title: 'الفريق والصلاحيات', render: teamView },
  settings: { title: 'الإعدادات', render: settingsView },
  search: { title: 'بحث', render: searchView },
};

boot();
