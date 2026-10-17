/* منصة نُبل وابتكار للتسويق — تقرير أعمار الديون وبيانات التواصل مع العملاء المدينين (متاح لكل أعضاء الفريق) */
'use strict';

const DEBT_BUCKETS = [
  { k: 'cur', l: 'لم تستحق بعد', test: (d) => d <= 0, cls: 'b', color: 'var(--navy)' },
  { k: 'd30', l: '1–30 يوماً', test: (d) => d >= 1 && d <= 30, cls: 'g', color: 'var(--gold)' },
  { k: 'd60', l: '31–60 يوماً', test: (d) => d >= 31 && d <= 60, cls: 'o', color: 'var(--terra)' },
  { k: 'd90', l: '61–90 يوماً', test: (d) => d >= 61 && d <= 90, cls: 'r', color: 'var(--red)' },
  { k: 'd90p', l: 'أكثر من 90 يوماً', test: (d) => d > 90, cls: 'r', color: '#7A1E12' },
];
const debtBucket = (days) => DEBT_BUCKETS.find((b) => b.test(Number(days) || 0));

function debtReminder(c) {
  const nums = c.invoices.map((i) => i.number).join('، ');
  return `السلام عليكم ${c.contact_name || c.name}،\nنشكركم على ثقتكم بـ«نُبل وابتكار للتسويق». نودّ تذكيركم بالمبالغ المستحقة بإجمالي ${moneyTxt(c.balance)} ر.س `
    + `(${c.invoices.length > 1 ? 'الفواتير' : 'الفاتورة'}: ${nums}). نأمل التكرم بالسداد أو إفادتنا بموعده المتوقع، ونسعد بخدمتكم دائماً.`;
}

async function debtsView() {
  S.debtData = await api('debts');
  debtsRender();
}
function debtsRender() {
  const d = S.debtData;
  const st = (S.debt ||= { q: '', b: '', open: {} });
  // تجميع الفواتير حسب العميل
  const byClient = new Map();
  d.clients.forEach((c) => byClient.set(c.id, { ...c, invoices: [], balance: 0, overdue: 0, maxDays: -Infinity, b: { cur: 0, d30: 0, d60: 0, d90: 0, d90p: 0 } }));
  d.invoices.forEach((i) => {
    const c = byClient.get(i.client_id) || byClient.set(i.client_id, { id: i.client_id, name: 'عميل غير محدد', invoices: [], balance: 0, overdue: 0, maxDays: -Infinity, b: { cur: 0, d30: 0, d60: 0, d90: 0, d90p: 0 } }).get(i.client_id);
    const bal = Number(i.balance) || 0; const bk = debtBucket(i.days);
    c.invoices.push(i); c.balance += bal; c.b[bk.k] += bal; if (i.days > 0) c.overdue += bal; c.maxDays = Math.max(c.maxDays, Number(i.days) || 0);
  });
  const all = [...byClient.values()].filter((c) => c.invoices.length).sort((a, b) => b.maxDays - a.maxDays || b.balance - a.balance);
  const tot = { bal: 0, over: 0, n: all.length, maxDays: 0, b: { cur: 0, d30: 0, d60: 0, d90: 0, d90p: 0 }, cnt: { cur: 0, d30: 0, d60: 0, d90: 0, d90p: 0 } };
  all.forEach((c) => { tot.bal += c.balance; tot.over += c.overdue; tot.maxDays = Math.max(tot.maxDays, c.maxDays); });
  d.invoices.forEach((i) => { const k = debtBucket(i.days).k; tot.b[k] += Number(i.balance) || 0; tot.cnt[k] += 1; });

  const q = st.q.trim();
  const list = all.filter((c) => (!q || [c.name, c.brand, c.contact_name, c.phone, c.email].some((x) => String(x || '').includes(q)))
    && (!st.b || c.b[st.b] > 0));
  const canAct = can('activities', 'w'); const canInv = can('invoices', 'r');
  const daysTxt = (n) => (n > 0 ? `<b style="color:${debtBucket(n).color}">متأخر <span class="num">${n}</span> يوماً</b>` : n === 0 ? 'يستحق اليوم' : `يستحق بعد <span class="num">${-n}</span> يوماً`);
  const contact = (c) => `<div class="dbt-ct">${c.contact_name ? `<b>${esc(c.contact_name)}</b>` : '<span class="muted">—</span>'}
    ${c.phone ? `<a href="tel:${esc(c.phone)}" class="num" dir="ltr">${esc(c.phone)}</a>` : '<span class="muted small">لا يوجد جوال</span>'}
    ${c.email ? `<a href="mailto:${esc(c.email)}" class="small" dir="ltr">${esc(c.email)}</a>` : ''}${c.city ? `<span class="small muted">${esc(c.city)}</span>` : ''}
    <span class="dbt-acts">${c.phone ? `<a class="btn btn-wa btn-s" target="_blank" rel="noopener" href="${waLink(c.phone, debtReminder(c))}">${I.wa} تذكير واتساب</a>` : ''}
    ${canAct ? `<button class="btn btn-g btn-s" data-act="${c.id}">تسجيل تواصل</button>` : ''}</span></div>`;

  V().innerHTML = `<div class="toolbar"><div class="search">${I.search}<input class="inp" id="dq" style="padding-inline-start:34px" placeholder="ابحث باسم العميل أو الجوال…" value="${esc(st.q)}"></div>
      <select class="inp" id="db" style="max-width:190px"><option value="">كل الأعمار</option>${DEBT_BUCKETS.map((b) => `<option value="${b.k}" ${st.b === b.k ? 'selected' : ''}>${b.l}</option>`).join('')}</select>
      <span class="sp"></span><span class="small muted">محدّث حتى ${fdate(d.today)}</span>
      <button class="btn btn-g btn-s" id="csv">${I.upload} تصدير Excel</button><button class="btn btn-g btn-s" onclick="printOfficialView('تقرير أعمار الديون')">${I.print} طباعة / PDF</button></div>
    <div class="grid g4">${kpi('إجمالي الديون القائمة', `${n0(tot.bal)}<small>ر.س</small>`, `${n0(d.invoices.length)} فاتورة`)}
      ${kpi('المتأخر عن الاستحقاق', `${n0(tot.over)}<small>ر.س</small>`, tot.bal ? `${Math.round((tot.over / tot.bal) * 100)}% من الإجمالي` : '', tot.over ? 'warn' : 'good')}
      ${kpi('عملاء عليهم مستحقات', n0(tot.n))}${kpi('أقدم تأخير', tot.maxDays > 0 ? `${n0(tot.maxDays)}<small>يوماً</small>` : '—', '', tot.maxDays > 60 ? 'warn' : '')}</div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h3>${I.chart} أعمار الديون</h3>${bars(DEBT_BUCKETS.map((b) => ({ k: b.l, n: tot.b[b.k], c: tot.cnt[b.k] })), { fmt: moneyTxt, color: 'var(--terra)' })}
        <p class="small muted" style="margin-top:8px">العمر محسوب من تاريخ الاستحقاق حتى اليوم، على الفواتير المصدرة غير المسددة بالكامل.</p></div>
      <div class="card"><h3>${I.bill} دفعات حلّ موعدها ولم تُصدر فاتورتها</h3>${d.pending.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>العميل</th><th>البيان</th><th>الاستحقاق</th><th>المبلغ</th></tr></thead><tbody>
        ${d.pending.map((p) => `<tr><td>${esc(p.client_name || '—')}</td><td class="small">${esc(p.description || p.number)}</td><td>${fdate(p.due_date)}</td><td>${money(p.total)}</td></tr>`).join('')}</tbody></table></div>
        <p class="small muted" style="margin-top:8px">مسودات مجدولة من العقود — تحتاج إصداراً من المالية لتدخل في أعمار الديون.</p>` : '<div class="empty small">لا توجد دفعات معلّقة الإصدار</div>'}</div></div>
    <div class="card" style="margin-top:14px"><h3>${I.users} العملاء المدينون وبيانات التواصل <span class="pill b">${n0(list.length)}</span></h3>
      ${list.length ? `<div class="tbl-wrap"><table class="t dbt"><thead><tr><th>العميل</th><th>جهة التواصل</th><th>المستحق</th>${DEBT_BUCKETS.map((b) => `<th class="small">${b.l}</th>`).join('')}<th>أقدم تأخير</th><th>آخر دفعة</th><th>آخر تواصل</th><th>مسؤول الحساب</th></tr></thead><tbody>
      ${list.map((c) => `<tr class="dbt-row" data-c="${c.id}"><td class="dbt-nm"><a href="#/client/${c.id}"><b>${esc(c.name)}</b></a>${c.brand && c.brand !== c.name ? `<div class="small muted">${esc(c.brand)}</div>` : ''}
          <div class="small"><button class="lnk" data-tg="${c.id}">${st.open[c.id] ? '▾' : '◂'} ${c.invoices.length} ${c.invoices.length > 1 ? 'فواتير' : 'فاتورة'}</button></div></td>
        <td>${contact(c)}</td><td><b>${money(c.balance)}</b></td>
        ${DEBT_BUCKETS.map((b) => `<td class="num small" style="${c.b[b.k] ? 'color:' + b.color + ';font-weight:700' : 'color:var(--muted)'}">${c.b[b.k] ? moneyTxt(c.b[b.k]) : '—'}</td>`).join('')}
        <td class="small">${daysTxt(c.maxDays)}</td>
        <td class="small">${c.last_payment ? `${fdate(c.last_payment)}<div class="muted">${money(c.last_payment_amount)}</div>` : '<span class="muted">لا دفعات</span>'}</td>
        <td class="small">${c.last_contact ? `${fdate(c.last_contact)}<div class="muted">${esc(c.last_contact_note || '')}</div>` : '<span class="muted">لا يوجد</span>'}</td>
        <td class="small">${esc(c.manager_name || '—')}</td>
</tr>
        ${st.open[c.id] ? `<tr class="dbt-sub"><td colspan="${8 + DEBT_BUCKETS.length}"><table class="t"><thead><tr><th>الفاتورة</th><th>البيان</th><th>الإصدار</th><th>الاستحقاق</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>العمر</th></tr></thead><tbody>
          ${c.invoices.map((i) => `<tr><td>${canInv ? `<a href="#/invoice/${i.id}">${esc(i.number)}</a>` : esc(i.number)}</td><td class="small">${esc(i.description || '')}</td><td>${fdate(i.issue_date)}</td><td>${fdate(i.due_date)}</td>
            <td>${money(i.total)}</td><td>${money(i.paid)}</td><td><b>${money(i.balance)}</b></td><td><span class="pill ${debtBucket(i.days).cls}">${debtBucket(i.days).l}</span></td></tr>`).join('')}</tbody></table></td></tr>` : ''}`).join('')}
      </tbody></table></div>` : `<div class="empty">${all.length ? 'لا نتائج مطابقة للبحث' : 'لا توجد ديون قائمة — كل الفواتير المصدرة مسددة.'}</div>`}
      <p class="small muted" style="margin-top:8px">التقرير متاح لكل أعضاء الفريق للاطلاع والمتابعة. التحصيل وتسجيل الدفعات من صلاحية المالية، وأي تواصل مع العميل يُسجَّل من زر «تسجيل تواصل» ليظهر للجميع.</p></div>`;

  $('#dq').oninput = debounce((e) => { st.q = e.target.value; debtsRender(); const el = $('#dq'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 300);
  $('#db').onchange = (e) => { st.b = e.target.value; debtsRender(); };
  $$('[data-tg]').forEach((b) => b.onclick = () => { st.open[b.dataset.tg] = !st.open[b.dataset.tg]; debtsRender(); });
  $$('[data-act]').forEach((b) => b.onclick = () => openForm('activities', null,
    { client_id: +b.dataset.act, kind: 'مكالمة', subject: 'متابعة تحصيل مستحقات', at: new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 16) }, debtsView));
  $('#csv').onclick = () => {
    const head = ['العميل', 'جهة التواصل', 'الجوال', 'البريد', 'المدينة', 'مسؤول الحساب', 'الفاتورة', 'البيان', 'تاريخ الإصدار', 'تاريخ الاستحقاق', 'الإجمالي', 'المدفوع', 'المتبقي', 'أيام التأخير', 'الشريحة', 'آخر دفعة', 'آخر تواصل'];
    const rows = list.flatMap((c) => c.invoices.map((i) => [c.name, c.contact_name, c.phone, c.email, c.city, c.manager_name, i.number, i.description, i.issue_date, i.due_date,
      i.total, i.paid, i.balance, Math.max(0, i.days), debtBucket(i.days).l, c.last_payment, (c.last_contact || '').slice(0, 10)]));
    const csv = '﻿' + [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `أعمار-الديون-${d.today}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
}

// التسجيل في القائمة والمسارات — متاح للجميع (بلا صلاحية مطلوبة)
ROUTES.debts = { title: 'أعمار الديون والمستحقات', render: debtsView };
(() => { const g = NAV.find((x) => x[0] === 'المالية'); if (g && !g[1].some((i) => i[0] === 'debts')) g[1].unshift(['debts', 'أعمار الديون', 'clock']); })();
I.clock = P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
