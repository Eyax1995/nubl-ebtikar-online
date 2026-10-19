// المحاسبة لكل جهة: شجرة الحسابات + الأستاذ العام المحسوب من المستندات (لا قيود مكررة تُخزَّن)
// المصادر: الفواتير (ذمم/إيراد/ضريبة مخرجات) · سندات القبض = payments · سندات الصرف = expenses (مع ضريبة المدخلات)
// · القيود اليدوية المرحّلة · السلف · مسيّر الرواتب المدفوع.
import { json, bad, HttpError, round2, today, nextNumber, audit } from './core.js';
import { ORGS } from './schema.js';

// شجرة حسابات افتراضية (من منصة مروج الحجاز، عامة لكيانات الخدمات): [رمز، اسم، نوع، رمز الأب، تجميعي]
export const COA_SEED = [
  ['1', 'الأصول', 'أصول', '', 1], ['11', 'الأصول المتداولة', 'أصول', '1', 1],
  ['1101', 'النقدية في الصندوق', 'أصول', '11'], ['1102', 'البنك', 'أصول', '11'], ['1103', 'مستحقات بوابات الدفع والمتاجر', 'أصول', '11'], ['1104', 'العملاء (ذمم مدينة)', 'أصول', '11'],
  ['1105', 'ضريبة القيمة المضافة — مدخلات', 'أصول', '11'], ['1106', 'مصروفات مدفوعة مقدماً', 'أصول', '11'], ['1107', 'المخزون', 'أصول', '11'], ['1108', 'سلف الموظفين', 'أصول', '11'],
  ['12', 'الأصول غير المتداولة', 'أصول', '1', 1], ['1201', 'أجهزة ومعدات', 'أصول', '12'], ['1202', 'أثاث ومفروشات', 'أصول', '12'], ['1203', 'مجمع الإهلاك', 'أصول', '12'],
  ['2', 'الخصوم', 'خصوم', '', 1], ['21', 'الخصوم المتداولة', 'خصوم', '2', 1],
  ['2101', 'الموردون (ذمم دائنة)', 'خصوم', '21'], ['2102', 'ضريبة القيمة المضافة — مخرجات', 'خصوم', '21'], ['2103', 'مصروفات مستحقة', 'خصوم', '21'], ['2104', 'رواتب مستحقة', 'خصوم', '21'], ['2105', 'إيرادات مقدمة', 'خصوم', '21'],
  ['22', 'الخصوم غير المتداولة', 'خصوم', '2', 1], ['2201', 'مخصص مكافأة نهاية الخدمة', 'خصوم', '22'], ['2202', 'قروض طويلة الأجل', 'خصوم', '22'],
  ['3', 'حقوق الملكية', 'حقوق ملكية', '', 1], ['3101', 'رأس المال', 'حقوق ملكية', '3'], ['3102', 'جاري المالك / المركز الرئيسي', 'حقوق ملكية', '3'], ['3103', 'الأرباح المبقاة', 'حقوق ملكية', '3'],
  ['4', 'الإيرادات', 'إيرادات', '', 1], ['4101', 'إيرادات الخدمات', 'إيرادات', '4'], ['4102', 'إيرادات الباقات الشهرية', 'إيرادات', '4'], ['4103', 'مبيعات المتجر الإلكتروني', 'إيرادات', '4'], ['4104', 'إيرادات أخرى', 'إيرادات', '4'],
  ['5', 'المصروفات', 'مصروفات', '', 1], ['51', 'المصروفات التشغيلية', 'مصروفات', '5', 1],
  ['5101', 'إعلانات ممولة', 'مصروفات', '51'], ['5102', 'اشتراكات وأنظمة', 'مصروفات', '51'], ['5103', 'رسوم المنصات والمتاجر', 'مصروفات', '51'], ['5104', 'رواتب ومكافآت', 'مصروفات', '51'],
  ['5105', 'تصميم ومحتوى ومستقلون', 'مصروفات', '51'], ['5106', 'تصوير وإنتاج', 'مصروفات', '51'], ['5107', 'شحن وتوصيل', 'مصروفات', '51'], ['5108', 'أدوات ومعدات', 'مصروفات', '51'],
  ['5109', 'إيجار ومرافق', 'مصروفات', '51'], ['5110', 'مصروفات أخرى', 'مصروفات', '51'], ['5111', 'رسوم بنكية', 'مصروفات', '51'], ['5112', 'مصروف الإهلاك', 'مصروفات', '51'],
  ['5113', 'عمولات المناديب', 'مصروفات', '51'], ['5114', 'طباعة ومطبوعات', 'مصروفات', '51'], ['5115', 'نقل ومواصلات', 'مصروفات', '51'],
  ['52', 'تكلفة المبيعات', 'مصروفات', '5', 1], ['5201', 'تكلفة البضاعة المباعة', 'مصروفات', '52'],
];
// بنود المصروفات (منصتنا + مروج) ← رمز الحساب
const EXP = {
  'رواتب': '5104', 'رواتب ومكافآت': '5104', 'عمولات': '5113', 'اشتراكات وأدوات': '5102', 'اشتراكات وأنظمة': '5102', 'إنتاج وتصوير': '5106', 'تصوير': '5106',
  'طباعة (الكيان الأم)': '5114', 'مستقلون': '5105', 'تصميم ومحتوى': '5105', 'إعلانات الكيان': '5101', 'إعلانات ممولة': '5101', 'نقل ومواصلات': '5115',
  'رسوم سلة': '5103', 'شحن وتوصيل': '5107', 'أدوات ومعدات': '5108', 'إيجار ومرافق': '5109',
};
const cashFor = (m) => (m === 'نقداً' ? '1101' : m === 'سلة' || m === 'رابط دفع' ? '1103' : '1102');
const n = (x) => Number(x) || 0;

export function needOrg(user) {
  if (!user.org || !ORGS[user.org]) throw new HttpError(400, 'المحاسبة والموارد البشرية لكل جهة على حدة — اختر الجهة من المبدّل أعلى الصفحة');
  return user.org;
}

export async function ensureCoa(db, org) {
  const c = await db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE org = ?').bind(org).first('n');
  if (c) return false;
  for (const [code, name, type, , g] of COA_SEED) {
    await db.prepare('INSERT INTO accounts (code, name, type, is_group, org) VALUES (?,?,?,?,?)').bind(code, name, type, g ? 1 : 0, org).run();
  }
  const { results } = await db.prepare('SELECT id, code FROM accounts WHERE org = ?').bind(org).all();
  const id = Object.fromEntries(results.map((r) => [r.code, r.id]));
  await db.batch(COA_SEED.filter((r) => r[3]).map(([code, , , p]) => db.prepare('UPDATE accounts SET parent_id = ? WHERE id = ?').bind(id[p], id[code])));
  return true;
}

async function chart(db, org) {
  await ensureCoa(db, org);
  const { results } = await db.prepare('SELECT * FROM accounts WHERE org = ? ORDER BY code').bind(org).all();
  const byCode = Object.fromEntries(results.map((a) => [a.code, a]));
  return { list: results, byId: Object.fromEntries(results.map((a) => [a.id, a])), A: (c) => byCode[c]?.id || null };
}

// كل القيود (محسوبة) لجهة حتى تاريخ
export async function entries(db, org, to) {
  const ch = await chart(db, org); const A = ch.A; const out = [];
  const valid = (id) => (id && ch.byId[id] ? Number(id) : null);
  const push = (e, lines) => { const L = lines.filter((l) => l.acc && (l.dr || l.cr)).map((l) => ({ ...l, dr: round2(l.dr), cr: round2(l.cr) })); if (L.length) out.push({ ...e, lines: L }); };
  const q = async (sql, ...a) => (await db.prepare(sql).bind(...a).all()).results;
  const T = to || '9999-12-31';
  const cl = Object.fromEntries((await q('SELECT id, name FROM clients WHERE org = ?', org)).map((r) => [r.id, r.name]));
  for (const i of await q("SELECT * FROM invoices WHERE org = ? AND status NOT IN ('مسودة','ملغاة') AND COALESCE(issue_date, substr(created_at,1,10)) <= ?", org, T)) {
    push({ date: i.issue_date || String(i.created_at).slice(0, 10), ref: i.number, desc: `فاتورة — ${cl[i.client_id] || ''} ${i.description ? '— ' + i.description : ''}`.trim(), src: 'فاتورة', link: `#/invoice/${i.id}` },
      [{ acc: A('1104'), dr: n(i.total), cr: 0 }, { acc: valid(i.revenue_account) || A('4101'), dr: 0, cr: n(i.subtotal) }, { acc: A('2102'), dr: 0, cr: n(i.vat) }]);
  }
  for (const p of await q("SELECT * FROM payments WHERE org = ? AND COALESCE(status,'مرحّل') != 'ملغى' AND COALESCE(paid_at, substr(created_at,1,10)) <= ?", org, T)) {
    push({ date: p.paid_at || String(p.created_at).slice(0, 10), ref: p.number || p.ref || '', desc: `سند قبض — ${cl[p.client_id] || ''} ${p.description || p.notes || ''}`.trim(), src: 'سند قبض', link: '#/payments' },
      [{ acc: valid(p.cash_account) || A(cashFor(p.method)), dr: n(p.amount), cr: 0 }, { acc: valid(p.account_id) || A('1104'), dr: 0, cr: n(p.amount) }]);
  }
  for (const x of await q("SELECT * FROM expenses WHERE org = ? AND COALESCE(status,'مرحّل') != 'ملغى' AND COALESCE(date, substr(created_at,1,10)) <= ?", org, T)) {
    const vat = n(x.vat);
    push({ date: x.date || String(x.created_at).slice(0, 10), ref: x.number || '', desc: `سند صرف — ${x.vendor || ''} ${x.notes ? '— ' + x.notes : ''}`.trim(), src: 'سند صرف', link: '#/expenses' },
      [{ acc: valid(x.account_id) || A(EXP[x.category] || '5110'), dr: n(x.amount) - vat, cr: 0 }, { acc: A('1105'), dr: vat, cr: 0 }, { acc: valid(x.cash_account) || A('1102'), dr: 0, cr: n(x.amount) }]);
  }
  for (const j of await q("SELECT * FROM journals WHERE org = ? AND COALESCE(status,'مرحّل') = 'مرحّل' AND date <= ?", org, T)) {
    let L = []; try { L = JSON.parse(j.lines || '[]'); } catch { L = []; }
    push({ date: j.date, ref: j.number || '', desc: j.description || 'قيد يومية', src: 'قيد يدوي', link: '#/journals' },
      L.map((l) => ({ acc: valid(l.account_id), dr: n(l.debit), cr: n(l.credit), note: l.note || '' })));
  }
  const em = Object.fromEntries((await q('SELECT id, name FROM employees WHERE org = ?', org)).map((r) => [r.id, r.name]));
  for (const a of await q("SELECT * FROM advances WHERE org = ? AND status != 'ملغاة' AND date <= ?", org, T)) {
    push({ date: a.date, ref: a.number || '', desc: `سلفة — ${em[a.employee_id] || ''}`, src: 'سلفة موظف', link: '#/advances' },
      [{ acc: A('1108'), dr: n(a.amount), cr: 0 }, { acc: valid(a.cash_account) || A('1102'), dr: 0, cr: n(a.amount) }]);
  }
  for (const p of await q("SELECT * FROM payroll WHERE org = ? AND status = 'مدفوع' AND COALESCE(paid_date, month || '-28') <= ?", org, T)) {
    const gross = n(p.basic) + n(p.allowances) + n(p.bonus);
    push({ date: p.paid_date || p.month + '-28', ref: p.number || '', desc: `راتب ${p.month} — ${em[p.employee_id] || ''}`, src: 'مسيّر رواتب', link: '#/payroll' },
      [{ acc: A('5104'), dr: gross, cr: 0 }, { acc: A('1108'), dr: 0, cr: n(p.advance_deduct) }, { acc: A('2103'), dr: 0, cr: n(p.deductions) },
        { acc: valid(p.cash_account) || A('1102'), dr: 0, cr: round2(gross - n(p.advance_deduct) - n(p.deductions)) }]);
  }
  out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { ch, entries: out };
}

const sumLines = (es, from, to, filter) => {
  const b = {};
  for (const e of es) {
    if (from && e.date < from) continue; if (to && e.date > to) continue;
    for (const l of e.lines) { if (filter && !filter(l)) continue; const x = (b[l.acc] ||= { dr: 0, cr: 0 }); x.dr += l.dr; x.cr += l.cr; }
  }
  return b;
};
// تجميع على الحسابات الأب
function rollup(ch, b) {
  const t = {};
  for (const [id, v] of Object.entries(b)) {
    let a = ch.byId[id];
    while (a) { const x = (t[a.id] ||= { dr: 0, cr: 0 }); x.dr += v.dr; x.cr += v.cr; a = a.parent_id ? ch.byId[a.parent_id] : null; }
  }
  return t;
}
const natDebit = (type) => ['أصول', 'مصروفات'].includes(type);

export async function finRoute(db, request, user, what) {
  const url = new URL(request.url);
  const org = needOrg(user);
  if (!['admin', 'manager', 'finance', 'executive'].includes(user.role)) return bad('المحاسبة للإدارة والمالية', 403);
  const from = url.searchParams.get('from') || today().slice(0, 4) + '-01-01';
  const to = url.searchParams.get('to') || today();

  if (what === 'seed' && request.method === 'POST') { const made = await ensureCoa(db, org); return json({ ok: true, created: made }); }

  const { ch, entries: es } = await entries(db, org, to);
  const unbalanced = es.filter((e) => Math.abs(e.lines.reduce((s, l) => s + l.dr - l.cr, 0)) > 0.01).map((e) => ({ date: e.date, ref: e.ref, desc: e.desc }));
  const acc = (id) => { const a = ch.byId[id]; return a ? { id: a.id, code: a.code, name: a.name, type: a.type, parent_id: a.parent_id, is_group: a.is_group } : null; };

  if (what === 'ledger') {
    const aid = Number(url.searchParams.get('account_id')) || null;
    const ids = aid ? new Set([aid, ...ch.list.filter((a) => { let p = a; while (p) { if (p.parent_id === aid) return true; p = p.parent_id ? ch.byId[p.parent_id] : null; } return false; }).map((a) => a.id)]) : null;
    let open = 0; const rows = [];
    for (const e of es) for (const l of e.lines) {
      if (ids && !ids.has(l.acc)) continue;
      if (e.date < from) { open += l.dr - l.cr; continue; }
      rows.push({ date: e.date, ref: e.ref, desc: e.desc, src: e.src, link: e.link, account: acc(l.acc), dr: l.dr, cr: l.cr, note: l.note || '' });
    }
    let bal = open; rows.forEach((r) => { bal = round2(bal + r.dr - r.cr); r.balance = bal; });
    return json({ org, from, to, account: aid ? acc(aid) : null, opening: round2(open), rows: rows.slice(-3000), unbalanced });
  }
  if (what === 'trial') {
    const openB = rollup(ch, sumLines(es, null, prevDay(from)));
    const perB = rollup(ch, sumLines(es, from, to));
    const rows = ch.list.map((a) => {
      const o = openB[a.id] || { dr: 0, cr: 0 }; const p = perB[a.id] || { dr: 0, cr: 0 };
      const close = o.dr + p.dr - o.cr - p.cr;
      return { ...acc(a.id), open: round2(o.dr - o.cr), dr: round2(p.dr), cr: round2(p.cr), close: round2(close) };
    }).filter((r) => r.open || r.dr || r.cr || r.close);
    const leaf = rows.filter((r) => !r.is_group);
    return json({ org, from, to, rows, totals: { dr: round2(leaf.reduce((s, r) => s + r.dr, 0)), cr: round2(leaf.reduce((s, r) => s + r.cr, 0)) }, unbalanced });
  }
  if (what === 'statements') {
    const per = rollup(ch, sumLines(es, from, to));
    const cum = rollup(ch, sumLines(es, null, to));
    const line = (a, b) => { const v = b[a.id] || { dr: 0, cr: 0 }; return round2(natDebit(a.type) ? v.dr - v.cr : v.cr - v.dr); };
    const sect = (type, b) => ch.list.filter((a) => a.type === type).map((a) => ({ ...acc(a.id), amount: line(a, b) })).filter((r) => r.amount);
    const top = (type, b) => ch.list.filter((a) => a.type === type && !a.parent_id).reduce((s, a) => s + line(a, b), 0);
    const revenue = round2(top('إيرادات', per)); const expense = round2(top('مصروفات', per));
    const netCum = round2(top('إيرادات', cum) - top('مصروفات', cum));
    const assets = round2(top('أصول', cum)); const liab = round2(top('خصوم', cum)); const eq = round2(top('حقوق ملكية', cum));
    return json({
      org, from, to, unbalanced,
      income: { revenue: sect('إيرادات', per), expenses: sect('مصروفات', per), total_revenue: revenue, total_expenses: expense, net: round2(revenue - expense) },
      balance: { assets: sect('أصول', cum), liabilities: sect('خصوم', cum), equity: sect('حقوق ملكية', cum), total_assets: assets, total_liabilities: liab,
        total_equity: eq, retained: netCum, total_le: round2(liab + eq + netCum), diff: round2(assets - (liab + eq + netCum)) },
    });
  }
  if (what === 'vat') {
    const b = sumLines(es, from, to);
    const out = b[ch.A('2102')] || { dr: 0, cr: 0 }; const inp = b[ch.A('1105')] || { dr: 0, cr: 0 };
    const sales = round2(es.filter((e) => e.src === 'فاتورة' && e.date >= from && e.date <= to).reduce((s, e) => s + e.lines.filter((l) => l.cr && l.acc !== ch.A('2102')).reduce((a, l) => a + l.cr, 0), 0));
    const outV = round2(out.cr - out.dr); const inV = round2(inp.dr - inp.cr);
    return json({ org, from, to, sales, output_vat: outV, input_vat: inV, net: round2(outV - inV) });
  }
  return bad('غير معروف', 404);
}
const prevDay = (d) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };

// ---------- الموارد البشرية: إعداد مسيّر شهر وصرفه ----------
export async function hrRoute(db, request, user, what, id) {
  const org = needOrg(user);
  if (!['admin', 'finance'].includes(user.role)) return bad('الرواتب للمدير العام والمالية', 403);
  const body = await request.json().catch(() => ({}));
  if (what === 'payroll-run' && request.method === 'POST') {
    const month = /^\d{4}-\d{2}$/.test(body.month || '') ? body.month : today().slice(0, 7);
    await ensureCoa(db, org);
    const emps = (await db.prepare("SELECT * FROM employees WHERE org = ? AND status = 'على رأس العمل'").bind(org).all()).results;
    const done = new Set((await db.prepare('SELECT employee_id FROM payroll WHERE org = ? AND month = ?').bind(org, month).all()).results.map((r) => r.employee_id));
    let created = 0;
    for (const e of emps) {
      if (done.has(e.id)) continue;
      const adv = (await db.prepare("SELECT * FROM advances WHERE employee_id = ? AND status = 'قائمة'").bind(e.id).all()).results;
      const advDed = round2(adv.reduce((s, a) => s + Math.min(n(a.installment) || n(a.amount), n(a.amount) - n(a.paid_back)), 0));
      const allow = round2(n(e.housing) + n(e.transport) + n(e.other_allow));
      const ded = n(e.fixed_deduct);
      const net = round2(n(e.basic_salary) + allow - ded - advDed);
      await db.prepare(`INSERT INTO payroll (number, month, employee_id, basic, allowances, bonus, deductions, advance_deduct, net, status, org, created_by)
        VALUES (?,?,?,?,?,0,?,?,?,'مسودة',?,?)`).bind(await nextNumber(db, 'payroll', 'PR', org), month, e.id, n(e.basic_salary), allow, ded, advDed, net, org, user.id).run();
      created++;
    }
    await audit(db, user, 'payroll-run', 'payroll', null, `${org} ${month}: ${created}`);
    return json({ month, created, skipped: done.size });
  }
  if (what === 'payroll-pay' && id && request.method === 'POST') {
    const p = await db.prepare('SELECT * FROM payroll WHERE id = ? AND org = ?').bind(id, org).first();
    if (!p) return bad('غير موجود', 404);
    if (p.status === 'مدفوع') return bad('المسيّر مصروف مسبقاً');
    const ch = await chart(db, org);
    const cash = body.cash_account && ch.byId[body.cash_account] ? Number(body.cash_account) : ch.A('1102');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.paid_date || '') ? body.paid_date : today();
    await db.prepare("UPDATE payroll SET status = 'مدفوع', paid_date = ?, cash_account = ?, updated_at = datetime('now') WHERE id = ?").bind(date, cash, id).run();
    // استرداد السلف من الاستقطاع
    let left = n(p.advance_deduct);
    const adv = (await db.prepare("SELECT * FROM advances WHERE employee_id = ? AND status = 'قائمة' ORDER BY date, id").bind(p.employee_id).all()).results;
    for (const a of adv) {
      if (left <= 0) break;
      const take = Math.min(left, n(a.amount) - n(a.paid_back)); left = round2(left - take);
      const pb = round2(n(a.paid_back) + take);
      await db.prepare("UPDATE advances SET paid_back = ?, status = CASE WHEN ? >= amount - 0.009 THEN 'مسددة' ELSE status END, updated_at = datetime('now') WHERE id = ?").bind(pb, pb, a.id).run();
    }
    await audit(db, user, 'pay', 'payroll', id, p.number);
    return json({ ok: true });
  }
  return bad('غير معروف', 404);
}
