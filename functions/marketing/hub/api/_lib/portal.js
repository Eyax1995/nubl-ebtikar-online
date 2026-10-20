// بوابات الشركاء: المندوب (/marketing/rep/) والعميل (/marketing/client/) — الدخول برمز تحقق على واتساب
// المسارات العامة: POST portal/otp {kind,phone} · POST portal/verify {kind,phone,code} · POST portal/logout · GET portal/me
// ثم portal/rep/* (portal_rep.js) و portal/client/* (portal_client.js) بجلسة البوابة فقط — لا علاقة لها بجلسات الموظفين.
// الجداول تُنشأ هنا عند أول طلب (لا تمر بـ MIGRATIONS في schema.js).
// إرسال الرمز: نافذة الـ24 ساعة مفتوحة → نص حر · وإلا قالب المصادقة nubl_login_code (يُنشأ تلقائياً لدى Meta عند أول حاجة)
//              · وإلى أن يُعتمد القالب: جسر الإشعارات (قالب nubl_team_alert الخدمي).
import { json, bad, randomToken, getCookie, getSettings } from './core.js';
import { waBridge } from './telegram.js';
import { sendText } from '../../../../wa/_lib/engine.js';
import { repPortalRoute } from './portal_rep.js';
import { clientPortalRoute } from './portal_client.js';

export const PCOOKIE = 'np_s';
const SESSION_DAYS = 30;
const CODE_MIN = 10;
const FROM_PHONE_ID = '1368158866379375'; // رقم التسويق 0563413040
const WABA_ID = '1686695736383983';
const GRAPH = 'https://graph.facebook.com/v23.0';
const OTP_TPL = 'nubl_login_code';
const KINDS = { rep: 'بوابة المندوب', client: 'بوابة العميل' };

const enc = new TextEncoder();
export async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function normPhone(p) {
  let d = String(p || '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (/^05\d{8}$/.test(d)) d = '966' + d.slice(1);
  if (/^5\d{8}$/.test(d)) d = '966' + d;
  return /^\d{10,15}$/.test(d) ? d : '';
}
export async function pbody(request) { try { return await request.json(); } catch { return {}; } }
export const clip = (s, n) => String(s ?? '').trim().slice(0, n);

let READY = false;
async function ensure(db) {
  if (READY) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS portal_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, phone TEXT, code_hash TEXT,
      expires_at TEXT, tries INTEGER DEFAULT 0, used INTEGER DEFAULT 0, ip TEXT, created_at TEXT DEFAULT (datetime('now')))`),
    db.prepare('CREATE INDEX IF NOT EXISTS ix_portal_codes ON portal_codes(phone, kind, id)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS portal_sessions (token_hash TEXT PRIMARY KEY, kind TEXT NOT NULL, phone TEXT, ref_id INTEGER,
      expires_at TEXT, last_seen TEXT, created_at TEXT DEFAULT (datetime('now')))`),
    // طلبات الشركاء: طلب صرف، تحديث بنكي، طلب/ملاحظة عميل، إثبات سداد، رد على عرض أو منشور
    db.prepare(`CREATE TABLE IF NOT EXISTS portal_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, ref_id INTEGER, type TEXT,
      subject TEXT, body TEXT, entity TEXT, entity_id INTEGER, file_id INTEGER, status TEXT DEFAULT 'جديد', handled_by INTEGER, handled_at TEXT,
      created_at TEXT DEFAULT (datetime('now')))`),
    db.prepare('CREATE INDEX IF NOT EXISTS ix_portal_req ON portal_requests(kind, ref_id)'),
  ]);
  READY = true;
}

// الحسابات المطابقة للجوال (تُقارن آخر 9 أرقام ثم الصيغة الكاملة لأن الأرقام القديمة قد تكون محفوظة بصيغ مختلفة)
export async function accountsFor(db, kind, phone) {
  const last9 = phone.slice(-9);
  const sql = kind === 'rep'
    ? "SELECT id, name, phone FROM reps WHERE status != 'موقوف' AND replace(replace(replace(phone,' ',''),'-',''),'+','') LIKE ?"
    : "SELECT id, name, phone FROM clients WHERE replace(replace(replace(phone,' ',''),'-',''),'+','') LIKE ? ORDER BY id";
  const { results } = await db.prepare(sql).bind('%' + last9).all();
  return results.filter((r) => normPhone(r.phone) === phone).map(({ id, name }) => ({ id, name }));
}

// ---------- إرسال الرمز ----------
async function windowOpen(env, to) {
  if (!env.WA_DB) return false;
  try {
    const r = await env.WA_DB.prepare("SELECT at FROM wa_events WHERE wa_id = ? AND kind = 'message' ORDER BY id DESC LIMIT 1").bind(to).first();
    return !!(r && Date.now() - Date.parse(String(r.at).replace(' ', 'T') + 'Z') < 23.5 * 3600e3);
  } catch { return false; }
}
const graph = (env, path, body) => fetch(`${env.WA_GRAPH_URL || GRAPH}/${path}`, {
  method: body ? 'POST' : 'GET',
  headers: { authorization: 'Bearer ' + env.WA_TOKEN, ...(body ? { 'content-type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined,
}).then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) })).catch((e) => ({ ok: false, data: { error: { message: e.message } } }));
const setSetting = (db, k, v) => db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(k, v).run();

// حالة قالب المصادقة — تُفحص كل 30 دقيقة كحد أقصى، ويُطلب إنشاؤه من Meta مرة واحدة إن لم يوجد
async function otpTemplateReady(db, env) {
  const s = await getSettings(db);
  if (s.portal_otp_tpl === 'APPROVED') return true;
  if (s.portal_otp_tpl_at && Date.now() - Date.parse(s.portal_otp_tpl_at) < 30 * 60e3) return false;
  let status = 'MISSING';
  const r = await graph(env, `${WABA_ID}/message_templates?name=${OTP_TPL}&fields=name,status,language`);
  const row = (r.data.data || []).find((t) => t.name === OTP_TPL);
  if (row) status = row.status;
  else if (r.ok) {
    const c = await graph(env, `${WABA_ID}/message_templates`, {
      name: OTP_TPL, language: 'ar', category: 'AUTHENTICATION',
      components: [
        { type: 'BODY', add_security_recommendation: true },
        { type: 'FOOTER', code_expiration_minutes: CODE_MIN },
        { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: 'نسخ الرمز' }] },
      ],
    });
    status = c.ok ? (c.data.status || 'PENDING') : 'CREATE_FAILED: ' + String(c.data?.error?.error_user_msg || c.data?.error?.message || '').slice(0, 200);
  }
  await setSetting(db, 'portal_otp_tpl', status);
  await setSetting(db, 'portal_otp_tpl_at', new Date().toISOString());
  return status === 'APPROVED';
}

async function sendCode(db, env, to, code, kind, name) {
  const text = `رمز الدخول إلى ${KINDS[kind]} — نُبل وابتكار للتسويق: ${code}\nصالح ${CODE_MIN} دقائق. لا تشاركه مع أي أحد، وفريقنا لن يطلبه منك.`;
  if (!env.WA_TOKEN) return { ok: false, via: 'none' };
  if (await windowOpen(env, to)) {
    const r = await sendText(env, env.WA_PHONE_ID || FROM_PHONE_ID, to, text);
    if (r.ok) return { ok: true, via: 'text' };
  }
  if (await otpTemplateReady(db, env)) {
    const r = await graph(env, `${env.WA_PHONE_ID || FROM_PHONE_ID}/messages`, {
      messaging_product: 'whatsapp', to, type: 'template',
      template: { name: OTP_TPL, language: { code: 'ar' }, components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
      ] },
    });
    if (r.ok && r.data.messages) return { ok: true, via: 'auth_template' };
  }
  // مؤقت إلى أن يعتمد Meta قالب المصادقة
  const b = await waBridge(db, { to, name, kind: 'auth', title: `رمز الدخول ${code}`, body: `${KINDS[kind]} · صالح ${CODE_MIN} دقائق · لا تشاركه مع أحد`,
    summary: `رمز الدخول ${code} — ${KINDS[kind]}، صالح ${CODE_MIN} دقائق`, link: '' });
  return { ok: !!b.ok, via: 'bridge' };
}

// ---------- الجلسة ----------
const cookie = (tok, maxAge) => `${PCOOKIE}=${tok}; Path=/marketing; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
export async function portalSession(db, request) {
  const tok = getCookie(request, PCOOKIE);
  if (!tok || !/^[a-f0-9]{64}$/.test(tok)) return null;
  const s = await db.prepare('SELECT * FROM portal_sessions WHERE token_hash = ?').bind(await sha256(tok)).first();
  if (!s || s.expires_at < new Date().toISOString()) return null;
  // الحساب ما زال مطابقاً للجوال؟ (إيقاف المندوب أو تغيير جوال العميل يُنهي الوصول فوراً)
  const accounts = await accountsFor(db, s.kind, s.phone);
  if (!accounts.some((a) => a.id === s.ref_id)) return null;
  if (!s.last_seen || Date.now() - Date.parse(s.last_seen) > 3600e3) await db.prepare('UPDATE portal_sessions SET last_seen = ? WHERE token_hash = ?').bind(new Date().toISOString(), s.token_hash).run();
  return { ...s, accounts };
}

export async function portalRoute(db, env, request, parts) {
  await ensure(db);
  const method = request.method.toUpperCase();
  const [, a] = parts; // portal/<a>/...
  const ip = request.headers.get('cf-connecting-ip') || '';

  if (a === 'otp' && method === 'POST') {
    const d = await pbody(request);
    const kind = KINDS[d.kind] ? d.kind : null; const phone = normPhone(d.phone);
    if (!kind) return bad('بوابة غير معروفة');
    if (!phone) return bad('اكتب رقم الجوال مثل 05XXXXXXXX');
    const generic = { ok: true, msg: 'إن كان الرقم مسجلاً لدينا فسيصلك رمز الدخول على واتساب خلال لحظات.' };
    const recent = await db.prepare("SELECT COUNT(*) AS n FROM portal_codes WHERE phone = ? AND created_at >= datetime('now','-15 minutes')").bind(phone).first('n');
    const daily = await db.prepare("SELECT COUNT(*) AS n FROM portal_codes WHERE phone = ? AND created_at >= datetime('now','-1 day')").bind(phone).first('n');
    const byIp = ip ? await db.prepare("SELECT COUNT(*) AS n FROM portal_codes WHERE ip = ? AND created_at >= datetime('now','-1 hour')").bind(ip).first('n') : 0;
    if (recent >= 3 || daily >= 10 || byIp >= 12) return bad('طلبات كثيرة — انتظر قليلاً ثم أعد المحاولة', 429);
    const accounts = await accountsFor(db, kind, phone);
    // نسجّل المحاولة حتى للأرقام غير المسجلة (يحدّ من تجربة الأرقام) ولا نكشف هل الرقم مسجّل
    const a8 = new Uint32Array(1); crypto.getRandomValues(a8);
    const code = String(100000 + (a8[0] % 900000));
    const exp = new Date(Date.now() + CODE_MIN * 60e3).toISOString();
    await db.prepare('INSERT INTO portal_codes (kind, phone, code_hash, expires_at, ip) VALUES (?,?,?,?,?)')
      .bind(kind, phone, accounts.length ? await sha256(`${kind}:${phone}:${code}`) : 'x', exp, ip).run();
    if (!accounts.length) return json(generic);
    const sent = await sendCode(db, env, phone, code, kind, accounts[0].name);
    if (!sent.ok) return bad('تعذّر إرسال الرمز الآن — حاول بعد دقيقة أو تواصل مع فريقنا', 502);
    return json(generic);
  }

  if (a === 'verify' && method === 'POST') {
    const d = await pbody(request);
    const kind = KINDS[d.kind] ? d.kind : null; const phone = normPhone(d.phone); const code = String(d.code || '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\D/g, '');
    if (!kind || !phone || code.length !== 6) return bad('أدخل الرمز المكوّن من 6 أرقام');
    const row = await db.prepare('SELECT * FROM portal_codes WHERE phone = ? AND kind = ? AND used = 0 ORDER BY id DESC LIMIT 1').bind(phone, kind).first();
    if (!row || row.expires_at < new Date().toISOString()) return bad('انتهت صلاحية الرمز — اطلب رمزاً جديداً', 400);
    if (row.tries >= 5) return bad('محاولات كثيرة — اطلب رمزاً جديداً', 429);
    if (row.code_hash !== await sha256(`${kind}:${phone}:${code}`)) {
      await db.prepare('UPDATE portal_codes SET tries = tries + 1 WHERE id = ?').bind(row.id).run();
      return bad(`الرمز غير صحيح — تبقّت ${Math.max(0, 4 - row.tries)} محاولات`, 400);
    }
    await db.prepare('UPDATE portal_codes SET used = 1 WHERE id = ?').bind(row.id).run();
    const accounts = await accountsFor(db, kind, phone);
    if (!accounts.length) return bad('لم يعد هذا الرقم مرتبطاً بحساب', 403);
    const tok = randomToken(32);
    await db.prepare('INSERT INTO portal_sessions (token_hash, kind, phone, ref_id, expires_at, last_seen) VALUES (?,?,?,?,?,?)')
      .bind(await sha256(tok), kind, phone, accounts[0].id, new Date(Date.now() + SESSION_DAYS * 86400e3).toISOString(), new Date().toISOString()).run();
    await db.prepare("DELETE FROM portal_sessions WHERE expires_at < ?").bind(new Date().toISOString()).run();
    return json({ ok: true, kind }, 200, { 'set-cookie': cookie(tok, SESSION_DAYS * 86400) });
  }

  if (a === 'logout' && method === 'POST') {
    const tok = getCookie(request, PCOOKIE);
    if (tok) await db.prepare('DELETE FROM portal_sessions WHERE token_hash = ?').bind(await sha256(tok)).run();
    return json({ ok: true }, 200, { 'set-cookie': cookie('', 0) });
  }

  const ses = await portalSession(db, request);
  if (!ses) return bad('سجّل الدخول برقم جوالك', 401);

  if (a === 'me' && method === 'GET') return json({ kind: ses.kind, ref_id: ses.ref_id, accounts: ses.accounts });
  // التبديل بين أكثر من حساب على الجوال نفسه (عميل لديه أكثر من نشاط)
  if (a === 'switch' && method === 'POST') {
    const d = await pbody(request); const id = Number(d.id);
    if (!ses.accounts.some((x) => x.id === id)) return bad('حساب غير مرتبط بجوالك', 403);
    await db.prepare('UPDATE portal_sessions SET ref_id = ? WHERE token_hash = ?').bind(id, ses.token_hash).run();
    return json({ ok: true });
  }
  if (a === 'rep' && ses.kind === 'rep') return repPortalRoute(db, env, request, ses, parts.slice(2));
  if (a === 'client' && ses.kind === 'client') return clientPortalRoute(db, env, request, ses, parts.slice(2));
  return bad('غير متاح لهذه البوابة', 403);
}

// سجل طلبات الشركاء (يُستخدم في البوابتين)
export async function addRequest(db, ses, r) {
  const x = await db.prepare(`INSERT INTO portal_requests (kind, ref_id, type, subject, body, entity, entity_id, file_id) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(ses.kind, ses.ref_id, r.type, r.subject || null, r.body || null, r.entity || null, r.entity_id || null, r.file_id || null).run();
  return x.meta.last_row_id;
}
export const portalLink = (kind) => `https://nubl-ebtikar.online/marketing/${kind === 'rep' ? 'rep' : 'client'}/`;

// ---------- إدارة البوابات من المنصة (جلسة موظف) ----------
// GET portals            طلبات الشركاء حسب الدور · POST portals/handle/:id {status, note} · POST portals/invite {kind, id}
const FIN_TYPES = ['طلب صرف', 'تحديث بنكي', 'إثبات سداد'];
const SEE = { admin: null, manager: null, finance: FIN_TYPES, account: 'client', sales: 'rep' };
export async function portalsAdminRoute(db, env, request, user, a, b) {
  await ensure(db);
  const method = request.method.toUpperCase();
  if (!(user.role in SEE)) return bad('لا تملك صلاحية طلبات البوابات', 403);
  const scope = SEE[user.role];
  const where = Array.isArray(scope) ? `r.type IN (${scope.map(() => '?').join(',')})` : scope ? 'r.kind = ?' : '1=1';
  const args = Array.isArray(scope) ? scope : scope ? [scope] : [];

  if (!a && method === 'GET') {
    const { results } = await db.prepare(`SELECT r.*, CASE r.kind WHEN 'rep' THEN (SELECT name FROM reps WHERE id = r.ref_id) ELSE (SELECT name FROM clients WHERE id = r.ref_id) END AS party,
        u.name AS handler FROM portal_requests r LEFT JOIN users u ON u.id = r.handled_by WHERE ${where} ORDER BY r.status = 'جديد' DESC, r.id DESC LIMIT 300`).bind(...args).all();
    const sessions = await db.prepare("SELECT kind, COUNT(DISTINCT ref_id) AS n FROM portal_sessions WHERE expires_at > ? GROUP BY kind").bind(new Date().toISOString()).all();
    const s = await getSettings(db);
    return json({ rows: results, active: Object.fromEntries(sessions.results.map((x) => [x.kind, x.n])), otp_template: s.portal_otp_tpl || 'لم يُفحص بعد' });
  }
  if (a === 'handle' && b && method === 'POST') {
    const d = await pbody(request);
    const st = ['تمت المعالجة', 'مرفوض', 'جديد'].includes(d.status) ? d.status : 'تمت المعالجة';
    const r = await db.prepare(`UPDATE portal_requests SET status = ?, handled_by = ?, handled_at = datetime('now'), body = CASE WHEN ? != '' THEN COALESCE(body,'') || ? ELSE body END
      WHERE id = ? AND ${where.replace(/r\./g, '')}`).bind(st, user.id, clip(d.note, 500), `\n[رد ${user.name}] ${clip(d.note, 500)}`, b, ...args).run();
    if (!r.meta.changes) return bad('غير موجود', 404);
    return json({ ok: true });
  }
  if (a === 'invite' && method === 'POST') {
    const d = await pbody(request);
    const kind = d.kind === 'rep' ? 'rep' : 'client';
    const okRole = kind === 'rep' ? ['admin', 'manager', 'finance'] : ['admin', 'manager', 'account', 'sales'];
    if (!okRole.includes(user.role)) return bad('لا تملك صلاحية دعوة هذا الطرف', 403);
    const row = await db.prepare(`SELECT id, name, phone${kind === 'client' ? ', contact_name' : ''} FROM ${kind === 'rep' ? 'reps' : 'clients'} WHERE id = ?`).bind(d.id).first();
    if (!row) return bad('غير موجود', 404);
    const to = normPhone(row.phone);
    if (!to) return bad('لا يوجد رقم جوال صالح — أضفه أولاً');
    const link = portalLink(kind);
    const title = kind === 'rep' ? 'بوابة المندوب — نُبل وابتكار للتسويق' : 'بوابتك لدى نُبل وابتكار للتسويق';
    const body = kind === 'rep'
      ? `سجّل عملاءك وتابع صفقاتهم وعمولاتك واطلب صرفها من ${link} — ادخل برقم جوالك هذا ويصلك رمز على واتساب.`
      : `تابع فواتيرك وعروضك وعقودك واعتمد منشوراتك وأرسل طلباتك من ${link} — ادخل برقم جوالك هذا ويصلك رمز على واتساب.`;
    const r = await waBridge(db, { to, name: row.contact_name || row.name, kind: 'info', title, body, summary: `${title} · ${body}`, link });
    await db.prepare('INSERT INTO audit (user_id, action, entity, entity_id, detail) VALUES (?,?,?,?,?)').bind(user.id, 'invite', kind === 'rep' ? 'reps' : 'clients', row.id, r.ok ? 'واتساب' : 'فشل: ' + (r.error || '')).run().catch(() => {});
    if (!r.ok) return bad('تعذّر إرسال الدعوة على واتساب: ' + (r.error || 'الجسر غير متاح') + ` — أرسل الرابط يدوياً: ${link}`, 502);
    return json({ ok: true, link });
  }
  return bad('إجراء غير معروف', 404);
}
