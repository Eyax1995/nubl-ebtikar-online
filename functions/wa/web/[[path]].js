// ودجت المحادثة في موقعَي «نُبل وابتكار للتسويق» و«مروج الحجاز» (24 أكتوبر 2026)
// المسارات (CORS مفتوح لأن متجر مروج على نطاق سلة):
//   POST /wa/web/<site>/start {name, phone?, page?}      → {v, t}  (زائر جديد: معرّف أرقام عشوائي + توقيع)
//   POST /wa/web/<site>/send  {v, t, text}               → يُخزَّن في الصندوق (خط wnubl/wmorooj) ويرد المساعد الذكي في الخلفية
//   GET  /wa/web/<site>/poll?v=&t=&after=<id>            → الرسائل الجديدة من المساعد والفريق
// site: nubl | morooj. الفريق يرد من صندوق واتساب في المنصة كأي محادثة؛ «أكمل على واتساب» ينقل الزائر لرقم الخط الأساسي.
import { LINES, threadKey } from '../_lib/lines.js';
import { buildPrompt, askAI, alertStaff } from '../_lib/engine.js';
import { moroojWording } from '../_lib/morooj.js';
import { notifyUser, h as hx } from '../../marketing/hub/api/_lib/telegram.js';
import { getSettings } from '../../marketing/hub/api/_lib/core.js';
import { ensureCwTables } from '../import/chatwoot.js';

const SITES = { nubl: 'wnubl', morooj: 'wmorooj' };
const HANDOFF_H = 12, MAX_TURNS = 20, RATE_PER_HOUR = 40;
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors } });
const clip = (v, n) => String(v || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);

async function sig(env, dept, vid) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('web-chat:' + (env.WA_VERIFY_TOKEN || 'nubl')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dept + ':' + vid));
  return [...new Uint8Array(s)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function normPhone(s) {
  let p = String(s || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1); else if (p.startsWith('00')) p = p.slice(2);
  if (/^05\d{8}$/.test(p)) p = '966' + p.slice(1); else if (/^5\d{8}$/.test(p)) p = '966' + p;
  return /^\d{10,15}$/.test(p) ? p : '';
}
const waLink = (L) => 'https://wa.me/' + LINES[L.base].display;

export async function onRequestOptions() { return new Response(null, { status: 204, headers: cors }); }

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const [site, action] = Array.isArray(params.path) ? params.path : [];
  const dept = SITES[site]; if (!dept || !env.WA_DB) return J({ error: 'not found' }, 404);
  const L = LINES[dept]; const db = env.WA_DB;
  const method = request.method.toUpperCase();
  await ensureCwTables(db);

  if (action === 'start' && method === 'POST') {
    let b = {}; try { b = await request.json(); } catch { /* */ }
    if (b.website) return J({ ok: true }); // فخ الروبوتات
    const name = clip(b.name, 60); if (name.length < 2) return J({ error: 'اكتب اسمك' }, 400);
    const phone = normPhone(b.phone);
    const vid = '7' + [...crypto.getRandomValues(new Uint8Array(12))].map((x) => x % 10).join('');
    await db.prepare(`INSERT INTO wa_contacts (dept, wa_id, name, email, attrs, source, updated_at) VALUES (?,?,?,?,?,'web',datetime('now'))
      ON CONFLICT(dept, wa_id) DO UPDATE SET name=excluded.name, attrs=excluded.attrs, updated_at=datetime('now')`)
      .bind(dept, vid, name, null, JSON.stringify({ phone, page: clip(b.page, 300), ua: clip(request.headers.get('user-agent'), 160) })).run();
    await db.prepare(`INSERT INTO wa_sessions (session_key, dept, wa_id, customer_name, handoff_until, history, updated_at) VALUES (?,?,?,?,'','[]',datetime('now'))
      ON CONFLICT(session_key) DO NOTHING`).bind(dept + ':' + vid, dept, vid, phone ? `${name} · ${phone.startsWith('966') ? '0' + phone.slice(3) : '+' + phone}` : name).run();
    // موقع التسويق: من ترك جواله يُسجَّل عميلاً محتملاً (كما في رقم التسويق)
    if (phone && L.base === 'marketing' && env.DB) {
      try {
        const s = await getSettings(env.DB);
        if (s.hook_token) await fetch(new URL(request.url).origin + '/marketing/hub/api/hook/lead', { method: 'POST', headers: { 'content-type': 'application/json', 'x-nubl-token': s.hook_token },
          body: JSON.stringify({ name, phone, source: 'محادثة الموقع', message: 'بدأ محادثة من نافذة الموقع' }) });
      } catch (e) { console.warn('web lead', e.message); }
    }
    return J({ ok: true, v: vid, t: await sig(env, dept, vid), wa: waLink(L), brand: L.brand });
  }

  // ما بعد البدء: التحقق من الزائر
  const q = new URL(request.url).searchParams;
  let b = {}; if (method === 'POST') { try { b = await request.json(); } catch { /* */ } }
  const vid = String(b.v || q.get('v') || '').replace(/\D/g, '').slice(0, 20);
  const tok = String(b.t || q.get('t') || '');
  if (!vid || tok !== await sig(env, dept, vid)) return J({ error: 'جلسة غير صالحة' }, 403);
  const key = dept + ':' + vid;

  if (action === 'poll' && method === 'GET') {
    const after = Number(q.get('after')) || 0;
    const rows = (await db.prepare(`SELECT id, at, kind, text, reply, detail FROM wa_events WHERE dept = ? AND wa_id = ? AND id > ? AND kind IN ('message','reply','staff') ORDER BY id LIMIT 100`)
      .bind(dept, vid, after).all()).results || [];
    const s = await db.prepare('SELECT handoff_until FROM wa_sessions WHERE session_key = ?').bind(key).first();
    return J({ messages: rows.map((r) => { let d = {}; try { d = JSON.parse(r.detail || '{}'); } catch { /* */ }
      return { id: r.id, at: r.at, from: r.kind === 'message' ? 'me' : r.kind === 'reply' ? 'bot' : 'team', text: r.kind === 'message' ? r.text : r.reply, by: r.kind === 'staff' ? 'فريق ' + L.brand : '' }; }),
      human: !!(s && s.handoff_until && Date.parse(s.handoff_until) > Date.now()) });
  }

  if (action === 'send' && method === 'POST') {
    const text = clip(b.text, 1000); if (!text) return J({ error: 'اكتب رسالتك' }, 400);
    const n = await db.prepare(`SELECT COUNT(*) AS n FROM wa_events WHERE dept = ? AND wa_id = ? AND kind = 'message' AND at > datetime('now','-1 hour')`).bind(dept, vid).first('n');
    if (n >= RATE_PER_HOUR) return J({ error: 'رسائل كثيرة — أكمل معنا على واتساب', wa: waLink(L) }, 429);
    const ins = await db.prepare('INSERT INTO wa_events (dept, wa_id, kind, msg_id, text, status, detail) VALUES (?,?,?,?,?,?,?)')
      .bind(dept, vid, 'message', `web:${vid}:${Date.now()}`, text, 'received', JSON.stringify({ src: 'web' })).run();
    ctx.waitUntil(reply(env, L, dept, vid, text).catch((e) => console.warn('web reply', e.message)));
    return J({ ok: true, id: ins.meta.last_row_id });
  }
  return J({ error: 'not found' }, 404);
}

// رد المساعد الذكي بمعرفة الخط الأساسي (أو انتظار الفريق إن كانت المحادثة محوّلة)، وتنبيه الفريق
async function reply(env, L, dept, vid, text) {
  const db = env.WA_DB; const key = dept + ':' + vid; const now = Date.now();
  const row = (await db.prepare('SELECT * FROM wa_sessions WHERE session_key = ?').bind(key).first()) || {};
  let history = []; try { history = JSON.parse(row.history || '[]'); } catch { /* */ }
  const first = !history.length;
  history.push({ r: 'customer', t: text, at: new Date(now).toISOString() });
  const name = String(row.customer_name || '').split(' · ')[0];
  let handoffUntil = row.handoff_until || '';
  const link = `#/wa/${threadKey(dept, vid)}`;
  const save = () => db.prepare(`UPDATE wa_sessions SET history = ?, handoff_until = ?, updated_at = datetime('now') WHERE session_key = ?`).bind(JSON.stringify(history.slice(-MAX_TURNS)), handoffUntil, key).run();
  // كل رسالة واردة تُحوَّل لمستلمي التحويل (كما في واتساب)
  try {
    const s = env.DB ? await getSettings(env.DB) : {};
    const ids = String(s.wa_forward_user_ids ?? '1').split(',').map((x) => parseInt(x, 10)).filter((x) => x > 0);
    for (const id of ids) await notifyUser(env.DB, env, id, `💬 <b>${hx(L.label)}</b> — ${hx(row.customer_name || 'زائر')}\n${hx(text.slice(0, 1200))}\n↩️ ردّ من صندوق واتساب في المنصة`, null, { kind: 'wa_in', link, title: '💬 محادثة من الموقع', urgent: true });
  } catch (e) { console.warn('web fwd', e.message); }
  if (handoffUntil && Date.parse(handoffUntil) > now) { await save(); return; } // الفريق يتولى
  const p = buildPrompt({ dept: L.base, brand: L.brand, channel: 'web', name, wa_id: vid, text }, { customer_name: name }, history);
  const ai = await askAI(env, p.system, p.user);
  let out = ai.ok ? ai.text : '';
  let handoff = false;
  if (/\[\s*تحويل\s*\]/.test(out)) { handoff = true; out = out.replace(/\[\s*تحويل\s*\]/g, '').trim(); }
  if (!out) { out = 'حياك الله 🌷 لحظات ويرد عليك أحد الزملاء هنا.'; handoff = true; }
  if (L.base === 'morooj') out = moroojWording(out);
  if (handoff) handoffUntil = new Date(now + HANDOFF_H * 3600e3).toISOString();
  history.push({ r: 'bot', t: out, at: new Date().toISOString() });
  await db.prepare('INSERT INTO wa_events (dept, wa_id, kind, reply, status, detail) VALUES (?,?,?,?,?,?)')
    .bind(dept, vid, 'reply', out.slice(0, 3500), 'sent', JSON.stringify({ engine: ai.engine || null, ai_error: ai.ok ? null : ai.error, handoff })).run();
  await save();
  if (handoff) await alertStaff(env, `🙋 تحويل محادثة ${L.label} لموظف\n<b>${hx(row.customer_name || 'زائر')}</b>\nآخر رسالة: ${hx(text.slice(0, 300))}\n↩️ ردّ من صندوق واتساب في المنصة`, link);
  else if (first) await alertStaff(env, `💬 محادثة جديدة من ${L.label}\n<b>${hx(row.customer_name || 'زائر')}</b>\n${hx(text.slice(0, 300))}\n🤖 ردّ المساعد الذكي، ويمكنك المتابعة من الصندوق`, link);
}
