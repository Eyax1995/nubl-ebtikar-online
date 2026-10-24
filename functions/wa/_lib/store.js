// أتمتة واتساب لمتجر «مروج الحجاز» على سلة (24 أكتوبر 2026) — منقولة من Worker «morooj-whatsapp» (v9) إلى المنصة.
// سلة ترسل أحداث الطلبات إلى /wa/salla/<المفتاح> ← قالب معتمد من رقم مروج (خط morooj في lines.js).
// كل رسالة آلية تظهر أيضاً في محادثة العميل بصندوق واتساب («أتمتة المتجر»)، والطلبات وعملاء المتجر تُحفظ في المنصة (store_orders/store_customers).
// المتابعات بعد 48 ساعة (تأخير التنفيذ، متابعة طلب عرض السعر) تُجدول في store_due ويرسلها /wa/health (storeTick).
import { LINES } from './lines.js';
import { renderByName } from './templates.js';

const L = LINES.morooj;
const GRAPH = 'https://graph.facebook.com/v23.0';
const HOUR = 3600 * 1000;
export const SALLA_KEY_DEFAULT = '87fdb45419e89a01'; // نفس مفتاح المسار في الـ Worker القديم: يكفي تغيير النطاق في إعداد سلة
const SCHEDULE = { in_progress: { type: 'delay', after: 48 * HOUR }, request_quote: { type: 'followup', after: 48 * HOUR } };
// أسماء القوالب كما تظهر للموظف في المحادثة
export const TEMPLATE_AR = {
  morooj_order_received: 'تأكيد استلام الطلب', morooj_payment_pending: 'الطلب بانتظار الدفع', morooj_order_in_progress: 'الطلب قيد التنفيذ',
  morooj_order_completed: 'تم تنفيذ الطلب', morooj_order_done: 'تم التنفيذ مع رابط التقييم', morooj_order_canceled: 'إلغاء الطلب', morooj_refund_update: 'تحديث الاسترجاع',
  morooj_quote_received: 'استلام طلب عرض السعر', morooj_abandoned_cart: 'تذكير السلة المتروكة', morooj_order_ramadan: 'طلب رمضاني', morooj_review_link: 'طلب التقييم',
  morooj_delay_notice: 'إشعار تأخير التنفيذ', morooj_followup: 'متابعة طلب عرض السعر',
};

let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS store_orders (ref TEXT PRIMARY KEY, salla_id TEXT, customer TEXT, phone TEXT, items TEXT, total REAL, status TEXT, slug TEXT,
      customer_id TEXT, source TEXT, payment TEXT, city TEXT, url TEXT, order_date TEXT, org TEXT DEFAULT 'morooj', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS store_customers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, city TEXT, url TEXT, org TEXT DEFAULT 'morooj', updated_at TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS store_wa (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT DEFAULT (datetime('now')), ref TEXT, phone TEXT, name TEXT, template TEXT, ok INTEGER, wamid TEXT, error TEXT)`),
    db.prepare('CREATE INDEX IF NOT EXISTS ix_store_wa_ref ON store_wa(ref, template)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS store_due (k TEXT PRIMARY KEY, due_at INTEGER NOT NULL, type TEXT, ref TEXT, slug TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS store_flags (k TEXT PRIMARY KEY, at INTEGER NOT NULL)`),
  ]);
  ready = true;
}

function normalizePhone(code, mobile) {
  let m = (String(code || '') + String(mobile || '')).replace(/\D/g, '');
  if (m.startsWith('00')) m = m.slice(2);
  if (m.startsWith('05')) m = '966' + m.slice(1);
  if (m.startsWith('5') && m.length === 9) m = '966' + m;
  return m;
}
function slugFromName(n) {
  if (!n) return '';
  if (n.includes('قيد التنفيذ')) return 'in_progress';
  if (n.includes('تم التنفيذ')) return 'completed';
  if (n.includes('تم التوصيل')) return 'delivered';
  if (n.includes('ملغي') || n.includes('إلغاء')) return 'canceled';
  if (n.includes('جاري الاسترجاع')) return 'restoring';
  if (n.includes('مسترجع')) return 'restored';
  if (n.includes('عرض سعر')) return 'request_quote';
  if (n.includes('بانتظار الدفع') || n.includes('بإنتظار الدفع')) return 'payment_pending';
  if (n.includes('المراجعة')) return 'under_review';
  return '';
}

// حدث سلة → خطة الرسالة (منقول كما هو من الـ Worker)
export function mapSallaEvent(body) {
  const event = String(body.event || '');
  const d0 = body.data || {};
  const d = (d0.order && typeof d0.order === 'object')
    ? { ...d0.order, customer: d0.order.customer || d0.customer, items: d0.order.items || d0.items, status: (d0.status && typeof d0.status === 'object') ? d0.status : (d0.order.status || d0.status) }
    : d0;
  const stRaw = d.status ?? d0.status ?? {};
  const st = (typeof stRaw === 'object') ? stRaw : { name: String(stRaw) };
  const statusName = String(st.name || st.customized?.name || d0.status_name || '');
  const slug = String(st.slug || st.customized?.slug || d0.slug || slugFromName(statusName));
  const c = d.customer || {};
  const name = String(c.first_name || c.name || 'عميلنا').trim();
  const ref = String(d.reference_id || d.order_id || d.id || '');
  const items = (d.items || []).map((i) => `${i.name} × ${i.quantity}`).join('، ') || 'طلبك';
  const total = d.amounts?.total?.amount ?? d.total?.amount ?? '';
  const phone = normalizePhone(c.mobile_code, c.mobile);
  let template = null, params = [], review = false;
  if (event === 'order.created' || event === 'invoice.created') {
    if (slug === 'payment_pending') { template = 'morooj_payment_pending'; params = [name, ref, String(total)]; }
    else { template = 'morooj_order_received'; params = [name, ref, items]; }
  } else if (event === 'order.status.updated') {
    if (statusName.includes('رمضان')) { template = 'morooj_order_ramadan'; params = [name, ref, items]; }
    else if (slug === 'in_progress' && !statusName.includes('التوثيق')) { template = 'morooj_order_in_progress'; params = [name, ref]; }
    else if (slug === 'completed' || slug === 'delivered' || statusName.includes('التوثيق')) { template = 'morooj_order_completed'; params = [name, ref, items]; review = true; }
    else if (slug === 'canceled') { template = 'morooj_order_canceled'; params = [name, ref]; }
    else if (slug === 'restoring' || slug === 'restored') { template = 'morooj_refund_update'; params = [name, ref, statusName || 'جاري الاسترجاع']; }
    else if (slug === 'request_quote') { template = 'morooj_quote_received'; params = [name, ref]; }
  } else if (event.startsWith('abandoned')) {
    template = 'morooj_abandoned_cart'; params = [name, items];
  }
  return {
    event, slug: statusName.includes('رمضان') ? 'ramadan' : slug, statusName, total, sallaId: String(d.id || ''), customerId: String(c.id || ''),
    customerFull: String(c.full_name || c.name || '').trim(), customerUrl: String(c.urls?.admin || ''), source: String(d.source || ''), payment: String(d.payment_method || ''),
    city: String(c.city || ''), adminUrl: String(d.urls?.admin || ''), orderDate: d.date?.date ? String(d.date.date).slice(0, 19) : '',
    ref, name, items, phone, template, params, review, ready: !!(template && phone),
  };
}

async function sendTemplate(env, phone, template, params) {
  const token = L.token(env);
  if (!token) return { ok: false, error: 'MOROOJ_WA_TOKEN غير مضبوط' };
  const r = await fetch(`${GRAPH}/${L.phoneId(env)}/messages`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'template', template: { name: template, language: { code: 'ar' },
      components: params.length ? [{ type: 'body', parameters: params.map((t) => ({ type: 'text', text: String(t).slice(0, 1000) })) }] : [] } }),
  });
  const out = await r.json().catch(() => ({}));
  return { ok: r.ok && !out.error, id: out.messages?.[0]?.id || '', error: out.error?.message || (r.ok ? '' : `HTTP ${r.status}`) };
}

// سجل الإرسال + ظهور الرسالة في محادثة العميل بصندوق واتساب (خط مروج) دون إيقاف الرد الآلي
async function logSend(env, plan, template, params, r) {
  try {
    await env.DB.prepare('INSERT INTO store_wa (ref, phone, name, template, ok, wamid, error) VALUES (?,?,?,?,?,?,?)')
      .bind(plan.ref || '', plan.phone || '', plan.name || '', template, r.ok ? 1 : 0, r.id || '', r.error || '').run();
  } catch (e) { console.warn('store_wa', e.message); }
  if (!env.WA_DB || !plan.phone) return;
  // سطر للفريق (نوع الرسالة ورقم الطلب) ثم نص القالب كما وصل للعميل
  const full = await renderByName(env, L, template, params, 'ar').catch(() => null);
  const label = `🛒 ${TEMPLATE_AR[template] || template}${plan.ref ? ` — طلب ${plan.ref}` : ''}\n${(full && full.text) || params.filter(Boolean).join(' · ')}`.slice(0, 3000);
  try {
    await env.WA_DB.prepare('INSERT INTO wa_events (dept, wa_id, kind, msg_id, text, reply, status, detail) VALUES (?,?,?,?,?,?,?,?)')
      .bind('morooj', plan.phone, 'staff', r.id || null, null, label, r.ok ? 'sent' : 'send_failed', JSON.stringify({ by: 'أتمتة المتجر', template, error: r.ok ? null : r.error }).slice(0, 1500)).run();
    const key = 'morooj:' + plan.phone;
    const row = await env.WA_DB.prepare('SELECT history, customer_name, handoff_until FROM wa_sessions WHERE session_key = ?').bind(key).first();
    let h = []; try { h = JSON.parse((row && row.history) || '[]'); } catch { /* */ }
    h.push({ r: 'bot', t: label, at: new Date().toISOString() });
    await env.WA_DB.prepare(`INSERT INTO wa_sessions (session_key, dept, wa_id, customer_name, handoff_until, history, updated_at) VALUES (?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(session_key) DO UPDATE SET history=excluded.history, updated_at=datetime('now')`)
      .bind(key, 'morooj', plan.phone, (row && row.customer_name) || plan.customerFull || plan.name || '', (row && row.handoff_until) || '', JSON.stringify(h.slice(-20))).run();
  } catch (e) { console.warn('store inbox', e.message); }
}

const flag = async (db, k) => !!(await db.prepare('SELECT 1 FROM store_flags WHERE k = ?').bind(k).first());
const setFlag = (db, k) => db.prepare('INSERT OR REPLACE INTO store_flags (k, at) VALUES (?, ?)').bind(k, Date.now()).run();

async function saveOrder(db, plan) {
  if (!plan.ref || !(plan.event.startsWith('order') || plan.event.startsWith('invoice'))) return;
  const total = plan.total === '' || plan.total == null ? null : Number(plan.total);
  await db.prepare(`INSERT INTO store_orders (ref, salla_id, customer, phone, items, total, status, slug, customer_id, source, payment, city, url, order_date, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(ref) DO UPDATE SET
      customer_id=COALESCE(NULLIF(excluded.customer_id,''),store_orders.customer_id), source=COALESCE(NULLIF(excluded.source,''),store_orders.source),
      payment=COALESCE(NULLIF(excluded.payment,''),store_orders.payment), city=COALESCE(NULLIF(excluded.city,''),store_orders.city), url=COALESCE(NULLIF(excluded.url,''),store_orders.url),
      order_date=COALESCE(NULLIF(excluded.order_date,''),store_orders.order_date), customer=excluded.customer, phone=excluded.phone,
      items=CASE WHEN excluded.items='طلبك' THEN store_orders.items ELSE excluded.items END, total=COALESCE(excluded.total, store_orders.total),
      status=COALESCE(NULLIF(excluded.status,''), store_orders.status), slug=COALESCE(NULLIF(excluded.slug,''), store_orders.slug), updated_at=datetime('now')`)
    .bind(plan.ref, plan.sallaId, plan.customerFull || plan.name, plan.phone, plan.items, total, plan.statusName, plan.slug, plan.customerId, plan.source, plan.payment, plan.city, plan.adminUrl, plan.orderDate).run();
  if (plan.customerId) await db.prepare(`INSERT INTO store_customers (id, name, phone, city, url, updated_at) VALUES (?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET name=COALESCE(NULLIF(excluded.name,''),store_customers.name), phone=COALESCE(NULLIF(excluded.phone,''),store_customers.phone),
      city=COALESCE(NULLIF(excluded.city,''),store_customers.city), url=COALESCE(NULLIF(excluded.url,''),store_customers.url), updated_at=datetime('now')`)
    .bind(plan.customerId, plan.customerFull || plan.name, plan.phone, plan.city, plan.customerUrl).run();
  // جدولة المتابعة بعد 48 ساعة لهذه الحالة (تُلغى تلقائياً إن تغيرت الحالة قبل موعدها)
  const s = SCHEDULE[plan.slug];
  if (s && plan.phone && !(await flag(db, `sent:${s.type}:${plan.ref}`))) {
    await db.prepare('INSERT OR IGNORE INTO store_due (k, due_at, type, ref, slug) VALUES (?,?,?,?,?)').bind(`${s.type}:${plan.ref}`, Date.now() + s.after, s.type, plan.ref, plan.slug).run();
  }
}

// معالجة حدث سلة كاملاً — يُستدعى في الخلفية (waitUntil)
export async function handleSalla(env, body) {
  const db = env.DB; await ensure(db);
  const plan = mapSallaEvent(body);
  console.log('salla', JSON.stringify({ event: plan.event, slug: plan.slug, template: plan.template, ready: plan.ready }));
  try { await saveOrder(db, plan); } catch (e) { console.warn('store order', e.message); }
  if (!plan.ready) return { skipped: true, plan };
  const off = await db.prepare("SELECT value FROM settings WHERE key = 'store_wa_on'").first('value').catch(() => null);
  if (off === '0') return { skipped: true, reason: 'off' };
  // سلة قد تعيد إرسال الحدث نفسه: لا يتكرر القالب لنفس الطلب خلال 10 دقائق
  const dk = `dedupe:${plan.ref}:${plan.template}`;
  const last = await db.prepare('SELECT at FROM store_flags WHERE k = ?').bind(dk).first('at');
  if (plan.ref && last && Date.now() - last < 10 * 60 * 1000) return { duplicate: true };
  if (plan.ref) await setFlag(db, dk);
  // التنفيذ: رسالة واحدة تجمع التنفيذ ورابط التقييم إن نجحت، وإلا القالبان بالتتابع — والتقييم مرة واحدة لكل طلب
  if (plan.review && !(await flag(db, `reviewed:${plan.ref}`))) {
    const r0 = await sendTemplate(env, plan.phone, 'morooj_order_done', plan.params);
    await logSend(env, plan, 'morooj_order_done', plan.params, r0);
    if (r0.ok) { await setFlag(db, `reviewed:${plan.ref}`); return { ok: true, template: 'morooj_order_done' }; }
  }
  const r = await sendTemplate(env, plan.phone, plan.template, plan.params);
  await logSend(env, plan, plan.template, plan.params, r);
  if (r.ok && plan.review && !(await flag(db, `reviewed:${plan.ref}`))) {
    await new Promise((res) => setTimeout(res, 3000));
    const rp = [plan.name, plan.ref];
    const rr = await sendTemplate(env, plan.phone, 'morooj_review_link', rp);
    await logSend(env, plan, 'morooj_review_link', rp, rr);
    if (rr.ok) await setFlag(db, `reviewed:${plan.ref}`);
  }
  return { ok: r.ok, template: plan.template };
}

function arabicDate(ms) {
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Riyadh' }).format(new Date(ms));
}

// المتابعات المستحقة — من /wa/health كل 10 دقائق
export async function storeTick(env) {
  if (!env.DB || !L.token(env)) return { skipped: true };
  const db = env.DB; await ensure(db);
  const now = Date.now();
  const due = (await db.prepare('SELECT * FROM store_due WHERE due_at <= ? ORDER BY due_at LIMIT 20').bind(now).all()).results || [];
  let sent = 0;
  for (const d of due) {
    await db.prepare('DELETE FROM store_due WHERE k = ?').bind(d.k).run();
    const o = await db.prepare('SELECT * FROM store_orders WHERE ref = ?').bind(d.ref).first();
    if (!o || !o.phone || (await flag(db, `sent:${d.type}:${d.ref}`))) continue;
    if (o.slug !== d.slug) continue; // تغيرت حالة الطلب قبل الموعد
    const name = String(o.customer || 'عميلنا').split(/\s+/)[0];
    const plan = { ref: d.ref, phone: o.phone, name };
    let template, params;
    if (d.type === 'delay') { template = 'morooj_delay_notice'; params = [name, d.ref, arabicDate(now + 48 * HOUR)]; }
    else if (d.type === 'followup') { template = 'morooj_followup'; params = [name, `طلب عرض السعر رقم ${d.ref}`]; }
    else continue;
    const r = await sendTemplate(env, o.phone, template, params);
    await logSend(env, plan, template, params, r);
    if (r.ok) { await setFlag(db, `sent:${d.type}:${d.ref}`); sent++; }
  }
  return { due: due.length, sent };
}
