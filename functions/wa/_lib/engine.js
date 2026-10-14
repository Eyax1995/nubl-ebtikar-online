// محرك مساعد واتساب نُبل وابتكار (بديل n8n) — Cloudflare Pages Functions + D1
// الأسرار تُضبط في لوحة Cloudflare Pages ← Settings ← Variables and Secrets:
//   WA_TOKEN         توكن System User لواتساب (إرسال الرسائل)
//   ANTHROPIC_API_KEY مفتاح Claude (المحرك الأساسي للرد الآلي عند ضبطه)
//   CLAUDE_MODEL     (اختياري) الافتراضي claude-sonnet-4-5
//   GEMINI_API_KEY   مفتاح Gemini (احتياطي)
//   WA_VERIFY_TOKEN  رمز التحقق الذي يُكتب في إعداد Webhook لدى Meta
//   META_APP_SECRET  (اختياري) سرّ التطبيق للتحقق من توقيع Meta
//   GEMINI_MODEL     (اختياري) الافتراضي gemini-3.5-flash
// الربط: env.WA_DB = قاعدة nubl-wa-assistant (مستقلة)، env.DB = قاعدة منصة hub (للتسجيل والتنبيهات فقط)
import { COMMON, KB } from './kb.js';
import { MARKETING_EXTRA } from './marketing.js';
import { notifyRoles, h as hx } from '../../marketing/hub/api/_lib/telegram.js';
import { getSettings } from '../../marketing/hub/api/_lib/core.js';

// الأرقام المخدومة — رقم «نُبل وابتكار للتسويق» فقط (قرار إياد 12 أكتوبر 2026).
// أرقام الدعاية والإعلان ومروج الحجاز مستبعدة تماماً: رسائلها تُتجاهل فلا تُخزَّن ولا يُرد عليها ولا تصل لمنصة التسويق.
export const NUMBERS = {
  '966563413040': { dept: 'marketing', brand: 'نبل وابتكار للتسويق' },
};

const GRAPH = 'https://graph.facebook.com/v23.0';
const HANDOFF_HOURS = 12;      // صمت بعد رد موظف من التطبيق أو بعد تحويل حقيقي
const ERROR_PAUSE_MIN = 10;    // صمت قصير عند عطل مؤقت في الذكاء الاصطناعي
const MAX_TURNS = 20;          // ذاكرة المحادثة
const STALE_SEC = 3600;        // تجاهل الرسائل الأقدم من ساعة (إعادة إرسال Meta)
const WAIT_ALERT_MIN = 15;     // أقل فاصل بين تنبيهين «عميل ينتظر» لنفس المحادثة
const H = 3600 * 1000;

const MEDIA = { image: 'صورة', document: 'ملف', audio: 'رسالة صوتية', video: 'فيديو', sticker: 'ملصق', location: 'موقع', contacts: 'جهة اتصال' };
function describe(m) {
  if (m.type === 'text') return (m.text && m.text.body) || '';
  if (m.type === 'interactive') { const r = m.interactive.button_reply || m.interactive.list_reply || {}; return r.title || ''; }
  if (m.type === 'button') return (m.button && m.button.text) || '';
  if (m.type === 'location') { const l = m.location || {}; return '[أرسل موقعاً' + (l.name ? ': ' + l.name : '') + (l.address ? ' — ' + l.address : '') + ']'; }
  if (m.type === 'contacts') return '[أرسل جهة اتصال: ' + (m.contacts || []).map((c) => (c.name && c.name.formatted_name) || '').filter(Boolean).join('، ') + ']';
  if (MEDIA[m.type]) {
    const md = m[m.type] || {};
    return '[أرسل ' + MEDIA[m.type] + (md.filename ? ': ' + md.filename : '') + ']' + (md.caption ? ' ' + md.caption : '');
  }
  return '[رسالة من نوع ' + m.type + ']';
}

// بيانات الوسائط للعرض في صندوق المنصة: الصورة/الملف/الصوت/الموقع/جهات الاتصال + الرسالة المُقتبسة
export function mediaInfo(m) {
  const o = {};
  if (m.context && m.context.id) o.ctx = m.context.id;
  if (['image', 'video', 'audio', 'document', 'sticker'].includes(m.type)) {
    const md = m[m.type] || {};
    Object.assign(o, { t: m.type, id: md.id || null, mime: md.mime_type || '', fn: md.filename || '', cap: md.caption || '', voice: md.voice || undefined });
  } else if (m.type === 'location') {
    const l = m.location || {}; Object.assign(o, { t: 'location', loc: { lat: l.latitude, lng: l.longitude, name: l.name || '', addr: l.address || '', url: l.url || '' } });
  } else if (m.type === 'contacts') {
    o.t = 'contacts'; o.ct = (m.contacts || []).slice(0, 5).map((c) => ({ n: (c.name && c.name.formatted_name) || '', p: ((c.phones || [])[0] || {}).phone || '', w: ((c.phones || [])[0] || {}).wa_id || '' }));
  } else if (m.type === 'interactive' || m.type === 'button') o.t = 'button';
  return Object.keys(o).length ? o : null;
}

// يحوّل حمولة Meta إلى أحداث مبسّطة
export function parseEvents(body) {
  const out = [];
  for (const entry of (body.entry || [])) {
    for (const change of (entry.changes || [])) {
      const v = change.value || {};
      const meta = v.metadata || {};
      const display = String(meta.display_phone_number || '').replace(/\D/g, '');
      const cfg = NUMBERS[display];
      if (!cfg) continue;
      const base = { dept: cfg.dept, brand: cfg.brand, phone_number_id: String(meta.phone_number_id || ''), display_phone: display };
      if (change.field === 'messages') {
        const names = {};
        for (const c of (v.contacts || [])) names[c.wa_id] = (c.profile && c.profile.name) || '';
        for (const m of (v.messages || [])) {
          if (m.type === 'reaction' || m.type === 'system') continue;
          out.push({ ...base, kind: 'message', wa_id: m.from, name: names[m.from] || '', type: m.type, text: String(describe(m)).trim(), msg_id: m.id, ts: Number(m.timestamp) || 0, media: mediaInfo(m) });
        }
      } else if (change.field === 'smb_message_echoes') {
        for (const e of (v.message_echoes || [])) {
          out.push({ ...base, kind: 'echo', wa_id: e.to, name: '', type: e.type, text: String(describe(e)).trim(), msg_id: e.id, ts: Number(e.timestamp) || 0, media: mediaInfo(e) });
        }
      } else if (change.field === 'history') {
        for (const hh of (v.history || [])) for (const th of (hh.threads || [])) for (const hm of (th.messages || [])) {
          out.push({ ...base, kind: 'history', wa_id: th.id, direction: String(hm.from || '') === display ? 'business' : 'customer', type: hm.type, text: String(describe(hm)).trim(), msg_id: hm.id, ts: Number(hm.timestamp) || 0 });
        }
      }
    }
  }
  return out;
}

async function graph(env, path, payload) {
  const r = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.WA_TOKEN}` },
    body: JSON.stringify(payload),
  });
  let d = {}; try { d = await r.json(); } catch { /* */ }
  return { ok: r.ok && !d.error, status: r.status, data: d };
}

export async function sendText(env, phoneNumberId, to, body) {
  return graph(env, `${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body, preview_url: true },
  });
}

async function logEvent(env, row) {
  try {
    await env.WA_DB.prepare('INSERT INTO wa_events (dept, wa_id, kind, msg_id, text, reply, status, detail) VALUES (?,?,?,?,?,?,?,?)')
      .bind(row.dept || null, row.wa_id || null, row.kind || null, row.msg_id || null, row.text || null, row.reply || null, row.status || null, row.detail || null).run();
    return true;
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return false; // نفس الرسالة وصلت من قبل
    console.warn('logEvent', e.message);
    return true;
  }
}

async function getSession(env, key) {
  return await env.WA_DB.prepare('SELECT * FROM wa_sessions WHERE session_key = ?').bind(key).first();
}
async function saveSession(env, s) {
  await env.WA_DB.prepare(`INSERT INTO wa_sessions (session_key, dept, wa_id, customer_name, handoff_until, history, waiting_alert_at, updated_at)
    VALUES (?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(session_key) DO UPDATE SET customer_name=excluded.customer_name, handoff_until=excluded.handoff_until,
      history=excluded.history, waiting_alert_at=excluded.waiting_alert_at, updated_at=datetime('now')`)
    .bind(s.session_key, s.dept, s.wa_id, s.customer_name || '', s.handoff_until || '', s.history, s.waiting_alert_at || null).run();
}

// تنبيه الإدارة (واتساب ثم تلجرام عبر منصة hub) — لا يُفشل الرد أبداً
async function alertStaff(env, text, link = '#wa') {
  try { if (env.DB) await notifyRoles(env.DB, env, 'admin', text, { kind: 'lead', link }); } catch (e) { console.warn('alert', e.message); }
}

// تسجيل عميل التسويق كعميل محتمل في hub (مكرر الرقم يُدمج، ومرة كل 12 ساعة)
async function registerLead(env, origin, ev, preview) {
  try {
    if (!env.DB || ev.dept !== 'marketing') return;
    const s = await getSettings(env.DB);
    if (!s.hook_token) return;
    await fetch(`${origin}/marketing/hub/api/hook/lead`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nubl-token': s.hook_token },
      body: JSON.stringify({ name: ev.name || '', phone: ev.wa_id, source: 'واتساب', message: preview.slice(0, 500) }),
    });
  } catch (e) { console.warn('lead', e.message); }
}

function buildPrompt(ev, session, history) {
  let when = '';
  try {
    when = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  } catch { when = new Date().toISOString(); }
  const context = [
    '# سياق هذه المحادثة',
    '- الوقت الآن في جدة: ' + when,
    '- العميل راسل رقم: ' + ev.brand + ' (قسم ' + (ev.dept === 'marketing' ? 'التسويق' : 'الدعاية والإعلان') + ')',
    '- اسم العميل في واتساب: ' + (ev.name || session.customer_name || 'غير معروف'),
    '- طلبات العميل في منصة نبل:',
    'تعذر الوصول لبيانات الطلبات الآن — لا تخمّن حالة أي طلب، واعرض تحويله لموظف.',
  ].join('\n');
  const OUTPUT = '# صيغة الإخراج\nاكتب نص الرد فقط كما سيصل للعميل في واتساب — بلا مقدمات ولا شرح ولا علامات اقتباس. إذا احتاجت المحادثة موظفاً اكتب ردك ثم [تحويل] في آخر سطر.';
  const LABEL = { customer: 'العميل', staff: 'موظف نبل', bot: 'أنت' };
  const transcript = history.map((x) => (LABEL[x.r] || x.r) + ': ' + x.t).join('\n');
  let system = COMMON + '\n\n' + (KB[ev.dept] || KB.advertising) + '\n\n' + context + '\n\n' + OUTPUT;
  if (ev.dept === 'marketing') system += MARKETING_EXTRA;
  return { system, user: 'المحادثة حتى الآن (الأقدم أولاً):\n' + transcript + '\n\nاكتب ردك على آخر رسالة من العميل.' };
}

// ترتيب المحركات: Claude (إن ضُبط ANTHROPIC_API_KEY) ← Gemini ← Workers AI داخل Cloudflare — أي عطل ينتقل للتالي تلقائياً
async function claude(env, system, user) {
  if (!env.ANTHROPIC_API_KEY) return { ok: false, error: 'no key', skip: true };
  const model = env.CLAUDE_MODEL || 'claude-sonnet-4-5';
  let lastErr = '';
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 1500, temperature: 0.5, system, messages: [{ role: 'user', content: user }] }),
      });
      const d = await r.json().catch(() => ({}));
      const text = (d.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
      if (r.ok && text) return { ok: true, text, engine: 'claude:' + model };
      lastErr = (d.error && d.error.message) || `HTTP ${r.status}`;
      if (r.status === 400 || r.status === 401 || r.status === 403 || r.status === 404) break; // خطأ إعداد: لا فائدة من الإعادة
    } catch (e) { lastErr = e.message; }
    if (i < 1) await new Promise((res) => setTimeout(res, 2000));
  }
  return { ok: false, error: 'claude: ' + lastErr.slice(0, 300) };
}

export async function askAI(env, system, user) {
  const c = await claude(env, system, user);
  if (c.ok) return c;
  const g = await gemini(env, system, user);
  if (g.ok) return g;
  return { ok: false, error: (c.skip ? '' : c.error + ' | ') + g.error };
}

// Gemini (احتياطي)، وعند نفاد الحصة أو أي عطل ننتقل إلى Workers AI داخل Cloudflare (بلا فوترة خارجية)
async function gemini(env, system, user) {
  const model = env.GEMINI_MODEL || 'gemini-3.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  let lastErr = '';
  if (env.GEMINI_API_KEY) {
    for (let i = 0; i < 2; i++) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 4096 },
          }),
        });
        const d = await r.json().catch(() => ({}));
        const parts = (((d.candidates || [])[0] || {}).content || {}).parts || [];
        const text = parts.filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
        if (r.ok && text) return { ok: true, text, engine: 'gemini' };
        lastErr = (d.error && d.error.message) || `HTTP ${r.status}`;
        if (r.status === 429) break; // نفاد الحصة: لا فائدة من الإعادة
      } catch (e) { lastErr = e.message; }
      if (i < 1) await new Promise((res) => setTimeout(res, 3000));
    }
  }
  const fb = await workersAI(env, system, user);
  if (fb.ok) return fb;
  return { ok: false, error: (lastErr ? 'gemini: ' + lastErr.slice(0, 300) + ' | ' : '') + 'workers-ai: ' + fb.error };
}

async function workersAI(env, system, user) {
  if (!env.AI) return { ok: false, error: 'no AI binding' };
  const model = env.WA_FALLBACK_MODEL || '@cf/google/gemma-4-26b-a4b-it';
  try {
    const r = await env.AI.run(model, {
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: 1200, temperature: 0.5,
    });
    let text = (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content))) || '';
    if (typeof text !== 'string') text = String(text || '');
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    if (text) return { ok: true, text, engine: 'workers-ai' };
    return { ok: false, error: 'empty response' };
  } catch (e) { return { ok: false, error: String(e.message || e).slice(0, 300) }; }
}

// معالجة حدث واحد (رسالة أو صدى رد موظف)
async function handleLive(env, origin, ev) {
  const fresh = await logEvent(env, { dept: ev.dept, wa_id: ev.wa_id, kind: ev.kind, msg_id: ev.msg_id, text: ev.text, status: 'received', detail: ev.media ? JSON.stringify({ m: ev.media }).slice(0, 1500) : null });
  if (!fresh) return; // مكررة
  const key = ev.dept + ':' + ev.wa_id;
  const row = (await getSession(env, key)) || {};
  let history = []; try { history = JSON.parse(row.history || '[]'); } catch { history = []; }
  const now = Date.now();
  const s = { session_key: key, dept: ev.dept, wa_id: ev.wa_id, customer_name: ev.name || row.customer_name || '', handoff_until: row.handoff_until || '', waiting_alert_at: row.waiting_alert_at || null };

  if (ev.kind === 'echo') {
    history.push({ r: 'staff', t: ev.text, at: new Date(now).toISOString() });
    s.handoff_until = new Date(now + HANDOFF_HOURS * H).toISOString();
    s.history = JSON.stringify(history.slice(-MAX_TURNS));
    await saveSession(env, s);
    return;
  }
  if (ev.ts && now / 1000 - ev.ts > STALE_SEC) return;

  history.push({ r: 'customer', t: ev.text, at: new Date(now).toISOString() });
  await registerLead(env, origin, ev, ev.text);

  const paused = s.handoff_until && Date.parse(s.handoff_until) > now;
  if (paused) {
    s.history = JSON.stringify(history.slice(-MAX_TURNS));
    const lastAlert = s.waiting_alert_at ? Date.parse(s.waiting_alert_at) : 0;
    if (now - lastAlert > WAIT_ALERT_MIN * 60 * 1000) {
      s.waiting_alert_at = new Date(now).toISOString();
      await alertStaff(env, `⏳ عميل ينتظر رداً على واتساب ${ev.dept === 'marketing' ? 'التسويق' : 'الدعاية والإعلان'}\n<b>${hx(s.customer_name || ev.wa_id)}</b> · ${hx(ev.wa_id)}\n${hx(ev.text.slice(0, 300))}\n↩️ ردّ من صندوق واتساب في المنصة`, `#/wa/${ev.wa_id}`);
    }
    await saveSession(env, s);
    return;
  }

  // علامة القراءة + مؤشر الكتابة
  graph(env, `${ev.phone_number_id}/messages`, { messaging_product: 'whatsapp', status: 'read', message_id: ev.msg_id, typing_indicator: { type: 'text' } }).catch(() => {});

  const p = buildPrompt(ev, s, history);
  const ai = await askAI(env, p.system, p.user);
  let reply = ai.ok ? ai.text : '';
  let handoff = false;
  if (/\[\s*تحويل\s*\]/.test(reply)) { handoff = true; reply = reply.replace(/\[\s*تحويل\s*\]/g, '').trim(); }
  if (handoff) s.handoff_until = new Date(now + HANDOFF_HOURS * H).toISOString();
  if (!reply) {
    reply = 'حياك الله 🌷 لحظات ويرد عليك أحد الزملاء.';
    s.handoff_until = new Date(now + (ai.ok ? HANDOFF_HOURS * H : ERROR_PAUSE_MIN * 60 * 1000)).toISOString();
    handoff = true;
  }
  if (reply.length > 3500) reply = reply.slice(0, 3500);

  const sent = await sendText(env, ev.phone_number_id, ev.wa_id, reply);
  history.push({ r: 'bot', t: reply, at: new Date().toISOString() });
  s.history = JSON.stringify(history.slice(-MAX_TURNS));
  await saveSession(env, s);
  await logEvent(env, {
    dept: ev.dept, wa_id: ev.wa_id, kind: 'reply', reply, status: sent.ok ? 'sent' : 'send_failed',
    detail: JSON.stringify({ engine: ai.engine || null, ai_error: ai.ok ? null : ai.error, handoff, wamid: sent.data?.messages?.[0]?.id || null, send_error: sent.data?.error?.message || null }).slice(0, 1500),
  });
  if (handoff) {
    await alertStaff(env, `🙋 تحويل محادثة واتساب ${ev.dept === 'marketing' ? 'التسويق' : 'الدعاية والإعلان'} لموظف\n<b>${hx(s.customer_name || ev.wa_id)}</b> · ${hx(ev.wa_id)}\nآخر رسالة: ${hx(ev.text.slice(0, 300))}${ai.ok ? '' : '\n⚠️ عطل مؤقت في الذكاء الاصطناعي'}`, `#/wa/${ev.wa_id}`);
  } else if (!row.session_key) {
    // أول رسالة من رقم جديد: تنبيه فوري حتى لو تولّى الرد الآلي المحادثة
    await alertStaff(env, `💬 محادثة جديدة على واتساب ${ev.dept === 'marketing' ? 'التسويق' : 'الدعاية والإعلان'}\n<b>${hx(s.customer_name || ev.wa_id)}</b> · ${hx(ev.wa_id)}\n${hx(ev.text.slice(0, 300))}\n🤖 ${sent.ok ? 'ردّ الرد الآلي، ويمكنك المتابعة من صندوق واتساب في المنصة' : 'تعذّر إرسال الرد الآلي — ردّ بنفسك من المنصة'}`, `#/wa/${ev.wa_id}`);
  }
}

async function saveHistory(env, items) {
  if (!items.length) return;
  const stmts = items.map((x) => env.WA_DB.prepare('INSERT OR IGNORE INTO wa_history_import (dept, business_number, wa_id, direction, msg_type, text, ts, msg_id) VALUES (?,?,?,?,?,?,?,?)')
    .bind(x.dept, x.display_phone, x.wa_id, x.direction, x.type, x.text, x.ts, x.msg_id));
  for (let i = 0; i < stmts.length; i += 50) await env.WA_DB.batch(stmts.slice(i, i + 50));
}

export async function processWebhook(env, origin, body) {
  const events = parseEvents(body);
  await saveHistory(env, events.filter((e) => e.kind === 'history'));
  for (const ev of events.filter((e) => e.kind !== 'history')) {
    try { await handleLive(env, origin, ev); } catch (e) {
      console.error('wa', e.message);
      await logEvent(env, { dept: ev.dept, wa_id: ev.wa_id, kind: 'error', status: 'error', detail: String(e.message).slice(0, 1000) });
    }
  }
}

// التحقق من توقيع Meta (X-Hub-Signature-256) عند ضبط META_APP_SECRET
export async function validSignature(env, raw, header) {
  if (!env.META_APP_SECRET) return true;
  if (!header || !header.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.META_APP_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const given = header.slice(7);
  if (given.length !== hex.length) return false;
  let diff = 0; for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
