// المناديب الخارجيون بنظام العمولة — الاستحقاق الآلي من التحصيل، الاعتماد، الصرف، وكشف الحساب للمندوب
// القواعد المعتمدة (إياد، 15 أكتوبر 2026):
//   • تُستحق العمولة عند تحصيل كل دفعة من العميل (لا عمولة على مال لم يُحصَّل)، وتُلغى آلياً إن حُذفت الدفعة.
//   • تُحتسب على أول عقد والتجديدات لمدة (months) شهراً من بداية أول عقد للعميل — الافتراضي 12 شهراً لكل مندوب.
//   • الأساس الافتراضي: المبلغ قبل الضريبة (net) × نسبة المندوب.
//   • المندوب يتابع عبر رابط كشف حساب خاص (بلا حساب دخول) + إشعار واتساب عند كل استحقاق وكل صرف.
import { json, bad, randomToken, audit, getSettings, addMonths, today, round2, nextNumber } from './core.js';
import { notifyRoles, waBridge, h as hx } from './telegram.js';

const enc = new TextEncoder();
async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const HUB = 'https://nubl-ebtikar.online/marketing/hub/';
const portalUrl = (origin, tok) => `${origin || 'https://nubl-ebtikar.online'}/marketing/hub/rep.html#${tok}`;
const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
export const COMM_STATUS = ['مستحقة', 'معتمدة', 'مصروفة', 'ملغاة'];

// رسالة واتساب للمندوب (لا تُفشل العملية الأصلية)
async function tellRep(db, rep, title, body, link) {
  try {
    if (!rep?.phone) return;
    const h = (new Date().getUTCHours() + 3) % 24; if (h >= 23 || h < 7) return; // لا رسائل ليلاً — الكشف محدّث دائماً
    await waBridge(db, { to: rep.phone, name: rep.name, kind: 'finance', title, body, summary: `${title} · ${body}`.replace(/\s+/g, ' ').slice(0, 800), link: link || '' });
  } catch (e) { console.warn('rep wa', e.message); }
}

// ---------- الاستحقاق الآلي من دفعة ----------
export async function accrueForPayment(db, env, paymentId, origin) {
  try {
    const p = await db.prepare('SELECT * FROM payments WHERE id = ?').bind(paymentId).first();
    if (!p || !p.client_id || !(p.amount > 0)) return null;
    const c = await db.prepare('SELECT id, name, rep_id, rep_until FROM clients WHERE id = ?').bind(p.client_id).first();
    if (!c || !c.rep_id) return null;
    const rep = await db.prepare('SELECT * FROM reps WHERE id = ?').bind(c.rep_id).first();
    if (!rep || rep.status !== 'نشط') return null;
    // نافذة الاستحقاق: من بداية أول عقد للعميل (أو أول دفعة) لمدة months شهراً
    let until = c.rep_until;
    if (!until) {
      const first = await db.prepare("SELECT MIN(start_date) AS d FROM contracts WHERE client_id = ? AND start_date IS NOT NULL AND status != 'ملغي'").bind(c.id).first('d');
      const start = first || String(p.paid_at || today()).slice(0, 10);
      until = addMonths(start, Number(rep.months) || 12);
      await db.prepare('UPDATE clients SET rep_until = ? WHERE id = ?').bind(until, c.id).run();
    }
    const paidAt = String(p.paid_at || today()).slice(0, 10);
    if (paidAt > until) return { skipped: 'خارج مدة استحقاق المندوب' };
    const s = await getSettings(db);
    const vat = Number(s.vat_rate || 15) / 100;
    const base = rep.base === 'gross' ? round2(p.amount) : round2(p.amount / (1 + vat));
    const rate = Number(rep.rate) || 0;
    const amount = round2(base * rate / 100);
    if (!(amount > 0)) return null;
    const inv = p.invoice_id ? await db.prepare('SELECT number, contract_id FROM invoices WHERE id = ?').bind(p.invoice_id).first() : null;
    const r = await db.prepare(`INSERT OR IGNORE INTO commissions (rep_id, client_id, contract_id, invoice_id, payment_id, base_amount, rate, amount, status, note, earned_at)
      VALUES (?,?,?,?,?,?,?,?, 'مستحقة', ?, ?)`).bind(rep.id, c.id, inv?.contract_id || null, p.invoice_id || null, p.id, base, rate, amount,
      `سداد ${inv?.number || ''}`.trim(), paidAt).run();
    if (!r.meta.changes) return null; // محتسبة مسبقاً
    await notifyRoles(db, env, ['finance', 'admin'], `🤝 عمولة مستحقة للمندوب <b>${hx(rep.name)}</b>: ${fmt(amount)} ر.س\nمن سداد ${fmt(p.amount)} ر.س — ${hx(c.name)} (${rate}% من ${fmt(base)})\nبانتظار الاعتماد`, { kind: 'finance', link: '#commissions' });
    await tellRep(db, rep, `سُجّلت لك عمولة ${fmt(amount)} ر.س`, `من سداد العميل ${c.name} بتاريخ ${paidAt}. تُصرف بعد اعتمادها من المالية.`);
    return { id: r.meta.last_row_id, amount };
  } catch (e) { console.warn('accrue', e.message); return null; }
}

// عند حذف دفعة: تُلغى العمولة غير المصروفة، وتُعكس المصروفة بقيد سالب يُخصم من الصرف القادم
export async function voidForPayment(db, paymentId, user) {
  try {
    const cm = await db.prepare('SELECT * FROM commissions WHERE payment_id = ?').bind(paymentId).first();
    if (!cm) return;
    if (cm.status !== 'مصروفة') {
      await db.prepare("UPDATE commissions SET status = 'ملغاة', note = COALESCE(note,'') || ' · أُلغيت لحذف الدفعة' WHERE id = ?").bind(cm.id).run();
    } else {
      await db.prepare(`INSERT INTO commissions (rep_id, client_id, contract_id, invoice_id, payment_id, base_amount, rate, amount, status, note, earned_at)
        VALUES (?,?,?,?,NULL,?,?,?, 'معتمدة', ?, ?)`).bind(cm.rep_id, cm.client_id, cm.contract_id, cm.invoice_id, -cm.base_amount, cm.rate, -cm.amount,
        `عكس عمولة مصروفة (#${cm.id}) لحذف الدفعة — تُخصم من الصرف القادم`, today()).run();
    }
    await audit(db, user, 'void', 'commissions', cm.id, 'payment deleted');
  } catch (e) { console.warn('void', e.message); }
}

// عند تعديل دفعة (المبلغ/العميل/التاريخ): يُعاد احتساب العمولة غير المصروفة وتعود لحالة «مستحقة»
export async function refreshForPayment(db, env, paymentId) {
  const cm = await db.prepare('SELECT id, status FROM commissions WHERE payment_id = ?').bind(paymentId).first();
  if (cm && cm.status === 'مصروفة') return null; // المصروفة لا تُمس — يعالجها الحذف بقيد عكسي
  if (cm) await db.prepare('DELETE FROM commissions WHERE id = ?').bind(cm.id).run();
  return accrueForPayment(db, env, paymentId);
}

// احتساب الدفعات السابقة للعميل عند ربطه بمندوب لاحقاً
export async function syncClient(db, env, clientId, origin) {
  const { results } = await db.prepare(`SELECT p.id FROM payments p LEFT JOIN commissions c ON c.payment_id = p.id
    WHERE p.client_id = ? AND c.id IS NULL ORDER BY p.paid_at, p.id`).bind(clientId).all();
  let n = 0;
  for (const r of results) { const x = await accrueForPayment(db, env, r.id, origin); if (x && x.amount) n++; }
  return n;
}

// ---------- كشف الحساب ----------
async function statement(db, repId) {
  const rep = await db.prepare('SELECT id, name, phone, rate, months, base, status FROM reps WHERE id = ?').bind(repId).first();
  if (!rep) return null;
  const { results: rows } = await db.prepare(`SELECT c.id, c.earned_at, c.base_amount, c.rate, c.amount, c.status, c.note, c.payout_id, cl.name AS client
    FROM commissions c LEFT JOIN clients cl ON cl.id = c.client_id WHERE c.rep_id = ? AND c.status != 'ملغاة' ORDER BY c.earned_at DESC, c.id DESC LIMIT 500`).bind(repId).all();
  const { results: payouts } = await db.prepare('SELECT id, number, total, count, method, paid_at FROM rep_payouts WHERE rep_id = ? ORDER BY paid_at DESC, id DESC').bind(repId).all();
  const { results: clients } = await db.prepare('SELECT id, name, rep_until FROM clients WHERE rep_id = ? ORDER BY name').bind(repId).all();
  const { results: leads } = await db.prepare("SELECT id, COALESCE(company, name) AS name, status FROM leads WHERE rep_id = ? AND (client_id IS NULL) ORDER BY id DESC").bind(repId).all();
  const sum = (st) => round2(rows.filter((r) => st.includes(r.status)).reduce((a, r) => a + Number(r.amount || 0), 0));
  return { rep, rows, payouts, clients, leads, totals: { due: sum(['مستحقة']), approved: sum(['معتمدة']), paid: sum(['مصروفة']), all: sum(['مستحقة', 'معتمدة', 'مصروفة']) } };
}

// رابط الكشف العام (بلا تسجيل دخول) — يعرض بيانات المندوب نفسه فقط
export async function publicRep(db, request) {
  const tok = new URL(request.url).searchParams.get('t') || '';
  if (!/^nrp_[a-f0-9]{32}$/.test(tok)) return bad('رابط غير صالح', 404);
  const rep = await db.prepare("SELECT id FROM reps WHERE portal_hash = ? AND status != 'موقوف'").bind(await sha256(tok)).first();
  if (!rep) return bad('الرابط منتهٍ أو غير صالح', 404);
  const st = await statement(db, rep.id);
  delete st.rep.phone; delete st.rep.id;
  st.payouts = st.payouts.map(({ id, ...r }) => r);
  st.rows = st.rows.map(({ id, payout_id, ...r }) => r);
  st.clients = st.clients.map(({ id, ...r }) => r);
  st.leads = st.leads.map(({ id, ...r }) => r);
  const s = await getSettings(db);
  return json({ ...st, company: s.company_name || 'نُبل وابتكار للتسويق', today: today() });
}

// ---------- مسارات الإدارة ----------
const canSee = (u) => ['admin', 'manager', 'finance', 'executive'].includes(u.role);
const canPay = (u) => ['admin', 'finance'].includes(u.role);

export async function commissionsRoute(db, env, request, user, a, b) {
  const method = request.method.toUpperCase();
  const origin = new URL(request.url).origin;
  let d = {}; if (method !== 'GET') { try { d = await request.json(); } catch { /* */ } }
  if (!canSee(user)) return bad('العمولات للإدارة والمالية', 403);

  // ملخص المناديب + قائمة العمولات
  if (!a && method === 'GET') {
    const url = new URL(request.url);
    const where = ["c.status != 'ملغاة'"]; const args = [];
    if (url.searchParams.get('status')) { where.push('c.status = ?'); args.push(url.searchParams.get('status')); }
    if (url.searchParams.get('rep')) { where.push('c.rep_id = ?'); args.push(url.searchParams.get('rep')); }
    const { results: rows } = await db.prepare(`SELECT c.*, cl.name AS client, r.name AS rep, i.number AS invoice_no, p.amount AS paid_amount, u.name AS approver
      FROM commissions c LEFT JOIN clients cl ON cl.id = c.client_id LEFT JOIN reps r ON r.id = c.rep_id LEFT JOIN invoices i ON i.id = c.invoice_id
      LEFT JOIN payments p ON p.id = c.payment_id LEFT JOIN users u ON u.id = c.approved_by WHERE ${where.join(' AND ')} ORDER BY c.earned_at DESC, c.id DESC LIMIT 1000`).bind(...args).all();
    const { results: reps } = await db.prepare(`SELECT r.id, r.name, r.phone, r.rate, r.months, r.base, r.status, (r.portal_hash IS NOT NULL) AS has_portal,
      (SELECT COUNT(*) FROM clients WHERE rep_id = r.id) AS clients,
      (SELECT COUNT(*) FROM leads WHERE rep_id = r.id AND client_id IS NULL) AS leads,
      (SELECT COALESCE(SUM(amount),0) FROM commissions WHERE rep_id = r.id AND status = 'مستحقة') AS due,
      (SELECT COALESCE(SUM(amount),0) FROM commissions WHERE rep_id = r.id AND status = 'معتمدة') AS approved,
      (SELECT COALESCE(SUM(amount),0) FROM commissions WHERE rep_id = r.id AND status = 'مصروفة') AS paid,
      (SELECT MAX(paid_at) FROM rep_payouts WHERE rep_id = r.id) AS last_payout
      FROM reps r ORDER BY r.status = 'نشط' DESC, r.name`).all();
    const { results: payouts } = await db.prepare(`SELECT o.*, r.name AS rep, u.name AS by_name FROM rep_payouts o LEFT JOIN reps r ON r.id = o.rep_id LEFT JOIN users u ON u.id = o.created_by
      ORDER BY o.paid_at DESC, o.id DESC LIMIT 200`).all();
    return json({ rows, reps, payouts, can_pay: canPay(user) });
  }

  if (a === 'statement' && b && method === 'GET') {
    const st = await statement(db, b); if (!st) return bad('المندوب غير موجود', 404);
    return json(st);
  }

  if (!canPay(user)) return bad('الاعتماد والصرف للمالية والمدير العام', 403);

  if (a === 'approve' && method === 'POST') {
    const ids = (d.ids || []).map(Number).filter(Boolean);
    if (!ids.length) return bad('اختر عمولات');
    const r = await db.prepare(`UPDATE commissions SET status = 'معتمدة', approved_by = ?, approved_at = datetime('now')
      WHERE status = 'مستحقة' AND id IN (${ids.map(() => '?').join(',')})`).bind(user.id, ...ids).run();
    await audit(db, user, 'approve', 'commissions', null, ids.join(','));
    return json({ approved: r.meta.changes });
  }

  if (a === 'payout' && method === 'POST') {
    const repId = Number(d.rep_id); if (!repId) return bad('حدّد المندوب');
    const rep = await db.prepare('SELECT * FROM reps WHERE id = ?').bind(repId).first(); if (!rep) return bad('المندوب غير موجود', 404);
    const ids = (d.ids || []).map(Number).filter(Boolean);
    const sel = ids.length ? ` AND id IN (${ids.map(() => '?').join(',')})` : '';
    const { results: items } = await db.prepare(`SELECT id, amount FROM commissions WHERE rep_id = ? AND status = 'معتمدة'${sel}`).bind(repId, ...ids).all();
    if (!items.length) return bad('لا توجد عمولات معتمدة لصرفها لهذا المندوب');
    const total = round2(items.reduce((x, i) => x + Number(i.amount), 0));
    if (!(total > 0)) return bad('صافي العمولات المعتمدة صفر أو سالب — لا يوجد ما يُصرف');
    const number = await nextNumber(db, 'rep_payouts', 'CP');
    const paidAt = d.paid_at || today();
    const r = await db.prepare('INSERT INTO rep_payouts (number, rep_id, total, count, method, ref, paid_at, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(number, repId, total, items.length, d.method || 'تحويل بنكي', d.ref || null, paidAt, d.notes || null, user.id).run();
    const pid = r.meta.last_row_id;
    await db.batch(items.map((i) => db.prepare("UPDATE commissions SET status = 'مصروفة', payout_id = ? WHERE id = ?").bind(pid, i.id)));
    // يُسجَّل الصرف مصروفاً في المالية تلقائياً
    try {
      await db.prepare('INSERT INTO expenses (category, vendor, amount, vat, date, notes, user_id) VALUES (?,?,?,?,?,?,?)')
        .bind('عمولات', rep.name, total, 0, paidAt, `صرف عمولات ${number} — ${items.length} بنداً${d.ref ? ' · مرجع ' + d.ref : ''}`, user.id).run();
    } catch (e) { console.warn('expense', e.message); }
    await audit(db, user, 'payout', 'rep_payouts', pid, `${rep.name} ${total}`);
    await notifyRoles(db, env, ['admin', 'finance'], `💸 صُرفت عمولات للمندوب <b>${hx(rep.name)}</b>: ${fmt(total)} ر.س (${number})\nبواسطة ${hx(user.name)}`, { kind: 'finance', link: '#commissions' }, user.id);
    await tellRep(db, rep, `تم صرف عمولاتك ${fmt(total)} ر.س`, `رقم الصرف ${number} بتاريخ ${paidAt} عبر ${d.method || 'تحويل بنكي'}. شكراً لشراكتك مع نُبل وابتكار للتسويق.`, '');
    return json({ payout_id: pid, number, total, count: items.length }, 201);
  }

  // رابط كشف حساب جديد للمندوب (يلغي القديم)
  if (a === 'portal' && b && method === 'POST') {
    const rep = await db.prepare('SELECT id, name, phone FROM reps WHERE id = ?').bind(b).first(); if (!rep) return bad('المندوب غير موجود', 404);
    const tok = 'nrp_' + randomToken(16);
    await db.prepare('UPDATE reps SET portal_hash = ?, portal_prefix = ? WHERE id = ?').bind(await sha256(tok), tok.slice(0, 8), rep.id).run();
    await audit(db, user, 'portal', 'reps', rep.id);
    const url = portalUrl(origin, tok);
    if (d.send) await tellRep(db, rep, 'كشف حساب عمولاتك لدى نُبل وابتكار للتسويق', `تابع عملاءك وعمولاتك المستحقة والمصروفة من الرابط الخاص بك (لا تشاركه): ${url}`, url);
    return json({ url });
  }

  // احتساب الدفعات السابقة لعملاء المندوب
  if (a === 'sync' && method === 'POST') {
    const repId = Number(d.rep_id);
    const { results } = await db.prepare(`SELECT id FROM clients WHERE rep_id ${repId ? '= ?' : 'IS NOT NULL'}`).bind(...(repId ? [repId] : [])).all();
    let n = 0; for (const c of results) n += await syncClient(db, env, c.id, origin);
    return json({ created: n });
  }
  return bad('إجراء غير معروف', 404);
}
