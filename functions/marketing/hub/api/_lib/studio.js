// استوديو الذكاء الاصطناعي — عروض الأسعار (بنموذج عرض BBR) ← العقود ← الخطط التسويقية ← المنشورات
// القواعد المعتمدة (إياد، 15 أكتوبر 2026):
//   • أسعار الكتالوج مقفلة لا يغيّرها الذكاء، والبنود الخاصة يقترح الذكاء سعرها بعلامة «يحتاج اعتماد» حتى تعتمدها الإدارة/المالية.
//   • العقد = بنود قياسية ثابتة (docs.js) + أجزاء متغيرة يملؤها الذكاء (النطاق، المخرجات، الجدول، الشروط الخاصة)، ويُراجع قانونياً قبل التوقيع.
//   • المنشورات تُجهَّز وتوزَّع في تقويم المنصة (لا نشر آلي على المنصات في هذه المرحلة)، مع تصدير CSV للجدولة.
import { json, bad, HttpError, audit, getSettings, today, addDays, addMonths, round2, nextNumber } from './core.js';
import { notifyRoles, notifyUser, h as hx } from './telegram.js';
import { aiJSON, aiReady, aiPing, BRAND } from './ai.js';
import { buildDocx, renderHtml } from './docx.js';
import { quoteBlocks, contractBlocks, planBlocks, quoteTotals } from './docs.js';

const APPROVERS = ['admin', 'manager', 'finance'];
const PLATFORMS = ['إنستقرام', 'تيك توك', 'سناب شات', 'X', 'لينكدإن', 'فيسبوك', 'يوتيوب', 'قوقل بزنس', 'واتساب'];
const FORMATS = ['منشور', 'كاروسيل', 'ريل', 'ستوري', 'فيديو', 'إعلان ممول', 'مقال'];
const PILLARS = ['تعليمي', 'عرض / بيع', 'خلف الكواليس', 'موسمي', 'دليل اجتماعي', 'هوية وقيم'];
const parse = (s, d) => { try { return typeof s === 'string' ? JSON.parse(s) : s || d; } catch { return d; } };
const str = (v, n = 2000) => (v == null ? '' : String(v)).slice(0, n);
const arr = (v) => (Array.isArray(v) ? v : []);
// قصّ عند حد كلمة لا في منتصفها
const clip = (v, n) => { const t = str(v, 5000).trim(); if (t.length <= n) return t; const c = t.slice(0, n - 1); const i = c.lastIndexOf(' '); return (i > n * 0.6 ? c.slice(0, i) : c).replace(/[s،,—-]+$/, '') + '…'; };
// مرحلة الجدول الزمني: المدة قصيرة (عمود ضيق)، وما بعد «—» في المدة تفصيل يُنقل إلى عمود المرحلة الأعرض
const tline = (t) => {
  let phase = str(t.phase, 300).trim(), dur = str(t.duration, 400).trim();
  const m = dur.match(/^(.{2,40}?)s+[—–-]s+(.+)$/);
  if (m && dur.length > 30) { dur = m[1].trim(); phase = phase ? `${phase} — ${m[2].trim()}` : m[2].trim(); }
  return { phase: clip(phase, 300), duration: clip(dur, 60) };
};

async function readBody(request) { try { return await request.json(); } catch { return {}; } }
async function runAI(env, system, user, opts) {
  try { return await aiJSON(env, system, user, opts); } catch (e) { throw new HttpError(e.status || 503, e.message); }
}

// ---------- السياق ----------
async function catalogRows(db, org = 'nubl') {
  const { results } = await db.prepare("SELECT id, kind, sector, code, name, months, monthly, price, unit, plan, delivery, details FROM catalog WHERE active = 1 AND COALESCE(org,'nubl') = ? ORDER BY kind, sector, months, id").bind(org).all();
  return results;
}
const catalogBrief = (rows) => rows.map((r) => {
  const d = parse(r.details, {});
  const extra = r.kind === 'package' ? ` · ${d.posts || '?'} منشور و${d.designs || '?'} تصميم شهرياً · ${d.platforms || '?'} منصات · سقف إعلانات ${d.adcap || '?'}` : d.desc ? ` · ${String(d.desc).slice(0, 120)}` : '';
  return `${r.code || 'ID' + r.id} | ${r.kind === 'package' ? 'باقة' : r.kind === 'print' ? 'مطبوعات' : 'خدمة'} | ${r.sector || ''} | ${r.name}${r.kind === 'package' ? ` | ${r.months} شهر | ${r.monthly} ر.س/شهر` : ` | ${r.price} ر.س${r.unit ? '/' + r.unit : ''}`}${extra}`;
}).join('\n');

async function partyContext(db, d) {
  const out = {};
  if (d.client_id) out.client = await db.prepare('SELECT id, name, brand, sector, contact_name, phone, email, city, package, notes, socials, cr_number, vat_number, national_address FROM clients WHERE id = ?').bind(d.client_id).first();
  if (d.lead_id) out.lead = await db.prepare('SELECT id, name, company, phone, city, sector, segment, interest, notes, client_id FROM leads WHERE id = ?').bind(d.lead_id).first();
  if (d.deal_id) out.deal = await db.prepare('SELECT id, title, value, stage, package, notes, lead_id, client_id FROM deals WHERE id = ?').bind(d.deal_id).first();
  if (!out.client && out.lead?.client_id) out.client = await db.prepare('SELECT * FROM clients WHERE id = ?').bind(out.lead.client_id).first();
  const pid = out.client?.id || out.lead?.id;
  const kind = out.client ? 'client_id' : out.lead ? 'lead_id' : null;
  if (kind) {
    const { results } = await db.prepare(`SELECT kind, subject, outcome, notes, at FROM activities WHERE ${kind} = ? ORDER BY at DESC LIMIT 8`).bind(pid).all();
    out.history = results;
  }
  return out;
}
const partyText = (p) => [
  p.client && `العميل: ${p.client.name}${p.client.brand ? ' / ' + p.client.brand : ''} · القطاع: ${p.client.sector || '—'} · المدينة: ${p.client.city || '—'} · المسؤول: ${p.client.contact_name || '—'} · الباقة الحالية: ${p.client.package || '—'} · ملاحظات: ${str(p.client.notes, 500)}`,
  p.lead && `العميل المحتمل: ${p.lead.name}${p.lead.company ? ' — ' + p.lead.company : ''} · القطاع: ${p.lead.sector || '—'} · المدينة: ${p.lead.city || '—'} · الاهتمام: ${p.lead.interest || '—'} · ملاحظات: ${str(p.lead.notes, 500)}`,
  p.deal && `الصفقة: ${p.deal.title} · المرحلة: ${p.deal.stage} · الباقة المقترحة: ${p.deal.package || '—'} · ملاحظات: ${str(p.deal.notes, 400)}`,
  p.history?.length && 'آخر التواصل:\n' + p.history.map((h) => `- ${String(h.at).slice(0, 10)} ${h.kind}: ${h.subject || ''} ${h.outcome || ''} ${str(h.notes, 160)}`).join('\n'),
].filter(Boolean).join('\n');

// ---------- عرض السعر ----------
const QUOTE_SCHEMA = `{
 "subject": "عنوان العرض (سطر واحد يصف الخدمة للعميل)",
 "prepared_for": "الأستاذ/ ... — اسم المنشأة، المدينة.",
 "intro": "فقرة افتتاحية 2-4 جمل: ماذا نقدم ولماذا، والهدف التجاري للعميل. يمكن استخدام **غامق**",
 "sections": [ { "heading": "عنوان القسم (مثل: محتوى الصفحة / نطاق العمل / ما تحصلون عليه شهرياً)", "intro": "اختياري", "table": { "columns": ["القسم","ما يعرضه"], "rows": [["...","..."]] }, "bullets": ["اختياري"], "callout": { "label": "اختياري", "text": "..." }, "after_pricing": false } ],
 "pricing": {
   "setup":   { "title": "التأسيس (يُدفع مرة واحدة)", "items": [ { "name": "...", "desc": "تفصيل مختصر", "catalog_code": "رمز من الكتالوج أو null", "qty": 1, "price": 0 } ] },
   "monthly": { "title": "اختياري", "min_months": 3, "items": [ { "name": "...", "desc": "...", "catalog_code": "...", "qty": 1, "price": 0 } ] },
   "addons":  { "title": "خيارات إضافية للنمو (اختيارية)", "items": [ { "name": "...", "desc": "...", "catalog_code": "...", "price": 0, "unit": "شهر أو فارغ", "from": false } ] },
   "perk": "ميزة عند التعاقد (اختياري)"
 },
 "timeline": [ { "phase": "المرحلة أو المطلوب من العميل (التفاصيل هنا)", "duration": "المدة فقط بكلمات قليلة، مثل: 5–7 أيام عمل" } ],
 "terms": ["**التأسيس**: شروط الدفع ...", "جولتا تعديل ...", "ضريبة القيمة المضافة ١٥٪ مضافة، وتصدر فاتورة ضريبية نظامية."],
 "validity_days": 14,
 "setup_split": [50, 50]
}`;
const QUOTE_RULES = `قواعد عرض السعر (نموذج «عرض BBR» المعتمد):
- البنية: افتتاحية تجارية ← قسم أو قسمان للمحتوى/النطاق بجدول واضح ← العرض المالي (تأسيس / شهري / إضافات اختيارية) ← أقسام بعد التسعير عند الحاجة (after_pricing=true) ← الجدول الزمني والمطلوب من العميل ← الشروط.
- الأسعار: لأي بند موجود في الكتالوج ضع catalog_code مطابقاً تماماً لرمزه (أو "ID"+رقمه) — المنصة تضع سعر الكتالوج تلقائياً ولا يجوز لك تغييره. الباقات التسويقية تُوضع في monthly وسعرها شهري.
- البنود الخاصة غير الموجودة في الكتالوج: اقترح سعراً واقعياً لسوق جدة بالريال قبل الضريبة واجعل catalog_code=null — سيظهر «يحتاج اعتماد» حتى تعتمده الإدارة.
- لا تحسب الضريبة ولا المجاميع؛ المنصة تحسبها. البند المشمول مجاناً price=0.
- الإضافات: اقترح 2-4 خيارات نمو منطقية (مثل تصوير عبر قطاع الإنتاج في المجموعة، باقة تسويقية من الكتالوج، نسخة إنجليزية، أتمتة) فقط عندما تخدم هدف العميل.
- الشروط: شروط الدفع (setup_split يطابقها، مجموعها 100)، جولات التعديل، الملكية للعميل، الضريبة. لا تضف الحساب البنكي ولا الختام (تضيفهما المنصة).
- لا تذكر منافسين بالاسم، ولا أرقام أداء مضمونة.
- subject وصف للخدمة فقط ولا يبدأ بعبارة «عرض سعر» (العنوان مكتوب مسبقاً).
- لا تخترع خدمات أو أدوات أو مزايا لم ترد في الاحتياج أو الكتالوج. الميزة عند التعاقد (perk) فقط إن كانت منطقية من المعطيات (مثل الإعفاء من رسوم الدعم عند التعاقد على باقة تسويقية)، وإلا اتركها فارغة.
- راجع الإملاء قبل الإخراج (واجهات لا وجهات، تكويد/برمجة، همزات القطع)، وكل صف في جداول الأقسام يحتوي عمودين مكتملين.`;

function normItems(items, cmap, group) {
  return arr(items).slice(0, 25).map((i) => {
    const code = i.catalog_code ? String(i.catalog_code).trim() : '';
    const c = code ? cmap.get(code.toUpperCase()) : null;
    const it = { name: str(i.name || c?.name, 200), desc: str(i.desc, 400), qty: Math.max(1, Number(i.qty) || 1) };
    if (group === 'addons') { it.unit = str(i.unit, 20); it.from = !!i.from; }
    if (c) {
      it.catalog_id = c.id; it.catalog_code = c.code || 'ID' + c.id; it.locked = true; it.review = false;
      it.price = c.kind === 'package' ? Number(c.monthly) || 0 : Number(c.price) || Number(c.monthly) || 0;
      if (c.kind === 'package' && group === 'addons' && !it.unit) it.unit = 'شهر';
    } else {
      it.price = i.price === '' || i.price == null ? null : round2(i.price); it.locked = false;
      it.review = it.price == null || it.price > 0 ? !i.approved : false;
      if (i.approved) it.approved = true;
    }
    return it;
  }).filter((i) => i.name);
}
export function normalizeQuoteDoc(raw, catalog, vat) {
  const cmap = new Map();
  for (const c of catalog) { if (c.code) cmap.set(String(c.code).toUpperCase(), c); cmap.set('ID' + c.id, c); }
  const P = raw.pricing || {};
  const doc = {
    subject: str(raw.subject, 200), prepared_for: str(raw.prepared_for, 300), intro: str(raw.intro, 1500),
    sections: arr(raw.sections).slice(0, 6).map((s) => ({
      heading: str(s.heading, 120), intro: str(s.intro, 800), after_pricing: !!s.after_pricing,
      table: s.table && arr(s.table.rows).length ? { columns: arr(s.table.columns).slice(0, 3).map((c) => str(c, 40)), rows: arr(s.table.rows).slice(0, 20).map((r) => arr(r).slice(0, 3).map((c) => str(c, 500))) } : null,
      bullets: arr(s.bullets).slice(0, 10).map((b) => str(b, 400)),
      callout: s.callout?.text ? { label: str(s.callout.label, 60), text: str(s.callout.text, 500) } : null,
    })).filter((s) => s.heading),
    pricing: {
      setup: { title: str(P.setup?.title, 120), items: normItems(P.setup?.items, cmap, 'setup') },
      monthly: { title: str(P.monthly?.title, 120), min_months: Math.max(0, Math.min(36, Number(P.monthly?.min_months) || 0)), items: normItems(P.monthly?.items, cmap, 'monthly') },
      addons: { title: str(P.addons?.title, 120), items: normItems(P.addons?.items, cmap, 'addons') },
      perk: str(P.perk, 400), perk_label: str(P.perk_label, 60),
    },
    timeline: arr(raw.timeline).slice(0, 10).map(tline).filter((t) => t.phase),
    timeline_heading: str(raw.timeline_heading, 100),
    terms: arr(raw.terms).slice(0, 10).map((t) => str(t, 400)),
    validity_days: Math.max(3, Math.min(60, Number(raw.validity_days) || 14)),
    setup_split: arr(raw.setup_split).map(Number).filter((x) => x > 0).slice(0, 4),
  };
  if (doc.pricing.monthly.items.length && !doc.pricing.monthly.min_months) doc.pricing.monthly.min_months = 1;
  doc.totals = quoteTotals(doc, vat);
  return doc;
}
async function saveQuoteRecord(db, q, doc, s) {
  const t = doc.totals;
  const items = [...doc.pricing.setup.items, ...doc.pricing.monthly.items.map((i) => ({ ...i, monthly: 1 }))].map((i) => ({ name: i.name, desc: i.desc, qty: i.qty, price: i.price ?? 0, catalog_id: i.catalog_id || null, monthly: i.monthly || 0 }));
  await db.prepare(`UPDATE quotes SET title = ?, items = ?, subtotal = ?, discount = 0, vat = ?, total = ?, months = ?, plan = ?, doc = ?, price_review = ?, terms = ?, valid_until = COALESCE(valid_until, ?), updated_at = datetime('now') WHERE id = ?`)
    .bind(doc.subject || q.title, JSON.stringify(items), t.contract_net, t.contract_vat, t.contract_total, t.months || 1, t.monthly > 0 ? 'monthly' : 'single',
      JSON.stringify(doc), t.review ? 1 : 0, doc.terms.join('\n'), addDays(today(), doc.validity_days), q.id).run();
}

async function aiQuote(db, env, user, d, h) {
  h.need(user, 'quotes', 'w');
  if (!str(d.brief).trim()) return bad('اكتب وصف الاحتياج (ماذا يريد العميل وما هدفه)');
  const party = await partyContext(db, d);
  if (!party.client && !party.lead) return bad('اختر العميل أو العميل المحتمل');
  const s = await getSettings(db); const cat = await catalogRows(db, party.client?.org || party.lead?.org || 'nubl');
  const picked = arr(d.services).map(Number);
  const user_msg = `${partyText(party)}

الاحتياج والمعطيات من فريقنا:
${str(d.brief, 4000)}
${d.budget ? `ميزانية العميل التقريبية: ${str(d.budget, 100)}` : ''}${d.months ? `\nمدة التعاقد المطلوبة: ${Number(d.months)} أشهر` : ''}
${picked.length ? `خدمات اختارها الفريق من الكتالوج ويجب تضمينها: ${cat.filter((c) => picked.includes(c.id)).map((c) => c.code || 'ID' + c.id).join('، ')}` : ''}

الكتالوج المعتمد (الرمز | النوع | القطاع | الاسم | المدة/السعر):
${catalogBrief(cat)}

اكتب عرض السعر بهذه البنية تماماً:
${QUOTE_SCHEMA}`;
  const { data, engine } = await runAI(env, `${BRAND}\n${QUOTE_RULES}`, user_msg, { max: 7000, tier: 'deep' });
  const doc = normalizeQuoteDoc(data, cat, s.vat_rate || 15);
  if (!doc.pricing.setup.items.length && !doc.pricing.monthly.items.length) throw new HttpError(422, 'لم يُنتج الذكاء بنوداً مسعّرة — أضف تفاصيل أكثر للاحتياج');
  const clientId = party.client?.id || null; const leadId = party.lead?.id || null;
  const number = await nextNumber(db, 'quotes', 'Q', party.client?.org || party.lead?.org || 'nubl');
  const r = await db.prepare(`INSERT INTO quotes (number, client_id, lead_id, deal_id, title, status, valid_until, created_by, ai_engine) VALUES (?,?,?,?,?, 'مسودة', ?, ?, ?)`)
    .bind(number, clientId, leadId, party.deal?.id || null, doc.subject || 'عرض سعر', addDays(today(), doc.validity_days), user.id, engine).run();
  const q = { id: r.meta.last_row_id, title: doc.subject };
  await saveQuoteRecord(db, q, doc, s);
  if (party.deal && ['جديدة', 'تواصل أول', 'جلسة تشخيص'].includes(party.deal.stage)) await db.prepare("UPDATE deals SET stage = 'عرض سعر', value = ?, updated_at = datetime('now') WHERE id = ?").bind(doc.totals.contract_net, party.deal.id).run();
  await db.prepare('INSERT INTO activities (kind, lead_id, deal_id, client_id, subject, notes, user_id) VALUES (?,?,?,?,?,?,?)')
    .bind('ملاحظة', leadId, party.deal?.id || null, clientId, `عرض سعر ${number} (ذكاء نُبل)`, `${doc.subject} — ${doc.totals.contract_net} ر.س قبل الضريبة`, user.id).run();
  await audit(db, user, 'ai-quote', 'quotes', q.id, engine);
  if (doc.totals.review) await notifyRoles(db, env, ['admin', 'finance'], `🧾 عرض سعر <b>${hx(number)}</b> بانتظار اعتماد ${doc.totals.review} بند خارج الكتالوج\n${hx(doc.subject)} — ${hx(party.client?.name || party.lead?.company || party.lead?.name || '')}\nأعدّه ${hx(user.name)} بالذكاء الاصطناعي`, { kind: 'finance', link: `#quote/${q.id}` }, user.id);
  return json({ id: q.id, number, review: doc.totals.review, engine }, 201);
}

async function reviseQuote(db, env, user, id, d, h) {
  h.need(user, 'quotes', 'w');
  const q = await h.inScope(db, user, 'quotes', id);
  const doc0 = parse(q.doc, null); if (!doc0) return bad('هذا العرض لم يُنشأ بالذكاء — أنشئ عرضاً ذكياً جديداً');
  if (!str(d.instruction).trim()) return bad('اكتب التعديل المطلوب');
  const s = await getSettings(db); const cat = await catalogRows(db, q.org || 'nubl');
  const { totals, ...prev } = doc0;
  const { data, engine } = await runAI(env, `${BRAND}\n${QUOTE_RULES}\nأنت تعدّل عرضاً قائماً: نفّذ التعديل المطلوب فقط وحافظ على بقية المحتوى كما هو، وأعد العرض كاملاً بنفس البنية.`,
    `العرض الحالي:\n${JSON.stringify(prev)}\n\nالتعديل المطلوب:\n${str(d.instruction, 2000)}\n\nالكتالوج:\n${catalogBrief(cat)}`, { max: 7000 });
  // البنود الخاصة المعتمدة سابقاً تبقى معتمدة إن لم يتغير سعرها
  const approved = new Map([...doc0.pricing.setup.items, ...doc0.pricing.monthly.items, ...doc0.pricing.addons.items].filter((i) => !i.locked && !i.review).map((i) => [i.name, i.price]));
  for (const g of ['setup', 'monthly', 'addons']) for (const i of arr(data.pricing?.[g]?.items)) if (!i.catalog_code && approved.has(i.name) && Number(approved.get(i.name)) === Number(i.price)) i.approved = true;
  const doc = normalizeQuoteDoc(data, cat, s.vat_rate || 15);
  await saveQuoteRecord(db, q, doc, s);
  await db.prepare('UPDATE quotes SET ai_engine = ? WHERE id = ?').bind(engine, q.id).run();
  await audit(db, user, 'ai-revise', 'quotes', q.id, str(d.instruction, 200));
  return json({ ok: true, review: doc.totals.review, engine });
}

// تعديل يدوي على المستند (نصوص وأسعار البنود الخاصة) — بنود الكتالوج تبقى مقفلة
async function editQuote(db, env, user, id, d, h) {
  h.need(user, 'quotes', 'w');
  const q = await h.inScope(db, user, 'quotes', id);
  const s = await getSettings(db); const cat = await catalogRows(db, q.org || 'nubl');
  const old = parse(q.doc, null); if (!old || !d.doc) return bad('لا يوجد مستند');
  const approver = APPROVERS.includes(user.role);
  const oldPrice = new Map([...old.pricing.setup.items, ...old.pricing.monthly.items, ...old.pricing.addons.items].map((i) => [i.name, i]));
  for (const g of ['setup', 'monthly', 'addons']) for (const i of arr(d.doc.pricing?.[g]?.items)) {
    const o = oldPrice.get(i.name);
    if (approver && !i.catalog_code) i.approved = true; // المعتمِد يعدّل ويعتمد في خطوة واحدة
    else if (o && !o.review && !o.locked && Number(o.price) === Number(i.price)) i.approved = true;
  }
  const doc = normalizeQuoteDoc(d.doc, cat, s.vat_rate || 15);
  await saveQuoteRecord(db, q, doc, s);
  if (approver && !doc.totals.review) await db.prepare("UPDATE quotes SET approved_by = ?, approved_at = datetime('now') WHERE id = ?").bind(user.id, q.id).run();
  await audit(db, user, 'edit-doc', 'quotes', q.id);
  return json({ ok: true, review: doc.totals.review });
}

async function approveQuote(db, env, user, id, h) {
  if (!APPROVERS.includes(user.role)) return bad('اعتماد الأسعار للمدير العام والمدير والمالية', 403);
  const q = await h.inScope(db, user, 'quotes', id);
  const s = await getSettings(db); const cat = await catalogRows(db, q.org || 'nubl');
  const doc0 = parse(q.doc, null); if (!doc0) return bad('لا يوجد مستند ذكي لهذا العرض');
  for (const g of ['setup', 'monthly', 'addons']) for (const i of doc0.pricing[g].items) if (!i.locked) { if (i.price == null) return bad(`حدّد سعر «${i.name}» قبل الاعتماد`); i.approved = true; }
  const doc = normalizeQuoteDoc(doc0, cat, s.vat_rate || 15);
  await saveQuoteRecord(db, q, doc, s);
  await db.prepare("UPDATE quotes SET approved_by = ?, approved_at = datetime('now') WHERE id = ?").bind(user.id, q.id).run();
  await audit(db, user, 'approve-prices', 'quotes', q.id);
  if (q.created_by && q.created_by !== user.id) await notifyUser(db, env, q.created_by, `✅ اعتُمدت أسعار عرض السعر <b>${hx(q.number)}</b> بواسطة ${hx(user.name)}\nجاهز للإرسال للعميل`, null, { kind: 'finance', link: `#quote/${q.id}` });
  return json({ ok: true });
}

// ---------- العقد ----------
const CONTRACT_SCHEMA = `{
 "intro": "تمهيد مختصر جملة أو جملتان يذكر نشاط العميل وهدف التعاقد",
 "scope": [ { "item": "الخدمة", "details": "التفاصيل الدقيقة القابلة للقياس (الكميات، المنصات، الحدود)" } ],
 "deliverables": ["مخرج محدد قابل للتسليم والاعتماد"],
 "client_duties": ["التزام خاص بهذا العميل/المشروع فقط (العامة موجودة مسبقاً)"],
 "timeline": [ { "phase": "...", "duration": "..." } ],
 "special_terms": ["شرط خاص نابع من العرض فقط (مثل ميزة الإعفاء، ملكية الدومين، الحد الأدنى للمدة) — لا تكرر البنود القياسية"]
}`;
export function legacyQuoteDoc(q) {
  const items = parse(q.items, []);
  const setup = items.filter((i) => !i.monthly).map((i) => ({ name: i.name, desc: i.desc || '', qty: Number(i.qty) || 1, price: Number(i.price) || 0, locked: true }));
  const monthly = items.filter((i) => i.monthly).map((i) => ({ name: i.name, desc: i.desc || '', qty: Number(i.qty) || 1, price: Number(i.price) || 0, locked: true }));
  const doc = { subject: q.title || '', prepared_for: '', intro: q.notes || '', sections: [], pricing: { setup: { items: setup }, monthly: { min_months: monthly.length ? Number(q.months) || 1 : 0, items: monthly }, addons: { items: [] } }, timeline: [], terms: String(q.terms || '').split('\n').filter(Boolean), validity_days: 15 };
  if (Number(q.discount) > 0) doc.pricing.setup.items.push({ name: 'خصم', qty: 1, price: -Number(q.discount), locked: true });
  return doc;
}

async function aiContract(db, env, user, quoteId, d, h) {
  h.need(user, 'contracts', 'w');
  const q = await h.inScope(db, user, 'quotes', quoteId);
  if (q.price_review) return bad('أسعار العرض بانتظار الاعتماد — تُعتمد أولاً ثم يُحوَّل لعقد');
  const s = await getSettings(db);
  const qdoc = parse(q.doc, null) || legacyQuoteDoc(q);
  const totals = quoteTotals(qdoc, s.vat_rate || 15);
  const contractId = await h.toContract(q.id);
  const c = await db.prepare('SELECT * FROM contracts WHERE id = ?').bind(contractId).first();
  const client = await db.prepare('SELECT * FROM clients WHERE id = ?').bind(c.client_id).first();
  const { totals: _t, ...qclean } = qdoc;
  const { data, engine } = await runAI(env, `${BRAND}\nأنت تصيغ الأجزاء المتغيرة من عقد خدمات تسويقية بناءً على عرض سعر معتمد. البنود القانونية القياسية (الدفع، الملكية، السرية، الإنهاء، النظام الواجب التطبيق…) مكتوبة مسبقاً ولا تكتبها. التزم بما ورد في العرض حرفياً في الكميات والمدد، ولا تضف التزامات أو أسعاراً جديدة.`,
    `العميل: ${client?.name || ''} · القطاع: ${client?.sector || ''}\nعرض السعر المعتمد ${q.number}:\n${JSON.stringify(qclean)}\n${d.notes ? `\nملاحظات إضافية من الفريق: ${str(d.notes, 1500)}` : ''}\n\nأعد:\n${CONTRACT_SCHEMA}`, { max: 4000, tier: 'deep' });
  const months = Math.max(1, totals.months || Number(c.months) || 1);
  const cdoc = {
    subject: qdoc.subject, intro: str(data.intro, 800),
    scope: arr(data.scope).slice(0, 15).map((x) => ({ item: str(x.item, 150), details: str(x.details, 600) })).filter((x) => x.item),
    deliverables: arr(data.deliverables).slice(0, 12).map((x) => str(x, 300)),
    client_duties: arr(data.client_duties).slice(0, 6).map((x) => str(x, 300)),
    timeline: arr(data.timeline).length ? arr(data.timeline).slice(0, 10).map(tline) : qdoc.timeline,
    special_terms: arr(data.special_terms).slice(0, 8).map((x) => str(x, 400)),
    setup_split: qdoc.setup_split, totals, quote_number: q.number, engine,
  };
  const start = c.start_date || today();
  await db.prepare(`UPDATE contracts SET doc = ?, months = ?, end_date = ?, total_value = ?, monthly_value = ?, title = COALESCE(?, title), package = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(JSON.stringify(cdoc), months, addDays(addMonths(start, months), -1), totals.contract_net, totals.monthly || round2(totals.contract_net / months),
      qdoc.subject || null, cdoc.scope.map((x) => `• ${x.item}: ${x.details}`).join('\n').slice(0, 2000), c.id).run();
  await audit(db, user, 'ai-contract', 'contracts', c.id, q.number);
  await notifyRoles(db, env, ['admin', 'finance'], `✍️ مسودة عقد <b>${hx(c.number)}</b> من عرض ${hx(q.number)} — ${hx(client?.name || '')}\nالقيمة ${totals.contract_net.toLocaleString('en-US')} ر.س قبل الضريبة · بانتظار المراجعة والتوقيع`, { kind: 'finance', link: `#contract/${c.id}` }, user.id);
  return json({ contract_id: c.id, number: c.number, engine });
}

// ---------- الخطة التسويقية ----------
const PLAN_SCHEMA = `{
 "title": "عنوان الخطة",
 "summary": "ملخص تنفيذي 3-5 جمل",
 "summary_callout": "أهم قرار أو رسالة في جملة",
 "swot": { "strengths": [], "weaknesses": [], "opportunities": [], "threats": [] },
 "objectives": [ { "goal": "هدف SMART", "kpi": "المؤشر", "target": "رقم مستهدف واقعي مع الفترة" } ],
 "audience": [ { "segment": "الشريحة", "insight": "الدافع/الاحتياج", "message": "الرسالة" } ],
 "positioning": "التموضع والرسالة الرئيسية",
 "pillars": [ { "name": "تعليمي|عرض / بيع|خلف الكواليس|موسمي|دليل اجتماعي|هوية وقيم", "share": 30, "examples": ["فكرة"] } ],
 "channels": [ { "platform": "إنستقرام", "role": "الدور في القمع", "frequency": "3 أسبوعياً", "best_times": "8–11 م" } ],
 "calendar": [ { "month": "نوفمبر 2026", "theme": "الفكرة الرئيسية", "seasons": ["مناسبة"] } ],
 "ads": { "budget": "الميزانية الشهرية المقترحة", "split": [ { "channel": "ميتا — رسائل واتساب", "objective": "الهدف", "pct": 60 } ] },
 "roadmap": [ { "phase": "التأسيس", "duration": "الأسبوعان 1-2", "actions": ["..."] } ],
 "risks": [ { "risk": "...", "mitigation": "..." } ],
 "next_steps": ["من يفعل ماذا ومتى"]
}`;
const PLAN_SCHEMA_A = `{
 "title": "عنوان الخطة",
 "summary": "ملخص تنفيذي 3-5 جمل",
 "summary_callout": "أهم قرار أو رسالة في جملة",
 "swot": { "strengths": [], "weaknesses": [], "opportunities": [], "threats": [] },
 "objectives": [ { "goal": "هدف SMART", "kpi": "المؤشر", "target": "رقم مستهدف واقعي مع الفترة" } ],
 "audience": [ { "segment": "الشريحة", "insight": "الدافع/الاحتياج", "message": "الرسالة" } ],
 "positioning": "التموضع والرسالة الرئيسية"
}`;
const PLAN_SCHEMA_B = `{
 "pillars": [ { "name": "تعليمي|عرض / بيع|خلف الكواليس|موسمي|دليل اجتماعي|هوية وقيم", "share": 30, "examples": ["فكرة"] } ],
 "channels": [ { "platform": "إنستقرام", "role": "الدور في القمع", "frequency": "3 أسبوعياً", "best_times": "8–11 م" } ],
 "calendar": [ { "month": "نوفمبر 2026", "theme": "الفكرة الرئيسية", "seasons": ["مناسبة"] } ],
 "ads": { "budget": "الميزانية الشهرية المقترحة", "split": [ { "channel": "ميتا — رسائل واتساب", "objective": "الهدف", "pct": 60 } ] },
 "roadmap": [ { "phase": "التأسيس", "duration": "الأسبوعان 1-2", "actions": ["..."] } ],
 "risks": [ { "risk": "...", "mitigation": "..." } ],
 "next_steps": ["من يفعل ماذا ومتى"]
}`;
async function seasonsAhead(db, from, months) {
  const { results } = await db.prepare('SELECT name, date, sectors FROM seasons WHERE date >= ? AND date <= ? ORDER BY date').bind(from, addMonths(from, months)).all();
  return results;
}
async function packageFor(db, client) {
  if (!client?.package) return null;
  const { results } = await db.prepare("SELECT name, months, monthly, details FROM catalog WHERE kind = 'package' AND active = 1 AND COALESCE(org,'nubl') = ?").bind(client.org || 'nubl').all();
  const pk = String(client.package);
  return results.sort((x, y) => y.name.length - x.name.length).find((r) => pk.includes(r.name) || r.name.includes(pk)) || null;
}
async function aiPlan(db, env, user, d, h) {
  h.need(user, 'plans', 'w');
  const client = d.client_id ? await db.prepare('SELECT * FROM clients WHERE id = ?').bind(d.client_id).first() : null;
  if (!client) return bad('اختر العميل');
  const months = Math.max(1, Math.min(12, Number(d.months) || 3));
  const start = /^\d{4}-\d{2}-\d{2}$/.test(d.start_date || '') ? d.start_date : today();
  const [seas, pkg, party] = await Promise.all([seasonsAhead(db, start, months), packageFor(db, client), partyContext(db, { client_id: client.id })]);
  const pd = pkg ? parse(pkg.details, {}) : null;
  const sys = `${BRAND}\nأنت استراتيجي تسويق أول تكتب خطة تسويقية تنفيذية لعميل سعودي. ابنِ الخطة على: المشكلة ← الجمهور ← التموضع ← القيمة ← القنوات ← المحتوى ← الإعلانات ← مؤشرات الأداء ← خارطة التنفيذ. الأهداف SMART وواقعية، والقنوات حسب جمهور القطاع في السعودية، ومجموع نسب المحاور 100 ومجموع نسب الإعلانات 100. اربط التقويم بالمواسم المعطاة فقط. لا تختلق أرقاماً عن أداء العميل الحالي؛ إن لم تتوفر فاجعل الهدف الأول قياس خط الأساس.`;
  const brief = `${partyText(party)}
${pkg ? `الباقة المتعاقد عليها: ${pkg.name} — ${pd?.posts || '?'} منشوراً و${pd?.designs || '?'} تصميماً شهرياً على ${pd?.platforms || '?'} منصات، وإدارة إعلانات حتى ${pd?.adcap || '?'} ر.س` : ''}
مدة الخطة: ${months} أشهر تبدأ ${start}
الأهداف والاحتياج: ${str(d.goals, 2500) || 'غير محددة — اقترح الأنسب للقطاع'}
الميزانية الإعلانية: ${str(d.budget, 100) || 'غير محددة — اقترح ميزانية مناسبة'}
${d.audience ? `الجمهور: ${str(d.audience, 800)}` : ''}${d.platforms?.length ? `\nالمنصات المفضلة: ${arr(d.platforms).join('، ')}` : ''}${d.notes ? `\nملاحظات: ${str(d.notes, 1500)}` : ''}
المواسم والمناسبات خلال الفترة: ${seas.map((x) => `${x.name} (${x.date})`).join('، ') || 'لا مواسم مسجلة'}

`;
  // توليد متوازٍ لنصفي الخطة (الاستراتيجية + التنفيذ) — يختصر الزمن للنصف تقريباً
  const [A, B] = await Promise.all([
    runAI(env, sys, `${brief}\nاكتب الجزء الاستراتيجي من الخطة فقط بهذه البنية:\n${PLAN_SCHEMA_A}`, { max: 4500, tier: 'top' }),
    runAI(env, sys, `${brief}\nاكتب الجزء التنفيذي من الخطة فقط (القسم الاستراتيجي يكتبه زميل بالتوازي على المعطيات نفسها) بهذه البنية:\n${PLAN_SCHEMA_B}`, { max: 5000, tier: 'deep' }),
  ]);
  const data = { ...B.data, ...A.data };
  const engine = A.engine === B.engine ? A.engine : `${A.engine} + ${B.engine}`;
  const doc = { ...data, months };
  const r = await db.prepare(`INSERT INTO plans (client_id, title, start_date, months, goals, budget, status, doc, engine, created_by) VALUES (?,?,?,?,?,?, 'مسودة', ?, ?, ?)`)
    .bind(client.id, str(data.title, 200) || `الخطة التسويقية — ${client.name}`, start, months, str(d.goals, 2000), str(d.budget, 100), JSON.stringify(doc), engine, user.id).run();
  await audit(db, user, 'ai-plan', 'plans', r.meta.last_row_id, engine);
  return json({ id: r.meta.last_row_id, engine }, 201);
}
async function revisePlan(db, env, user, id, d, h) {
  h.need(user, 'plans', 'w');
  const p = await db.prepare('SELECT * FROM plans WHERE id = ?').bind(id).first(); if (!p) return bad('الخطة غير موجودة', 404);
  if (!str(d.instruction).trim()) return bad('اكتب التعديل المطلوب');
  const { data, engine } = await runAI(env, `${BRAND}\nعدّل الخطة التسويقية التالية وفق التعليمات فقط، وأعدها كاملة بنفس البنية.`, `الخطة:\n${p.doc}\n\nالتعديل:\n${str(d.instruction, 2000)}`, { max: 7000 });
  await db.prepare("UPDATE plans SET doc = ?, title = ?, engine = ?, updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify({ ...data, months: p.months }), str(data.title, 200) || p.title, engine, id).run();
  await audit(db, user, 'ai-revise', 'plans', id, str(d.instruction, 200));
  return json({ ok: true, engine });
}

// ---------- المنشورات: توليد وتوزيع على تقويم الشهر ----------
const POST_RULES = `قواعد التوزيع (السعودية):
- وزّع المنشورات على أيام الشهر بالتساوي تقريباً، ولا تضع منشورين على المنصة نفسها في اليوم نفسه، وقدّم المحتوى الموسمي قبل المناسبة بيوم إلى ثلاثة أيام.
- أوقات مرجعية بتوقيت الرياض (اختر ضمنها): إنستقرام 20:00–23:00، تيك توك 21:00–00:00، سناب شات 21:00–23:00، X ‏13:00 أو 21:00، لينكدإن 09:00–11:00 من الأحد إلى الخميس، فيسبوك 19:00–22:00. الخميس والجمعة مساءً أعلى تفاعلاً للمحتوى الاستهلاكي.
- مزيج المحاور تقريباً: تعليمي 30٪، عرض/بيع 20٪، دليل اجتماعي 15٪، خلف الكواليس 15٪، موسمي 10٪، هوية وقيم 10٪ — أو حسب الخطة إن وُجدت.
- الكابشن: سطر افتتاحي يخطف الانتباه، قيمة واضحة، دعوة واحدة لاتخاذ إجراء، بنبرة العلامة. 3–6 وسوم مناسبة للسوق السعودي (عربية غالباً).
- design_brief: وصف بصري للمصمم (الفكرة، العناصر، النص على التصميم إن وجد بحد 6 كلمات، المقاس حسب الصيغة). الريل/الفيديو: فكرة المشاهد في 3 لقطات.
- لا وعود مضمونة، ولا أسعار غير معطاة، ولا محتوى يخالف الأنظمة أو الذوق العام.`;
async function aiPosts(db, env, user, d, h) {
  h.need(user, 'content', 'w');
  const client = d.client_id ? await db.prepare('SELECT * FROM clients WHERE id = ?').bind(d.client_id).first() : null;
  if (!client) return bad('اختر العميل');
  const month = /^\d{4}-\d{2}$/.test(d.month || '') ? d.month : today().slice(0, 7);
  const from = `${month}-01`; const to = addDays(addMonths(from, 1), -1);
  const [pkg, seas, plan] = await Promise.all([packageFor(db, client), seasonsAhead(db, from, 1),
    d.plan_id ? db.prepare('SELECT title, doc FROM plans WHERE id = ?').bind(d.plan_id).first() : db.prepare("SELECT id, title, doc FROM plans WHERE client_id = ? AND status != 'ملغاة' ORDER BY id DESC LIMIT 1").bind(client.id).first()]);
  const pd = pkg ? parse(pkg.details, {}) : null;
  const count = Math.max(1, Math.min(40, Number(d.count) || Number(pd?.posts) || 12));
  const platforms = arr(d.platforms).filter((p) => PLATFORMS.includes(p));
  const { results: existing } = await db.prepare('SELECT publish_date, platform, title FROM content WHERE client_id = ? AND publish_date BETWEEN ? AND ?').bind(client.id, from, to).all();
  const pdoc = plan ? parse(plan.doc, {}) : null;
  // دفعات متوازية (حتى 8 منشورات لكل دفعة على مدى أيام مستقل) — أسرع وأمتن من طلب واحد طويل
  const days0 = Number(to.slice(8)); const nb = Math.min(5, Math.ceil(count / 8));
  const batches = Array.from({ length: nb }, (_, k) => {
    const d1 = 1 + Math.floor((k * days0) / nb); const d2 = Math.floor(((k + 1) * days0) / nb);
    const n = Math.floor(count / nb) + (k < count % nb ? 1 : 0);
    return { n, f: `${month}-${String(d1).padStart(2, '0')}`, t: `${month}-${String(d2).padStart(2, '0')}` };
  });
  const sysP = `${BRAND}\nأنت مدير محتوى أول تعدّ تقويم منشورات شهري جاهزاً للتصميم والجدولة.\n${POST_RULES}`;
  const res = await Promise.all(batches.map(({ n, f, t }) => runAI(env, sysP, `العميل: ${client.name}${client.brand ? ' / ' + client.brand : ''} · القطاع: ${client.sector || ''} · المدينة: ${client.city || ''}\nنبذة وملاحظات: ${str(client.notes, 800)}
الشهر: ${month} · هذه الدفعة: ${n} منشوراً بين ${f} و${t} فقط (دفعات أخرى تغطي بقية الشهر)
المنصات: ${platforms.length ? platforms.join('، ') : (pdoc?.channels || []).map((c) => c.platform).join('، ') || 'إنستقرام، تيك توك، سناب شات'}
${pdoc ? `من الخطة التسويقية «${plan.title}»: التموضع: ${str(pdoc.positioning, 400)} · المحاور: ${(pdoc.pillars || []).map((p) => `${p.name} ${p.share}%`).join('، ')} · الأهداف: ${(pdoc.objectives || []).map((o) => o.goal).join('؛ ')}` : ''}
المواسم في الشهر: ${seas.map((s) => `${s.name} (${s.date})`).join('، ') || 'لا يوجد'}
${existing.length ? `منشورات موجودة مسبقاً (لا تكررها ولا تضع فوقها): ${existing.map((e) => `${e.publish_date} ${e.platform} ${e.title}`).join(' | ')}` : ''}
${d.notes ? `توجيهات الفريق: ${str(d.notes, 1500)}` : ''}

أعد: { "posts": [ { "date": "YYYY-MM-DD", "time": "HH:MM", "platform": "${PLATFORMS.join('|')}", "format": "${FORMATS.join('|')}", "pillar": "${PILLARS.join('|')}", "title": "عنوان داخلي قصير", "caption": "النص الكامل", "hashtags": "#وسم #وسم", "cta": "الدعوة لاتخاذ إجراء", "design_brief": "..." } ] }`, { max: Math.min(12000, 1200 + n * 750) })));
  const data = { posts: res.flatMap((r) => arr(r.data.posts || r.data)) };
  const engine = [...new Set(res.map((r) => r.engine))].join(' + ');
  const posts = arr(data.posts || data).slice(0, count);
  if (!posts.length) throw new HttpError(422, 'لم يُنتج الذكاء منشورات — أعد المحاولة بتوجيهات أوضح');
  const days = Number(to.slice(8)); let i = 0;
  const stmts = posts.map((p) => {
    let date = /^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.date >= from && p.date <= to ? p.date : `${month}-${String(Math.min(days, 1 + Math.floor((i * days) / posts.length))).padStart(2, '0')}`;
    i++;
    const time = /^\d{1,2}:\d{2}$/.test(p.time || '') ? p.time.padStart(5, '0') : '21:00';
    const platform = (platforms.length ? platforms : PLATFORMS).includes(p.platform) ? p.platform : platforms[0] || 'إنستقرام';
    return db.prepare(`INSERT INTO content (client_id, publish_date, publish_time, platform, format, pillar, title, caption, hashtags, cta, brief, status, assignee_id, plan_id, source, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?, 'كتابة', ?, ?, 'ذكاء نُبل', ?)`).bind(client.id, date, time, platform, FORMATS.includes(p.format) ? p.format : 'منشور', PILLARS.includes(p.pillar) ? p.pillar : null,
      str(p.title, 150) || 'منشور', str(p.caption, 3000), str(p.hashtags, 300), str(p.cta, 200), str(p.design_brief, 1500), client.account_manager_id || user.id, plan?.id || d.plan_id || null, user.id);
  });
  await db.batch(stmts);
  await audit(db, user, 'ai-posts', 'content', client.id, `${month} ${stmts.length}`);
  if (client.account_manager_id && client.account_manager_id !== user.id) await notifyUser(db, env, client.account_manager_id, `🗓️ جُهّز ${stmts.length} منشوراً لـ <b>${hx(client.name)}</b> لشهر ${month} بالذكاء الاصطناعي\nراجع النصوص وأحِلها للتصميم ثم الاعتماد`, null, { kind: 'task_assigned', link: '#content' });
  return json({ created: stmts.length, month, engine }, 201);
}

// ---------- ملفات Word ----------
const fname = (s) => String(s || 'مستند').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 90);
async function docFile(db, user, kind, id, h, format) {
  const s = await getSettings(db);
  const ctx = { settings: s, today: today(), signName: s.sign_name || 'إياد المغيرة', signTitle: s.sign_title || 'مدير قطاع التسويق' };
  let blocks, name, org = 'nubl';
  // مستندات مروج الحجاز تحمل بياناتها هي (الاسم والسجل والرقم الضريبي) لا بيانات نُبل وابتكار
  const forOrg = (o) => { org = o || 'nubl'; if (org === 'morooj') ctx.settings = { ...s, company_name: s.morooj_company_name || 'مروج الحجاز للأعمال التجارية', cr_number: s.morooj_cr_number || '', vat_number: s.morooj_vat_number || '', company_city: s.morooj_address || 'جدة', bank_line: s.morooj_bank_line || '' }; };
  if (kind === 'quote') {
    h.need(user, 'quotes', 'r');
    const q = await h.inScope(db, user, 'quotes', id); forOrg(q.org);
    const doc = parse(q.doc, null) || legacyQuoteDoc(q);
    const cl = q.client_id ? await db.prepare('SELECT name, contact_name, city FROM clients WHERE id = ?').bind(q.client_id).first() : q.lead_id ? await db.prepare('SELECT name, company AS contact_name, city FROM leads WHERE id = ?').bind(q.lead_id).first() : null;
    ctx.clientName = cl ? [cl.contact_name && cl.contact_name !== cl.name ? cl.contact_name : null, cl.name, cl.city].filter(Boolean).join(' — ') : '';
    blocks = quoteBlocks(q, doc, ctx); name = `عرض سعر ${q.number} — ${doc.subject || q.title || ''}`;
  } else if (kind === 'contract') {
    h.need(user, 'contracts', 'r');
    const c = await h.inScope(db, user, 'contracts', id); forOrg(c.org);
    let doc = parse(c.doc, null);
    if (!doc) {
      const q = c.quote_id ? await db.prepare('SELECT * FROM quotes WHERE id = ?').bind(c.quote_id).first() : null;
      const qd = q ? (parse(q.doc, null) || legacyQuoteDoc(q)) : { pricing: { setup: { items: [] }, monthly: { min_months: c.months, items: [{ name: c.package || c.title, price: c.monthly_value }] }, addons: { items: [] } } };
      doc = { subject: c.title, scope: String(c.package || '').split('\n').filter(Boolean).map((l) => ({ item: l.replace(/^•\s*/, '').split(':')[0], details: l.split(':').slice(1).join(':').trim() })), totals: quoteTotals(qd, s.vat_rate || 15), quote_number: q?.number };
    }
    ctx.client = await db.prepare('SELECT * FROM clients WHERE id = ?').bind(c.client_id).first() || {};
    ctx.quoteNumber = doc.quote_number;
    blocks = contractBlocks(c, doc, ctx); name = `عقد ${c.number} — ${ctx.client.name || ''}`;
  } else if (kind === 'plan') {
    h.need(user, 'plans', 'r');
    const p = await db.prepare('SELECT * FROM plans WHERE id = ?').bind(id).first(); if (!p) return bad('غير موجود', 404); forOrg(p.org);
    const cl = await db.prepare('SELECT name FROM clients WHERE id = ?').bind(p.client_id).first();
    ctx.clientName = cl?.name || '';
    blocks = planBlocks(p, parse(p.doc, {}), ctx); name = `الخطة التسويقية — ${cl?.name || ''}`;
  } else return bad('نوع غير معروف', 404);
  if (format === 'html') { await audit(db, user, 'print', kind, id); return json({ title: name, html: renderHtml(blocks), org }); }
  if (org === 'morooj') return bad('ملف Word لمستندات مروج الحجاز يُفعَّل بعد اعتماد ورقها الرسمي — استخدم «تنزيل PDF» حالياً');
  const bytes = await buildDocx(blocks, { title: name });
  await audit(db, user, 'docx', kind, id);
  return new Response(bytes, { headers: {
    'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'content-disposition': `attachment; filename="${(fname(name).replace(/[^\x21-\x7E]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-') || 'document')}.docx"; filename*=UTF-8''${encodeURIComponent(fname(name))}.docx`,
    'cache-control': 'no-store' } });
}

// ---------- الموجّه ----------
// h: { need, inScope, toContract(quoteId) → contractId }
export async function studioRoute(db, env, request, user, parts, h) {
  const method = request.method.toUpperCase();
  const [, a, b, c] = parts; // studio/<a>/<b>/<c>
  if (a === 'status' && method === 'GET' && new URL(request.url).searchParams.get('test')) return json({ claude: await aiPing(env) });
  if (a === 'status' && method === 'GET') return json({ ai: aiReady(env), engines: { claude: !!env.ANTHROPIC_API_KEY, gemini: !!env.GEMINI_API_KEY, workers: !!env.AI }, can_approve: APPROVERS.includes(user.role) });
  // تصدير أي مستند مطبوع من المنصة إلى Word على الأوراق الرسمية A4 — الكتل تُستخرج في المتصفح من مستند الطباعة نفسه
  if (a === 'word' && method === 'POST') {
    const d = await readBody(request);
    const OK = ['date', 'title', 'subtitle', 'meta', 'p', 'h1', 'h2', 'table', 'callout', 'bullets', 'small', 'closing', 'sign', 'signatures', 'pagebreak', 'spacer'];
    const str = (v, n = 4000) => String(v ?? '').slice(0, n);
    const blocks = (Array.isArray(d.blocks) ? d.blocks : []).slice(0, 1500).filter((b) => b && OK.includes(b.t)).map((b) => {
      if (b.t === 'table') {
        const cols = (b.cols || []).slice(0, 12).map((c) => ({ label: str(c.label, 200), align: ['center', 'left', 'right'].includes(c.align) ? c.align : undefined, w: Math.max(1, Math.min(8, Number(c.w) || 1)) }));
        if (!cols.length) return null;
        const rows = (b.rows || []).slice(0, 400).map((r) => ({ total: !!r.total, cells: (r.cells || []).slice(0, cols.length).map((c) => ({ text: str(c && c.text, 1500), sub: c && c.sub ? str(c.sub, 600) : undefined })) }))
          .map((r) => { while (r.cells.length < cols.length) r.cells.push({ text: '' }); return r; });
        return { t: 'table', cols, rows };
      }
      if (b.t === 'bullets') return { t: 'bullets', items: (b.items || []).slice(0, 200).map((x) => str(x, 1500)) };
      if (b.t === 'meta') return { t: 'meta', label: str(b.label, 200), text: str(b.text, 1500), shade: !!b.shade };
      if (b.t === 'signatures') return { t: 'signatures', left: str(b.left, 120), right: str(b.right, 120), leftName: str(b.leftName, 200), rightName: str(b.rightName, 200) };
      if (b.t === 'sign') return { t: 'sign', name: str(b.name, 120) || undefined, title: str(b.title, 120) || undefined };
      return { t: b.t, text: str(b.text), jc: b.jc === 'center' ? 'center' : undefined };
    }).filter(Boolean);
    if (!blocks.length) return bad('لا محتوى للتصدير', 400);
    const name = str(d.title, 150) || 'مستند';
    const bytes = await buildDocx(blocks, { title: name });
    await audit(db, user, 'docx', 'doc', 0);
    return new Response(bytes, { headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'content-disposition': `attachment; filename="document.docx"; filename*=UTF-8''${encodeURIComponent(fname(name))}.docx`, 'cache-control': 'no-store' } });
  }
  if (a === 'doc' && method === 'GET') return docFile(db, user, b, Number(c), h, new URL(request.url).searchParams.get('format'));
  if (user.via === 'token' && user.scope !== 'write') return bad('المفتاح للقراءة فقط', 403);
  const d = method === 'GET' ? {} : await readBody(request);
  // عمليات التوليد الطويلة تُبث كاستجابة متدفقة: نبضات كل 8 ثوانٍ تمنع مهلة Cloudflare (524 بعد 100 ثانية)
  const long = method === 'POST' && ((a === 'quote' && (!b || c === 'revise')) || a === 'contract' || a === 'plan' || a === 'posts');
  if (long) return streamed(() => dispatch(db, env, user, a, b, c, method, d, h));
  return dispatch(db, env, user, a, b, c, method, d, h);
}

// يبث مسافات فارغة (يتجاهلها JSON.parse) حتى يكتمل التوليد، ثم النتيجة مع __status
function streamed(work) {
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter(); const enc = new TextEncoder();
  const beat = setInterval(() => { w.write(enc.encode(' ')).catch(() => {}); }, 8000);
  (async () => {
    let out;
    try {
      const res = await work();
      const body = await res.json().catch(() => ({}));
      out = { ...body, __status: res.status };
    } catch (e) {
      out = { error: e.message || 'تعذّر التوليد', __status: e.status || 500 };
    }
    clearInterval(beat);
    try { await w.write(enc.encode(JSON.stringify(out))); await w.close(); } catch { /* أغلق المتصفح الاتصال */ }
  })();
  return new Response(readable, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
}

async function dispatch(db, env, user, a, b, c, method, d, h) {
  if (a === 'quote' && !b && method === 'POST') return aiQuote(db, env, user, d, h);
  if (a === 'quote' && b && c === 'revise' && method === 'POST') return reviseQuote(db, env, user, Number(b), d, h);
  if (a === 'quote' && b && c === 'approve' && method === 'POST') return approveQuote(db, env, user, Number(b), h);
  if (a === 'quote' && b && !c && method === 'PUT') return editQuote(db, env, user, Number(b), d, h);
  if (a === 'contract' && b && method === 'POST') return aiContract(db, env, user, Number(b), d, h);
  if (a === 'plan' && !b && method === 'POST') return aiPlan(db, env, user, d, h);
  if (a === 'plan' && b && c === 'revise' && method === 'POST') return revisePlan(db, env, user, Number(b), d, h);
  if (a === 'posts' && method === 'POST') return aiPosts(db, env, user, d, h);
  return bad('إجراء غير معروف', 404);
}
