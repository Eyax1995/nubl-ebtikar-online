// طلبات عروض الأسعار بين القطاعات — طرف منصة التسويق (مرآة SYS/xq.php في منصة الدعاية والإعلان nubl-ebtikar.com)
//
// البروتوكول متماثل: POST بجسم JSON إلى جسر الطرف الآخر
//   x-nubl-ts  = وقت يونكس بالثواني (نافذة ±300 ثانية)
//   x-nubl-sig = hex(HMAC-SHA256(السر المشترك, ts + "." + الجسم الخام))
//   {op, from, data}  op = ping | request.create | request.event | file.get
// - كل طرف يحفظ نسخته: direction=out لما أرسله وin للوارد، ويربطهما uid مشترك (peer_id = رقم السجل عند الآخر)
// - الملفات لا تُنسخ: يجلبها الطرف الآخر عند الفتح بـ file.get الموقّع
// - كل رسالة صادرة تمر بصندوق صادر xq_outbox ويُعاد إرسالها تلقائياً — والطرفان يتجاهلان المكرر (uid / event_uid)
import { json, HttpError, getSettings, randomToken, audit } from './core.js';
import { approvalsFeed, approvalDoc, approvalFile } from './tamim.js';
import { notifyUser, notifyRoles, h, HUB_URL } from './telegram.js';

export const XQ_SELF = 'mkt';
export const XQ_PEER = 'ads';
export const XQ_SECTORS = { ads: 'قطاع الدعاية والإعلان', mkt: 'قطاع التسويق' };
const PEER_URL_DEFAULT = 'https://nubl-ebtikar.com/AJAX/xq_bridge.php';
const PEER_UI = 'https://nubl-ebtikar.com/BACKOFFICE/xq.php?id=';
export const XQ_STATUS = {
  pending: ['بانتظار الوصول', 'x'], received: ['وصل — بانتظار التأكيد', 'b'], confirmed: ['مؤكَّد — قيد التسعير', 't'],
  quoted: ['صدر عرض السعر', 'o'], accepted: ['العرض مقبول', 'g'], declined: ['العرض مرفوض', 'r'], rejected: ['اعتذر القطاع', 'r'], cancelled: ['أُلغي الطلب', 'x'],
};
// مالك الحدث: in = القطاع المستقبِل، out = صاحب الطلب، * = الطرفان — والحالات المسموح منها
const EVENTS = {
  confirmed: ['in', ['received']],
  rejected: ['in', ['received', 'confirmed']],
  quoted: ['in', ['received', 'confirmed', 'quoted', 'declined']],
  cancelled: ['out', ['pending', 'received', 'confirmed', 'quoted']],
  accepted: ['out', ['quoted']],
  declined: ['out', ['quoted']],
  comment: ['*', null],
};
export const XQ_EVENT_LABEL = {
  created: 'أنشأ الطلب', delivered: 'وصل الطلب إلى القطاع الآخر', confirmed: 'أكّد الاستلام وبدأ التسعير', rejected: 'اعتذر عن الطلب',
  quoted: 'أرسل عرض السعر', cancelled: 'ألغى الطلب', accepted: 'قبل عرض السعر', declined: 'رفض عرض السعر', comment: 'علّق',
  quote_created: 'أنشأ عرض السعر في «عروض الأسعار»', // داخلي لا يُرسل
};

const enc = new TextEncoder();
const xuid = () => randomToken(16);
const UID_RE = /^[a-f0-9]{32}$/;
const str = (v, max) => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };
const num = (v) => (v === null || v === undefined || v === '' || !isFinite(+v) ? null : Math.round(+v * 100) / 100);
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const xqReady = (s) => !!(s.xq_secret && s.xq_secret.length >= 32);

/** استدعاء جسر الطرف الآخر — لا يرمي أبداً */
export async function xqCall(db, op, data, binary = false) {
  const s = await getSettings(db);
  if (!xqReady(s)) return { ok: false, error: 'الربط غير مُعدّ (السر المشترك)' };
  const body = JSON.stringify({ op, from: XQ_SELF, data });
  const ts = String(Math.floor(Date.now() / 1000));
  try {
    const r = await fetch(s.xq_peer_url || PEER_URL_DEFAULT, {
      method: 'POST', body, signal: AbortSignal.timeout(binary ? 60000 : 15000),
      headers: { 'content-type': 'application/json', 'x-nubl-ts': ts, 'x-nubl-sig': await hmacHex(s.xq_secret, `${ts}.${body}`), 'user-agent': 'nubl-mkt-xq/1' },
    });
    if (binary && r.status === 200 && !String(r.headers.get('content-type') || '').includes('application/json')) return { ok: true, res: r };
    let d = {}; try { d = await r.json(); } catch { /* */ }
    const ok = r.ok && !!d.ok;
    return { ok, status: r.status, data: d, error: ok ? null : (d.error || `رد غير متوقع (${r.status})`) };
  } catch (e) { return { ok: false, error: 'تعذّر الاتصال: ' + (e.message || e) }; }
}

// ---------------------------------------------------------------- صندوق الصادر
async function enqueue(db, op, data, requestId) {
  await db.prepare('INSERT INTO xq_outbox (op, payload, request_id) VALUES (?,?,?)').bind(op, JSON.stringify(data), requestId).run();
}
/** يرسل المعلّق بالترتيب ويتوقف عند أول فشل (لا يسبق حدثٌ إنشاءَ طلبه) */
export async function xqFlush(db, max = 10) {
  const s = await getSettings(db);
  if (!xqReady(s)) return 0;
  const { results } = await db.prepare('SELECT * FROM xq_outbox WHERE sent_at IS NULL ORDER BY id LIMIT ?').bind(max).all();
  let sent = 0;
  for (const m of results) {
    const r = await xqCall(db, m.op, JSON.parse(m.payload));
    if (!r.ok) { await db.prepare('UPDATE xq_outbox SET tries = tries + 1, last_error = ? WHERE id = ?').bind(String(r.error || '').slice(0, 250), m.id).run(); break; }
    await db.prepare("UPDATE xq_outbox SET sent_at = datetime('now'), tries = tries + 1, last_error = NULL WHERE id = ?").bind(m.id).run();
    sent++;
    if (m.op === 'request.create' && m.request_id) {
      await db.prepare("UPDATE xq_requests SET peer_id = ?, status = CASE WHEN status = 'pending' THEN 'received' ELSE status END, updated_at = datetime('now') WHERE id = ?")
        .bind(String(r.data.id || '') || null, m.request_id).run();
      await log(db, m.request_id, 'delivered', XQ_SECTORS[XQ_PEER], 'peer');
    }
  }
  return sent;
}
async function outboxState(db, requestId) {
  const r = await db.prepare('SELECT COUNT(*) AS n, MAX(last_error) AS err, MAX(tries) AS tries FROM xq_outbox WHERE request_id = ? AND sent_at IS NULL').bind(requestId).first();
  return r && r.n ? { pending: r.n, error: r.err, tries: r.tries } : null;
}
async function log(db, requestId, event, by, side = 'local', note = null, eventUid = null) {
  await db.prepare('INSERT OR IGNORE INTO xq_events (request_id, event_uid, event, by_name, side, note) VALUES (?,?,?,?,?,?)')
    .bind(requestId, eventUid || xuid(), event, by || null, side, note).run();
}

// ---------------------------------------------------------------- القراءة والصلاحيات
async function handlerRoles(db) { const s = await getSettings(db); return String(s.xq_handler_roles || 'admin,manager').split(',').map((x) => x.trim()).filter(Boolean); }
const isBoss = (u) => u.role === 'admin' || u.role === 'manager';

export async function xqGet(db, id) {
  const r = await db.prepare('SELECT * FROM xq_requests WHERE id = ?').bind(id).first();
  if (!r) return null;
  r.items = (await db.prepare('SELECT * FROM xq_items WHERE request_id = ? ORDER BY sort, id').bind(id).all()).results;
  r.files = (await db.prepare('SELECT id, item_uid, side, origin, name, mime, size, created_at FROM xq_files WHERE request_id = ? ORDER BY id').bind(id).all()).results;
  r.events = (await db.prepare('SELECT event, by_name, side, note, created_at FROM xq_events WHERE request_id = ? ORDER BY id').bind(id).all()).results;
  r.outbox = await outboxState(db, id);
  r.peer_link = r.peer_id ? PEER_UI + r.peer_id : null;
  r.quote = r.quote_id ? await db.prepare('SELECT id, number, status, title, total, valid_until, client_id, lead_id FROM quotes WHERE id = ?').bind(r.quote_id).first() : null;
  return r;
}
function canList(r, user, roles) {
  const can = ['comment'];
  for (const [ev, [owner, from]] of Object.entries(EVENTS)) {
    if (ev === 'comment' || owner !== r.direction || !from.includes(r.status)) continue;
    if (ev === 'quoted') { if (roles.includes(user.role)) can.push(r.quote_id ? 'send_quote' : 'issue_quote'); continue; } // العرض من «عروض الأسعار» نفسها
    if (owner === 'in' && roles.includes(user.role)) can.push(ev);
    if (owner === 'out' && (isBoss(user) || r.requester_user_id === user.id)) can.push(ev);
  }
  return can;
}
async function filesMeta(db, requestId, side, onlyIds = null) {
  const { results } = await db.prepare("SELECT id, item_uid, name, mime, size FROM xq_files WHERE request_id = ? AND side = ? AND origin = 'local'").bind(requestId, side).all();
  return results.filter((f) => !onlyIds || onlyIds.includes(f.id)).map((f) => ({ id: String(f.id), item_uid: f.item_uid, name: f.name, mime: f.mime, size: f.size }));
}
async function attachUploads(db, user, requestId, list, side, itemUids = []) {
  const ids = [];
  for (const f of (Array.isArray(list) ? list : []).slice(0, 30)) {
    const row = await db.prepare('SELECT id, name, mime, size FROM files WHERE id = ? AND user_id = ?').bind(+f.id || 0, user.id).first();
    if (!row) continue;
    const iu = f.item != null && f.item !== '' ? itemUids[+f.item] || null : null;
    const r = await db.prepare('INSERT INTO xq_files (request_id, item_uid, side, origin, file_id, name, mime, size) VALUES (?,?,?,?,?,?,?,?)')
      .bind(requestId, iu, side, 'local', row.id, str(f.name, 200) || row.name, str(f.mime, 100) || row.mime, row.size).run();
    ids.push(r.meta.last_row_id);
  }
  return ids;
}

// ---------------------------------------------------------------- الإنشاء والأحداث
async function nextNumber(db) {
  const y = new Date(Date.now() + 3 * 3600e3).getUTCFullYear();
  const n = await db.prepare("SELECT MAX(CAST(substr(number, 11) AS INTEGER)) AS n FROM xq_requests WHERE direction = 'out' AND number LIKE ?").bind(`RQ-M-${y}-%`).first('n');
  return `RQ-M-${y}-${String((n || 0) + 1).padStart(4, '0')}`;
}
function payloadCreate(r) {
  return {
    uid: r.uid, id: String(r.id), number: r.number, title: r.title, sector: XQ_SELF,
    requester: { name: r.requester_name, phone: r.requester_phone, email: r.requester_email },
    client: { name: r.client_name, company: r.client_company, phone: r.client_phone, email: r.client_email },
    needed_by: r.needed_by, notes: r.notes, links: r.links, suggested_total: r.suggested_total,
    items: r.items.map((i) => ({ uid: i.uid, title: i.title, description: i.description, qty: i.qty, unit: i.unit, suggested_price: i.suggested_price })),
    created_at: r.created_at,
  };
}

export async function xqCreate(db, env, user, d) {
  const items = (Array.isArray(d.items) ? d.items : []).map((it) => ({ uid: xuid(), title: str(it.title, 255), description: str(it.description, 4000),
    qty: num(it.qty) || 1, unit: str(it.unit, 30), suggested_price: num(it.suggested_price) })).filter((it) => it.title);
  if (!items.length) throw new HttpError(400, 'أضف بنداً واحداً على الأقل');
  if (!str(d.client_name, 200)) throw new HttpError(400, 'اسم العميل مطلوب');
  const priced = items.filter((i) => i.suggested_price != null);
  const total = num(d.suggested_total) ?? (priced.length ? Math.round(priced.reduce((a, i) => a + i.qty * i.suggested_price, 0) * 100) / 100 : null);
  const me = await db.prepare('SELECT name, phone, email FROM users WHERE id = ?').bind(user.id).first();
  const res = await db.prepare(`INSERT INTO xq_requests (uid, direction, number, status, title, requester_user_id, requester_name, requester_phone, requester_email,
      client_id, client_name, client_company, client_phone, client_email, needed_by, notes, links, suggested_total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(xuid(), 'out', await nextNumber(db), 'pending', str(d.title, 200), user.id, me.name, me.phone || null, me.email || null, +d.client_id || null,
      str(d.client_name, 200), str(d.client_company, 200), str(d.client_phone, 30), str(d.client_email, 160), date(d.needed_by), str(d.notes, 8000), str(d.links, 4000), total).run();
  const id = res.meta.last_row_id;
  await db.batch(items.map((it, k) => db.prepare('INSERT INTO xq_items (request_id, uid, title, description, qty, unit, suggested_price, sort) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id, it.uid, it.title, it.description, it.qty, it.unit, it.suggested_price, k)));
  await attachUploads(db, user, id, d.files, 'request', items.map((i) => i.uid));
  await log(db, id, 'created', me.name);
  await audit(db, user, 'create', 'xq_requests', id);
  const r = await xqGet(db, id);
  await enqueue(db, 'request.create', { ...payloadCreate(r), files: await filesMeta(db, id, 'request') }, id);
  await xqFlush(db);
  return xqGet(db, id);
}

async function peerFiles(db, requestId, files, side) {
  const st = (Array.isArray(files) ? files : []).filter((f) => f && f.id != null).map((f) => db.prepare(
    'INSERT INTO xq_files (request_id, item_uid, side, origin, peer_file_id, name, mime, size) VALUES (?,?,?,?,?,?,?,?)')
    .bind(requestId, UID_RE.test(String(f.item_uid || '')) ? f.item_uid : null, side, 'peer', String(f.id).slice(0, 40), str(f.name, 200) || 'ملف', str(f.mime, 100), +f.size || 0));
  if (st.length) await db.batch(st);
}

/** يطبق أثر الحدث (مشترك بين الحدث المحلي والوارد) */
async function apply(db, r, event, d) {
  if (event === 'comment') { await db.prepare("UPDATE xq_requests SET updated_at = datetime('now') WHERE id = ?").bind(r.id).run(); return; }
  const set = ['status = ?', "updated_at = datetime('now')"]; const p = [event];
  if (d.handler && typeof d.handler === 'object') { set.push('handler_name = ?', 'handler_phone = ?'); p.push(str(d.handler.name, 120), str(d.handler.phone, 30)); }
  if (event === 'quoted' && d.quote && typeof d.quote === 'object') {
    const q = d.quote;
    set.push('quote_number = ?', 'quote_total = ?', 'quote_vat_included = ?', 'quote_valid_until = ?', 'quote_note = ?', "quoted_at = datetime('now')");
    p.push(str(q.number, 40), num(q.total), q.vat_included ? 1 : 0, date(q.valid_until), str(q.note, 8000));
    const st = (Array.isArray(q.items) ? q.items : []).map((it) => db.prepare('UPDATE xq_items SET quoted_price = ? WHERE request_id = ? AND uid = ?').bind(num(it.quoted_price), r.id, String(it.uid || '')));
    if (st.length) await db.batch(st);
  }
  await db.prepare(`UPDATE xq_requests SET ${set.join(', ')} WHERE id = ?`).bind(...p, r.id).run();
}

export async function xqAct(db, env, user, id, d) {
  const r = await xqGet(db, id);
  if (!r) throw new HttpError(404, 'الطلب غير موجود');
  const event = String(d.event || '');
  if (!canList(r, user, await handlerRoles(db)).includes(event === 'quoted' ? 'send_quote' : event)) throw new HttpError(403, 'لا تملك صلاحية هذا الإجراء على الطلب بحالته الحالية');
  const note = str(d.note, 4000);
  const hasFiles = Array.isArray(d.files) && d.files.length > 0;
  if (['rejected', 'declined', 'comment'].includes(event) && !note && !hasFiles) throw new HttpError(400, 'اكتب السبب أو التعليق');
  const me = await db.prepare('SELECT name, phone FROM users WHERE id = ?').bind(user.id).first();
  const payload = { event, note };
  if (r.direction === 'in' && ['confirmed', 'quoted', 'rejected'].includes(event)) payload.handler = { name: me.name, phone: me.phone || null };
  if (event === 'quoted') {
    // العرض هو نفسه عرض «عروض الأسعار» المرتبط بالطلب: رقمه وإجماليه (شامل الضريبة) وصلاحيته، وملفه بقالب الطباعة المعتاد
    if (!r.quote_id || +d.quote_id !== r.quote_id) throw new HttpError(400, 'أصدر العرض من «عروض الأسعار» أولاً');
    if (!hasFiles) throw new HttpError(400, 'ملف العرض مطلوب');
    const q = await db.prepare('SELECT * FROM quotes WHERE id = ?').bind(r.quote_id).first();
    let qi = []; try { qi = JSON.parse(q.items || '[]'); } catch { /* */ }
    const items = qi.length === r.items.length ? r.items.map((it, k) => ({ uid: it.uid, quoted_price: num(qi[k].price) })) : [];
    payload.quote = { number: q.number, total: num(q.total), vat_included: true, valid_until: date(q.valid_until), note: str(q.notes, 8000), items };
    if (q.status === 'مسودة') await db.prepare("UPDATE quotes SET status = 'مرسل', updated_at = datetime('now') WHERE id = ?").bind(q.id).run();
  }
  const side = event === 'quoted' ? 'quote' : 'request';
  const newIds = await attachUploads(db, user, id, d.files, side);
  if (payload.handler) await db.prepare('UPDATE xq_requests SET handler_user_id = ? WHERE id = ?').bind(user.id, id).run();
  await apply(db, r, event, payload);
  const evUid = xuid();
  await log(db, id, event, me.name, 'local', note, evUid);
  await enqueue(db, 'request.event', { ...payload, uid: r.uid, event_uid: evUid, by: me.name, files: newIds.length ? await filesMeta(db, id, side, newIds) : [] }, id);
  await xqFlush(db);
  return xqGet(db, id);
}

async function notifyLocal(db, env, r, text, title) {
  const opts = { kind: 'xq', link: `#/xreq/${r.id}`, title };
  if (r.direction === 'out') { if (r.requester_user_id) await notifyUser(db, env, r.requester_user_id, text, null, opts); return; }
  if (r.handler_user_id) await notifyUser(db, env, r.handler_user_id, text, null, opts);
  else await notifyRoles(db, env, await handlerRoles(db), text, opts);
}

async function receiveCreate(db, env, d) {
  if (!UID_RE.test(String(d.uid || ''))) throw new HttpError(400, 'معرف غير صالح');
  const ex = await db.prepare('SELECT id FROM xq_requests WHERE uid = ?').bind(d.uid).first('id');
  if (ex) return ex;
  const rq = d.requester || {}; const cl = d.client || {};
  const res = await db.prepare(`INSERT INTO xq_requests (uid, direction, number, peer_id, status, title, requester_name, requester_phone, requester_email,
      client_name, client_company, client_phone, client_email, needed_by, notes, links, suggested_total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(d.uid, 'in', str(d.number, 30) || 'RQ-?', str(d.id, 40), 'received', str(d.title, 200), str(rq.name, 120), str(rq.phone, 30), str(rq.email, 160),
      str(cl.name, 200), str(cl.company, 200), str(cl.phone, 30), str(cl.email, 160), date(d.needed_by), str(d.notes, 8000), str(d.links, 4000), num(d.suggested_total)).run();
  const id = res.meta.last_row_id;
  const items = Array.isArray(d.items) ? d.items : [];
  if (items.length) await db.batch(items.map((it, k) => db.prepare('INSERT INTO xq_items (request_id, uid, title, description, qty, unit, suggested_price, sort) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id, UID_RE.test(String(it.uid || '')) ? it.uid : xuid(), str(it.title, 255) || 'بند', str(it.description, 4000), num(it.qty) || 1, str(it.unit, 30), num(it.suggested_price), k)));
  await peerFiles(db, id, d.files, 'request');
  await log(db, id, 'created', `${str(rq.name, 120) || ''} — ${XQ_SECTORS[XQ_PEER]}`, 'peer');
  const r = await xqGet(db, id);
  await notifyLocal(db, env, r, `📨 <b>طلب عرض سعر جديد</b> من ${h(XQ_SECTORS[XQ_PEER])}\n${h(r.number)} — ${h(r.client_name || '')}\n🧾 ${r.items.length} بند${r.suggested_total != null ? ` · مقترح ${r.suggested_total} ر.س` : ''}\n👤 ${h(r.requester_name || '')}`, 'طلب عرض سعر من ' + XQ_SECTORS[XQ_PEER]);
  return id;
}

async function receiveEvent(db, env, d) {
  const id = await db.prepare('SELECT id FROM xq_requests WHERE uid = ?').bind(String(d.uid || '')).first('id');
  if (!id) throw new HttpError(404, 'الطلب غير موجود لدينا');
  const event = String(d.event || '');
  if (!EVENTS[event]) throw new HttpError(400, 'حدث غير معروف');
  const r = await xqGet(db, id);
  const owner = EVENTS[event][0];
  if (owner !== '*' && owner === r.direction) throw new HttpError(409, 'حدث لا يخص هذا الطرف');
  if (!UID_RE.test(String(d.event_uid || ''))) throw new HttpError(400, 'معرف حدث غير صالح');
  if (await db.prepare('SELECT 1 AS x FROM xq_events WHERE event_uid = ?').bind(d.event_uid).first('x')) return; // وصل سابقاً
  await apply(db, r, event, d);
  await peerFiles(db, id, d.files, event === 'quoted' ? 'quote' : 'request');
  const by = str(d.by, 120);
  await log(db, id, event, `${by || ''} — ${XQ_SECTORS[XQ_PEER]}`, 'peer', str(d.note, 4000), d.event_uid);
  const icon = { confirmed: '✅', rejected: '⛔', quoted: '💰', cancelled: '🚫', accepted: '🎉', declined: '↩️', comment: '💬' }[event] || '🔔';
  const extra = event === 'quoted' && d.quote?.total != null ? ` بقيمة ${d.quote.total} ر.س` : '';
  await notifyLocal(db, env, r, `${icon} <b>${h(r.number)}</b>: ${h(by || XQ_SECTORS[XQ_PEER])} ${XQ_EVENT_LABEL[event]}${h(extra)}\n${h(r.client_name || '')}${d.note ? `\n💬 ${h(String(d.note).slice(0, 300))}` : ''}`, `${r.number}: ${XQ_EVENT_LABEL[event]}`);
}

// ---------------------------------------------------------------- الجسر العام (من منصة الدعاية والإعلان)
export async function xqBridge(db, env, request, ctx) {
  // الطرف الآخر متاح الآن — فرصة لإرسال ما تعذّر من صندوقنا الصادر بعد الرد (لا يؤخر الاستجابة)
  const out = (o, status = 200) => { if (o.ok && ctx?.waitUntil) ctx.waitUntil(xqFlush(db, 10).catch(() => 0)); return json(o, status); };
  try {
    if (request.method !== 'POST') return out({ ok: false, error: 'POST فقط' }, 405);
    const s = await getSettings(db);
    if (!xqReady(s)) return out({ ok: false, error: 'الربط غير مُعدّ' }, 503);
    const raw = await request.text();
    if (raw.length > 2_000_000) return out({ ok: false, error: 'حجم كبير' }, 413);
    const ts = request.headers.get('x-nubl-ts') || ''; const sig = (request.headers.get('x-nubl-sig') || '').toLowerCase();
    if (!/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return out({ ok: false, error: 'انتهت صلاحية الطلب (الوقت)' }, 401);
    if (!safeEq(await hmacHex(s.xq_secret, `${ts}.${raw}`), sig)) return out({ ok: false, error: 'توقيع غير صالح' }, 401);
    let j; try { j = JSON.parse(raw); } catch { return out({ ok: false, error: 'بيانات غير صالحة' }, 400); }
    const d = j.data && typeof j.data === 'object' ? j.data : {};
    switch (j.op) {
      case 'ping': return out({ ok: true, sector: XQ_SELF, name: XQ_SECTORS[XQ_SELF], time: new Date().toISOString() });
      case 'request.create': return out({ ok: true, id: String(await receiveCreate(db, env, d)) });
      case 'request.event': await receiveEvent(db, env, d); return out({ ok: true });
      case 'file.get': {
        const f = await db.prepare("SELECT x.name, x.mime, fl.data FROM xq_files x JOIN files fl ON fl.id = x.file_id WHERE x.id = ? AND x.origin = 'local'").bind(+d.id || 0).first();
        if (!f) return out({ ok: false, error: 'الملف غير موجود' }, 404);
        const bin = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
        return new Response(bin, { headers: { 'content-type': f.mime || 'application/octet-stream', 'x-file-name': encodeURIComponent(f.name || 'file'), 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
      }
      // منصة القيادة: اعتمادات الرئيس التنفيذي (tamim.js)
      case 'approvals.list': return out({ ok: true, ...(await approvalsFeed(db)) });
      case 'approval.doc': return await approvalDoc(db, d);
      case 'approval.file': return await approvalFile(db, d);
      default: return out({ ok: false, error: 'عملية غير معروفة' }, 400);
    }
  } catch (e) {
    if (e instanceof HttpError) return out({ ok: false, error: e.message }, e.status);
    console.error('xq bridge', e);
    return out({ ok: false, error: 'تعذّرت المعالجة' }, 500);
  }
}

// ---------------------------------------------------------------- واتساب
function waText(r, kind) {
  const L = [];
  const q = (v) => String(+v || 0);
  if (kind === 'request') L.push(`📨 *طلب عرض سعر* ${r.number}${r.title ? ' — ' + r.title : ''}`, `من: ${r.requester_name} — ${XQ_SECTORS[XQ_SELF]}`, `إلى: ${XQ_SECTORS[XQ_PEER]}`);
  else L.push(`💰 *عرض السعر جاهز* — طلبكم ${r.number}${r.title ? ' (' + r.title + ')' : ''}`, `من: ${r.handler_name || ''} — ${XQ_SECTORS[XQ_SELF]}`);
  L.push(`العميل: ${r.client_name || ''}${r.client_company ? ' / ' + r.client_company : ''}${r.client_phone ? ' — ' + r.client_phone : ''}`, '');
  r.items.forEach((it, k) => {
    const p = kind === 'request' ? it.suggested_price : it.quoted_price;
    L.push(`${k + 1}) ${it.title} × ${q(it.qty)}${it.unit ? ' ' + it.unit : ''}${p != null ? ` — ${Number(p).toFixed(2)} ر.س${kind === 'request' ? ' (مقترح)' : ''}` : ''}`);
  });
  L.push('');
  if (kind === 'request') {
    if (r.suggested_total != null) L.push(`السعر المقترح الإجمالي: ${Number(r.suggested_total).toFixed(2)} ر.س`);
    if (r.needed_by) L.push(`مطلوب قبل: ${r.needed_by}`);
    if (r.notes) L.push(`ملاحظات: ${r.notes.slice(0, 400)}`);
    const nf = r.files.filter((f) => f.side === 'request').length; if (nf) L.push(`📎 ${nf} مرفق`);
    L.push(r.peer_link ? `التفاصيل والمرفقات: ${r.peer_link}` : `الطلب وصل إلى منصة ${XQ_SECTORS[XQ_PEER]} — قسم «طلبات بين القطاعات»`);
  } else {
    L.push(`إجمالي العرض: ${Number(r.quote_total || 0).toFixed(2)} ر.س ${r.quote_vat_included ? '(شامل الضريبة)' : '(غير شامل الضريبة)'}`);
    if (r.quote_valid_until) L.push(`صالح حتى: ${r.quote_valid_until}`);
    if (r.quote_note) L.push(`ملاحظات: ${r.quote_note.slice(0, 400)}`);
    if (r.peer_link) L.push(`تفاصيل العرض وملفه: ${r.peer_link}`);
  }
  return L.join('\n');
}
function waUrl(phone, text) {
  let p = String(phone || '').replace(/\D/g, '');
  if (/^05\d{8}$/.test(p)) p = '966' + p.slice(1); else if (/^5\d{8}$/.test(p)) p = '966' + p;
  return `https://wa.me/${p.length >= 11 ? p : ''}?text=${encodeURIComponent(text)}`;
}

// ---------------------------------------------------------------- مسارات الواجهة (بجلسة)
export async function xqRoute(db, env, request, user, a, b, entity) {
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const body = async () => { try { return await request.json(); } catch { throw new HttpError(400, 'بيانات غير صالحة'); } };
  const roles = await handlerRoles(db);

  if (!a && method === 'GET') {
    if (await db.prepare('SELECT 1 AS x FROM xq_outbox WHERE sent_at IS NULL LIMIT 1').first('x')) await xqFlush(db, 5);
    const box = url.searchParams.get('box') || 'all'; const status = url.searchParams.get('status') || ''; const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
    const w = []; const p = [];
    if (box === 'in' || box === 'out') { w.push('r.direction = ?'); p.push(box); }
    if (box === 'mine') { w.push('(r.requester_user_id = ? OR r.handler_user_id = ?)'); p.push(user.id, user.id); }
    if (XQ_STATUS[status]) { w.push('r.status = ?'); p.push(status); }
    if (q) { w.push("(COALESCE(r.number,'') || ' ' || COALESCE(r.title,'') || ' ' || COALESCE(r.client_name,'') || ' ' || COALESCE(r.client_company,'') || ' ' || COALESCE(r.client_phone,'') || ' ' || COALESCE(r.requester_name,'') || ' ' || COALESCE(r.handler_name,'')) LIKE ?"); p.push(`%${q}%`); }
    const { results } = await db.prepare(`SELECT r.id, r.direction, r.number, r.status, r.title, r.client_name, r.client_company, r.requester_name, r.handler_name, r.needed_by,
        r.suggested_total, r.quote_total, r.created_at, r.updated_at, (SELECT COUNT(*) FROM xq_items i WHERE i.request_id = r.id) AS items,
        (SELECT COUNT(*) FROM xq_outbox o WHERE o.request_id = r.id AND o.sent_at IS NULL) AS unsent
      FROM xq_requests r ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY r.updated_at DESC, r.id DESC LIMIT 300`).bind(...p).all();
    const counts = (await db.prepare('SELECT direction, status, COUNT(*) AS n FROM xq_requests GROUP BY direction, status').all()).results;
    const s = await getSettings(db);
    return json({ rows: results, counts, status: XQ_STATUS, sectors: XQ_SECTORS, self: XQ_SELF, peer: XQ_PEER, ready: xqReady(s), is_handler: roles.includes(user.role) });
  }
  if (!a && method === 'POST') { const r = await xqCreate(db, env, user, await body()); return json({ id: r.id, number: r.number, delivered: r.status !== 'pending' }, 201); }
  if (a === 'file' && b && method === 'GET') {
    const f = await db.prepare('SELECT x.*, fl.data FROM xq_files x LEFT JOIN files fl ON fl.id = x.file_id WHERE x.id = ?').bind(+b).first();
    if (!f) return json({ error: 'الملف غير موجود' }, 404);
    const disp = `${/^(image\/|application\/pdf|text\/html)/.test(f.mime || '') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name || 'file')}`;
    // مستند HTML (عرض سعر بقالب الطباعة) يُعرض معزولاً عن جلسة المنصة
    const iso = /^text\/html/i.test(f.mime || '') ? { 'content-security-policy': 'sandbox allow-scripts allow-modals allow-popups' } : {};
    if (f.origin === 'local') {
      const bin = Uint8Array.from(atob(f.data || ''), (c) => c.charCodeAt(0));
      return new Response(bin, { headers: { 'content-type': f.mime || 'application/octet-stream', 'content-disposition': disp, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', ...iso } });
    }
    const r = await xqCall(db, 'file.get', { id: f.peer_file_id }, true);
    if (!r.ok) return json({ error: 'تعذّر جلب الملف من ' + XQ_SECTORS[XQ_PEER] + ': ' + (r.error || '') }, 502);
    return new Response(r.res.body, { headers: { 'content-type': f.mime || r.res.headers.get('content-type') || 'application/octet-stream', 'content-disposition': disp, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', ...iso } });
  }
  if (a === 'config') {
    if (user.role !== 'admin') return json({ error: 'للمدير فقط' }, 403);
    if (method === 'POST') {
      const d = await body(); const st = [];
      const save = (k, v) => db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(k, v);
      if (d.secret !== undefined) { if (d.secret && String(d.secret).length < 32) return json({ error: 'السر المشترك 32 حرفاً على الأقل' }, 400); st.push(save('xq_secret', String(d.secret || '').trim())); }
      if (d.url !== undefined) { if (d.url && !/^https:\/\//.test(d.url)) return json({ error: 'الرابط يجب أن يبدأ بـ https://' }, 400); st.push(save('xq_peer_url', String(d.url || '').trim())); }
      if (st.length) await db.batch(st);
      await audit(db, user, 'xq_config', 'settings', null, Object.keys(d).join(','));
    }
    const s = await getSettings(db);
    return json({ ready: xqReady(s), url: s.xq_peer_url || PEER_URL_DEFAULT, handler_roles: s.xq_handler_roles || 'admin,manager' });
  }
  if (a === 'ping' && method === 'POST') {
    if (user.role !== 'admin') return json({ error: 'للمدير فقط' }, 403);
    const r = await xqCall(db, 'ping', { at: new Date().toISOString() });
    return json({ ok: r.ok, message: r.ok ? `الربط يعمل مع ${r.data.name || XQ_SECTORS[XQ_PEER]}` : `تعذّر الربط: ${r.error}` });
  }
  const id = +a;
  if (!id) return json({ error: 'مسار غير معروف' }, 404);
  if (!b && method === 'GET') {
    const r = await xqGet(db, id);
    if (!r) return json({ error: 'الطلب غير موجود' }, 404);
    r.can = canList(r, user, roles);
    r.wa = r.direction === 'out' ? { label: 'إرسال الطلب واتساب للقطاع الآخر', url: waUrl(null, waText(r, 'request')) }
      : (['quoted', 'accepted'].includes(r.status) ? { label: 'إرسال العرض واتساب لصاحب الطلب', url: waUrl(r.requester_phone, waText(r, 'quote')) } : null);
    return json({ request: r, status: XQ_STATUS, event_label: XQ_EVENT_LABEL, sectors: XQ_SECTORS, self: XQ_SELF, peer: XQ_PEER, hub_url: HUB_URL });
  }
  if (b === 'act' && method === 'POST') {
    const r = await xqAct(db, env, user, id, await body());
    return json({ ok: true, status: r.status, pending: !!r.outbox, message: XQ_EVENT_LABEL[r.events[r.events.length - 1]?.event] || 'تم' });
  }
  if (b === 'quote' && method === 'POST') {
    // إصدار العرض في «عروض الأسعار»: مسار الكيانات نفسه (ترقيم Q-سنة-رقم، المجاميع والضريبة، الصلاحيات، سجل التدقيق)
    const r = await xqGet(db, id);
    if (!r) return json({ error: 'الطلب غير موجود' }, 404);
    if (!canList(r, user, roles).includes('issue_quote')) return json({ error: 'لا يمكن إصدار عرض لهذا الطلب الآن' }, 403);
    const d = await body();
    const items = (Array.isArray(d.items) ? d.items : []).map((it) => ({ name: str(it.name, 255), desc: str(it.desc, 4000) || '', qty: num(it.qty) || 1, price: num(it.price) || 0 })).filter((it) => it.name);
    if (!items.length) return json({ error: 'أضف بنداً واحداً على الأقل' }, 400);
    let clientId = +d.client_id || null; let leadId = +d.lead_id || null;
    if (!clientId && !leadId) {
      const lead = await entity('POST', 'leads', null, { name: r.client_name, company: r.client_company, phone: r.client_phone, email: r.client_email,
        source: XQ_SECTORS[XQ_PEER], notes: `من طلب عرض سعر ${r.number} — ${r.requester_name || ''}` });
      leadId = lead.id;
    }
    const q = await entity('POST', 'quotes', null, { client_id: clientId, lead_id: clientId ? null : leadId, title: str(d.title, 200) || r.title || `عرض سعر — ${r.client_name || ''}`,
      items, discount: num(d.discount) || 0, valid_until: date(d.valid_until), notes: str(d.notes, 8000) });
    const me = await db.prepare('SELECT name, phone FROM users WHERE id = ?').bind(user.id).first();
    await db.prepare("UPDATE xq_requests SET quote_id = ?, handler_user_id = ?, handler_name = ?, handler_phone = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(q.id, user.id, me.name, me.phone || null, id).run();
    await log(db, id, 'quote_created', me.name, 'local', `${q.number} — ${q.total} ر.س`);
    return json({ quote: q });
  }
  if (b === 'resend' && method === 'POST') {
    const n = await xqFlush(db, 20); const st = await outboxState(db, id);
    return json({ ok: !st, message: st ? `تعذّر الإرسال: ${st.error}` : (n ? `أُرسل ${n} تحديث` : 'لا شيء معلّق') });
  }
  return json({ error: 'مسار غير معروف' }, 404);
}
