/* المحاسبة والموارد البشرية لكل جهة (المرحلة 1ب من دمج مروج الحجاز)
   شجرة الحسابات · القيود اليومية · سندات القبض (المقبوضات) والصرف (المصروفات) · القوائم المالية والأستاذ والضريبة
   · الموظفون · مسيّر الرواتب · السلف. الأستاذ العام يُحسب في الخادم من المستندات (_lib/ledger.js). */
(() => {
  const ACC_TYPES = ['أصول', 'خصوم', 'حقوق ملكية', 'إيرادات', 'مصروفات'];
  REF.accounts = { label: (r) => `${r.code} — ${r.name}` };
  REF.employees = { label: (r) => r.name };
  const orgF = () => F('org', 'الجهة', 'select', { o: Object.entries(ORGS_UI).map(([k, o]) => [k, `${o.short} — ${o.sector}`]), list: 1, def: () => S.org || 'nubl' });

  ENT.accounts = {
    title: 'شجرة الحسابات', one: 'حساب', icon: 'layers',
    fields: [
      F('code', 'رمز الحساب', 'text', { list: 1, req: 1 }), F('name', 'اسم الحساب', 'text', { list: 1, req: 1, w: 'full' }),
      F('type', 'النوع', 'select', { o: ACC_TYPES, list: 1, filter: 1, req: 1 }), F('parent_id', 'الحساب الرئيسي', 'ref', { ref: 'accounts', list: 1 }),
      F('is_group', 'حساب تجميعي (لا يُرحَّل عليه)', 'bool'), F('active', 'نشط', 'bool', { def: 1 }), F('notes', 'ملاحظات', 'textarea', { w: 'full' }), orgF(),
    ],
  };
  ENT.journals = {
    title: 'القيود اليومية', one: 'قيد', icon: 'book',
    fields: [F('number', 'رقم القيد', 'text', { list: 1, ro: 1 }), F('date', 'التاريخ', 'date', { list: 1, def: todayStr }), F('description', 'البيان', 'text', { list: 1, w: 'full' }),
      F('total', 'المبلغ', 'money', { list: 1, ro: 1 }), F('status', 'الحالة', 'select', { o: ['مرحّل', 'مسودة'], list: 1, filter: 1, def: 'مرحّل' }), F('ref', 'المرجع'), orgF()],
  };
  ENT.employees = {
    title: 'الموظفون', one: 'موظف', icon: 'team',
    fields: [
      F('name', 'الاسم', 'text', { list: 1, req: 1 }), F('job_title', 'المسمى الوظيفي', 'text', { list: 1 }), F('phone', 'الجوال', 'phone', { list: 1 }), F('email', 'البريد', 'email'),
      F('start_date', 'تاريخ المباشرة', 'date'), F('status', 'الحالة', 'select', { o: ['على رأس العمل', 'إجازة', 'منتهية خدماته'], list: 1, filter: 1, def: 'على رأس العمل' }),
      F('basic_salary', 'الراتب الأساسي', 'money', { list: 1 }), F('housing', 'بدل السكن', 'money'), F('transport', 'بدل النقل', 'money'), F('other_allow', 'بدلات أخرى', 'money'),
      F('fixed_deduct', 'استقطاع ثابت شهري (تأمينات…)', 'money'), F('bank_name', 'البنك'), F('iban', 'الآيبان', 'text', { w: 'full' }),
      F('user_id', 'حسابه في المنصة', 'ref', { ref: 'users' }), F('notes', 'ملاحظات', 'textarea', { w: 'full' }), orgF(),
    ],
  };
  ENT.payroll = {
    title: 'مسيّر الرواتب', one: 'راتب', icon: 'cash',
    fields: [
      F('number', 'الرقم', 'text', { list: 1, ro: 1 }), F('month', 'الشهر (YYYY-MM)', 'text', { list: 1, req: 1, def: () => todayStr().slice(0, 7) }),
      F('employee_id', 'الموظف', 'ref', { ref: 'employees', list: 1, req: 1 }), F('basic', 'الأساسي', 'money'), F('allowances', 'البدلات', 'money'), F('bonus', 'مكافآت وإضافي', 'money'),
      F('deductions', 'استقطاعات', 'money'), F('advance_deduct', 'خصم السلف', 'money'), F('net', 'الصافي', 'money', { list: 1, ro: 1 }),
      F('status', 'الحالة', 'select', { o: ['مسودة', 'معتمد', 'مدفوع'], list: 1, filter: 1, def: 'مسودة' }), F('paid_date', 'تاريخ الصرف', 'date', { list: 1 }),
      F('cash_account', 'حساب الصرف', 'ref', { ref: 'accounts' }), F('notes', 'ملاحظات', 'textarea', { w: 'full' }),
    ],
  };
  ENT.advances = {
    title: 'سلف الموظفين', one: 'سلفة', icon: 'out',
    fields: [
      F('number', 'الرقم', 'text', { list: 1, ro: 1 }), F('date', 'التاريخ', 'date', { list: 1, def: todayStr }), F('employee_id', 'الموظف', 'ref', { ref: 'employees', list: 1, req: 1 }),
      F('amount', 'المبلغ', 'money', { list: 1, req: 1 }), F('installment', 'القسط الشهري', 'money', { list: 1 }), F('paid_back', 'المسدد', 'money', { list: 1, ro: 1 }),
      F('status', 'الحالة', 'select', { o: ['قائمة', 'مسددة', 'ملغاة'], list: 1, filter: 1, def: 'قائمة' }), F('cash_account', 'صُرفت من حساب', 'ref', { ref: 'accounts' }),
      F('reason', 'السبب', 'text', { w: 'full' }), F('notes', 'ملاحظات', 'textarea', { w: 'full' }),
    ],
  };
  // السندات على المقبوضات والمصروفات الحالية
  const addF = (ent, fs, after) => { const d = ENT[ent]; if (!d) return; for (const f of fs) if (!d.fields.some((x) => x.k === f.k)) { const i = after ? d.fields.findIndex((x) => x.k === after) : -1; i >= 0 ? d.fields.splice(i + 1, 0, f) : d.fields.push(f); } };
  if (ENT.payments) {
    ENT.payments.title = 'سندات القبض (المقبوضات)'; ENT.payments.one = 'سند قبض';
    ENT.payments.fields.unshift(F('number', 'رقم السند', 'text', { list: 1, ro: 1 }));
    addF('payments', [F('description', 'البيان', 'text', { w: 'full' }), F('cash_account', 'إلى حساب (الصندوق/البنك)', 'ref', { ref: 'accounts' }),
      F('account_id', 'من حساب (الطرف الدائن)', 'ref', { ref: 'accounts', hint: 'فارغ = العملاء (ذمم مدينة)' }), F('status', 'الحالة', 'select', { o: ['مرحّل', 'ملغى'], list: 1, filter: 1, def: 'مرحّل' })], 'ref');
  }
  if (ENT.expenses) {
    ENT.expenses.title = 'سندات الصرف (المصروفات)'; ENT.expenses.one = 'سند صرف';
    ENT.expenses.fields.unshift(F('number', 'رقم السند', 'text', { list: 1, ro: 1 }));
    addF('expenses', [F('account_id', 'حساب المصروف', 'ref', { ref: 'accounts', hint: 'فارغ = حسب البند' }), F('cash_account', 'من حساب (الصندوق/البنك)', 'ref', { ref: 'accounts' }),
      F('status', 'الحالة', 'select', { o: ['مرحّل', 'ملغى'], list: 1, filter: 1, def: 'مرحّل' })], 'vat');
  }
  addF('invoices', [F('revenue_account', 'حساب الإيراد', 'ref', { ref: 'accounts', hint: 'فارغ = إيرادات الخدمات 4101' })], 'subtotal');

  // القائمة الجانبية
  const fg = NAV.find((x) => x[0] === 'المالية');
  if (fg) fg[1].forEach((i) => { if (i[0] === 'payments') i[1] = 'سندات القبض'; if (i[0] === 'expenses') i[1] = 'سندات الصرف'; });
  const at = NAV.findIndex((x) => x[0] === 'المالية') + 1;
  if (!NAV.some((x) => x[0] === 'المحاسبة')) NAV.splice(at, 0,
    ['المحاسبة', [['fin', 'القوائم المالية', 'chart', 'journals'], ['journals', 'القيود اليومية', 'book', 'journals'], ['accounts', 'شجرة الحسابات', 'layers', 'accounts']]],
    ['الموارد البشرية', [['employees', 'الموظفون', 'team', 'employees'], ['payroll', 'مسيّر الرواتب', 'cash', 'payroll'], ['advances', 'سلف الموظفين', 'out', 'advances']]]);

  // تتطلب جهة محددة
  const needOrg = () => {
    if (S.org) return false;
    $('#view').innerHTML = `<div class="card" style="max-width:560px;margin:30px auto;text-align:center"><h3 style="justify-content:center">اختر الجهة</h3>
      <p class="muted">المحاسبة والموارد البشرية مستقلة لكل منشأة. اختر الجهة لعرض حساباتها:</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:12px">${Object.entries(ORGS_UI).map(([k, o]) => `<button class="btn btn-p" data-pick="${k}">${esc(o.name)}</button>`).join('')}</div></div>`;
    $$('[data-pick]').forEach((b) => b.onclick = () => $(`#orgsw [data-org="${b.dataset.pick}"]`)?.click());
    return true;
  };
  const gate = (fn) => async (...a) => { if (needOrg()) return; return fn(...a); };
  const printBtn = (k, id) => `<button class="btn btn-g btn-s" data-pv="${k}:${id}" title="طباعة">طباعة</button>`;
  const bindPrint = () => $$('[data-pv]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); const [k, id] = b.dataset.pv.split(':'); printVoucher(k, (S.lastRows || []).find((r) => r.id == id)); });

  Object.assign(ROUTES, {
    accounts: { ent: 'accounts', render: gate(async () => { await refs('accounts', true); return listView('accounts', { extra: '<button class="btn btn-g btn-s" id="seed">الشجرة الافتراضية</button>' }).then(() => {
      const b = $('#seed'); if (b) b.onclick = async () => { const r = await api('fin/seed', { method: 'POST' }); toast(r.created ? 'أُنشئت شجرة الحسابات الافتراضية' : 'الشجرة موجودة مسبقاً'); invalidate('accounts'); rerender(); }; }); }) },
    journals: { ent: 'journals', render: gate(async () => { await refs('accounts'); return listView('journals'); }) },
    employees: { ent: 'employees', render: gate(() => listView('employees')) },
    advances: { ent: 'advances', render: gate(async () => { await refs('employees'); await refs('accounts'); return listView('advances', { rowActions: (r) => printBtn('advance', r.id), after: bindPrint }); }) },
    payroll: { ent: 'payroll', render: gate(payrollView) },
    payments: { ent: 'payments', render: () => listView('payments', { rowActions: (r) => printBtn('receipt', r.id), after: bindPrint }) },
    expenses: { ent: 'expenses', render: () => listView('expenses', { rowActions: (r) => printBtn('disb', r.id), after: bindPrint }) },
    fin: { title: 'القوائم المالية', render: gate(finView) },
  });

  /* ---------- القيد اليومي: محرر البنود ---------- */
  const baseForm = openForm;
  openForm = async function (ent, row = null, preset = {}, onSaved) {
    if (ent !== 'journals') return baseForm(ent, row, preset, onSaved);
    if (needOrgModal()) return;
    const accs = (await refs('accounts', true)).filter((a) => !a.is_group && a.active !== 0);
    let lines = []; try { lines = JSON.parse(row?.lines || '[]'); } catch { /* */ }
    if (lines.length < 2) lines = [...lines, {}, {}].slice(0, Math.max(2, lines.length));
    const wr = can('journals', 'w');
    const opt = (v) => `<option value=""></option>${accs.map((a) => `<option value="${a.id}" ${a.id == v ? 'selected' : ''}>${esc(a.code + ' — ' + a.name)}</option>`).join('')}`;
    const lr = (l) => `<tr><td><select class="inp" data-k="account_id">${opt(l.account_id)}</select></td><td><input class="inp num" data-k="debit" type="number" step="0.01" value="${l.debit || ''}"></td>
      <td><input class="inp num" data-k="credit" type="number" step="0.01" value="${l.credit || ''}"></td><td><input class="inp" data-k="note" value="${esc(l.note || '')}"></td><td><button class="btn btn-g btn-s" data-rm type="button">×</button></td></tr>`;
    const body = `<form class="fgrid" id="jf"><label class="f"><span>التاريخ</span><input class="inp" type="date" name="date" value="${esc(row?.date || todayStr())}"></label>
      <label class="f"><span>الحالة</span><select class="inp" name="status">${['مرحّل', 'مسودة'].map((x) => `<option ${x === (row?.status || 'مرحّل') ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="f full"><span>البيان</span><input class="inp" name="description" value="${esc(row?.description || '')}"></label>
      <label class="f"><span>المرجع</span><input class="inp" name="ref" value="${esc(row?.ref || '')}"></label>${row ? `<label class="f"><span>الرقم</span><div class="inp" style="background:var(--soft)">${esc(row.number || '')}</div></label>` : ''}</form>
      <div class="tbl-wrap" style="margin-top:10px"><table class="t" id="jl"><thead><tr><th style="min-width:220px">الحساب</th><th>مدين</th><th>دائن</th><th>ملاحظة</th><th></th></tr></thead><tbody>${lines.map(lr).join('')}</tbody>
      <tfoot><tr><td><button class="btn btn-g btn-s" type="button" id="jadd">+ بند</button></td><td class="num" id="jdr"></td><td class="num" id="jcr"></td><td colspan="2" id="jdiff"></td></tr></tfoot></table></div>`;
    const foot = (wr ? '<button class="btn btn-p" data-save>حفظ القيد</button>' : '') + '<button class="btn btn-g" data-cancel>إغلاق</button><span class="sp"></span>' + (row && can('journals', 'd') ? '<button class="btn btn-d" data-del>حذف</button>' : '');
    const m = modal({ title: row ? `القيد ${row.number || ''}` : 'قيد يومية جديد', body, foot, wide: true });
    const read = () => $$('#jl tbody tr', m.el).map((tr) => Object.fromEntries($$('[data-k]', tr).map((i) => [i.dataset.k, i.dataset.k === 'note' || i.dataset.k === 'account_id' ? i.value : Number(i.value) || 0])));
    const calc = () => { const L = read(); const dr = L.reduce((a, l) => a + l.debit, 0), cr = L.reduce((a, l) => a + l.credit, 0);
      $('#jdr', m.el).textContent = moneyTxt(dr); $('#jcr', m.el).textContent = moneyTxt(cr);
      $('#jdiff', m.el).innerHTML = Math.abs(dr - cr) < 0.01 ? '<span class="pill t">متوازن</span>' : `<span class="pill r">فرق ${moneyTxt(Math.abs(dr - cr))}</span>`; };
    const bind = () => { $$('#jl input,#jl select', m.el).forEach((i) => i.oninput = calc); $$('[data-rm]', m.el).forEach((b) => b.onclick = () => { b.closest('tr').remove(); calc(); }); };
    $('#jadd', m.el).onclick = () => { const L = read(); const d = L.reduce((a, l) => a + l.debit - l.credit, 0); $('#jl tbody', m.el).insertAdjacentHTML('beforeend', lr(d > 0 ? { credit: d } : d < 0 ? { debit: -d } : {})); bind(); calc(); };
    bind(); calc();
    $('[data-cancel]', m.el).onclick = m.close;
    const sv = $('[data-save]', m.el);
    if (sv) sv.onclick = async () => {
      const f = $('#jf', m.el);
      const data = { date: f.date.value, status: f.status.value, description: f.description.value, ref: f.ref.value, lines: read().filter((l) => l.account_id && (l.debit || l.credit)) };
      try { sv.disabled = true; row ? await api(`e/journals/${row.id}`, { method: 'PUT', body: data }) : await api('e/journals', { method: 'POST', body: data }); invalidate('journals'); toast('تم حفظ القيد'); m.close(); onSaved ? onSaved() : rerender(); }
      catch (e) { toast(e.message, 1); sv.disabled = false; }
    };
    const del = $('[data-del]', m.el);
    if (del) del.onclick = async () => { if (!(await confirmBox('حذف هذا القيد نهائياً؟'))) return; await api(`e/journals/${row.id}`, { method: 'DELETE' }); toast('تم الحذف'); m.close(); rerender(); };
    return m;
  };
  const needOrgModal = () => { if (S.org) return false; toast('اختر الجهة أولاً من المبدّل أعلى الصفحة', 1); return true; };

  /* ---------- مسيّر الرواتب ---------- */
  async function payrollView() {
    await refs('employees'); await refs('accounts');
    await listView('payroll', {
      extra: can('payroll', 'w') ? '<input class="inp" type="month" id="prm" style="width:150px"><button class="btn btn-n" id="prrun">إعداد مسيّر الشهر</button>' : '',
      rowActions: (r) => `${r.status !== 'مدفوع' && can('payroll', 'w') ? `<button class="btn btn-p btn-s" data-pay="${r.id}">صرف</button> ` : ''}${printBtn('slip', r.id)}`,
      after: () => {
        bindPrint();
        $$('[data-pay]').forEach((b) => b.onclick = async (e) => {
          e.stopPropagation();
          const cash = (S.cache.accounts?.rows || []).filter((a) => !a.is_group && String(a.code).startsWith('110'));
          const m = modal({ title: 'صرف الراتب', body: `<form class="fgrid"><label class="f"><span>تاريخ الصرف</span><input class="inp" type="date" name="d" value="${todayStr()}"></label>
            <label class="f"><span>من حساب</span><select class="inp" name="c">${cash.map((a) => `<option value="${a.id}" ${a.code === '1102' ? 'selected' : ''}>${esc(a.code + ' — ' + a.name)}</option>`).join('')}</select></label></form>`,
          foot: '<button class="btn btn-p" data-ok>تأكيد الصرف</button><button class="btn btn-g" data-x>إلغاء</button>' });
          $('[data-x]', m.el).onclick = m.close;
          $('[data-ok]', m.el).onclick = async () => { const f = $('form', m.el); try { await api(`hr/payroll-pay/${b.dataset.pay}`, { method: 'POST', body: { paid_date: f.d.value, cash_account: f.c.value } }); toast('تم صرف الراتب وترحيله'); m.close(); invalidate('advances'); rerender(); } catch (er) { toast(er.message, 1); } };
        });
      },
    });
    const pm = $('#prm'); if (pm) pm.value = todayStr().slice(0, 7);
    const rb = $('#prrun'); if (rb) rb.onclick = async () => { try { const r = await api('hr/payroll-run', { method: 'POST', body: { month: pm.value } }); toast(`أُعدّ ${r.created} راتب لشهر ${r.month}${r.skipped ? ` (${r.skipped} موجود مسبقاً)` : ''}`); rerender(); } catch (e) { toast(e.message, 1); } };
  }

  /* ---------- القوائم المالية ---------- */
  const st = { tab: 'statements', from: todayStr().slice(0, 4) + '-01-01', to: todayStr(), acc: '' };
  const n2 = (v) => `<span class="num">${moneyTxt(v)}</span>`;
  async function finView() {
    const accs = await refs('accounts', true);
    const tabs = [['statements', 'قائمة الدخل والمركز المالي'], ['trial', 'ميزان المراجعة'], ['ledger', 'الأستاذ العام'], ['vat', 'ضريبة القيمة المضافة']];
    $('#view').innerHTML = `<div class="toolbar">${tabs.map(([k, l]) => `<button class="btn ${st.tab === k ? 'btn-p' : 'btn-g'} btn-s" data-tab="${k}">${l}</button>`).join('')}
      <span class="sp"></span><label class="small">من <input class="inp" type="date" id="ff" value="${st.from}"></label><label class="small">إلى <input class="inp" type="date" id="ft" value="${st.to}"></label>
      ${st.tab === 'ledger' ? `<select class="inp" id="fa"><option value="">كل الحسابات</option>${accs.map((a) => `<option value="${a.id}" ${a.id == st.acc ? 'selected' : ''}>${esc(a.code + ' — ' + a.name)}</option>`).join('')}</select>` : ''}
      <button class="btn btn-n btn-s" id="fprint">طباعة / PDF</button></div><div id="fout"><div class="empty">جارٍ الاحتساب…</div></div>`;
    $$('[data-tab]').forEach((b) => b.onclick = () => { st.tab = b.dataset.tab; finView(); });
    $('#ff').onchange = (e) => { st.from = e.target.value; finView(); }; $('#ft').onchange = (e) => { st.to = e.target.value; finView(); };
    const fa = $('#fa'); if (fa) fa.onchange = (e) => { st.acc = e.target.value; finView(); };
    const qs = `from=${st.from}&to=${st.to}`;
    const d = await api(`fin/${st.tab}?${qs}${st.tab === 'ledger' && st.acc ? '&account_id=' + st.acc : ''}`);
    const warn = d.unbalanced?.length ? `<div class="card" style="border-color:var(--red);margin-bottom:12px"><b>تنبيه:</b> ${d.unbalanced.length} مستند غير متوازن (غالباً حساب محذوف أو غير محدد): ${d.unbalanced.slice(0, 5).map((u) => esc(u.ref || u.desc)).join('، ')}</div>` : '';
    let html = '';
    if (st.tab === 'statements') {
      const I1 = d.income, B = d.balance;
      const rows = (list) => list.map((r) => `<tr class="${r.is_group ? 'tt' : ''}"><td>${'&nbsp;'.repeat(r.parent_id ? (r.is_group ? 2 : 4) : 0)}${esc(r.code)} — ${esc(r.name)}</td><td class="n">${n2(r.amount)}</td></tr>`).join('');
      html = `<div class="grid g2"><div class="card"><h3>قائمة الدخل <span class="muted small">${st.from} ← ${st.to}</span></h3><table class="t"><tbody>
        <tr class="sh"><td><b>الإيرادات</b></td><td></td></tr>${rows(I1.revenue)}<tr class="tt"><td><b>إجمالي الإيرادات</b></td><td class="n"><b>${n2(I1.total_revenue)}</b></td></tr>
        <tr class="sh"><td><b>المصروفات</b></td><td></td></tr>${rows(I1.expenses)}<tr class="tt"><td><b>إجمالي المصروفات</b></td><td class="n"><b>${n2(I1.total_expenses)}</b></td></tr>
        <tr class="tt"><td><b>${I1.net >= 0 ? 'صافي الربح' : 'صافي الخسارة'}</b></td><td class="n"><b style="color:${I1.net >= 0 ? 'var(--teal)' : 'var(--red)'}">${n2(I1.net)}</b></td></tr></tbody></table></div>
        <div class="card"><h3>المركز المالي <span class="muted small">كما في ${st.to}</span></h3><table class="t"><tbody>
        <tr class="sh"><td><b>الأصول</b></td><td></td></tr>${rows(B.assets)}<tr class="tt"><td><b>إجمالي الأصول</b></td><td class="n"><b>${n2(B.total_assets)}</b></td></tr>
        <tr class="sh"><td><b>الخصوم</b></td><td></td></tr>${rows(B.liabilities)}
        <tr class="sh"><td><b>حقوق الملكية</b></td><td></td></tr>${rows(B.equity)}<tr><td>صافي الأرباح (الخسائر) المتراكمة غير المقفلة</td><td class="n">${n2(B.retained)}</td></tr>
        <tr class="tt"><td><b>إجمالي الخصوم وحقوق الملكية</b></td><td class="n"><b>${n2(B.total_le)}</b></td></tr></tbody></table>
        ${Math.abs(B.diff) > 0.01 ? `<p class="small" style="color:var(--red)">فرق توازن: ${moneyTxt(B.diff)}</p>` : '<p class="small muted">✓ المركز المالي متوازن</p>'}</div></div>`;
    } else if (st.tab === 'trial') {
      html = `<div class="tbl-wrap"><table class="t"><thead><tr><th>الحساب</th><th>رصيد افتتاحي</th><th>مدين الفترة</th><th>دائن الفترة</th><th>الرصيد الختامي</th></tr></thead><tbody>
        ${d.rows.map((r) => `<tr class="${r.is_group ? 'tt' : ''}"><td>${esc(r.code)} — ${esc(r.name)}</td><td class="n">${n2(r.open)}</td><td class="n">${n2(r.dr)}</td><td class="n">${n2(r.cr)}</td><td class="n">${n2(r.close)}</td></tr>`).join('')}
        <tr class="tt"><td><b>الإجمالي (حسابات تفصيلية)</b></td><td></td><td class="n"><b>${n2(d.totals.dr)}</b></td><td class="n"><b>${n2(d.totals.cr)}</b></td><td>${Math.abs(d.totals.dr - d.totals.cr) < 0.01 ? '<span class="pill t">متوازن</span>' : '<span class="pill r">غير متوازن</span>'}</td></tr></tbody></table></div>`;
    } else if (st.tab === 'ledger') {
      html = `<div class="card" style="margin-bottom:10px">${d.account ? `<b>${esc(d.account.code)} — ${esc(d.account.name)}</b> · ` : ''}رصيد أول المدة: ${n2(d.opening)}</div>
        <div class="tbl-wrap"><table class="t"><thead><tr><th>التاريخ</th><th>المرجع</th><th>البيان</th>${d.account ? '' : '<th>الحساب</th>'}<th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>
        ${d.rows.length ? d.rows.map((r) => `<tr><td class="num">${esc(r.date)}</td><td>${r.link ? `<a href="${r.link}">${esc(r.ref || r.src)}</a>` : esc(r.ref)}</td><td>${esc(r.desc)}${r.note ? `<div class="small muted">${esc(r.note)}</div>` : ''}</td>${d.account ? '' : `<td class="small">${esc(r.account ? r.account.code + ' — ' + r.account.name : '')}</td>`}<td class="n">${r.dr ? n2(r.dr) : ''}</td><td class="n">${r.cr ? n2(r.cr) : ''}</td><td class="n">${n2(r.balance)}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">لا حركات في الفترة</td></tr>'}</tbody></table></div>`;
    } else {
      html = `<div class="grid g4">${[['المبيعات الخاضعة (قبل الضريبة)', d.sales], ['ضريبة المخرجات', d.output_vat], ['ضريبة المدخلات', d.input_vat], [d.net >= 0 ? 'الضريبة المستحقة للسداد' : 'رصيد ضريبي قابل للاسترداد', Math.abs(d.net)]]
        .map(([l, v]) => `<div class="card kpi"><div class="l small muted">${l}</div><div class="v" style="font-size:22px;font-weight:700">${n2(v)} <span class="small">ر.س</span></div></div>`).join('')}</div>
        <p class="small muted" style="margin-top:10px">المخرجات من الفواتير المُصدرة، والمدخلات من ضريبة سندات الصرف. للمطابقة مع إقرار هيئة الزكاة والضريبة والجمارك.</p>`;
    }
    $('#fout').innerHTML = warn + html;
    $('#fprint').onclick = () => { const t = tabs.find((x) => x[0] === st.tab)[1]; const c = $('#fout').cloneNode(true);
      openDoc(docShell(`${t} — ${ORGS_UI[S.org].name}`, `<div class="ttl"><h1>${esc(t)}</h1><div class="n">${st.from} ← ${st.to}</div></div>${c.innerHTML}`, { org: S.org })); };
  }

  /* ---------- طباعة السندات وقسيمة الراتب ---------- */
  function printVoucher(kind, r) {
    if (!r) return;
    const org = r.org || S.org || 'nubl'; const s = orgSettings(org);
    const acc = (id) => (id ? refLabel('accounts', id) : '');
    const box = (rows) => `<div class="meta">${rows.filter(Boolean).map(([l, v]) => `<div>${l}: <b>${v || '—'}</b></div>`).join('')}</div>`;
    let title, html;
    if (kind === 'receipt') {
      title = `سند قبض ${r.number || r.id}`;
      html = box([['رقم السند', esc(r.number || r.id)], ['التاريخ', esc(r.paid_at || '')], ['استلمنا من', esc(refLabel('clients', r.client_id) || r.description || '')], ['المبلغ', `<span class="n">${moneyTxt(r.amount)}</span> ر.س`],
        ['طريقة الدفع', esc(r.method || '')], ['المرجع', esc(r.ref || '')], r.invoice_id && ['عن الفاتورة', esc(refLabel('invoices', r.invoice_id))], ['إلى حساب', esc(acc(r.cash_account))]])
        + `<p>وذلك عن: ${esc(r.description || r.notes || '')}</p>`;
    } else if (kind === 'disb') {
      title = `سند صرف ${r.number || r.id}`;
      html = box([['رقم السند', esc(r.number || r.id)], ['التاريخ', esc(r.date || '')], ['صرفنا إلى', esc(r.vendor || '')], ['المبلغ شامل الضريبة', `<span class="n">${moneyTxt(r.amount)}</span> ر.س`],
        ['منها ضريبة', `<span class="n">${moneyTxt(r.vat)}</span>`], ['البند', esc(r.category || acc(r.account_id))], ['من حساب', esc(acc(r.cash_account))]]) + `<p>وذلك عن: ${esc(r.notes || '')}</p>`;
    } else if (kind === 'advance') {
      title = `سند سلفة ${r.number || r.id}`;
      html = box([['رقم السند', esc(r.number || r.id)], ['التاريخ', esc(r.date || '')], ['الموظف', esc(refLabel('employees', r.employee_id))], ['المبلغ', `<span class="n">${moneyTxt(r.amount)}</span> ر.س`],
        ['القسط الشهري', `<span class="n">${moneyTxt(r.installment)}</span>`], ['المسدد', `<span class="n">${moneyTxt(r.paid_back)}</span>`]]) + `<p>السبب: ${esc(r.reason || '')}</p>`;
    } else {
      title = `قسيمة راتب ${r.month} — ${refLabel('employees', r.employee_id)}`;
      html = box([['الموظف', esc(refLabel('employees', r.employee_id))], ['الشهر', esc(r.month)], ['الرقم', esc(r.number || '')], ['الحالة', esc(r.status)]])
        + `<table><thead><tr><th>البند</th><th>المبلغ</th></tr></thead><tbody>${[['الراتب الأساسي', r.basic], ['البدلات', r.allowances], ['مكافآت وإضافي', r.bonus], ['استقطاعات', -r.deductions], ['خصم السلف', -r.advance_deduct]]
          .map(([l, v]) => `<tr><td>${l}</td><td class="n">${moneyTxt(v)}</td></tr>`).join('')}</tbody></table><div class="tot"><div class="g"><span>الصافي</span><span class="n">${moneyTxt(r.net)} ر.س</span></div></div>`;
    }
    openDoc(docShell(title, `<div class="ttl"><h1>${esc(title.split(' ').slice(0, 2).join(' '))}</h1><div class="n">${esc(s.company_name || '')}</div></div>${html}
      <div class="sig"><div>المحاسب</div><div>${kind === 'receipt' ? 'المستلم' : 'المستلم / التوقيع'}</div></div>`, { org }));
  }

  // إن سبق الإقلاعُ تحميلَ هذه الوحدة: أعد بناء القائمة والصفحة
  if (S.meta && $('.side')) { renderShell(); rerender(); }

  /* ---------- الإعدادات: بيانات مروج الحجاز للمستندات + استكمال دمج المحاسبة ---------- */
  const sr = ROUTES.settings;
  if (sr) { const base = sr.render; sr.render = async (...a) => { await base(...a); moroojCard(); }; }
  function moroojCard() {
    if (me().role !== 'admin' || $('#mrj-data')) return;
    const s = S.meta.settings; const K = [['morooj_company_name', 'الاسم الرسمي'], ['morooj_cr_number', 'السجل التجاري'], ['morooj_vat_number', 'الرقم الضريبي'], ['morooj_address', 'العنوان'], ['morooj_bank_line', 'الحساب البنكي في المستندات']];
    const c = document.createElement('div'); c.className = 'card'; c.id = 'mrj-data'; c.style.marginTop = '14px';
    c.innerHTML = `<h3>بيانات مروج الحجاز في المستندات</h3><p class="muted small">تظهر في ترويسة عروض وعقود وفواتير وسندات مروج الحجاز إلى أن يُعتمد ورقها الرسمي.</p>
      <form class="fgrid">${K.map(([k, l]) => `<label class="f"><span>${l}</span><input class="inp" name="${k}" value="${esc(s[k] || (k === 'morooj_company_name' ? 'مروج الحجاز للأعمال التجارية' : ''))}"></label>`).join('')}</form>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-p" id="mrj-sv">حفظ</button><button class="btn btn-g" id="mrj-fin">استكمال دمج المحاسبة والموارد البشرية من الأرشيف</button></div>`;
    const card = $('#mrj-card'); card ? card.after(c) : ($('#view .grid.g2 > div:last-child') || $('#view')).appendChild(c);
    $('#mrj-sv').onclick = async () => { const f = $('form', c); const body = {}; K.forEach(([k]) => body[k] = f[k].value.trim()); await api('settings', { method: 'PUT', body }); S.meta = await api('meta'); toast('تم الحفظ'); };
    $('#mrj-fin').onclick = async () => { try { const r = await api('import/morooj-finish', { method: 'POST' }); const f = r.finance || {};
      toast(`المحاسبة: ${f.accounts?.total || 0} حساب · ${f.journals || 0} قيد · ${f.hr?.employees || 0} موظف · ${f.hr?.payroll || 0} راتب · ${f.hr?.advances || 0} سلفة`); } catch (e) { toast(e.message, 1); } };
  }
})();
