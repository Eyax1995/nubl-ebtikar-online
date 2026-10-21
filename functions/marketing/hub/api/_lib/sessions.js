// جلسات التشخيص (v19): حجز ذاتي للعميل ← تأكيد واتساب + Google Meet ← استبيان النشاط ← تحليل بالذكاء جاهز للنقاش (أسئلة مقترحة وإدارة الجلسة) ← تذكيرات ← نتيجة قابلة للقياس.
// العام (بلا دخول): GET public/book/slots · POST public/book · GET|POST public/book/s/<key>[/survey|/cancel|/reschedule]
// للفريق: GET sessions?from&to · GET sessions/stats · GET|PUT sessions/<id> · POST sessions/<id>/analyze|meet|remind
// الأوقات كلها بتوقيت الرياض «YYYY-MM-DD HH:MM» (بلا توقيت صيفي). العميل لا يرى أسماء الفريق — «مسؤول الحسابات» فقط.
import { json, bad, audit, getSettings, today, nextNumber } from './core.js';
import { notifyUser, notifyRoles, h as hx } from './telegram.js';
import { aiJSON, BRAND } from './ai.js';
import { recordEvent, sign, subjectFromKey } from './track.js';
import { upsertEvent, deleteEvent, busyTimes, googleReady } from './google.js';
import { SECTORS } from './seed.js';

const SITE = 'https://nubl-ebtikar.online';
const ACTIVE = ['محجوزة', 'مؤكدة'];
export const STATUSES = ['محجوزة', 'مؤكدة', 'تمت', 'لم يحضر', 'ملغاة'];
const MODES = { video: 'اتصال مرئي (Google Meet)', phone: 'مكالمة هاتفية' };
const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const nowKSA = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const toMs = (ksa) => Date.parse(ksa.replace(' ', 'T') + ':00+03:00');
const fromMs = (ms) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const addMin = (ksa, m) => fromMs(toMs(ksa) + m * 60e3);
const ksaPlus = (m) => fromMs(Date.now() + m * 60e3); // الآن بتوقيت الرياض + m دقيقة
const hm = (x) => { const [h, m] = String(x).split(':').map(Number); return h * 60 + (m || 0); };
const pad = (n) => String(n).padStart(2, '0');
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);
const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const cleanPhone = (p) => { let d = String(p || '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[^\d]/g, ''); if (d.startsWith('00')) d = d.slice(2); if (/^05\d{8}$/.test(d)) d = '966' + d.slice(1); if (/^5\d{8}$/.test(d)) d = '966' + d; return /^\d{9,15}$/.test(d) ? d : null; };
export const whenAr = (ksa) => { const d = new Date(toMs(ksa)); const k = new Date(d.getTime() + 3 * 3600e3); const h = k.getUTCHours(), m = k.getUTCMinutes();
  return `${DAYS_AR[k.getUTCDay()]} ${k.getUTCDate()} ${MONTHS_AR[k.getUTCMonth()]} — الساعة ${h % 12 || 12}:${pad(m)} ${h < 12 ? 'صباحاً' : h < 15 ? 'ظهراً' : h < 18 ? 'عصراً' : 'مساءً'}`; };

// ---------- الإعدادات ----------
export function cfg(s) {
  return {
    days: String(s.book_days ?? '6,0,1,2,3,4').split(',').map(Number).filter((n) => n >= 0 && n <= 6), // السبت–الخميس
    from: /^\d{2}:\d{2}$/.test(s.book_from) ? s.book_from : '12:00',
    to: /^\d{2}:\d{2}$/.test(s.book_to) ? s.book_to : '21:00',
    len: Number(s.book_len) || 45, gap: Number(s.book_gap ?? 15) || 0,
    notice: Number(s.book_notice_h ?? 12), horizon: Number(s.book_horizon_d) || 14,
    capacity: Math.max(1, Number(s.book_capacity) || 1),
    off: String(s.book_off || '').split(',').map((x) => x.trim()).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)), // أيام إجازة
  };
}

// ---------- الأوقات المتاحة ----------
export async function availableSlots(db, env, { days } = {}) {
  const s = await getSettings(db); const c = cfg(s);
  const start = today(); const n = Math.min(days || c.horizon, 31);
  const minStart = fromMs(Date.now() + c.notice * 3600e3);
  const last = new Date(Date.parse(start) + n * 864e5).toISOString().slice(0, 10);
  const { results: taken } = await db.prepare(`SELECT start_at, end_at FROM diag_sessions WHERE status IN ('محجوزة','مؤكدة') AND start_at >= ? AND start_at <= ?`).bind(start + ' 00:00', last + ' 23:59').all();
  let busy = null; if (googleReady(env, s)) { try { busy = await busyTimes(db, env, start + ' 00:00', last + ' 23:59'); } catch { busy = null; } }
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.parse(start) + i * 864e5); const date = d.toISOString().slice(0, 10);
    if (!c.days.includes(d.getUTCDay()) || c.off.includes(date)) continue;
    const slots = [];
    for (let t = hm(c.from); t + c.len <= hm(c.to); t += c.len + c.gap) {
      const at = `${date} ${pad(Math.floor(t / 60))}:${pad(t % 60)}`; const end = addMin(at, c.len);
      if (at < minStart) continue;
      const a = toMs(at), b = toMs(end);
      const overlap = taken.filter((x) => toMs(x.start_at) < b && toMs(x.end_at) > a).length;
      if (overlap >= c.capacity) continue;
      if (busy && busy.some(([x, y]) => x < b && y > a)) continue; // مشغول في تقويم Google
      slots.push(at.slice(11));
    }
    if (slots.length) out.push({ date, label: `${DAYS_AR[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_AR[d.getUTCMonth()]}`, slots });
  }
  return { days: out, len: c.len, modes: MODES };
}

// ---------- الاستبيان (يتكيف مع القطاع) ----------
const Q = (id, label, type, o = {}) => ({ id, label, type, ...o });
const COMMON = [
  Q('about', 'عرّفنا بنشاطك باختصار، وما الذي يميّزك عن غيرك؟', 'area', { req: 1, ph: 'مثال: محل حلويات منزلية في جدة، نتميز بوصفات تراثية وتوصيل سريع' }),
  Q('age', 'منذ متى يعمل نشاطك؟', 'one', { req: 1, o: ['أقل من سنة', 'من سنة إلى 3 سنوات', 'من 3 إلى 5 سنوات', 'أكثر من 5 سنوات', 'لم ننطلق بعد'] }),
  Q('sell', 'أين يشتري منك عملاؤك؟', 'many', { req: 1, o: ['متجر إلكتروني', 'فرع أو معرض', 'واتساب', 'منصات التواصل', 'تطبيقات التوصيل', 'للشركات (B2B)', 'أخرى'] }),
  Q('links', 'روابط حساباتك أو متجرك أو موقعك', 'area', { ph: 'إنستقرام، تيك توك، المتجر… (اكتب ما يتوفر)' }),
  Q('audience', 'من عميلك المثالي؟ (العمر، الفئة، المدينة، الاهتمامات)', 'area', { req: 1 }),
  Q('top', 'ما أهم منتجاتك أو خدماتك التي تريد التركيز عليها؟', 'area', { req: 1 }),
  Q('ticket', 'متوسط قيمة الطلب أو الصفقة الواحدة', 'one', { o: ['أقل من 100 ريال', '100–500 ريال', '500–2,000 ريال', '2,000–10,000 ريال', 'أكثر من 10,000 ريال'] }),
  Q('channels', 'قنوات التسويق التي تستخدمها حالياً', 'many', { o: ['إنستقرام', 'سناب شات', 'تيك توك', 'X', 'جوجل', 'إعلانات ممولة', 'مؤثرون', 'لا شيء حالياً'] }),
  Q('who', 'من يدير التسويق لديك الآن؟', 'one', { req: 1, o: ['أنا بنفسي', 'موظف لدينا', 'وكالة أو مستقل', 'لا أحد'] }),
  Q('budget', 'الميزانية الشهرية المتاحة للتسويق والإعلانات (تقريباً)', 'one', { req: 1, o: ['أقل من 2,000 ريال', '2,000–5,000 ريال', '5,000–10,000 ريال', '10,000–25,000 ريال', 'أكثر من 25,000 ريال', 'لم أحددها بعد'] }),
  Q('challenge', 'ما أكبر تحدٍّ تسويقي تواجهه الآن؟', 'area', { req: 1 }),
  Q('goals', 'أهدافك خلال 3–6 أشهر القادمة', 'many', { req: 1, o: ['زيادة المبيعات', 'رفع الوعي بالعلامة', 'زيادة المتابعين والتفاعل', 'إطلاق منتج أو خدمة', 'الاستعداد لموسم', 'فتح فرع أو سوق جديد', 'بناء هوية أو متجر'] }),
  Q('competitors', 'من منافسوك الأبرز؟ (اختياري)', 'text'),
  Q('past', 'هل تعاملت مع وكالة أو مسوّق سابقاً؟ وما الذي لم ينجح؟ (اختياري)', 'area'),
  Q('success', 'كيف ستعرف بعد 3 أشهر أن تعاوننا نجح؟', 'area', { req: 1, ph: 'مثال: 50 طلباً إضافياً شهرياً، أو امتلاء الحجوزات في الموسم' }),
];
const SECTOR_Q = {
  food: [Q('delivery', 'نسبة طلباتك عبر تطبيقات التوصيل تقريباً', 'one', { o: ['لا نعمل معها', 'أقل من 25%', '25–50%', 'أكثر من 50%'] })],
  retail: [Q('store', 'منصة متجرك ونطاق المنتجات', 'one', { o: ['سلة', 'زد', 'Shopify', 'موقع خاص', 'لا يوجد متجر بعد'] }), Q('skus', 'عدد المنتجات تقريباً', 'one', { o: ['أقل من 20', '20–100', '100–500', 'أكثر من 500'] })],
  flowers: [Q('seasons', 'أهم المواسم لديك (يوم الأم، التخرج، رمضان…)', 'text')],
  events: [Q('eventtype', 'نوع المناسبات التي تخدمها ونطاقها الجغرافي', 'text')],
  pro: [Q('leads', 'من أين يأتيك العملاء الجدد عادةً؟', 'text')],
  npo: [Q('donors', 'الفئة المستهدفة: متبرعون، مستفيدون، متطوعون، شركاء؟', 'many', { o: ['متبرعون أفراد', 'شركات ومانحون', 'مستفيدون', 'متطوعون'] })],
  corp: [Q('decision', 'من صاحب قرار التعاقد التسويقي لديكم؟', 'text')],
};
export const surveyFor = (sector) => [...COMMON.slice(0, 7), ...(SECTOR_Q[sector] || []), ...COMMON.slice(7)];

// ---------- رابط إدارة الجلسة للعميل (موقّع) ----------
async function sessionKey(db, id) { return `S${id}.${await sign(db, 'S' + id)}`; }
async function sessionFromKey(db, key) {
  const m = /^S(\d{1,9})\.([a-f0-9]{16})$/.exec(String(key || '')); if (!m) return null;
  if ((await sign(db, 'S' + m[1])) !== m[2]) return null;
  return db.prepare('SELECT * FROM diag_sessions WHERE id = ?').bind(+m[1]).first();
}
const manageLink = async (db, id) => `${SITE}/book/s/${await sessionKey(db, id)}`;

// ---------- رسائل العميل (عبر طابور مسار العميل) ----------
async function tellClient(db, env, ses, event, text, extra = {}) {
  return recordEvent(db, env, { lead_id: ses.lead_id, client_id: ses.client_id, event, title: extra.title || text.split('\n')[0].slice(0, 160),
    client_text: text, link: await manageLink(db, ses.id), dedupe: extra.once === false ? `${event}:S${ses.id}:${Date.now()}` : `${event}:S${ses.id}:${ses.start_at}`, user: extra.user, via: extra.via || 'الحجز' });
}
const teamIds = async (db, ses) => {
  const ids = new Set(); if (ses.host_id) ids.add(ses.host_id);
  const l = ses.lead_id ? await db.prepare('SELECT owner_id FROM leads WHERE id = ?').bind(ses.lead_id).first('owner_id') : null; if (l) ids.add(l);
  return ids;
};
async function tellTeam(db, env, ses, text, opts = {}) {
  const ids = await teamIds(db, ses);
  if (opts.all || !ids.size) await notifyRoles(db, env, ['admin', 'manager'], text, { kind: 'reminder', link: `#/session/${ses.id}`, urgent: opts.urgent });
  if (!opts.all) for (const uid of ids) await notifyUser(db, env, uid, text, null, { kind: 'reminder', link: `#/session/${ses.id}`, urgent: opts.urgent });
}

// ---------- تحليل الاستبيان بالذكاء ----------
export async function analyze(db, env, id) {
  const ses = await db.prepare('SELECT * FROM diag_sessions WHERE id = ?').bind(id).first(); if (!ses) return null;
  const ans = parse(ses.survey, {}); const qs = surveyFor(ses.sector);
  const lines = qs.map((q) => { const v = ans[q.id]; return v && (Array.isArray(v) ? v.length : String(v).trim()) ? `- ${q.label}: ${Array.isArray(v) ? v.join('، ') : v}` : null; }).filter(Boolean);
  const sector = SECTORS.find((x) => x.id === ses.sector)?.name || ses.sector || 'غير محدد';
  const { results: pk } = await db.prepare("SELECT name, monthly, price, months FROM catalog WHERE active = 1 AND kind = 'package' AND (sector = ? OR sector IS NULL) ORDER BY months LIMIT 12").bind(ses.sector || '').all();
  const system = `${BRAND}
أنت مستشار تسويق أول تُعدّ ملف تحضير لجلسة تشخيص مجانية مدتها 45 دقيقة مع صاحب نشاط، بناءً على إجاباته في الاستبيان. الهدف: أن يدخل فريقنا الجلسة فاهماً النشاط، بأسئلة ذكية، وإدارة واضحة للوقت، تنتهي بخطوة تالية مقنعة دون ضغط.
لا تختلق أرقاماً أو حقائق لم ترد. إن نقصت معلومة فاذكرها ضمن ما يجب التحقق منه.`;
  const user = `بيانات الحجز: ${ses.name}${ses.company ? ' — ' + ses.company : ''} · القطاع: ${sector} · المدينة: ${ses.city || 'غير مذكورة'} · نوع الجلسة: ${MODES[ses.mode] || ses.mode}
ملاحظة العميل عند الحجز: ${ses.notes_client || '—'}
إجابات الاستبيان:
${lines.join('\n') || '(لم يكمل الاستبيان — حلّل من بيانات الحجز فقط وركّز على أسئلة الاكتشاف)'}
باقات الكتالوج المناسبة للقطاع (للترشيح فقط): ${pk.map((p) => `${p.name} (${p.months ? p.months + ' شهر' : 'مرة'} — ${p.monthly || p.price} ر.س)`).join(' · ') || 'غير متوفرة'}

أعد JSON بهذا الشكل بالضبط:
{"summary":"ملخص تنفيذي في 3–4 جمل","profile":{"activity":"","stage":"","channels":"","audience":"","budget":""},
"readiness":{"score":0,"label":"منخفضة|متوسطة|مرتفعة","reasons":["..."]},
"challenges":["أهم 3–5 تحديات مستنتجة"],"opportunities":["أهم 3–5 فرص سريعة"],"risks":["مخاطر أو إشارات حذر (ميزانية، توقعات، تعدد قرار…)"],
"verify":["معلومات ناقصة نتحقق منها في الجلسة"],"prep":["ما يراجعه الفريق قبل الجلسة (حسابات، متجر، منافسون)"],
"questions":[{"q":"سؤال مفتوح ذكي","why":"لماذا نسأله"}],
"agenda":[{"min":"0–5","title":"الترحيب وكسر الجليد","goal":"..."}],
"recommendation":{"package":"الباقة أو الخدمة المرشحة","why":"السبب","next":"الخطوة التالية المقترحة بعد الجلسة"}}
الأسئلة 8–10 مرتبة من الاكتشاف إلى الأهداف إلى الالتزام. الأجندة تغطي 45 دقيقة كاملة (5–6 بنود).`;
  const r = await aiJSON(env, system, user, { max: 6000, tier: 'deep' });
  const brief = r.data && typeof r.data === 'object' ? r.data : null;
  if (!brief) throw new Error('تعذّر التحليل');
  await db.prepare("UPDATE diag_sessions SET brief = ?, brief_engine = ?, brief_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify(brief), r.engine || null, id).run();
  return brief;
}

// ---------- إنشاء/تحديث حدث Google ----------
async function syncCalendar(db, env, ses) {
  const s = await getSettings(db); if (!googleReady(env, s)) return { ok: false, skipped: true };
  const c = cfg(s);
  const r = await upsertEvent(db, env, ses, { start: ses.start_at, end: ses.end_at || addMin(ses.start_at, c.len), eventId: ses.gcal_id, meet: ses.mode === 'video',
    title: `جلسة تشخيص — ${ses.company || ses.name} (${ses.number})`,
    description: `جلسة تشخيص تسويقي مجانية مع فريق نُبل وابتكار للخدمات التسويقية.\nالعميل: ${ses.name}${ses.company ? ' — ' + ses.company : ''}\nالجوال: ${ses.phone || '—'}\nالنوع: ${MODES[ses.mode]}\nإدارة الحجز والاستبيان: ${await manageLink(db, ses.id)}`,
    attendees: [ses.email] });
  if (r.ok) await db.prepare("UPDATE diag_sessions SET gcal_id = ?, meet_link = COALESCE(?, meet_link), updated_at = datetime('now') WHERE id = ?").bind(r.id, r.link, ses.id).run();
  return r;
}

// ---------- الحجز ----------
async function createBooking(db, env, d, { waitUntil, viaLead } = {}) {
  const s = await getSettings(db); const c = cfg(s);
  const errs = {};
  const name = clip(d.name, 120), phone = cleanPhone(d.phone), email = clip(d.email, 160).toLowerCase();
  if (name.length < 2) errs.name = 'اكتب اسمك';
  if (!phone) errs.phone = 'رقم الجوال غير صحيح — مثال: 05XXXXXXXX';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errs.email = 'البريد الإلكتروني غير صحيح';
  const mode = d.mode === 'phone' ? 'phone' : d.mode === 'video' ? 'video' : null; if (!mode) errs.mode = 'اختر نوع الجلسة';
  const at = `${clip(d.date, 10)} ${clip(d.time, 5)}`;
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(at)) errs.time = 'اختر الموعد';
  if (Object.keys(errs).length) return { error: 'راجع الحقول المحددة', fields: errs, status: 400 };
  // الموعد ما زال متاحاً؟
  const av = await availableSlots(db, env, { days: c.horizon });
  if (!av.days.some((x) => x.date === at.slice(0, 10) && x.slots.includes(at.slice(11)))) return { error: 'هذا الموعد لم يعد متاحاً — اختر موعداً آخر', fields: { time: 'حُجز للتو، اختر غيره' }, status: 409 };
  // العميل المحتمل: من رابط الدعوة أو بالجوال أو جديد
  let lead = viaLead || (await db.prepare('SELECT * FROM leads WHERE phone = ? ORDER BY id DESC LIMIT 1').bind(phone).first());
  const company = clip(d.company, 160); const sector = SECTORS.some((x) => x.id === d.sector) ? d.sector : (lead?.sector || null);
  if (!lead) {
    const r = await db.prepare(`INSERT INTO leads (name, company, phone, email, city, sector, source, status, next_followup, notes) VALUES (?,?,?,?,?,?,'حجز جلسة','جلسة تشخيص',?,?)`)
      .bind(name, company || null, phone, email || null, clip(d.city, 80) || null, sector, at.slice(0, 10), clip(d.notes, 600) || null).run();
    lead = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(r.meta.last_row_id).first();
  } else {
    await db.prepare(`UPDATE leads SET status = CASE WHEN status IN ('محوّل لعميل','غير مهتم') THEN status ELSE 'جلسة تشخيص' END, next_followup = ?,
      email = COALESCE(email, ?), company = COALESCE(company, ?), sector = COALESCE(sector, ?), updated_at = datetime('now') WHERE id = ?`).bind(at.slice(0, 10), email || null, company || null, sector, lead.id).run();
  }
  const number = await nextNumber(db, 'diag_sessions', 'DS', lead.org || 'nubl');
  const ins = await db.prepare(`INSERT INTO diag_sessions (number, lead_id, client_id, start_at, end_at, mode, status, name, company, phone, email, city, sector, notes_client, source, org)
    VALUES (?,?,?,?,?,?,'محجوزة',?,?,?,?,?,?,?,?,?)`).bind(number, lead.id, lead.client_id || null, at, addMin(at, c.len), mode, name, company || lead.company || null, phone, email || null,
    clip(d.city, 80) || null, sector, clip(d.notes, 600) || null, clip(d.source, 40) || 'الحجز الذاتي', lead.org || 'nubl').run();
  // الحجز داخل نافذة 24 ساعة: التأكيد وإشعار الحجز يغنيان عن تذكير «غداً»
  await db.prepare('UPDATE diag_sessions SET rem_team24 = 1, rem_client24 = 1 WHERE id = ? AND start_at <= ?').bind(ins.meta.last_row_id, ksaPlus(24 * 60)).run();
  let ses = await db.prepare('SELECT * FROM diag_sessions WHERE id = ?').bind(ins.meta.last_row_id).first();
  // Google Meet + التقويم (إن رُبط الحساب)
  const g = await syncCalendar(db, env, ses).catch((e) => ({ ok: false, error: e.message }));
  ses = await db.prepare('SELECT * FROM diag_sessions WHERE id = ?').bind(ses.id).first();
  const link = await manageLink(db, ses.id);
  await tellClient(db, env, ses, 'session_booked',
    `تم حجز جلسة التشخيص المجانية مع مسؤول الحسابات لدينا: ${whenAr(ses.start_at)} (${ses.mode === 'video' ? 'اتصال مرئي' : 'مكالمة هاتفية'} — ${c.len} دقيقة).${ses.meet_link ? `\nرابط الاجتماع: ${ses.meet_link}` : ses.mode === 'phone' ? `\nسنتصل بك على هذا الرقم في الموعد.` : '\nسيصلك رابط الاجتماع قبل الموعد.'}\nساعدنا نجهّز لك جلسة مفيدة: أكمل استبيان نشاطك (3 دقائق) من الرابط.`,
    { title: `📅 حُجزت جلسة التشخيص ${ses.number} — ${whenAr(ses.start_at)}` });
  await tellTeam(db, env, ses, `📅 جلسة تشخيص جديدة <b>${hx(ses.number)}</b>\n${hx(ses.name)}${ses.company ? ' — ' + hx(ses.company) : ''}\n🕒 ${hx(whenAr(ses.start_at))} · ${hx(MODES[ses.mode])}${g.ok === false && !g.skipped && ses.mode === 'video' ? '\n⚠️ تعذّر إنشاء رابط Meet: ' + hx(g.error || '') : ''}`, { all: true });
  await audit(db, null, 'create', 'sessions', ses.id, `${ses.number} حجز ذاتي`);
  return { ok: true, session: { number: ses.number, start_at: ses.start_at, when: whenAr(ses.start_at), mode: ses.mode, meet: ses.meet_link || null, len: c.len }, key: link.split('/book/s/')[1], link };
}

// ---------- العام ----------
export async function publicBook(db, env, request, parts, waitUntil) {
  const method = request.method.toUpperCase();
  const sub = parts[2];
  if (sub === 'slots' && method === 'GET') return json(await availableSlots(db, env), 200, { 'cache-control': 'no-store' });
  if (sub === 'prefill' && method === 'GET') { // رابط دعوة من المنصة: /book?k=<مفتاح متابعة العميل>
    const sj = await subjectFromKey(db, new URL(request.url).searchParams.get('k'));
    if (!sj) return json({ ok: false });
    const l = sj.lead || {}; const c = sj.client || {};
    return json({ ok: true, name: l.name || c.contact_name || c.name || '', company: l.company || c.name || '', sector: l.sector || c.sector || '', city: l.city || c.city || '', phone_hint: String(l.phone || c.phone || '').slice(-4) });
  }
  if (!sub && method === 'POST') {
    let d = {}; try { d = await request.json(); } catch { /* */ }
    if (d.website) return json({ ok: true }); // فخ الروبوتات
    if (Number(d.elapsed) > 0 && Number(d.elapsed) < 4000) return bad('أرسلت النموذج بسرعة كبيرة — حاول مرة أخرى');
    let viaLead = null;
    if (d.k) { const sj = await subjectFromKey(db, d.k); if (sj?.lead) viaLead = sj.lead; }
    const r = await createBooking(db, env, d, { waitUntil, viaLead });
    if (r.error) return json({ error: r.error, fields: r.fields }, r.status);
    return json(r, 201);
  }
  if (sub === 's') {
    const ses = await sessionFromKey(db, parts[3]);
    if (!ses) return bad('رابط الحجز غير صالح — تواصل معنا على واتساب', 404);
    const act = parts[4];
    const c = cfg(await getSettings(db));
    const view = async () => ({ number: ses.number, name: ses.name, company: ses.company, start_at: ses.start_at, when: whenAr(ses.start_at), mode: ses.mode, len: c.len,
      status: ses.status, meet: ses.status !== 'ملغاة' ? ses.meet_link : null, survey_done: !!ses.survey_at, questions: surveyFor(ses.sector), answers: parse(ses.survey, {}),
      can_change: ACTIVE.includes(ses.status) && ses.start_at > nowKSA() });
    if (!act && method === 'GET') return json(await view(), 200, { 'cache-control': 'no-store' });
    let d = {}; try { d = await request.json(); } catch { /* */ }
    if (act === 'survey' && method === 'POST') {
      const qs = surveyFor(ses.sector); const ans = {}; const errs = {};
      for (const q of qs) {
        let v = d.answers?.[q.id];
        if (q.type === 'many') v = (Array.isArray(v) ? v : []).map(String).filter((x) => q.o.includes(x));
        else if (q.type === 'one') v = q.o.includes(v) ? v : '';
        else v = clip(v, q.type === 'area' ? 1500 : 300);
        if (q.req && (Array.isArray(v) ? !v.length : !v)) errs[q.id] = 'مطلوب';
        ans[q.id] = v;
      }
      if (Object.keys(errs).length) return json({ error: 'أكمل الأسئلة المطلوبة', fields: errs }, 400);
      const first = !ses.survey_at;
      await db.prepare("UPDATE diag_sessions SET survey = ?, survey_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify(ans), ses.id).run();
      const run = async () => {
        try { await analyze(db, env, ses.id); } catch (e) { console.warn('analyze', e.message); }
        const fresh = await db.prepare('SELECT * FROM diag_sessions WHERE id = ?').bind(ses.id).first();
        await tellTeam(db, env, fresh, `📝 ${first ? 'أكمل' : 'حدّث'} العميل استبيان جلسة التشخيص <b>${hx(ses.number)}</b> — ${hx(ses.company || ses.name)}\n${fresh.brief ? '🤖 التحليل والأسئلة المقترحة وأجندة الجلسة جاهزة' : '⚠️ تعذّر التحليل الآلي — أعد المحاولة من صفحة الجلسة'}\n🕒 ${hx(whenAr(ses.start_at))}`);
      };
      if (waitUntil) waitUntil(run()); else await run();
      return json({ ok: true });
    }
    if (act === 'cancel' && method === 'POST') {
      if (!ACTIVE.includes(ses.status)) return bad('لا يمكن إلغاء هذا الحجز');
      await db.prepare("UPDATE diag_sessions SET status = 'ملغاة', cancel_reason = ?, updated_at = datetime('now') WHERE id = ?").bind(clip(d.reason, 400) || 'ألغاه العميل', ses.id).run();
      await deleteEvent(db, env, ses.gcal_id).catch(() => {});
      await recordEvent(db, env, { lead_id: ses.lead_id, client_id: ses.client_id, event: 'session_cancelled', title: `✖️ ألغى العميل جلسة التشخيص ${ses.number}`, detail: clip(d.reason, 400) || null, via: 'رابط الحجز' });
      await tellTeam(db, env, ses, `✖️ ألغى العميل جلسة التشخيص <b>${hx(ses.number)}</b> — ${hx(ses.company || ses.name)}\n🕒 كانت: ${hx(whenAr(ses.start_at))}${d.reason ? `\n💬 ${hx(clip(d.reason, 300))}` : ''}`, { all: true });
      return json({ ok: true });
    }
    if (act === 'reschedule' && method === 'POST') {
      if (!ACTIVE.includes(ses.status)) return bad('لا يمكن تغيير هذا الحجز');
      const at = `${clip(d.date, 10)} ${clip(d.time, 5)}`;
      const av = await availableSlots(db, env);
      if (!av.days.some((x) => x.date === at.slice(0, 10) && x.slots.includes(at.slice(11)))) return bad('هذا الموعد لم يعد متاحاً — اختر موعداً آخر', 409);
      const old = ses.start_at;
      await db.prepare("UPDATE diag_sessions SET start_at = ?, end_at = ?, status = 'محجوزة', rem_team24 = (? <= ?), rem_team1 = 0, rem_client24 = (? <= ?), rem_client1 = 0, updated_at = datetime('now') WHERE id = ?").bind(at, addMin(at, c.len), at, ksaPlus(24 * 60), at, ksaPlus(24 * 60), ses.id).run();
      const fresh = await db.prepare('SELECT * FROM diag_sessions WHERE id = ?').bind(ses.id).first();
      await syncCalendar(db, env, fresh).catch(() => {});
      const f2 = await db.prepare('SELECT * FROM diag_sessions WHERE id = ?').bind(ses.id).first();
      await tellClient(db, env, f2, 'session_rescheduled', `تم تغيير موعد جلسة التشخيص إلى ${whenAr(at)}.${f2.meet_link ? `\nرابط الاجتماع: ${f2.meet_link}` : ''}`, { title: `🔁 غيّر العميل موعد ${ses.number}`, via: 'رابط الحجز' });
      await tellTeam(db, env, f2, `🔁 غيّر العميل موعد جلسة <b>${hx(ses.number)}</b> — ${hx(ses.company || ses.name)}\nمن ${hx(whenAr(old))}\nإلى ${hx(whenAr(at))}`, { all: true });
      return json({ ok: true, when: whenAr(at) });
    }
  }
  return bad('مسار غير معروف', 404);
}

// ---------- المجدول: تذكيرات الفريق والعميل، وتذكير الاستبيان، وطلب تسجيل النتيجة ----------
export async function sessionsTick(db, env) {
  const now = nowKSA(); const out = { team24: 0, team1: 0, client24: 0, client1: 0, outcome: 0 };
  const { results } = await db.prepare(`SELECT * FROM diag_sessions WHERE status IN ('محجوزة','مؤكدة') AND start_at >= ? AND start_at <= ?`).bind(addMin(now, -180), addMin(now, 26 * 60)).all();
  for (const s of results) {
    const mins = (toMs(s.start_at) - Date.now()) / 60e3;
    if (mins <= 24 * 60 && mins > 60 && !s.rem_team24) {
      await tellTeam(db, env, s, `🗓️ غداً: جلسة تشخيص <b>${hx(s.number)}</b> — ${hx(s.company || s.name)}\n🕒 ${hx(whenAr(s.start_at))} · ${hx(MODES[s.mode])}\nالاستبيان: ${s.survey_at ? '✅ مكتمل والتحليل جاهز' : '⏳ لم يكتمل — أُرسل للعميل تذكير'}`, { all: true });
      await db.prepare('UPDATE diag_sessions SET rem_team24 = 1 WHERE id = ?').bind(s.id).run(); out.team24++;
    }
    if (mins <= 24 * 60 && mins > 60 && !s.rem_client24) {
      await tellClient(db, env, s, 'session_remind24', `تذكير بجلسة التشخيص: ${whenAr(s.start_at)} (${s.mode === 'video' ? 'اتصال مرئي' : 'مكالمة هاتفية'}).${s.survey_at ? '' : '\nلم يكتمل استبيان نشاطك بعد — 3 دقائق تجعل الجلسة أنفع لك.'}\nلتغيير الموعد أو إلغائه استخدم الرابط.`);
      await db.prepare('UPDATE diag_sessions SET rem_client24 = 1 WHERE id = ?').bind(s.id).run(); out.client24++;
    }
    if (mins <= 60 && mins > 0 && !s.rem_team1) {
      await tellTeam(db, env, s, `⏰ بعد ساعة: جلسة <b>${hx(s.number)}</b> — ${hx(s.company || s.name)}\n${s.mode === 'video' ? (s.meet_link ? '🎥 ' + hx(s.meet_link) : '⚠️ لا يوجد رابط اجتماع بعد') : '📞 ' + hx(s.phone || '')}\nافتح ملف التحضير والأسئلة المقترحة من المنصة.`, { urgent: true });
      await db.prepare('UPDATE diag_sessions SET rem_team1 = 1 WHERE id = ?').bind(s.id).run(); out.team1++;
    }
    if (mins <= 60 && mins > 0 && !s.rem_client1) {
      await tellClient(db, env, s, 'session_remind1', `جلستك مع مسؤول الحسابات بعد ساعة تقريباً (${whenAr(s.start_at)}).${s.mode === 'video' && s.meet_link ? `\nرابط الاجتماع: ${s.meet_link}` : s.mode === 'phone' ? '\nسنتصل بك على هذا الرقم.' : ''}`);
      await db.prepare('UPDATE diag_sessions SET rem_client1 = 1 WHERE id = ?').bind(s.id).run(); out.client1++;
    }
    if (mins <= -60 && !s.rem_outcome) { // بعد انتهائها بنصف ساعة تقريباً: سجّل النتيجة
      await tellTeam(db, env, s, `✅ انتهت جلسة <b>${hx(s.number)}</b> — ${hx(s.company || s.name)}\nسجّل النتيجة (تمت / لم يحضر) وملاحظاتك، ثم أرسل التشخيص المكتوب خلال 48 ساعة.`);
      await db.prepare('UPDATE diag_sessions SET rem_outcome = 1 WHERE id = ?').bind(s.id).run(); out.outcome++;
    }
  }
  return out;
}

// ---------- المقاييس ----------
async function stats(db, from, to) {
  const W = 'start_at >= ? AND start_at <= ?'; const a = [from + ' 00:00', to + ' 23:59'];
  const { results: by } = await db.prepare(`SELECT status, COUNT(*) AS n FROM diag_sessions WHERE ${W} GROUP BY status`).bind(...a).all();
  const n = Object.fromEntries(by.map((r) => [r.status, r.n]));
  const total = by.reduce((x, r) => x + r.n, 0);
  const survey = await db.prepare(`SELECT COUNT(*) AS n FROM diag_sessions WHERE ${W} AND survey_at IS NOT NULL`).bind(...a).first('n');
  const video = await db.prepare(`SELECT COUNT(*) AS n FROM diag_sessions WHERE ${W} AND mode = 'video'`).bind(...a).first('n');
  const lead = await db.prepare(`SELECT AVG(julianday(replace(start_at,' ','T')) - julianday(created_at)) AS d FROM diag_sessions WHERE ${W}`).bind(...a).first('d');
  // التحويل: جلسات تمت ← عرض سعر لنفس العميل المحتمل خلال 30 يوماً، ← عرض مقبول
  const quoted = await db.prepare(`SELECT COUNT(DISTINCT s.id) AS n FROM diag_sessions s JOIN quotes q ON q.lead_id = s.lead_id AND q.created_at >= s.start_at AND julianday(q.created_at) - julianday(replace(s.start_at,' ','T')) <= 30
    WHERE ${W.replace(/start_at/g, 's.start_at')} AND s.status = 'تمت'`).bind(...a).first('n');
  const won = await db.prepare(`SELECT COUNT(DISTINCT s.id) AS n FROM diag_sessions s JOIN quotes q ON q.lead_id = s.lead_id AND q.status = 'مقبول' AND q.created_at >= s.start_at
    WHERE ${W.replace(/start_at/g, 's.start_at')} AND s.status = 'تمت'`).bind(...a).first('n');
  const { results: src } = await db.prepare(`SELECT COALESCE(source,'—') AS k, COUNT(*) AS n FROM diag_sessions WHERE ${W} GROUP BY k ORDER BY n DESC`).bind(...a).all();
  const done = n['تمت'] || 0, noshow = n['لم يحضر'] || 0;
  const nowK = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  const upcoming = await db.prepare("SELECT COUNT(*) AS n FROM diag_sessions WHERE start_at >= ? AND status IN ('محجوزة','مؤكدة')").bind(nowK).first('n');
  return { total, by: n, done, noshow, cancelled: n['ملغاة'] || 0, upcoming,
    show_rate: done + noshow ? Math.round(done * 100 / (done + noshow)) : null, survey_rate: total ? Math.round(survey * 100 / total) : null,
    video_rate: total ? Math.round(video * 100 / total) : null, lead_days: lead != null ? Math.round(lead * 10) / 10 : null,
    quoted, won, quote_rate: done ? Math.round(quoted * 100 / done) : null, win_rate: done ? Math.round(won * 100 / done) : null, sources: src };
}

// ---------- للفريق ----------
export async function sessionsRoute(db, env, request, user, id, act, need) {
  need(user, 'leads', 'r');
  const method = request.method.toUpperCase(); const url = new URL(request.url);
  if (!id && method === 'GET') {
    const lid = Number(url.searchParams.get('lead_id')) || 0;
    const from = url.searchParams.get('from') || today(); const to = url.searchParams.get('to') || new Date(Date.parse(from) + 31 * 864e5).toISOString().slice(0, 10);
    const { results } = await db.prepare(`SELECT s.id, s.number, s.lead_id, s.start_at, s.end_at, s.mode, s.status, s.name, s.company, s.phone, s.sector, s.host_id, s.meet_link,
      (s.survey_at IS NOT NULL) AS survey_done, (s.brief IS NOT NULL) AS brief_done, u.name AS host_name FROM diag_sessions s LEFT JOIN users u ON u.id = s.host_id
      WHERE ${lid ? 's.lead_id = ?' : 's.start_at >= ? AND s.start_at <= ?'} ORDER BY s.start_at${lid ? ' DESC' : ''}`).bind(...(lid ? [lid] : [from + ' 00:00', to + ' 23:59'])).all();
    const s = await getSettings(db);
    return json({ rows: results, cfg: cfg(s), google: googleReady(env, s), book_link: `${SITE}/book` });
  }
  if (id === 'stats' && method === 'GET') {
    const to = url.searchParams.get('to') || today(); const from = url.searchParams.get('from') || new Date(Date.parse(to) - 90 * 864e5).toISOString().slice(0, 10);
    return json({ from, to, ...(await stats(db, from, to)) });
  }
  if (id === 'invite' && method === 'POST') { // إرسال رابط الحجز لعميل محتمل
    need(user, 'leads', 'w');
    let d = {}; try { d = await request.json(); } catch { /* */ }
    const lid = Number(d.lead_id) || 0; if (!lid) return bad('اختر العميل المحتمل');
    const key = `L${lid}.${await sign(db, 'L' + lid)}`; const link = `${SITE}/book?k=${key}`;
    const r = await recordEvent(db, env, { lead_id: lid, event: 'session_invite', dedupe: `invite:${Date.now()}`, title: '📨 أُرسل رابط حجز جلسة التشخيص', link, user, via: 'المنصة',
      client_text: clip(d.note, 500) || 'يسعدنا تحديد موعد جلسة التشخيص المجانية (45 دقيقة) مع مسؤول الحسابات لدينا. اختر الوقت المناسب لك ونوع الجلسة (اتصال مرئي أو مكالمة) من الرابط.' });
    return json({ ok: true, link, ...r });
  }
  const sid = Number(id) || 0; if (!sid) return bad('مسار غير معروف', 404);
  const ses = await db.prepare('SELECT * FROM diag_sessions WHERE id = ?').bind(sid).first();
  if (!ses) return bad('الجلسة غير موجودة', 404);
  if (!act && method === 'GET') {
    const lead = ses.lead_id ? await db.prepare('SELECT id, name, company, status, owner_id, source FROM leads WHERE id = ?').bind(ses.lead_id).first() : null;
    const { results: quotes } = ses.lead_id ? await db.prepare('SELECT id, number, title, status, total FROM quotes WHERE lead_id = ? ORDER BY id DESC LIMIT 5').bind(ses.lead_id).all() : { results: [] };
    return json({ row: { ...ses, survey: parse(ses.survey, null), brief: parse(ses.brief, null) }, questions: surveyFor(ses.sector), lead, quotes, manage: await manageLink(db, ses.id), modes: MODES, statuses: STATUSES });
  }
  need(user, 'leads', 'w');
  let d = {}; try { d = await request.json(); } catch { /* */ }
  if (!act && method === 'PUT') {
    const sets = []; const args = [];
    if (d.status !== undefined) { if (!STATUSES.includes(d.status)) return bad('حالة غير صالحة'); sets.push('status = ?'); args.push(d.status); }
    if (d.host_id !== undefined) { sets.push('host_id = ?'); args.push(Number(d.host_id) || null); }
    for (const k of ['notes', 'outcome']) if (d[k] !== undefined) { sets.push(`${k} = ?`); args.push(clip(d[k], 4000) || null); }
    if (d.meet_link !== undefined) { const v = clip(d.meet_link, 300); if (v && !/^https:\/\//.test(v)) return bad('رابط الاجتماع يبدأ بـ https://'); sets.push('meet_link = ?'); args.push(v || null); }
    if (!sets.length) return bad('لا تغييرات');
    await db.prepare(`UPDATE diag_sessions SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...args, sid).run();
    if (d.status && d.status !== ses.status) {
      const title = { 'مؤكدة': `✔️ تأكدت جلسة التشخيص ${ses.number}`, 'تمت': `✅ تمت جلسة التشخيص ${ses.number}`, 'لم يحضر': `🚫 لم يحضر العميل جلسة ${ses.number}`, 'ملغاة': `✖️ أُلغيت جلسة ${ses.number}` }[d.status] || `جلسة ${ses.number}: ${d.status}`;
      const ct = { 'ملغاة': 'أُلغيت جلسة التشخيص المحجوزة. يسعدنا تحديد موعد جديد متى ما ناسبك من الرابط.', 'لم يحضر': 'افتقدناك في جلسة التشخيص اليوم — يمكنك اختيار موعد جديد يناسبك من الرابط.' }[d.status];
      if (d.status === 'ملغاة') await deleteEvent(db, env, ses.gcal_id).catch(() => {});
      if (d.status === 'تمت' && ses.lead_id) await db.prepare("UPDATE leads SET status = CASE WHEN status IN ('جديد','قيد التواصل','جلسة تشخيص') THEN 'مهتم' ELSE status END, updated_at = datetime('now') WHERE id = ?").bind(ses.lead_id).run();
      if (ct) await recordEvent(db, env, { lead_id: ses.lead_id, client_id: ses.client_id, event: 'session_' + (d.status === 'ملغاة' ? 'cancelled' : 'noshow'), title, client_text: ct, link: `${SITE}/book`, dedupe: `st:S${sid}:${d.status}`, user });
      else await recordEvent(db, env, { lead_id: ses.lead_id, client_id: ses.client_id, event: 'session_status', title, user });
    }
    await audit(db, user, 'update', 'sessions', sid, Object.keys(d).join(','));
    return json({ ok: true });
  }
  if (act === 'analyze' && method === 'POST') return json({ ok: true, brief: await analyze(db, env, sid) });
  if (act === 'meet' && method === 'POST') {
    const r = await syncCalendar(db, env, ses);
    if (!r.ok) return bad(r.skipped ? 'اربط حساب Google من الإعدادات أولاً' : 'تعذّر إنشاء الاجتماع: ' + (r.error || ''), 400);
    const fresh = await db.prepare('SELECT meet_link FROM diag_sessions WHERE id = ?').bind(sid).first();
    if (fresh.meet_link && fresh.meet_link !== ses.meet_link) await tellClient(db, env, { ...ses, meet_link: fresh.meet_link }, 'session_meet', `رابط اجتماع جلسة التشخيص (${whenAr(ses.start_at)}): ${fresh.meet_link}`, { user, once: false });
    return json({ ok: true, meet: fresh.meet_link });
  }
  if (act === 'remind' && method === 'POST') {
    const r = await tellClient(db, env, ses, 'session_nudge', d.kind === 'survey' && !ses.survey_at
      ? `لتكون جلسة التشخيص (${whenAr(ses.start_at)}) مفيدة لك أكثر، أكمل استبيان نشاطك القصير من الرابط — 3 دقائق فقط.`
      : `تذكير بجلسة التشخيص: ${whenAr(ses.start_at)}.${ses.meet_link ? `\nرابط الاجتماع: ${ses.meet_link}` : ''}`, { user, title: '📨 أُرسل تذكير للعميل', once: false });
    return json({ ok: true, ...r });
  }
  return bad('مسار غير معروف', 404);
}
