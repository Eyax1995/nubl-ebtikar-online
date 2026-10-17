/* منصة نُبل وابتكار للتسويق — المناديب الخارجيون بنظام العمولة
   • المندوب يُربط بالعميل المحتمل أو الصفقة أو العميل، وتنتقل نسبته للعميل آلياً عند التحويل.
   • العمولة تُستحق آلياً عند تسجيل كل دفعة من العميل (على المبلغ قبل الضريبة) خلال مدة المندوب (افتراضياً 12 شهراً من أول عقد).
   • المالية تعتمد ثم تصرف (يُسجَّل الصرف مصروفاً تلقائياً)، والمندوب يتابع من رابط كشف حساب خاص + واتساب. */
'use strict';
(function nublReps() {
  const CAN_SEE = ['admin', 'manager', 'finance', 'executive'];
  const CAN_PAY = ['admin', 'finance'];
  const seeComm = () => CAN_SEE.includes(me().role);
  const canPay = () => CAN_PAY.includes(me().role);
  Object.assign(PILL, { 'مستحقة': 'g', 'معتمدة': 'b', 'مصروفة': 't', 'موقوف': 'x' });
  I.hand = P('<path d="M2 12l4-4 4 2 3-3 5 1 4 4"/><path d="M6 8l-4 4 6 6 2-1 2 2 2-1 2 2 3-3-6-6"/><path d="M10 13l2 2M12 11l3 3"/>');

  // ---------- كيان المندوب ----------
  ENT.reps = {
    title: 'المناديب', one: 'مندوب', icon: 'hand',
    fields: [
      F('name', 'اسم المندوب', 'text', { list: 1, req: 1 }), F('phone', 'الجوال (واتساب)', 'phone', { list: 1, req: 1 }),
      F('email', 'البريد', 'email'), F('city', 'المدينة', 'text', { list: 1 }),
      F('rate', 'نسبة العمولة %', 'number', { list: 1, req: 1, def: 10, hint: 'تُحتسب من كل دفعة يحصّلها الكيان من عملاء المندوب' }),
      F('months', 'مدة الاستحقاق (شهور)', 'number', { def: 12, hint: 'من بداية أول عقد للعميل — تشمل العقد الأول وتجديداته خلالها' }),
      F('base', 'أساس الاحتساب', 'select', { o: [['net', 'المبلغ قبل الضريبة (موصى به)'], ['gross', 'المبلغ شامل الضريبة']], def: 'net' }),
      F('status', 'الحالة', 'select', { o: ['نشط', 'موقوف'], list: 1, filter: 1, def: 'نشط' }),
      F('bank_name', 'البنك'), F('iban', 'الآيبان (IBAN)', 'text', { hint: 'للصرف — لا يظهر للمبيعات وإدارة الحسابات' }),
      F('notes', 'ملاحظات / شروط الاتفاق', 'textarea', { w: 'full' }),
    ],
  };
  REF.reps = { label: (r) => `${r.name}${r.rate != null ? ` (${r.rate}%)` : ''}` };

  // حقل «المندوب» في العميل المحتمل والصفقة والعميل — يُضاف بعد معرفة الصلاحيات
  function injectFields() {
    if (!can('reps', 'r')) return;
    const add = (ent, after, field) => {
      const fs = ENT[ent]?.fields; if (!fs || fs.some((f) => f.k === field.k)) return;
      const i = fs.findIndex((f) => f.k === after); fs.splice(i >= 0 ? i + 1 : fs.length - 1, 0, field);
    };
    const hint = 'مندوب خارجي بنظام العمولة جلب هذا العميل — تُحتسب عمولته آلياً من التحصيل';
    add('leads', 'owner_id', F('rep_id', 'المندوب (عمولة)', 'ref', { ref: 'reps', hint }));
    add('deals', 'owner_id', F('rep_id', 'المندوب (عمولة)', 'ref', { ref: 'reps', hint }));
    if (['admin', 'manager', 'finance', 'executive'].includes(me().role)) {
      add('clients', 'account_manager_id', F('rep_id', 'المندوب (عمولة)', 'ref', { ref: 'reps', hint }));
      add('clients', 'rep_id', F('rep_until', 'نهاية مدة عمولة المندوب', 'date', { ro: 1 }));
    }
  }

  // ---------- الشاشة ----------
  const st = { tab: 'reps', status: '', rep: '', sel: new Set() };
  async function view() {
    if (!seeComm()) {
      // المبيعات وإدارة الحسابات: قائمة المناديب فقط (بلا مبالغ أو بيانات بنكية)
      return listView('reps', { noAdd: true });
    }
    S.comm = await api('commissions');
    draw();
  }
  const sum = (rows, k = 'amount') => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  function draw() {
    const d = S.comm; const reps = d.reps; const rows = d.rows;
    const due = rows.filter((r) => r.status === 'مستحقة'); const appr = rows.filter((r) => r.status === 'معتمدة'); const paid = rows.filter((r) => r.status === 'مصروفة');
    const tabs = [['reps', `المناديب (${reps.length})`], ['rows', `العمولات (${rows.length})`], ['payouts', `الصرفيات (${d.payouts.length})`]];
    V().innerHTML = `<div class="grid g4">
        ${kpi('بانتظار الاعتماد', `${n0(sum(due))}<small>ر.س</small>`, `${n0(due.length)} عمولة مستحقة من التحصيل`, due.length ? 'warn' : '')}
        ${kpi('معتمدة بانتظار الصرف', `${n0(sum(appr))}<small>ر.س</small>`, `${n0(appr.length)} بنداً`, appr.length ? 'warn' : '')}
        ${kpi('المصروف للمناديب', `${n0(sum(paid))}<small>ر.س</small>`, `${n0(d.payouts.length)} عملية صرف`, 'good')}
        ${kpi('المناديب النشطون', n0(reps.filter((r) => r.status === 'نشط').length), `${n0(sum(reps, 'clients'))} عميل · ${n0(sum(reps, 'leads'))} عميل محتمل`)}</div>
      <div class="toolbar" style="margin-top:14px"><div class="ak-tabs cm-tabs">${tabs.map(([k, l]) => `<button type="button" data-tab="${k}" class="${st.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <span class="sp"></span>${canPay() ? `<button class="btn btn-g btn-s" id="cmsync" title="يحتسب أي دفعات سابقة لعملاء المناديب لم تُحتسب بعد">إعادة الاحتساب</button>` : ''}
        ${can('reps', 'w') ? `<button class="btn btn-p" id="cmadd">${I.plus} مندوب جديد</button>` : ''}</div>
      <div id="cmb"></div>
      <p class="small muted" style="margin-top:10px">القواعد: تُستحق العمولة آلياً مع كل دفعة يُسجَّل تحصيلها من عميل المندوب (لا عمولة على مبلغ لم يُحصَّل)، على العقد الأول وتجديداته خلال مدة المندوب من بداية أول عقد. حذف الدفعة يلغي عمولتها، وإن كانت مصروفة تُخصم من الصرف القادم. المالية تعتمد وتصرف، والصرف يُسجَّل في المصروفات تلقائياً ويصل المندوب إشعار واتساب.</p>`;
    $$('[data-tab]').forEach((b) => b.onclick = () => { st.tab = b.dataset.tab; st.sel.clear(); draw(); });
    $('#cmadd') && ($('#cmadd').onclick = () => openForm('reps', null, {}, view));
    $('#cmsync') && ($('#cmsync').onclick = async (e) => {
      e.target.disabled = true;
      try { const r = await api('commissions/sync', { method: 'POST', body: {} }); toast(r.created ? `احتُسبت ${r.created} عمولة جديدة` : 'لا دفعات غير محتسبة'); view(); } catch (er) { toast(er.message, 1); e.target.disabled = false; }
    });
    ({ reps: drawReps, rows: drawRows, payouts: drawPayouts })[st.tab]();
  }

  function drawReps() {
    const reps = S.comm.reps; const box = $('#cmb');
    if (!reps.length) { box.innerHTML = `<div class="card empty">لا مناديب بعد — أضف أول مندوب (مثل عبد الباسط الوصابي) ونسبته، ثم اختره في حقل «المندوب» عند العميل المحتمل أو العميل.</div>`; return; }
    box.innerHTML = `<div class="grid g3 cm-reps">${reps.map((r) => `<div class="card cm-rep ${r.status !== 'نشط' ? 'off' : ''}">
        <div class="cm-h"><div><b>${esc(r.name)}</b><div class="small muted"><span class="num">${r.rate}%</span> · ${r.base === 'gross' ? 'شامل الضريبة' : 'قبل الضريبة'} · ${r.months} شهراً</div></div>${pill(r.status)}</div>
        <div class="cm-nums"><div><span>مستحق</span><b>${money(r.due)}</b></div><div><span>معتمد</span><b>${money(r.approved)}</b></div><div><span>مصروف</span><b>${money(r.paid)}</b></div></div>
        <div class="small muted">${n0(r.clients)} عميل · ${n0(r.leads)} محتمل · آخر صرف ${r.last_payout ? fdate(r.last_payout) : '—'}${r.has_portal ? ' · <span style="color:var(--teal)">الرابط مفعّل</span>' : ''}</div>
        <div class="cm-acts"><button class="btn btn-g btn-s" data-st="${r.id}">${I.doc} كشف الحساب</button>
          ${canPay() ? `<button class="btn btn-g btn-s" data-portal="${r.id}">${I.link} رابط المندوب</button>` : ''}
          ${canPay() && r.approved > 0 ? `<button class="btn btn-p btn-s" data-pay="${r.id}">${I.cash} صرف ${moneyTxt(r.approved)}</button>` : ''}
          ${can('reps', 'w') ? `<button class="btn btn-g btn-s" data-ed="${r.id}">${I.edit || ''} تعديل</button>` : ''}
          ${r.phone ? `<a class="btn btn-wa btn-s" target="_blank" rel="noopener" href="${waLink(r.phone, `السلام عليكم ${r.name}،`)}">${I.wa}</a>` : ''}</div></div>`).join('')}</div>`;
    $$('[data-st]', box).forEach((b) => b.onclick = () => statementModal(+b.dataset.st));
    $$('[data-portal]', box).forEach((b) => b.onclick = () => portalModal(reps.find((r) => r.id == b.dataset.portal)));
    $$('[data-pay]', box).forEach((b) => b.onclick = () => payoutModal(+b.dataset.pay));
    $$('[data-ed]', box).forEach((b) => b.onclick = async () => { const { row } = await api('e/reps/' + b.dataset.ed); openForm('reps', row, {}, () => { invalidate('reps'); view(); }); });
  }

  function drawRows() {
    const box = $('#cmb'); const all = S.comm.rows;
    const rows = all.filter((r) => (!st.status || r.status === st.status) && (!st.rep || r.rep_id == st.rep));
    const selectable = canPay() && rows.some((r) => r.status === 'مستحقة');
    box.innerHTML = `<div class="card"><div class="toolbar" style="margin:0 0 10px">
        <select class="inp" id="cms" style="max-width:170px"><option value="">كل الحالات</option>${['مستحقة', 'معتمدة', 'مصروفة'].map((s) => `<option ${st.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <select class="inp" id="cmr" style="max-width:220px"><option value="">كل المناديب</option>${S.comm.reps.map((r) => `<option value="${r.id}" ${st.rep == r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
        <span class="sp"></span><span class="small muted">الإجمالي المعروض: <b>${money(sum(rows))}</b></span>
        ${selectable ? `<button class="btn btn-p btn-s" id="cmap" disabled>اعتماد المحدد</button>` : ''}
        <button class="btn btn-g btn-s" id="cmcsv">تصدير Excel</button></div>
      ${rows.length ? `<div class="tbl-wrap"><table class="t"><thead><tr>${selectable ? '<th><input type="checkbox" id="cmall"></th>' : ''}<th>التاريخ</th><th>المندوب</th><th>العميل</th><th>الفاتورة</th><th>المحصّل</th><th>الأساس</th><th>النسبة</th><th>العمولة</th><th>الحالة</th></tr></thead><tbody>
        ${rows.map((r) => `<tr>${selectable ? `<td>${r.status === 'مستحقة' ? `<input type="checkbox" data-sel="${r.id}" ${st.sel.has(r.id) ? 'checked' : ''}>` : ''}</td>` : ''}
          <td>${fdate(r.earned_at)}</td><td>${esc(r.rep || '—')}</td><td>${r.client_id ? `<a href="#/client/${r.client_id}">${esc(r.client || '')}</a>` : '—'}</td>
          <td class="small">${r.invoice_id ? `<a href="#/invoice/${r.invoice_id}">${esc(r.invoice_no || '')}</a>` : esc(r.note || '')}</td>
          <td>${money(r.paid_amount)}</td><td>${money(r.base_amount)}</td><td class="num">${r.rate}%</td><td><b>${money(r.amount)}</b></td>
          <td>${pill(r.status)}${r.approver ? `<div class="small muted">${esc(r.approver)}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">لا عمولات بعد — تظهر هنا آلياً عند تسجيل أي دفعة من عميل مرتبط بمندوب.</div>'}</div>`;
    $('#cms').onchange = (e) => { st.status = e.target.value; drawRows(); };
    $('#cmr').onchange = (e) => { st.rep = e.target.value; drawRows(); };
    const ap = $('#cmap'); const sync = () => { if (ap) { ap.disabled = !st.sel.size; ap.textContent = st.sel.size ? `اعتماد ${st.sel.size} (${moneyTxt(sum(all.filter((r) => st.sel.has(r.id))))} ر.س)` : 'اعتماد المحدد'; } };
    $$('[data-sel]', box).forEach((c) => c.onchange = () => { c.checked ? st.sel.add(+c.dataset.sel) : st.sel.delete(+c.dataset.sel); sync(); });
    $('#cmall') && ($('#cmall').onchange = (e) => { $$('[data-sel]', box).forEach((c) => { c.checked = e.target.checked; e.target.checked ? st.sel.add(+c.dataset.sel) : st.sel.delete(+c.dataset.sel); }); sync(); });
    sync();
    ap && (ap.onclick = async () => {
      if (!(await confirmBox(`اعتماد ${st.sel.size} عمولة بإجمالي ${moneyTxt(sum(all.filter((r) => st.sel.has(r.id))))} ر.س للصرف؟`))) return;
      try { const r = await api('commissions/approve', { method: 'POST', body: { ids: [...st.sel] } }); toast(`اعتُمدت ${r.approved}`); st.sel.clear(); view(); } catch (e) { toast(e.message, 1); }
    });
    $('#cmcsv').onclick = () => csv(`عمولات-المناديب-${todayStr()}.csv`, ['التاريخ', 'المندوب', 'العميل', 'الفاتورة', 'المحصّل', 'الأساس', 'النسبة %', 'العمولة', 'الحالة', 'ملاحظة'],
      rows.map((r) => [r.earned_at, r.rep, r.client, r.invoice_no, r.paid_amount, r.base_amount, r.rate, r.amount, r.status, r.note]));
  }

  function drawPayouts() {
    const p = S.comm.payouts; const box = $('#cmb');
    box.innerHTML = `<div class="card">${p.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>الرقم</th><th>التاريخ</th><th>المندوب</th><th>البنود</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th><th>بواسطة</th></tr></thead><tbody>
      ${p.map((o) => `<tr><td class="num">${esc(o.number)}</td><td>${fdate(o.paid_at)}</td><td>${esc(o.rep || '')}</td><td class="num">${o.count}</td><td><b>${money(o.total)}</b></td><td>${esc(o.method || '')}</td><td class="small" dir="ltr">${esc(o.ref || '')}</td><td class="small">${esc(o.by_name || '')}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">لا صرفيات بعد.</div>'}</div>`;
  }

  function csv(name, head, rows) {
    const t = '﻿' + [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------- كشف الحساب ----------
  async function statementModal(id) {
    const m = modal({ title: 'كشف حساب المندوب', wide: true, body: '<div id="cmst"><div class="empty">جارٍ التحميل…</div></div>' });
    try {
      const s = await api('commissions/statement/' + id);
      $('#cmst', m.el).innerHTML = `<div class="cm-st-h"><div><h3 style="margin:0">${esc(s.rep.name)}</h3><span class="small muted">نسبة ${s.rep.rate}% · ${s.rep.base === 'gross' ? 'شامل الضريبة' : 'قبل الضريبة'} · مدة ${s.rep.months} شهراً من أول عقد</span></div>
          <button class="btn btn-g btn-s" data-pr>${I.print} طباعة</button></div>
        <div class="grid g4" style="margin:12px 0">${kpi('مستحق', money(s.totals.due))}${kpi('معتمد', money(s.totals.approved))}${kpi('مصروف', money(s.totals.paid), '', 'good')}${kpi('إجمالي العمولات', money(s.totals.all))}</div>
        <h4>العملاء (${s.clients.length})</h4>${s.clients.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>العميل</th><th>تنتهي مدة العمولة</th></tr></thead><tbody>${s.clients.map((c) => `<tr><td><a href="#/client/${c.id}">${esc(c.name)}</a></td><td>${c.rep_until ? fdate(c.rep_until) : '<span class="muted">تبدأ مع أول دفعة/عقد</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted">لا عملاء مرتبطون بعد.</p>'}
        ${s.leads.length ? `<h4>عملاء محتملون (${s.leads.length})</h4><p class="small">${s.leads.map((l) => `<a href="#/lead/${l.id}">${esc(l.name)}</a> ${pill(l.status)}`).join(' · ')}</p>` : ''}
        <h4>الحركات</h4>${s.rows.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>التاريخ</th><th>العميل</th><th>البيان</th><th>الأساس</th><th>العمولة</th><th>الحالة</th></tr></thead><tbody>${s.rows.map((r) => `<tr><td>${fdate(r.earned_at)}</td><td>${esc(r.client || '')}</td><td class="small">${esc(r.note || '')}</td><td>${money(r.base_amount)}</td><td><b>${money(r.amount)}</b></td><td>${pill(r.status)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted">لا حركات بعد.</p>'}
        ${s.payouts.length ? `<h4>الصرفيات</h4><p class="small">${s.payouts.map((p) => `${esc(p.number)} · ${fdate(p.paid_at)} · <b>${moneyTxt(p.total)} ر.س</b>`).join('<br>')}</p>` : ''}`;
      $('[data-pr]', m.el).onclick = () => printStatement(s);
    } catch (e) { $('#cmst', m.el).innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }
  function printStatement(s) {
    const w = window.open('', '_blank'); if (!w) return toast('اسمح بالنوافذ المنبثقة للطباعة', 1);
    const row = (r) => `<tr><td>${r.earned_at || ''}</td><td>${esc(r.client || '')}</td><td>${esc(r.note || '')}</td><td>${moneyTxt(r.base_amount)}</td><td>${moneyTxt(r.amount)}</td><td>${esc(r.status)}</td></tr>`;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف حساب ${esc(s.rep.name)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet"><style>body{font-family:Tajawal,sans-serif;color:#082A37;margin:32px}h1{color:#15556B;border-bottom:3px solid #DC9C47;padding-bottom:8px}
      table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}th{background:#308D8B;color:#fff;padding:7px}td{border-bottom:1px solid #e5ddd0;padding:6px}.c{display:flex;gap:12px;margin:14px 0}.c div{flex:1;border:1px solid #e5ddd0;border-radius:10px;padding:10px}.c b{display:block;font-size:20px;color:#15556B}</style></head><body>
      <h1>كشف حساب عمولات — ${esc(s.rep.name)}</h1><p>نُبل وابتكار للتسويق · نسبة ${s.rep.rate}% · حتى تاريخ ${todayStr()}</p>
      <div class="c"><div>مستحق<b>${moneyTxt(s.totals.due)}</b></div><div>معتمد<b>${moneyTxt(s.totals.approved)}</b></div><div>مصروف<b>${moneyTxt(s.totals.paid)}</b></div><div>الإجمالي<b>${moneyTxt(s.totals.all)}</b></div></div>
      <table><thead><tr><th>التاريخ</th><th>العميل</th><th>البيان</th><th>الأساس (ر.س)</th><th>العمولة (ر.س)</th><th>الحالة</th></tr></thead><tbody>${s.rows.map(row).join('')}</tbody></table>
      <p style="margin-top:40px">إياد المغيرة — مدير قطاع التسويق</p><script>onload=()=>print()<\/script></body></html>`);
    w.document.close();
  }

  // ---------- رابط المندوب ----------
  async function portalModal(rep) {
    const m = modal({ title: `رابط كشف الحساب — ${esc(rep.name)}`, body: `<p class="small muted">رابط خاص يتابع منه المندوب عملاءه وعمولاته المستحقة والمصروفة دون حساب دخول. إنشاء رابط جديد <b>يلغي الرابط السابق</b>.</p>
      ${rep.has_portal ? '<div class="ak-warn">للمندوب رابط مفعّل — الإنشاء سيوقفه ويصدر رابطاً جديداً.</div>' : ''}
      <label class="chk" style="margin:8px 0"><input type="checkbox" id="pwa" ${rep.phone ? 'checked' : 'disabled'}> أرسله للمندوب عبر واتساب المنصة</label><div id="pout"></div>`,
    foot: '<button class="btn btn-p" data-go>إنشاء الرابط</button><button class="btn btn-g" data-x>إغلاق</button>' });
    $('[data-x]', m.el).onclick = m.close;
    $('[data-go]', m.el).onclick = async (e) => {
      e.target.disabled = true;
      try {
        const r = await api('commissions/portal/' + rep.id, { method: 'POST', body: { send: $('#pwa', m.el).checked } });
        $('#pout', m.el).innerHTML = `<div class="ak-code"><button type="button" data-cp>نسخ</button><pre id="purl" style="direction:ltr;text-align:left">${esc(r.url)}</pre></div>
          ${rep.phone ? `<a class="btn btn-wa btn-s" target="_blank" rel="noopener" href="${waLink(rep.phone, `أهلاً ${rep.name}، هذا رابط كشف حساب عمولاتك لدى نُبل وابتكار للتسويق (خاص بك، لا تشاركه):\n${r.url}`)}">${I.wa} إرسال من واتساب جهازي</a>` : ''}`;
        $('[data-cp]', m.el).onclick = async (ev) => { try { await navigator.clipboard.writeText(r.url); ev.target.textContent = 'تم ✓'; } catch { toast('انسخ يدوياً', 1); } };
        toast($('#pwa', m.el).checked ? 'أُنشئ الرابط وأُرسل للمندوب' : 'أُنشئ الرابط'); rep.has_portal = 1;
      } catch (er) { toast(er.message, 1); e.target.disabled = false; }
    };
  }

  // ---------- الصرف ----------
  async function payoutModal(repId) {
    const s = await api('commissions/statement/' + repId);
    const { row: rep } = await api('e/reps/' + repId);
    const items = s.rows.filter((r) => r.status === 'معتمدة'); const total = sum(items);
    const m = modal({ title: `صرف عمولات — ${esc(rep.name)}`, body: `<div class="grid g2">${kpi('المبلغ المعتمد للصرف', money(total), `${items.length} بنداً`)}
        ${kpi('بيانات التحويل', esc(rep.bank_name || '—'), rep.iban ? `<span dir="ltr" class="num">${esc(rep.iban)}</span>` : '<span style="color:var(--terra)">لا آيبان مسجل</span>')}</div>
      <form class="fgrid" style="margin-top:12px"><label class="f"><span>طريقة الصرف</span><select class="inp" name="method"><option>تحويل بنكي</option><option>نقداً</option><option>شيك</option></select></label>
        <label class="f"><span>تاريخ الصرف</span><input class="inp" type="date" name="paid_at" value="${todayStr()}"></label>
        <label class="f full"><span>رقم المرجع / الحوالة</span><input class="inp" name="ref" dir="ltr"></label>
        <label class="f full"><span>ملاحظات</span><input class="inp" name="notes"></label></form>
      <p class="small muted">يُسجَّل الصرف في المصروفات (بند «عمولات») تلقائياً، وتتحول البنود إلى «مصروفة»، ويصل المندوب إشعار واتساب.</p>`,
    foot: `<button class="btn btn-p" data-go ${total > 0 ? '' : 'disabled'}>تأكيد صرف ${moneyTxt(total)} ر.س</button><button class="btn btn-g" data-x>إلغاء</button>` });
    $('[data-x]', m.el).onclick = m.close;
    $('[data-go]', m.el).onclick = async (e) => {
      const f = $('form', m.el); e.target.disabled = true;
      try {
        const r = await api('commissions/payout', { method: 'POST', body: { rep_id: repId, method: f.method.value, paid_at: f.paid_at.value, ref: f.ref.value.trim(), notes: f.notes.value.trim() } });
        toast(`تم الصرف ${r.number}`); m.close(); view();
      } catch (er) { toast(er.message, 1); e.target.disabled = false; }
    };
  }

  // ---------- التسجيل ----------
  const css = document.createElement('style');
  css.textContent = `.cm-tabs{margin:0}.cm-rep{display:flex;flex-direction:column;gap:10px}.cm-rep.off{opacity:.6}.cm-h{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.cm-h b{font-size:16px;color:var(--deep)}
    .cm-nums{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.cm-nums div{background:var(--soft,#F4EDE1);border-radius:10px;padding:8px}.cm-nums span{display:block;font-size:11.5px;color:var(--muted)}.cm-nums b{font-size:13.5px}
    .cm-acts{display:flex;flex-wrap:wrap;gap:6px}.cm-st-h{display:flex;justify-content:space-between;align-items:center;gap:10px}#cmst h4{margin:14px 0 6px;color:var(--navy)}
    .ak-tabs{display:flex;gap:6px;flex-wrap:wrap}.ak-tabs button{border:1px solid var(--line);background:#fff;border-radius:99px;padding:5px 13px;font-size:13px;cursor:pointer}.ak-tabs button.on{background:var(--navy);color:#fff;border-color:var(--navy)}
    @media(max-width:700px){.cm-nums b{font-size:12px}}`;
  document.head.appendChild(css);
  ROUTES.commissions = { title: 'المناديب والعمولات', render: view };
  const baseShell = renderShell;
  renderShell = function () {
    injectFields();
    const g = NAV.find((x) => x[0] === 'المالية');
    if (g && can('reps', 'r') && !g[1].some((i) => i[0] === 'commissions')) g[1].push(['commissions', seeComm() ? 'المناديب والعمولات' : 'المناديب', 'hand']);
    baseShell();
  };
})();
