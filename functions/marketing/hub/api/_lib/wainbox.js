// صندوق ردود واتساب «نُبل وابتكار للتسويق» داخل منصة hub
// يقرأ المحادثات من قاعدة المساعد (WA_DB) ويرسل ردود الموظفين من رقم التسويق عبر Cloud API.
// المسارات: GET wa/threads · GET wa/thread/<wa_id> · POST wa/send/<wa_id> {text} · POST wa/bot/<wa_id> {on}
import { json, bad } from './core.js';

const DEPT = 'marketing';
const DEFAULT_PHONE_ID = '1368158866379375'; // رقم التسويق 0563413040 على الحساب الموثّق
const GRAPH = 'https://graph.facebook.com/v23.0';
const ROLES_OK = ['admin', 'manager', 'sales', 'account'];
const STAFF_PAUSE_H = 12;   // بعد رد الموظف يصمت الرد الآلي لهذه المحادثة
const MANUAL_OFF_D = 30;    // إيقاف يدوي للرد الآلي

const cleanId = (s) => String(s || '').replace(/\D/g, '').slice(0, 20);

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
async function mergeIntoSession(db, key, waId, turn, handoffUntil, onlyExtend) {
  const row = await db.prepare('SELECT * FROM wa_sessions WHERE session_key = ?').bind(key).first();
  let history = []; try { history = JSON.parse((row && row.history) || '[]'); } catch { /* */ }
  if (turn) history.push(turn);
  history = history.slice(-20);
  let until = handoffUntil;
  if (onlyExtend && row && row.handoff_until && Date.parse(row.handoff_until) > Date.parse(handoffUntil)) until = row.handoff_until;
  await db.prepare(`INSERT INTO wa_sessions (session_key, dept, wa_id, customer_name, handoff_until, history, waiting_alert_at, updated_at)
      VALUES (?,?,?,?,?,?,NULL,datetime('now'))
      ON CONFLICT(session_key) DO UPDATE SET handoff_until=excluded.handoff_until, history=excluded.history, updated_at=datetime('now')`)
    .bind(key, DEPT, waId, (row && row.customer_name) || '', until, JSON.stringify(history)).run();
}
