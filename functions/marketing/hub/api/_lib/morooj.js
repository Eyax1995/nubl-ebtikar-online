// دمج منصة «مروج الحجاز» في منصة نُبل وابتكار — الجهة = 'morooj' (عملاء القطاع غير الربحي)
// المدخل: ملف «تنزيل نسخة احتياطية» من مروج الحجاز { exported, data: { <entity>: [rows] }, settings }
// المبدأ: كل سجل خام يُحفظ في legacy_import (لا يضيع شيء)، والكيانات المشتركة تُنقل إلى جداولنا بمعرّفات جديدة
// مع إعادة ربط المراجع، والكيانات التي لا مقابل لها بعد (المحاسبة، الموارد البشرية، الحملات، المتجر…) تبقى في الأرشيف للمراحل التالية.
import { tableCols, today, round2, HttpError } from './core.js';
import { ORGS, ORG_ENTITIES } from './schema.js';

const SRC = 'morooj';
const REFS = { lead_id: 'leads', client_id: 'clients', deal_id: 'deals', quote_id: 'quotes', contract_id: 'contracts', project_id: 'projects', invoice_id: 'invoices' };
// حقول أشخاص من منصة مروج (لا تحمل النسخة الاحتياطية المستخدمين) — تُترك فارغة ويُسند الفريق لاحقاً
const PEOPLE = ['owner_id', 'user_id', 'assignee_id', 'account_manager_id', 'designer_id', 'created_by', 'rep_id', 'default_assignee_id', 'approved_by'];

// توحيد القيم مع قوائم منصتنا (ما لا مقابل له يبقى كما هو)
const MAP = {
  leads: { status: { 'تم التواصل': 'قيد التواصل', 'تحول لعميل': 'محوّل لعميل', 'تحوّل لعميل': 'محوّل لعميل' } },
  clients: { status: { 'متوقف مؤقتاً': 'موقوف مؤقتاً' }, health: { 'يحتاج انتباه': 'معرّض للخطر', 'خطر': 'معرّض للخطر' } },
  contracts: { status: { 'بانتظار التوقيع': 'مسودة' }, plan: { 'دفعة واحدة': 'single', 'شهري': 'monthly', 'ربع سنوي': '4q' } },
  quotes: { plan: { 'دفعة واحدة': 'single', 'شهري': 'monthly', 'ربع سنوي': '4q' } },
  projects: { status: { 'لم يبدأ': 'نشط', 'جاري': 'نشط', 'معلق': 'معلّق' } },
  tasks: { status: { 'مكتملة': 'منجزة' }, priority: { 'متوسطة': 'عادية' } },
  content: { status: { 'بانتظار الاعتماد': 'بانتظار اعتماد العميل' } },
  catalog: { kind: { 'باقة': 'package', 'خدمة': 'service', 'إضافة': 'service', 'منتج': 'service' } },
};

const num = (x) => Number(x) || 0;
const asText = (v) => (v == null ? null : typeof v === 'object' ? JSON.stringify(v) : typeof v === 'boolean' ? (v ? 1 : 0) : v);
const totals = (r) => {
  const sub = (Array.isArray(r.items) ? r.items : []).reduce((s, it) => s + num(it.qty || 1) * num(it.price), 0);
  const disc = num(r.discount); const net = Math.max(0, sub - disc); const vat = round2(net * 0.15);
  return { sub: round2(sub), disc, net: round2(net), vat, total: round2(net + vat) };
};

// تحويل سجل مروج إلى صف في جدولنا
function shape(table, r, ids) {
  const o = {};
  for (const [k, v] of Object.entries(r)) {
    if (k === 'id' || k.startsWith('_') || PEOPLE.includes(k)) continue;
    if (REFS[k]) { o[k] = v == null || v === '' ? null : (ids[REFS[k]].get(String(v)) ?? null); continue; }
    o[k] = asText(v);
  }
  const m = MAP[table] || {};
  for (const [k, mp] of Object.entries(m)) if (o[k] != null && mp[o[k]] !== undefined) o[k] = mp[o[k]];
  if (table === 'catalog') {
    const p = num(r.price); const months = num(r.months) || null;
    if (r.unit === 'شهري') { o.monthly = p; o.price = months ? round2(p * months) : p; } else o.price = p;
    o.active = r.active === false || r.active === 0 ? 0 : 1;
  }
  if (table === 'quotes') {
    const t = totals(r);
    o.subtotal = r.subtotal ?? t.sub; o.discount = r.discount ?? t.disc; o.vat = r.vat ?? t.vat; o.total = r.total ?? t.total;
    if (Array.isArray(r.items)) o.items = JSON.stringify(r.items.map((i) => ({ name: i.name || i.title || '', desc: i.desc || i.description || '', qty: num(i.qty) || 1, price: num(i.price) })));
  }
  if (table === 'invoices') {
    const t = totals(r);
    const hasItems = Array.isArray(r.items) && r.items.length;
    o.subtotal = hasItems ? t.net : round2(num(r.subtotal) - num(r.discount));
    o.vat = hasItems ? t.vat : num(r.vat) || round2(o.subtotal * 0.15);
    o.total = hasItems ? t.total : num(r.total) || round2(o.subtotal + o.vat);
    o.status = r.status === 'ملغاة' ? 'ملغاة' : 'مصدرة'; // تُحدَّث بعد احتساب المقبوضات
    o.paid = 0;
    if (!o.description && hasItems) o.description = r.items.map((i) => i.name).filter(Boolean).join(' + ').slice(0, 300);
  }
  if (table === 'tasks') {
    if (typeof r.checklist === 'string' && r.checklist.trim() && !r.checklist.trim().startsWith('[')) {
      o.checklist = JSON.stringify(r.checklist.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        .map((l) => ({ t: l.replace(/^[✓✔☑]\s*/, ''), d: /^[✓✔☑]/.test(l) })));
    }
    o.source = 'مروج الحجاز';
    if (o.status === 'منجزة' && !o.done_at) o.done_at = r.updated_at || r.due_date || null;
  }
  if (table === 'content') o.source = 'مروج الحجاز';
  return o;
}

// سند قبض ← دفعة (يغذّي التحصيل والفواتير ولوحة القيادة) · سند صرف ← مصروف
const fromReceipt = (r, ids) => ({
  invoice_id: r.invoice_id ? ids.invoices.get(String(r.invoice_id)) ?? null : null,
  client_id: r.client_id ? ids.clients.get(String(r.client_id)) ?? null : null,
  amount: num(r.amount), method: r.method || null, ref: r.number || r.ref || null, paid_at: r.date || null,
  notes: [r.description, r.notes, r.ref && r.number ? 'مرجع: ' + r.ref : ''].filter(Boolean).join(' — ') || null,
});
const fromDisb = (r, ids, accName) => ({
  category: accName || 'سند صرف', vendor: r.payee || null, amount: num(r.amount), vat: num(r.vat) || null, date: r.date || null,
  client_id: r.client_id ? ids.clients.get(String(r.client_id)) ?? null : null,
  notes: [r.number, r.description, r.ref].filter(Boolean).join(' — ') || null,
});

const ORDER = ['catalog', 'leads', 'clients', 'deals', 'quotes', 'contracts', 'projects', 'invoices', 'payments', 'receipts', 'expenses', 'disbursements', 'activities', 'visits', 'tasks', 'content'];
const TARGET = { receipts: 'payments', disbursements: 'expenses' };

export async function importMorooj(db, d, user) {
  const data = d?.data || d?.backup?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'الملف ليس نسخة احتياطية من منصة مروج الحجاز (لا يحتوي data)');
  const dry = !!d.dry;
  const ids = Object.fromEntries(Object.values(REFS).concat(['catalog', 'payments', 'expenses', 'activities', 'visits', 'tasks', 'content']).map((k) => [k, new Map()]));
  // ما استُورد سابقاً (إعادة الاستيراد آمنة: لا تكرار)
  const prev = (await db.prepare('SELECT entity, old_id, new_id FROM legacy_import WHERE src = ?').bind(SRC).all()).results;
  const done = new Set(prev.map((p) => p.entity + ':' + p.old_id));
  for (const p of prev) { const t = TARGET[p.entity] || p.entity; if (p.new_id && ids[t] && !TARGET[p.entity]) ids[t].set(String(p.old_id), p.new_id); }

  const counts = {}; const legacyOnly = {}; const stmtsLegacy = [];
  const accName = new Map((data.accounts || []).map((a) => [String(a.id), a.name]));
  const pushLegacy = (entity, row, newId) => stmtsLegacy.push(db.prepare('INSERT OR IGNORE INTO legacy_import (src, entity, old_id, new_id, data) VALUES (?,?,?,?,?)')
    .bind(SRC, entity, String(row.id ?? row.number ?? Math.random()), newId ?? null, JSON.stringify(row)));
  const leadClientFix = [];

  for (const ent of ORDER) {
    const rows = Array.isArray(data[ent]) ? data[ent] : [];
    if (!rows.length) continue;
    const table = TARGET[ent] || ent;
    const cols = await tableCols(db, table);
    const c = (counts[ent] = { total: rows.length, imported: 0, skipped: 0 });
    const pend = [];
    for (const r of rows) {
      if (r == null || r.id == null) { c.skipped++; continue; }
      if (done.has(ent + ':' + r.id)) { c.skipped++; continue; }
      if (ent === 'payments' && r.merged_into) { pushLegacy(ent, r, null); c.skipped++; continue; } // مُرحّلة إلى سند قبض
      if ((ent === 'receipts' || ent === 'disbursements') && r.status === 'ملغى') { pushLegacy(ent, r, null); c.skipped++; continue; }
      let o = ent === 'receipts' ? fromReceipt(r, ids) : ent === 'disbursements' ? fromDisb(r, ids, accName.get(String(r.account_id))) : shape(table, r, ids);
      if (ent === 'leads' && r.client_id) { leadClientFix.push([r.id, r.client_id]); o.client_id = null; }
      const rec = {};
      for (const [k, v] of Object.entries(o)) if (cols.has(k) && k !== 'id' && v !== undefined) rec[k] = v === '' ? null : v;
      rec.org = 'morooj';
      if (cols.has('created_by')) rec.created_by = user.id;
      if (table === 'activities' && !rec.at) rec.at = r.created_at || today();
      pend.push([r, rec]);
    }
    if (dry) { c.imported = pend.length; continue; }
    for (let i = 0; i < pend.length; i += 40) {
      const chunk = pend.slice(i, i + 40);
      const res = await db.batch(chunk.map(([, rec]) => { const k = Object.keys(rec); return db.prepare(`INSERT INTO ${table} (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).bind(...k.map((x) => rec[x])); }));
      res.forEach((x, j) => {
        const [r] = chunk[j]; const nid = x.meta.last_row_id;
        if (ids[table] && !TARGET[ent]) ids[table].set(String(r.id), nid);
        pushLegacy(ent, r, nid); c.imported++;
      });
    }
  }
  // باقي الكيانات (المحاسبة، الموارد البشرية، الحملات، قاعدة المعرفة، المتجر…) تُحفظ خاماً للمراحل التالية
  for (const [ent, rows] of Object.entries(data)) {
    if (ORDER.includes(ent) || !Array.isArray(rows)) continue;
    let n = 0;
    for (const r of rows) { if (r && !done.has(ent + ':' + (r.id ?? r.number))) { if (!dry) pushLegacy(ent, r, null); n++; } }
    if (n) legacyOnly[ent] = n;
  }
  const st = d.settings || d.backup?.settings;
  if (!dry && st && typeof st === 'object') {
    stmtsLegacy.push(db.prepare("INSERT OR REPLACE INTO legacy_import (src, entity, old_id, new_id, data) VALUES (?, 'settings', 'settings', NULL, ?)")
      .bind(SRC, JSON.stringify(st)));
  }
  if (dry) return { dry: true, counts, legacy: legacyOnly };

  for (let i = 0; i < stmtsLegacy.length; i += 50) await db.batch(stmtsLegacy.slice(i, i + 50));
  // ربط العملاء المحتملين بعملائهم بعد استيراد العملاء
  const fix = leadClientFix.map(([l, cl]) => [ids.leads.get(String(l)), ids.clients.get(String(cl))]).filter(([a, b]) => a && b);
  if (fix.length) await db.batch(fix.map(([a, b]) => db.prepare('UPDATE leads SET client_id = ? WHERE id = ?').bind(b, a)));
  // المدفوع وحالة كل فاتورة مستوردة
  const invIds = [...ids.invoices.values()];
  for (let i = 0; i < invIds.length; i += 80) {
    const part = invIds.slice(i, i + 80);
    await db.prepare(`UPDATE invoices SET paid = COALESCE((SELECT ROUND(SUM(amount),2) FROM payments p WHERE p.invoice_id = invoices.id), 0),
      status = CASE WHEN status = 'ملغاة' THEN 'ملغاة'
        WHEN COALESCE((SELECT SUM(amount) FROM payments p WHERE p.invoice_id = invoices.id), 0) >= total - 0.009 THEN 'مدفوعة'
        WHEN COALESCE((SELECT SUM(amount) FROM payments p WHERE p.invoice_id = invoices.id), 0) > 0 THEN 'مدفوعة جزئياً' ELSE 'مصدرة' END
      WHERE id IN (${part.map(() => '?').join(',')})`).bind(...part).run();
  }
  return { ok: true, counts, legacy: legacyOnly };
}

// ملخص الجهتين لمبدّل الجهة ولوحة الإعدادات
export async function orgSummary(db) {
  const out = {};
  for (const [k, o] of Object.entries(ORGS)) {
    const r = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM clients WHERE COALESCE(org,'nubl') = ?1) AS clients,
      (SELECT COUNT(*) FROM leads WHERE COALESCE(org,'nubl') = ?1) AS leads,
      (SELECT COUNT(*) FROM contracts WHERE COALESCE(org,'nubl') = ?1 AND status IN ('نشط','موقّع')) AS contracts,
      (SELECT COALESCE(ROUND(SUM(total - COALESCE(paid,0)),2),0) FROM invoices WHERE COALESCE(org,'nubl') = ?1 AND status IN ('مصدرة','مدفوعة جزئياً','متأخرة')) AS receivable`).bind(k).first();
    out[k] = { ...o, ...r };
  }
  const lg = (await db.prepare('SELECT entity, COUNT(*) AS n, SUM(new_id IS NOT NULL) AS moved FROM legacy_import WHERE src = ? GROUP BY entity ORDER BY entity').bind(SRC).all()).results;
  return { orgs: out, legacy: lg, entities: ORG_ENTITIES };
}
