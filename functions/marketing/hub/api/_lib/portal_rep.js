// بوابة المندوب — /marketing/rep/ (الجلسة من portal.js، ses.ref_id = رقم المندوب)
// GET  portal/rep             الملخص: العمولات والصرفيات والعملاء وحالة العملاء المحتملين والصفقات (بلا مبالغ عقود) والطلبات والمواد
// POST portal/rep/lead        {name, phone, company, city, sector, notes} تسجيل عميل محتمل باسم المندوب (يرفض المكرر)
// POST portal/rep/payout      {note} طلب صرف المعتمد
// POST portal/rep/bank        {bank_name, iban} تحديث بيانات التحويل (يُبلَّغ المالية)
import { json, bad, audit, getSettings, round2 } from './core.js';
import { notifyRoles, h as hx } from './telegram.js';
import { statement } from './reps.js';
import { SECTORS } from './seed.js';
import { normPhone, pbody, clip, addRequest } from './portal.js';

const SITE = 'https://nubl-ebtikar.online/marketing/';
const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const maskIban = (s) => (s ? String(s).replace(/\s+/g, '').replace(/^(.{4}).*(.{4})$/, '$1 •••• •••• $2') : '');
const DEAL_OPEN = ['جديدة', 'تواصل أول', 'جلسة تشخيص', 'عرض سعر', 'تفاوض'];

// مواد جاهزة للمشاركة — صفحات الموقع العامة فقط
const MATERIALS = [
  { title: 'الباقات والأسعار', desc: 'باقات كل قطاع بأسعارها ومدة العقد', url: SITE + 'packages.html', img: SITE + 'catalog/pkg-retail.jpg' },
  { title: 'خدماتنا الثلاث عشرة', desc: 'من الهوية إلى الإعلانات والتصوير والمتاجر', url: SITE + 'services.html', img: SITE + 'catalog/srv-identity.jpg' },
  { title: 'أعمالنا ودراسات الحالة', desc: 'نتائج حقيقية لعملاء نُبل', url: SITE + 'work.html', img: SITE + 'catalog/srv-photo-half.jpg' },
  { title: 'ساعدني أختار', desc: 'أربعة أسئلة ترشّح للعميل الباقة المناسبة', url: SITE + 'find-service.html', img: SITE + 'catalog/srv-diag.jpg' },
  { title: 'مؤشر الجاهزية التسويقية', desc: 'اختبار مجاني يكشف أين يقف مشروع العميل', url: SITE + 'readiness.html', img: SITE + 'catalog/srv-profile.jpg' },
  { title: 'آراء العملاء', desc: 'مراجعات حقيقية على خرائط قوقل', url: SITE + 'testimonials.html', img: SITE + 'catalog/pkg-corp.jpg' },
];

export async function repPortalRoute(db, env, request, ses, sub) {
  const method = request.method.toUpperCase();
  const [a] = sub;
  const rep = await db.prepare('SELECT * FROM reps WHERE id = ?').bind(ses.ref_id).first();
  if (!rep || rep.status === 'موقوف') return bad('الحساب موقوف — تواصل مع فريقنا', 403);

  if (!a && method === 'GET') {
    const st = await statement(db, rep.id);
    const { results: leads } = await db.prepare(`SELECT l.id, COALESCE(NULLIF(l.company,''), l.name) AS name, l.status, l.created_at, l.client_id,
        (SELECT d.stage FROM deals d WHERE d.lead_id = l.id ORDER BY d.id DESC LIMIT 1) AS stage
      FROM leads l WHERE l.rep_id = ? ORDER BY l.id DESC LIMIT 200`).bind(rep.id).all();
    const { results: deals } = await db.prepare(`SELECT d.id, d.title, d.stage, d.updated_at, d.created_at, COALESCE(c.name, l.company, l.name) AS party
      FROM deals d LEFT JOIN clients c ON c.id = d.client_id LEFT JOIN leads l ON l.id = d.lead_id WHERE d.rep_id = ? ORDER BY d.id DESC LIMIT 200`).bind(rep.id).all();
    const { results: requests } = await db.prepare("SELECT id, type, subject, status, created_at FROM portal_requests WHERE kind = 'rep' AND ref_id = ? ORDER BY id DESC LIMIT 30").bind(rep.id).all();
    const s = await getSettings(db);
    const pending = requests.some((r) => r.type === 'طلب صرف' && r.status === 'جديد');
    return json({
      company: s.company_name || 'نُبل وابتكار للتسويق',
      rep: { name: rep.name, rate: rep.rate, months: rep.months, base: rep.base, city: rep.city, bank_name: rep.bank_name || '', iban: maskIban(rep.iban), code: 'R' + rep.id },
      totals: st.totals, rows: st.rows.map(({ id, payout_id, ...r }) => r), payouts: st.payouts.map(({ id, ...r }) => r),
      clients: st.clients.map(({ id, ...r }) => r),
      leads: leads.map(({ id, client_id, ...r }) => ({ ...r, converted: !!client_id })),
      deals: deals.map(({ id, ...r }) => ({ ...r, open: DEAL_OPEN.includes(r.stage) })),
      requests, payout_pending: pending, materials: MATERIALS, sectors: SECTORS.map((x) => ({ id: x.id, name: x.name })),
      wa: '966563413040', // رقم التسويق 0563413040
    });
  }

  if (a === 'lead' && method === 'POST') {
    const d = await pbody(request);
    const name = clip(d.name, 120); const phone = normPhone(d.phone);
    if (!name || !phone) return bad('اسم العميل ورقم جواله مطلوبان');
    if (phone === normPhone(rep.phone)) return bad('هذا رقمك أنت — أدخل رقم العميل');
    // لا يُنسب عميل موجود مسبقاً لمندوب جديد — تحفظ حق من سجّله أولاً
    const last9 = '%' + phone.slice(-9);
    const exL = await db.prepare("SELECT id, phone FROM leads WHERE replace(replace(phone,' ',''),'+','') LIKE ?").bind(last9).all();
    const exC = await db.prepare("SELECT id, phone FROM clients WHERE replace(replace(phone,' ',''),'+','') LIKE ?").bind(last9).all();
    if ([...exL.results, ...exC.results].some((r) => normPhone(r.phone) === phone)) return bad('هذا العميل مسجّل لدينا مسبقاً، فلا يمكن تسجيله باسمك. للاستفسار تواصل مع فريق المبيعات.', 409);
    const sector = SECTORS.some((x) => x.id === d.sector) ? d.sector : null;
    const notes = [clip(d.notes, 1200), `سجّله المندوب ${rep.name} (R${rep.id}) من بوابة المندوب`].filter(Boolean).join(' · ');
    const r = await db.prepare(`INSERT INTO leads (name, company, phone, city, sector, source, status, next_followup, notes, rep_id)
      VALUES (?,?,?,?,?,'إحالة','جديد',date('now'),?,?)`).bind(name, clip(d.company, 120) || null, phone, clip(d.city, 60) || null, sector, notes, rep.id).run();
    const id = r.meta.last_row_id;
    await db.prepare("INSERT INTO activities (kind, lead_id, subject, notes, at) VALUES ('إحالة', ?, ?, ?, datetime('now'))")
      .bind(id, `إحالة من المندوب ${rep.name}`, clip(d.notes, 1200) || null).run();
    await audit(db, { id: null, name: 'بوابة المندوب: ' + rep.name }, 'create', 'leads', id, `بوابة المندوب: ${rep.name}`);
    const s = await getSettings(db);
    await notifyRoles(db, env, s.lead_notify_roles || 'admin,manager,sales',
      `🤝 عميل محتمل جديد من المندوب <b>${hx(rep.name)}</b>\n<b>${hx(name)}</b>${d.company ? ' — ' + hx(clip(d.company, 120)) : ''}${d.notes ? `\n${hx(clip(d.notes, 300))}` : ''}`,
      { kind: 'lead', link: `#lead/${id}` });
    return json({ ok: true }, 201);
  }

  if (a === 'payout' && method === 'POST') {
    const d = await pbody(request);
    const st = await statement(db, rep.id);
    if (!(st.totals.approved > 0)) return bad('لا توجد عمولات معتمدة بانتظار الصرف حالياً');
    const dup = await db.prepare("SELECT id FROM portal_requests WHERE kind = 'rep' AND ref_id = ? AND type = 'طلب صرف' AND status = 'جديد'").bind(rep.id).first('id');
    if (dup) return bad('لديك طلب صرف قيد المعالجة — سيصلك إشعار عند الصرف');
    if (!rep.iban) return bad('أضف رقم الآيبان أولاً من قسم «بيانات التحويل»');
    await addRequest(db, ses, { type: 'طلب صرف', subject: `صرف ${fmt(st.totals.approved)} ر.س`, body: clip(d.note, 600), entity: 'reps', entity_id: rep.id });
    await notifyRoles(db, env, ['finance', 'admin'], `💸 طلب صرف من المندوب <b>${hx(rep.name)}</b>: المعتمد ${fmt(round2(st.totals.approved))} ر.س${d.note ? `\n${hx(clip(d.note, 300))}` : ''}`,
      { kind: 'finance', link: '#commissions' });
    return json({ ok: true }, 201);
  }

  if (a === 'bank' && method === 'POST') {
    const d = await pbody(request);
    const iban = String(d.iban || '').replace(/\s+/g, '').toUpperCase();
    const bank = clip(d.bank_name, 80);
    if (!/^SA\d{22}$/.test(iban)) return bad('رقم الآيبان السعودي يبدأ بـ SA ويليه 22 رقماً');
    if (!bank) return bad('اكتب اسم البنك');
    await db.prepare("UPDATE reps SET bank_name = ?, iban = ?, updated_at = datetime('now') WHERE id = ?").bind(bank, iban, rep.id).run();
    await addRequest(db, ses, { type: 'تحديث بنكي', subject: `${bank} · ${maskIban(iban)}`, body: rep.iban ? `السابق: ${rep.bank_name || ''} ${maskIban(rep.iban)}` : 'أول إدخال', entity: 'reps', entity_id: rep.id });
    await audit(db, { id: null, name: 'بوابة المندوب: ' + rep.name }, 'bank', 'reps', rep.id, `بوابة المندوب: ${maskIban(rep.iban)} → ${maskIban(iban)}`);
    // تغيير بيانات التحويل حساس: تُبلَّغ المالية دائماً لتتأكد قبل أي صرف
    await notifyRoles(db, env, ['finance', 'admin'], `🏦 المندوب <b>${hx(rep.name)}</b> حدّث بيانات التحويل من بوابته\n${hx(bank)} · ${maskIban(iban)}${rep.iban ? `\n(السابق ${maskIban(rep.iban)})` : ''}\nتأكد منه هاتفياً قبل الصرف القادم.`,
      { kind: 'finance', link: '#commissions' });
    return json({ ok: true, iban: maskIban(iban), bank_name: bank });
  }

  return bad('إجراء غير معروف', 404);
}
