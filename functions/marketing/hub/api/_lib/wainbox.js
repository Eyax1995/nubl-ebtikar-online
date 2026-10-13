// صندوق ردود واتساب «نُبل وابتكار للتسويق» داخل منصة hub
// يقرأ المحادثات من قاعدة المساعد (WA_DB) ويرسل ردود الموظفين من رقم التسويق عبر Cloud API.
// المسارات: GET wa/threads · GET wa/thread/<wa_id> · POST wa/send/<wa_id> {text} · POST wa/bot/<wa_id> {on}
// GET wa/templates · POST wa/start {to,name,template,lang,params} · GET|POST wa/profile · POST wa/photo {data,type}
import { json, bad } from './core.js';

const DEPT = 'marketing';
const DEFAULT_PHONE_ID = '1368158866379375'; // رقم التسويق 0563413040 على الحساب الموثّق
const GRAPH = 'https://graph.facebook.com/v23.0';
const ROLES_OK = ['admin', 'manager', 'sales', 'account'];
const ROLES_ADMIN = ['admin', 'manager'];       // إعدادات الملف التجاري
const WABA_ID = '1686695736383983';
const APP_ID = '1399023689070366';
const VERTICALS = ['PROF_SERVICES', 'OTHER', 'RETAIL', 'EDU', 'EVENT_PLAN', 'FINANCE', 'APPAREL', 'BEAUTY', 'ENTERTAIN', 'GROCERY', 'HEALTH', 'HOTEL', 'NONPROFIT', 'RESTAURANT', 'TRAVEL', 'AUTO'];
const STAFF_PAUSE_H = 12;   // بعد رد الموظف يصمت الرد الآلي لهذه المحادثة
const MANUAL_OFF_D = 30;    // إيقاف يدوي للرد الآلي

const cleanId = (s) => String(s || '').replace(/\D/g, '').slice(0, 20);
// 05xxxxxxxx أو 5xxxxxxxx أو 9665… أو رقم دولي → صيغة واتساب
function normPhone(s) {
  let p = String(s || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1); else if (p.startsWith('00')) p = p.slice(2);
  if (/^05\d{8}$/.test(p)) p = '966' + p.slice(1);
  else if (/^5\d{8}$/.test(p)) p = '966' + p;
  return /^\d{10,15}$/.test(p) ? p : '';
}
const graph = (env, path, opts = {}) => fetch(`${GRAPH}/${path}`, {
  ...opts, headers: { authorization: 'Bearer ' + env.WA_TOKEN, ...(opts.body && typeof opts.body === 'string' ? { 'content-type': 'application/json' } : {}), ...(opts.headers || {}) },
}).then(async (r) => ({ ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) }));
const gErr = (r) => (r.data && r.data.error && (r.data.error.error_user_msg || r.data.error.message)) || `HTTP ${r.status}`;

export async function waInboxRoute(env, request, user, sub, id) {
  if (!ROLES_OK.includes(user.role)) return bad('لا تملك صلاحية صندوق واتساب', 403);
  if (!env.WA_DB) return bad('قاعدة واتساب غير مربوطة (WA_DB)', 503);
  const db = env.WA_DB;
  const method = request.method.toUpperCase();

  if (sub === 'threads' && method === 'GET') {
    const rows = (await db.prepare(
      `SELECT e.wa_id, MAX(e.id) AS last_id, MAX(e.at) AS last_at,
              SUM(CASE WHEN e.kind='message' THEN 1 ELSE 0 END) AS n_in
         FROM wa_events e WHERE e.dept = ? AND e.wa_id IS NOT NULL AND e.wa_id <> ''
        GROUP BY e.wa_id ORDER BY last_id DESC LIMIT 200`).bind(DEPT).all()).results || [];
    const out = [];
    for (const r of rows) {
      const last = await db.prepare('SELECT kind, text, reply FROM wa_events WHERE id = ?').bind(r.last_id).first();
      const s = await db.prepare('SELECT customer_name, handoff_until FROM wa_sessions WHERE session_key = ?').bind(DEPT + ':' + r.wa_id).first();
      const lastIn = await db.prepare(`SELECT at FROM wa_events WHERE dept=? AND wa_id=? AND kind='message' ORDER BY id DESC LIMIT 1`).bind(DEPT, r.wa_id).first();
      out.push({
        wa_id: r.wa_id, name: (s && s.customer_name) || '', last_at: r.last_at, n_in: r.n_in,
        last_kind: last && last.kind, last_text: last ? (last.kind === 'reply' || last.kind === 'staff' ? (last.reply || last.text) : last.text) : '',
        last_customer_at: lastIn ? lastIn.at : null,
        bot_paused_until: (s && s.handoff_until) || '',
      });
    }
    return json({ threads: out, now: new Date().toISOString() });
  }

  if (sub === 'templates' && method === 'GET') {
    if (!env.WA_TOKEN) return bad('توكن واتساب غير مضبوط', 503);
    const r = await graph(env, `${WABA_ID}/message_templates?fields=name,status,category,language,components&limit=100`);
    if (!r.ok) return bad('تعذّر جلب القوالب: ' + gErr(r), 502);
    const all = (r.data.data || []).map((t) => {
      const body = (t.components || []).find((c) => c.type === 'BODY') || {};
      const btns = ((t.components || []).find((c) => c.type === 'BUTTONS') || {}).buttons || [];
      const n = Math.max(0, ...[...String(body.text || '').matchAll(/\{\{(\d+)\}\}/g)].map((m) => +m[1]));
      return { name: t.name, status: t.status, category: t.category, lang: t.language, text: body.text || '', params: n, buttons: btns.map((b) => b.text) };
    });
    return json({ templates: all.filter((t) => t.status === 'APPROVED'), pending: all.filter((t) => t.status !== 'APPROVED').map((t) => ({ name: t.name, status: t.status })) });
  }

  if (sub === 'start' && method === 'POST') {
    if (!env.WA_TOKEN) return bad('توكن واتساب غير مضبوط', 503);
    let b = {}; try { b = await request.json(); } catch { /* */ }
    const to = normPhone(b.to);
    if (!to) return bad('رقم الجوال غير صالح — اكتبه مثل 05XXXXXXXX أو بالصيغة الدولية', 400);
    const tpl = String(b.template || '').replace(/[^a-z0-9_]/g, '');
    if (!tpl) return bad('اختر قالباً معتمداً', 400);
    const lang = String(b.lang || 'ar').replace(/[^A-Za-z_]/g, '') || 'ar';
    const params = (Array.isArray(b.params) ? b.params : []).map((x) => String(x || '').replace(/[\n\t]+/g, ' ').replace(/ {5,}/g, '    ').trim().slice(0, 900));
    if (params.some((x) => !x)) return bad('املأ كل حقول القالب', 400);
    const msg = { messaging_product: 'whatsapp', to, type: 'template', template: { name: tpl, language: { code: lang } } };
    if (params.length) msg.template.components = [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }];
    const r = await graph(env, `${env.WA_PHONE_ID || DEFAULT_PHONE_ID}/messages`, { method: 'POST', body: JSON.stringify(msg) });
    const ok = r.ok && r.data.messages && r.data.messages[0];
    const rendered = String(b.preview || '').slice(0, 4000) || `[قالب ${tpl}] ${params.join(' · ')}`;
    await db.prepare(`INSERT INTO wa_events (dept, wa_id, kind, msg_id, text, reply, status, detail) VALUES (?,?,?,?,?,?,?,?)`)
      .bind(DEPT, to, 'staff', ok ? r.data.messages[0].id : null, null, rendered, ok ? 'sent' : 'send_failed',
        JSON.stringify({ by: user.name, template: tpl, error: ok ? null : gErr(r) }).slice(0, 1500)).run();
    if (!ok) return bad('تعذّر الإرسال: ' + gErr(r), 502);
    const name = String(b.name || '').trim().slice(0, 80);
    await mergeIntoSession(db, DEPT + ':' + to, to, { r: 'staff', t: rendered, at: new Date().toISOString() },
      new Date(Date.now() + STAFF_PAUSE_H * 3600e3).toISOString(), true, name);
    return json({ ok: true, wa_id: to });
  }

  if (sub === 'profile' || sub === 'photo') {
    if (!ROLES_ADMIN.includes(user.role)) return bad('إعدادات واتساب للمدير فقط', 403);
    if (!env.WA_TOKEN) return bad('توكن واتساب غير مضبوط', 503);
    const phoneId = env.WA_PHONE_ID || DEFAULT_PHONE_ID;
    if (sub === 'profile' && method === 'GET') {
      const [p, n] = await Promise.all([
        graph(env, `${phoneId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`),
        graph(env, `${phoneId}?fields=verified_name,name_status,display_phone_number,quality_rating,messaging_limit_tier`),
      ]);
      if (!p.ok) return bad('تعذّر جلب الملف التجاري: ' + gErr(p), 502);
      return json({ profile: (p.data.data || [])[0] || {}, phone: n.data || {}, verticals: VERTICALS });
    }
    if (sub === 'profile' && method === 'POST') {
      let b = {}; try { b = await request.json(); } catch { /* */ }
      const body = { messaging_product: 'whatsapp' };
      const lim = { about: 139, description: 512, address: 256, email: 128 };
      for (const k of Object.keys(lim)) if (b[k] !== undefined) body[k] = String(b[k] || '').trim().slice(0, lim[k]);
      if (body.about === '') return bad('«النبذة» لا يمكن أن تكون فارغة', 400);
      if (b.websites !== undefined) body.websites = (Array.isArray(b.websites) ? b.websites : []).map((x) => String(x).trim()).filter((x) => /^https?:\/\//.test(x)).slice(0, 2);
      if (b.vertical !== undefined) { if (!VERTICALS.includes(b.vertical)) return bad('تصنيف غير معروف', 400); body.vertical = b.vertical; }
      const r = await graph(env, `${phoneId}/whatsapp_business_profile`, { method: 'POST', body: JSON.stringify(body) });
      if (!r.ok) return bad('لم يُحفظ: ' + gErr(r), 502);
      return json({ ok: true });
    }
    if (sub === 'photo' && method === 'POST') {
      let b = {}; try { b = await request.json(); } catch { /* */ }
      const type = b.type === 'image/png' ? 'image/png' : b.type === 'image/jpeg' ? 'image/jpeg' : '';
      if (!type) return bad('الصورة يجب أن تكون JPG أو PNG', 400);
      let bytes; try { bytes = Uint8Array.from(atob(String(b.data || '')), (c) => c.charCodeAt(0)); } catch { return bad('ملف غير صالح', 400); }
      if (!bytes.length || bytes.length > 5 * 1024 * 1024) return bad('حجم الصورة يجب ألا يتجاوز 5 ميجابايت', 400);
      const s1 = await graph(env, `${env.META_APP_ID || APP_ID}/uploads?file_name=profile.${type === 'image/png' ? 'png' : 'jpg'}&file_length=${bytes.length}&file_type=${encodeURIComponent(type)}`, { method: 'POST' });
      if (!s1.ok || !s1.data.id) return bad('تعذّر بدء الرفع: ' + gErr(s1), 502);
      const up = await fetch(`${GRAPH}/${s1.data.id}`, { method: 'POST', headers: { authorization: 'OAuth ' + env.WA_TOKEN, file_offset: '0' }, body: bytes });
      const ud = await up.json().catch(() => ({}));
      if (!up.ok || !ud.h) return bad('تعذّر رفع الصورة: ' + ((ud.error && ud.error.message) || up.status), 502);
      const r = await graph(env, `${phoneId}/whatsapp_business_profile`, { method: 'POST', body: JSON.stringify({ messaging_product: 'whatsapp', profile_picture_handle: ud.h }) });
      if (!r.ok) return bad('لم تُعتمد الصورة: ' + gErr(r), 502);
      return json({ ok: true });
    }
  }

  const waId = cleanId(id);
  if (!waId) return bad('رقم غير صالح', 400);
  const key = DEPT + ':' + waId;

  if (sub === 'thread' && method === 'GET') {
    const ev = (await db.prepare(
      `SELECT id, at, kind, text, reply, status, detail FROM wa_events WHERE dept = ? AND wa_id = ? ORDER BY id DESC LIMIT 300`)
      .bind(DEPT, waId).all()).results || [];
    const msgs = ev.reverse().filter((e) => ['message', 'reply', 'staff', 'echo'].includes(e.kind)).map((e) => {
      let by = '';
      if (e.kind === 'staff') { try { by = (JSON.parse(e.detail || '{}').by) || ''; } catch { /* */ } }
      return {
        id: e.id, at: e.at, from: e.kind === 'message' ? 'customer' : e.kind === 'reply' ? 'bot' : 'staff',
        text: e.kind === 'reply' || e.kind === 'staff' ? (e.reply || e.text || '') : (e.text || ''),
        status: e.status, by,
      };
    });
    const s = await db.prepare('SELECT customer_name, handoff_until FROM wa_sessions WHERE session_key = ?').bind(key).first();
    const lastIn = [...msgs].reverse().find((m) => m.from === 'customer');
    return json({
      wa_id: waId, name: (s && s.customer_name) || '', bot_paused_until: (s && s.handoff_until) || '',
      window_open: !!(lastIn && Date.now() - Date.parse(lastIn.at.replace(' ', 'T') + 'Z') < 24 * 3600e3),
      messages: msgs,
    });
  }

  if (sub === 'send' && method === 'POST') {
    let b = {}; try { b = await request.json(); } catch { /* */ }
    const text = String(b.text || '').trim().slice(0, 4000);
    if (!text) return bad('اكتب نص الرد', 400);
    if (!env.WA_TOKEN) return bad('توكن واتساب غير مضبوط', 503);
    const lastIn = await db.prepare(`SELECT at FROM wa_events WHERE dept=? AND wa_id=? AND kind='message' ORDER BY id DESC LIMIT 1`).bind(DEPT, waId).first();
    if (!lastIn || Date.now() - Date.parse(String(lastIn.at).replace(' ', 'T') + 'Z') >= 24 * 3600e3) {
      return bad('مرّ أكثر من 24 ساعة على آخر رسالة من العميل — واتساب لا يسمح بالرد الحر؛ يلزم قالب معتمد.', 409);
    }
    const phoneId = env.WA_PHONE_ID || DEFAULT_PHONE_ID;
    const r = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.WA_TOKEN },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: waId, type: 'text', text: { body: text, preview_url: true } }),
    });
    const d = await r.json().catch(() => ({}));
    const ok = r.ok && d.messages && d.messages[0];
    await db.prepare(`INSERT INTO wa_events (dept, wa_id, kind, msg_id, text, reply, status, detail) VALUES (?,?,?,?,?,?,?,?)`)
      .bind(DEPT, waId, 'staff', ok ? d.messages[0].id : null, null, text, ok ? 'sent' : 'send_failed',
        JSON.stringify({ by: user.name, error: ok ? null : (d.error && d.error.message) || `HTTP ${r.status}` }).slice(0, 1500)).run();
    if (!ok) return bad('تعذّر الإرسال: ' + ((d.error && d.error.message) || r.status), 502);
    await mergeIntoSession(db, key, waId, { r: 'staff', t: text, at: new Date().toISOString() },
      new Date(Date.now() + STAFF_PAUSE_H * 3600e3).toISOString(), true);
    return json({ ok: true });
  }

  if (sub === 'bot' && method === 'POST') {
    let b = {}; try { b = await request.json(); } catch { /* */ }
    const until = b.on ? '' : new Date(Date.now() + MANUAL_OFF_D * 864e5).toISOString();
    await mergeIntoSession(db, key, waId, null, until, false);
    return json({ ok: true, bot_paused_until: until });
  }

  return bad('مسار غير معروف', 404);
}

// تحديث جلسة المساعد: إضافة رد الموظف لسياق المحادثة وضبط إيقاف الرد الآلي
async function mergeIntoSession(db, key, waId, turn, handoffUntil, onlyExtend, name) {
  const row = await db.prepare('SELECT * FROM wa_sessions WHERE session_key = ?').bind(key).first();
  let history = []; try { history = JSON.parse((row && row.history) || '[]'); } catch { /* */ }
  if (turn) history.push(turn);
  history = history.slice(-20);
  let until = handoffUntil;
  if (onlyExtend && row && row.handoff_until && Date.parse(row.handoff_until) > Date.parse(handoffUntil)) until = row.handoff_until;
  await db.prepare(`INSERT INTO wa_sessions (session_key, dept, wa_id, customer_name, handoff_until, history, waiting_alert_at, updated_at)
      VALUES (?,?,?,?,?,?,NULL,datetime('now'))
      ON CONFLICT(session_key) DO UPDATE SET customer_name=excluded.customer_name, handoff_until=excluded.handoff_until, history=excluded.history, updated_at=datetime('now')`)
    .bind(key, DEPT, waId, (row && row.customer_name) || name || '', until, JSON.stringify(history)).run();
}
