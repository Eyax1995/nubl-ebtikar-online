// الملف الشخصي لكل عضو (v30 — 29 أكتوبر 2026) + دعوات تفعيل الحساب للموظف الجديد
// الموظف يُكمل بياناته بنفسه (الشخصية، الهوية، البنك، المستندات) والإدارة تؤكّدها قسماً قسماً: ناقص · بانتظار التأكيد · مؤكَّد ✓
//   GET  profile                 ملفي (كامل)          · POST profile {…الحقول}            حفظ (أي قسم يتغيّر يعود «بانتظار التأكيد»)
//   POST profile/upload {kind,…} رفع صورة/مستند       · GET  profile/pending              ملفات بانتظار التأكيد + غير المكتملة (admin/manager/finance)
//   GET  profile/<id>            ملف عضو (الحساس مقنّع لغير صاحبه والإدارة والمالية) · POST profile/<id> تعديل (admin) · POST profile/<id>/upload (admin)
//   POST profile/<id>/confirm {section: personal|id|bank|phone}  تأكيد (admin/manager) — يعكس الجوال والبريد والبنك والآيبان على سجل الموظف (employees.user_id)
// مستندات الهوية والسيرة تُحفظ في files بنطاق 'profile:<uid>' ولا تُنزَّل إلا لصاحبها والإدارة والمالية (fileAllowed في filesRoute).
// الدعوات: users POST {invite:true} أو POST users/<id>/invite → رابط موقّع لمرة واحدة 72 ساعة (HMAC بسرّ track_secret وبادئة invite:، وبصمته SHA-256 في user_invites)
//   إلى /marketing/hub/activate#<key> يختار فيه الموظف كلمة مروره ثم يدخل إلى #/me/welcome. الإرسال واتساب من رقم التسويق (نص حر داخل 24 ساعة، وإلا قالب nubl_client_update).
import { json, bad, HttpError, audit, createSession, sessionCookie, hashPassword } from './core.js';
import { notifyUser, notifyRoles } from './telegram.js';
import { secret, templateReady } from './track.js';
import { cleanPhone as cleanPhone0 } from './hiring.js';
import { sendText } from '../../../../wa/_lib/engine.js';

const SITE = 'https://nubl-ebtikar.online';
const cleanPhone = (p) => { const d = cleanPhone0(p); return /^\d{9,15}$/.test(d || '') ? d : null; };
const FROM_PHONE_ID = '1368158866379375';
const INVITE_HOURS = 72;
const PRIV = ['admin', 'manager', 'finance']; // يرون الحساس كاملاً وينزّلون المستندات
const BOSS = ['admin', 'manager']; // يؤكدون البيانات
export const SOCIAL = ['instagram', 'x', 'snapchat', 'tiktok', 'linkedin', 'behance', 'facebook'];
const FILE_KINDS = { avatar: 'الصورة الشخصية', id_front: 'صورة الهوية (الوجه)', id_back: 'صورة الهوية (الظهر)', cv: 'السيرة الذاتية', degree: 'المؤهل العلمي' };
export const SECTIONS = {
  personal: { label: 'البيانات الشخصية', fields: ['personal_email', 'birth_date', 'nationality', 'city', 'district', 'emergency_name', 'emergency_relation', 'emergency_phone', ...SOCIAL.map((s) => 'social_' + s)] },
  id: { label: 'الهوية', fields: ['national_id', 'id_expiry'] },
  bank: { label: 'الحساب البنكي', fields: ['bank_name', 'iban', 'holder_name'] },
};
const FIELD_SEC = {}; for (const [k, s] of Object.entries(SECTIONS)) for (const f of s.fields) FIELD_SEC[f] = k;

const parse = (v, d) => { try { const x = JSON.parse(v); return x ?? d; } catch { return d; } };
const str = (v, n = 200) => String(v ?? '').replace(/[\u0000-\u001F]/g, ' ').trim().slice(0, n);
const firstName = (n) => { const w = String(n || '').trim().split(/\s+/); return /^(عبد|عبدال|أبو|ابو|أم|ام|آل)$/.test(w[0]) && w[1] ? `${w[0]} ${w[1]}` : (w[0] || ''); };
const digits = (v) => String(v || '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\D/g, '');
export const normIban = (v) => String(v || '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\s+/g, '').toUpperCase();
const mask = (v, keep = 4) => { const s = String(v || ''); if (!s) return ''; return s.length <= keep ? '•'.repeat(s.length) : (/^SA/.test(s) ? 'SA' + '•'.repeat(s.length - keep - 2) : '•'.repeat(s.length - keep)) + s.slice(-keep); };
const nowIso = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

// ---------- القراءة والحساب ----------
async function load(db, uid) {
  const u = await db.prepare('SELECT id, name, email, phone, role, title, avatar, active, last_login, created_at, notify_wa, notify_tg, tg_chat_id, tg_username FROM users WHERE id = ?').bind(uid).first();
  if (!u) throw new HttpError(404, 'المستخدم غير موجود');
  const p = await db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').bind(uid).first();
  return { u, d: parse(p?.data, {}), files: parse(p?.files, {}), status: parse(p?.status, {}), conf: parse(p?.confirm, {}), updated_at: p?.updated_at || null, exists: !!p };
}
// المطلوب لاكتمال الملف (الحسابات الاجتماعية اختيارية)
function required(P) {
  const { u, d, files } = P;
  return [
    ['mobile', 'جوال واتساب', 'info', 'personal', !!u.phone],
    ['personal_email', 'البريد الشخصي', 'info', 'personal', !!d.personal_email],
    ['birth_date', 'تاريخ الميلاد', 'info', 'personal', !!d.birth_date],
    ['emergency', 'جهة اتصال للطوارئ', 'info', 'personal', !!(d.emergency_name && d.emergency_phone)],
    ['national_id', 'رقم الهوية / الإقامة', 'docs', 'id', !!d.national_id],
    ['id_expiry', 'تاريخ انتهاء الهوية', 'docs', 'id', !!d.id_expiry],
    ['id_front', 'صورة الهوية', 'docs', 'id', !!files.id_front],
    ['bank_name', 'اسم البنك', 'docs', 'bank', !!d.bank_name],
    ['iban', 'الآيبان', 'docs', 'bank', !!d.iban],
    ['holder_name', 'اسم صاحب الحساب', 'docs', 'bank', !!d.holder_name],
  ].map(([k, l, tab, sec, ok]) => ({ k, l, tab, sec, ok }));
}
function secState(P, sec, req) {
  const missing = req.some((r) => r.sec === sec && !r.ok);
  if (missing) return 'missing';
  return P.status[sec] === 'ok' ? 'ok' : 'pending';
}
const pctOf = (req) => Math.round((req.filter((r) => r.ok).length / req.length) * 100);
export async function selfPct(db, uid) {
  try { return pctOf(required(await load(db, uid))); } catch { return null; }
}

async function works(db, uid) {
  const t = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  const month = t.slice(0, 7); const d30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const one = async (sql, ...a) => { try { return await db.prepare(sql).bind(...a).first(); } catch { return {}; } };
  const tk = await one(`SELECT SUM(CASE WHEN status != 'منجزة' THEN 1 ELSE 0 END) AS open, SUM(CASE WHEN status != 'منجزة' AND due_date < ? THEN 1 ELSE 0 END) AS overdue,
    SUM(CASE WHEN status = 'منجزة' AND done_at >= ? THEN 1 ELSE 0 END) AS done30 FROM tasks WHERE assignee_id = ?`, t, d30, uid);
  const ct = await one(`SELECT COUNT(*) AS month, SUM(CASE WHEN status = 'منشور' THEN 1 ELSE 0 END) AS published FROM content WHERE (assignee_id = ? OR designer_id = ?) AND substr(publish_date, 1, 7) = ?`, uid, uid, month);
  let list = [];
  try { ({ results: list } = await db.prepare(`SELECT id, title, status, due_date, priority FROM tasks WHERE assignee_id = ? AND status != 'منجزة' ORDER BY due_date IS NULL, due_date LIMIT 8`).bind(uid).all()); } catch { /* */ }
  return { tasks_open: tk?.open || 0, tasks_overdue: tk?.overdue || 0, tasks_done30: tk?.done30 || 0, content_month: ct?.month || 0, content_published: ct?.published || 0, open_list: list };
}

async function view(db, viewer, uid, withWorks) {
  const P = await load(db, uid);
  const { u, d, files, conf } = P;
  const own = viewer.id === u.id; const priv = own || PRIV.includes(viewer.role); const boss = BOSS.includes(viewer.role);
  const req = required(P);
  const sections = {};
  for (const [k, s] of Object.entries(SECTIONS)) sections[k] = { label: s.label, state: secState(P, k, req), by: conf[k]?.by_name || null, at: conf[k]?.at || null };
  const phone = { value: u.phone || '', verified: !!(u.phone && conf.phone?.value === u.phone), by: conf.phone?.by_name || null, at: conf.phone?.at || null };
  const social = {}; for (const s of SOCIAL) if (d['social_' + s]) social[s] = d['social_' + s];
  const out = {
    user: { id: u.id, name: u.name, email: u.email, role: u.role, title: u.title || '', avatar: u.avatar || null, last_login: u.last_login, created_at: u.created_at, active: !!u.active },
    own, can_edit: own || viewer.role === 'admin', can_confirm: boss && (!own || viewer.role === 'admin'), can_title: viewer.role === 'admin', privileged: priv,
    social, phone, sections, required: req, pct: pctOf(req), updated_at: P.updated_at,
  };
  if (priv) {
    out.data = { ...d };
    out.files = {}; for (const k of Object.keys(FILE_KINDS)) if (files[k]) out.files[k] = files[k];
  } else {
    // غير صاحب الملف ولا الإدارة ولا المالية: بطاقة تعارف فقط — الهوية والآيبان مقنّعان، بلا مستندات ولا ميلاد ولا عنوان ولا طوارئ
    out.data = { city: d.city || '', nationality: d.nationality || '', national_id: mask(d.national_id), iban: mask(d.iban), bank_name: d.bank_name || '' };
    out.files = {};
    out.required = []; out.pct = null;
  }
  if (own) out.notify = { wa: u.notify_wa !== 0, tg: u.notify_tg !== 0, tg_linked: !!u.tg_chat_id, tg_username: u.tg_username || null };
  if (withWorks && (own || boss)) out.works = await works(db, uid);
  return out;
}

// ---------- الحفظ ----------
function validate(k, raw) {
  let v = str(raw, k.startsWith('social_') ? 200 : 120);
  if (!v) return null;
  if (k === 'personal_email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) throw new HttpError(400, 'البريد الشخصي غير صحيح');
  if ((k === 'birth_date' || k === 'id_expiry') && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new HttpError(400, 'صيغة التاريخ غير صحيحة');
  if (k === 'national_id') { v = digits(v); if (!/^[12]\d{9}$/.test(v)) throw new HttpError(400, 'رقم الهوية / الإقامة 10 أرقام يبدأ بـ 1 أو 2'); }
  if (k === 'iban') { v = normIban(v); if (!/^SA\d{22}$/.test(v)) throw new HttpError(400, 'الآيبان غير صحيح — يبدأ بـ SA ويليه 22 رقماً'); }
  if (k === 'emergency_phone') { const p = cleanPhone(v); if (!p) throw new HttpError(400, 'جوال الطوارئ غير صحيح'); v = p; }
  return v;
}
async function store(db, uid, P, by) {
  await db.prepare(`INSERT INTO user_profiles (user_id, data, files, status, confirm, updated_at, updated_by) VALUES (?,?,?,?,?,datetime('now'),?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, files = excluded.files, status = excluded.status, confirm = excluded.confirm, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .bind(uid, JSON.stringify(P.d), JSON.stringify(P.files), JSON.stringify(P.status), JSON.stringify(P.conf), by).run();
}
// الأقسام التي تغيّرت تعود «بانتظار التأكيد»، وتُبلَّغ الإدارة بما صار بانتظارها للتو
async function markPending(db, env, actor, P, secs) {
  const fresh = [];
  for (const s of secs) { if (P.status[s] !== 'pending') fresh.push(s); P.status[s] = 'pending'; delete P.conf[s]; }
  if (fresh.length) {
    const req = required(P);
    const ready = fresh.filter((s) => secState(P, s, req) !== 'missing');
    if (ready.length) await notifyRoles(db, env, BOSS, `🪪 ${P.u.name} حدّث ${ready.map((s) => '«' + SECTIONS[s].label + '»').join(' و')} في ملفه الشخصي — بانتظار التأكيد`,
      { kind: 'general', link: `#/me/${P.u.id}`, title: `ملف ${P.u.name} بانتظار التأكيد` }, actor.id);
  }
}
async function save(db, env, actor, uid, d) {
  const P = await load(db, uid);
  const changed = new Set();
  // التحقق من كل القيم أولاً — لا يُحفظ شيء إن كان أي حقل غير صالح
  const vals = {};
  for (const k of Object.keys(FIELD_SEC)) if (d[k] !== undefined) vals[k] = validate(k, d[k]);
  const n = d.name !== undefined ? str(d.name, 120) : undefined;
  if (n !== undefined && !n) return bad('الاسم مطلوب');
  const p = d.phone !== undefined ? (d.phone ? cleanPhone(d.phone) : null) : undefined;
  if (d.phone && !p) return bad('رقم الجوال غير صحيح — مثال: 05xxxxxxxx');
  // حقول جدول users: الاسم والجوال (والمسمى للمدير العام فقط)
  if (n !== undefined && n !== P.u.name) { await db.prepare('UPDATE users SET name = ? WHERE id = ?').bind(n, uid).run(); P.u.name = n; changed.add('personal'); }
  if (p !== undefined && (p || null) !== (P.u.phone || null)) { await db.prepare('UPDATE users SET phone = ? WHERE id = ?').bind(p, uid).run(); P.u.phone = p; changed.add('personal'); }
  if (d.title !== undefined && actor.role === 'admin') await db.prepare('UPDATE users SET title = ? WHERE id = ?').bind(str(d.title, 120) || null, uid).run();
  if (actor.id === uid && (d.notify_wa !== undefined || d.notify_tg !== undefined)) {
    await db.prepare('UPDATE users SET notify_wa = ?, notify_tg = ? WHERE id = ?').bind(d.notify_wa === false ? 0 : 1, d.notify_tg === false ? 0 : 1, uid).run();
  }
  for (const [k, sec] of Object.entries(FIELD_SEC)) {
    if (!(k in vals)) continue;
    const v = vals[k];
    if ((v || null) !== (P.d[k] || null)) { if (v) P.d[k] = v; else delete P.d[k]; changed.add(sec); }
  }
  if (changed.size) await markPending(db, env, actor, P, [...changed]);
  if (changed.size || !P.exists) await store(db, uid, P, actor.id);
  // لا قيم حساسة في سجل التدقيق — أسماء الأقسام فقط
  if (changed.size) await audit(db, actor, 'profile', 'users', uid, 'تحديث: ' + [...changed].map((s) => SECTIONS[s].label).join('، '));
  return json(await view(db, actor, uid, false));
}
async function upload(db, env, actor, uid, d) {
  const kind = String(d.kind || '');
  if (!FILE_KINDS[kind]) return bad('نوع الملف غير معروف');
  if (!d.data || !/^[A-Za-z0-9+/=]+$/.test(d.data)) return bad('ملف غير صالح');
  const size = Math.floor(d.data.length * 3 / 4);
  if (size > 1_400_000) return bad('حجم الملف أكبر من المسموح (1.4MB) — صغّر الصورة');
  const okMime = kind === 'avatar' ? /^image\/(jpeg|png|webp)$/ : /^image\/(jpeg|png|webp)$|^application\/pdf$/;
  if (!okMime.test(d.mime || '')) return bad(kind === 'avatar' ? 'الصورة الشخصية صورة فقط' : 'المسموح صورة أو PDF');
  const name = str(d.name, 120) || kind;
  // الصورة الشخصية عامة داخل المنصة (تظهر في القائمة والفريق)، وما عداها خاص بصاحبه والإدارة والمالية
  const r = await db.prepare('INSERT INTO files (name, mime, size, data, user_id, scope) VALUES (?,?,?,?,?,?)')
    .bind(name, d.mime, size, d.data, actor.id, kind === 'avatar' ? null : `profile:${uid}`).run();
  const fid = r.meta.last_row_id;
  const P = await load(db, uid);
  if (kind === 'avatar') await db.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(fid, uid).run();
  else {
    P.files[kind] = { id: fid, name, mime: d.mime, at: nowIso() };
    if (kind === 'id_front' || kind === 'id_back') await markPending(db, env, actor, P, ['id']);
    await store(db, uid, P, actor.id);
  }
  await audit(db, actor, 'profile_file', 'users', uid, FILE_KINDS[kind]);
  return json({ ok: true, kind, file: { id: fid, name, mime: d.mime }, profile: await view(db, actor, uid, false) });
}
async function confirm(db, env, actor, uid, sec) {
  if (!BOSS.includes(actor.role)) return bad('التأكيد للمدير العام ومدير الخدمات التسويقية', 403);
  if (actor.id === uid && actor.role !== 'admin') return bad('لا يؤكد العضو بياناته بنفسه', 403);
  if (!SECTIONS[sec] && sec !== 'phone') return bad('قسم غير معروف');
  const P = await load(db, uid);
  const stamp = { by: actor.id, by_name: actor.name, at: nowIso() };
  if (sec === 'phone') {
    if (!P.u.phone) return bad('لا يوجد رقم جوال لتأكيده');
    P.conf.phone = { ...stamp, value: P.u.phone };
  } else {
    if (secState(P, sec, required(P)) === 'missing') return bad(`«${SECTIONS[sec].label}» ناقص — لا يمكن تأكيده قبل اكتماله`);
    P.status[sec] = 'ok'; P.conf[sec] = stamp;
    if (sec === 'personal' && P.u.phone) P.conf.phone = { ...stamp, value: P.u.phone };
  }
  await store(db, uid, P, actor.id);
  // ربط الموارد البشرية: سجل الموظف المرتبط بالمستخدم يأخذ البيانات المؤكدة (لا رواتب هنا)
  let hr = 0;
  try {
    if (sec === 'personal' || sec === 'phone') hr = (await db.prepare("UPDATE employees SET phone = COALESCE(?, phone), email = COALESCE(?, email), updated_at = datetime('now') WHERE user_id = ?")
      .bind(P.u.phone || null, P.d.personal_email || P.u.email || null, uid).run()).meta.changes || 0;
    if (sec === 'bank') hr = (await db.prepare("UPDATE employees SET bank_name = ?, iban = ?, updated_at = datetime('now') WHERE user_id = ?").bind(P.d.bank_name || null, P.d.iban || null, uid).run()).meta.changes || 0;
  } catch (e) { console.warn('profile hr mirror', e.message); }
  await audit(db, actor, 'profile_confirm', 'users', uid, sec === 'phone' ? 'الجوال' : SECTIONS[sec].label);
  if (actor.id !== uid) await notifyUser(db, env, uid, `✅ أكّدت الإدارة ${sec === 'phone' ? 'رقم جوالك' : '«' + SECTIONS[sec].label + '»'} في ملفك الشخصي`, null, { kind: 'general', link: '#/me' });
  return json({ ok: true, hr_updated: hr, profile: await view(db, actor, uid, false) });
}
async function pending(db, actor) {
  if (!PRIV.includes(actor.role)) return bad('للإدارة والمالية فقط', 403);
  const { results: users } = await db.prepare('SELECT id, name, title, role, avatar, last_login FROM users WHERE active = 1 ORDER BY name').all();
  const out = [];
  for (const u of users) {
    const P = await load(db, u.id); const req = required(P);
    const states = Object.fromEntries(Object.keys(SECTIONS).map((s) => [s, secState(P, s, req)]));
    const pend = Object.keys(states).filter((s) => states[s] === 'pending');
    out.push({ id: u.id, name: u.name, title: u.title, role: u.role, avatar: u.avatar, never_logged_in: !u.last_login, pct: pctOf(req), pending: pend, states, updated_at: P.updated_at,
      phone_verified: !!(P.u.phone && P.conf.phone?.value === P.u.phone) });
  }
  return json({ rows: out, pending: out.filter((r) => r.pending.length).length, incomplete: out.filter((r) => r.pct < 100).length });
}

export async function profileRoute(db, env, request, user, a, b) {
  if (user.via === 'token') return bad('الملف الشخصي متاح من داخل المنصة فقط', 403);
  const m = request.method.toUpperCase();
  const body = async () => { try { return await request.json(); } catch { throw new HttpError(400, 'بيانات غير صالحة'); } };
  if (!a || a === 'me') {
    if (m === 'GET') return json(await view(db, user, user.id, true));
    if (m === 'POST') return save(db, env, user, user.id, await body());
  }
  if (a === 'upload' && m === 'POST') return upload(db, env, user, user.id, await body());
  if (a === 'pending' && m === 'GET') return pending(db, user);
  if (/^\d+$/.test(a || '')) {
    const uid = Number(a);
    if (!b && m === 'GET') return json(await view(db, user, uid, true));
    if (b === 'confirm' && m === 'POST') return confirm(db, env, user, uid, String((await body()).section || ''));
    if (uid !== user.id && user.role !== 'admin') return bad('تعديل ملف عضو آخر للمدير العام فقط', 403);
    if (!b && m === 'POST') return save(db, env, user, uid, await body());
    if (b === 'upload' && m === 'POST') return upload(db, env, user, uid, await body());
  }
  return bad('مسار غير معروف', 404);
}

// حماية ملفات الملف الشخصي في GET files/<id> و files/<id>/extract
export async function fileAllowed(db, user, id) {
  let sc = null;
  try { sc = await db.prepare('SELECT scope FROM files WHERE id = ?').bind(id).first('scope'); } catch { return true; }
  const m = /^profile:(\d+)$/.exec(sc || '');
  if (!m) return true;
  return Number(m[1]) === user.id || PRIV.includes(user.role);
}

// ======================================================================
// دعوات التفعيل
async function isig(db, base) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(await secret(db)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('invite:' + base));
  return [...new Uint8Array(sig)].slice(0, 12).map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function sha(s) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function graph(env, path, payload) {
  const r = await fetch(`${env.WA_GRAPH_URL || 'https://graph.facebook.com/v23.0'}/${path}`, { method: 'POST', headers: { authorization: `Bearer ${env.WA_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  let d = {}; try { d = await r.json(); } catch { /* */ }
  return { ok: r.ok && !d.error, data: d };
}
const arDate = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? `${+m[3]}/${+m[2]}/${m[1]}` : ''; };
export function welcomeText(name, start) {
  return `أهلاً بك ${firstName(name)} في فريق نُبل وابتكار للتسويق 🌟\nيسعدنا انضمامك إلينا${start ? ` ابتداءً من ${arDate(start)}` : ''}.\n`
    + `فعّل حسابك في منصة الفريق واختر كلمة مرورك بنفسك، ثم أكمل ملفك الشخصي: صورة الهوية ورقمها وتاريخ انتهائها، الآيبان واسم البنك وصاحب الحساب، بريدك الشخصي وجوالك، تاريخ الميلاد، جهة اتصال للطوارئ، وحساباتك على المنصات.\n`
    + `الرابط صالح ${INVITE_HOURS} ساعة ولمرة واحدة.\n🔒 بياناتك سرية ولا يطّلع عليها إلا الإدارة والمالية.`;
}
async function sendInviteWa(db, env, actor, u, text, link) {
  const to = cleanPhone(u.phone);
  if (!to) return { ok: false, error: 'لا يوجد رقم جوال صالح للعضو' };
  if (!env.WA_TOKEN) return { ok: false, error: 'واتساب غير مضبوط' };
  const phoneId = env.WA_PHONE_ID || FROM_PHONE_ID;
  let open = false;
  try { const r = env.WA_DB && await env.WA_DB.prepare("SELECT at FROM wa_events WHERE wa_id = ? AND kind = 'message' ORDER BY id DESC LIMIT 1").bind(to).first(); open = !!(r && Date.now() - Date.parse(String(r.at).replace(' ', 'T') + 'Z') < 23.5 * 3600e3); } catch { /* */ }
  let res, via;
  if (open) { res = await sendText(env, phoneId, to, `${text}\n\n${link}\n\nفريق نُبل وابتكار للتسويق`); via = 'text'; }
  else {
    if (!(await templateReady(db, env))) return { ok: false, error: 'قالب واتساب nubl_client_update غير معتمد بعد' };
    const news = text.split('\n').slice(1).join(' · ').replace(/\s{2,}/g, ' ').slice(0, 900);
    res = await graph(env, `${phoneId}/messages`, { messaging_product: 'whatsapp', to, type: 'template',
      template: { name: 'nubl_client_update', language: { code: 'ar' }, components: [{ type: 'body', parameters: [firstName(u.name) || 'زميلنا', `أهلاً بك في فريق نُبل وابتكار للتسويق · ${news}`, link].map((t) => ({ type: 'text', text: t })) }] } });
    via = 'template';
  }
  const ok = res && res.ok && res.data?.messages?.[0];
  const error = ok ? null : String(res?.data?.error?.message || res?.error || 'تعذّر الإرسال').slice(0, 300);
  // يظهر في صندوق واتساب (بلا الرابط: الرابط مفتاح دخول لمرة واحدة)
  try { await env.WA_DB?.prepare('INSERT INTO wa_events (dept, wa_id, kind, msg_id, text, reply, status, detail) VALUES (?,?,?,?,?,?,?,?)')
    .bind('marketing', to, 'staff', ok ? res.data.messages[0].id : null, null, `${text}\n[رابط التفعيل]`, ok ? 'sent' : 'send_failed', JSON.stringify({ by: actor?.name || 'دعوة تفعيل', mode: via, error, invite_user: u.id })).run(); } catch { /* */ }
  return { ok: !!ok, error, via };
}
// إنشاء دعوة جديدة (تُلغي أي دعوة سابقة غير مستعملة) وإرسالها واتساب عند send
export async function createInvite(db, env, actor, uid, { send = true } = {}) {
  const u = await db.prepare('SELECT id, name, email, phone, active, last_login, must_change FROM users WHERE id = ?').bind(uid).first();
  if (!u) throw new HttpError(404, 'المستخدم غير موجود');
  if (!u.active) throw new HttpError(400, 'العضو موقوف — فعّله أولاً');
  if (u.last_login && !u.must_change) throw new HttpError(400, 'العضو فعّل حسابه ودخل من قبل — استعمل «كلمة مرور مؤقتة» إن نسي كلمته');
  await db.prepare("UPDATE user_invites SET revoked_at = datetime('now') WHERE user_id = ? AND used_at IS NULL AND revoked_at IS NULL").bind(uid).run();
  const exp = new Date(Date.now() + INVITE_HOURS * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const r = await db.prepare('INSERT INTO user_invites (user_id, token_hash, expires_at, created_by) VALUES (?,?,?,?)').bind(uid, '-', exp, actor.id).run();
  const iid = r.meta.last_row_id;
  const key = `${iid}.${await isig(db, `${iid}.${uid}.${exp}`)}`;
  await db.prepare('UPDATE user_invites SET token_hash = ? WHERE id = ?').bind(await sha(key), iid).run();
  const link = `${SITE}/marketing/hub/activate#${key}`;
  let start = null;
  try { start = await db.prepare("SELECT start_date FROM employees WHERE user_id = ? AND start_date IS NOT NULL ORDER BY id DESC LIMIT 1").bind(uid).first('start_date'); } catch { /* */ }
  const text = welcomeText(u.name, start);
  let sent = { ok: false, error: null, via: null };
  if (send) {
    sent = await sendInviteWa(db, env, actor, u, text, link);
    await db.prepare("UPDATE user_invites SET sent_via = ?, sent_error = ?, sent_at = CASE WHEN ? THEN datetime('now') END WHERE id = ?").bind(sent.via || null, sent.error, sent.ok ? 1 : 0, iid).run();
  }
  await audit(db, actor, 'invite', 'users', uid, send ? (sent.ok ? `واتساب (${sent.via})` : `لم يُرسل: ${sent.error || ''}`) : 'رابط للنسخ');
  return { link, expires_at: exp, sent: sent.ok, via: sent.via, error: sent.error, has_phone: !!cleanPhone(u.phone), text };
}
export async function inviteStatus(db, uid) {
  const r = await db.prepare('SELECT id, expires_at, used_at, revoked_at, sent_at, sent_via, sent_error, created_at FROM user_invites WHERE user_id = ? ORDER BY id DESC LIMIT 1').bind(uid).first();
  const u = await db.prepare('SELECT last_login, must_change, phone FROM users WHERE id = ?').bind(uid).first();
  return { last: r || null, never_logged_in: !u?.last_login, must_change: !!u?.must_change, has_phone: !!cleanPhone(u?.phone) };
}

// الصفحة العامة: GET public/activate/<key> · POST public/activate/<key> {password}
export async function publicActivate(db, env, request, key) {
  const m = /^(\d+)\.([0-9a-f]{24})$/.exec(String(key || ''));
  if (!m) return bad('رابط التفعيل غير صالح', 404);
  const row = await db.prepare('SELECT * FROM user_invites WHERE id = ?').bind(m[1]).first();
  if (!row || row.token_hash !== await sha(key) || m[2] !== await isig(db, `${row.id}.${row.user_id}.${row.expires_at}`)) return bad('رابط التفعيل غير صالح', 404);
  if (row.used_at) return bad('استُخدم هذا الرابط من قبل — ادخل بكلمة مرورك، أو اطلب من الإدارة دعوة جديدة', 410);
  if (row.revoked_at) return bad('أُلغي هذا الرابط وأُرسلت دعوة أحدث — استعمل آخر رسالة وصلتك', 410);
  if (row.expires_at < nowIso()) return bad(`انتهت صلاحية الرابط (${INVITE_HOURS} ساعة) — اطلب من الإدارة إعادة إرسال الدعوة`, 410);
  const u = await db.prepare('SELECT id, name, email, role, active FROM users WHERE id = ?').bind(row.user_id).first();
  if (!u || !u.active) return bad('الحساب غير نشط — تواصل مع الإدارة', 410);
  if (request.method === 'GET') return json({ ok: true, name: u.name, first: firstName(u.name), email: u.email, expires_at: row.expires_at });
  if (request.method !== 'POST') return bad('طريقة غير مدعومة', 405);
  let d = {}; try { d = await request.json(); } catch { /* */ }
  const pw = String(d.password || '');
  if (pw.length < 8) return bad('كلمة المرور 8 أحرف على الأقل');
  if (pw.length > 128) return bad('كلمة المرور طويلة جداً');
  const used = await db.prepare("UPDATE user_invites SET used_at = datetime('now') WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL").bind(row.id).run();
  if (!used.meta.changes) return bad('استُخدم هذا الرابط من قبل', 410);
  const h = await hashPassword(pw);
  await db.prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, must_change = 0 WHERE id = ?').bind(h.hash, h.salt, u.id).run();
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(u.id).run();
  const token = await createSession(db, u.id);
  await audit(db, u, 'activate', 'users', u.id, 'تفعيل الحساب من رابط الدعوة');
  await notifyRoles(db, env, BOSS, `🎉 فعّل ${u.name} حسابه في المنصة وبدأ إكمال ملفه الشخصي`, { kind: 'general', link: `#/me/${u.id}` }, u.id);
  return json({ ok: true, redirect: '/marketing/hub/#/me/welcome' }, 200, { 'set-cookie': sessionCookie(token) });
}
