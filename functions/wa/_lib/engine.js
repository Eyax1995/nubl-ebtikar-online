// محرك مساعد واتساب نُبل وابتكار (بديل n8n) — Cloudflare Pages Functions + D1
// الأسرار تُضبط في لوحة Cloudflare Pages ← Settings ← Variables and Secrets:
//   WA_TOKEN         توكن System User لواتساب (إرسال الرسائل)
//   ANTHROPIC_API_KEY مفتاح Claude (المحرك الأساسي للرد الآلي عند ضبطه)
//   CLAUDE_MODEL_CHAT (اختياري) نموذج ردود العملاء، الافتراضي claude-sonnet-5-5 ثم claude-haiku-5-5
//   GEMINI_API_KEY   مفتاح Gemini (احتياطي)
//   WA_VERIFY_TOKEN  رمز التحقق الذي يُكتب في إعداد Webhook لدى Meta
//   META_APP_SECRET  (اختياري) سرّ التطبيق للتحقق من توقيع Meta
//   GEMINI_MODEL     (اختياري) الافتراضي gemini-3.5-flash
// الربط: env.WA_DB = قاعدة nubl-wa-assistant (مستقلة)، env.DB = قاعدة منصة hub (للتسجيل والتنبيهات فقط)
import { COMMON, KB } from './kb.js';
import { MARKETING_EXTRA } from './marketing.js';
import { MOROOJ_FULL, moroojWording } from './morooj.js';
import { LINES, PHONE_LINES, lineOf, lineByPhoneId, tokenForPath, threadKey } from './lines.js';
import { notifyRoles, notifyUser, h as hx } from '../../marketing/hub/api/_lib/telegram.js';
import { getSettings } from '../../marketing/hub/api/_lib/core.js';
import { findStaff, handleStaffMessage } from '../../marketing/hub/api/_lib/staffwa.js';

// الأرقام المخدومة: «نُبل وابتكار للتسويق» (قرار إياد 12 أكتوبر 2026)، و«مروج الحجاز» بعد نقلها من Chatwoot (قرار إياد 24 أكتوبر 2026).
// أرقام الدعاية والإعلان ومروج الحجاز مستبعدة تماماً: رسائلها تُتجاهل فلا تُخزَّن ولا يُرد عليها ولا تصل لمنصة التسويق.
export const NUMBERS = Object.fromEntries(PHONE_LINES.map((l) => [l.display, { dept: l.dept, brand: l.brand }]));
const deptLabel = (dept) => (LINES[dept] ? LINES[dept].label : 'الدعاية والإعلان');

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
  // «unsupported»: أنواع لا يسلّمها واتساب لواجهة Cloud API أصلاً (عرض لمرة واحدة، استطلاع، ملاحظة فيديو، دعوة حدث…)
  // — محتواها لا يصلنا ولا يمكن جلبه، لكنه يظهر في تطبيق واتساب أعمال على جوال الرقم (وضع التعايش)
  if (m.type === 'unsupported') return '[رسالة لا تعرضها واجهة واتساب — غالباً صورة أو فيديو «عرض لمرة واحدة» أو استطلاع أو ملاحظة فيديو أو دعوة حدث؛ تظهر فقط في تطبيق واتساب أعمال على جوال الرقم 0563413040]';
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
  else if (m.type === 'unsupported') o.t = 'unsupported';
  return Object.keys(o).length ? o : null;
}

// يحوّل حمولة Meta إلى أحداث مبسّطة
export function parseEvents(body, env = {}) {
  const out = [];
  for (const entry of (body.entry || [])) {
    for (const change of (entry.changes || [])) {
      const v = change.value || {};
      const meta = v.metadata || {};
      const display = String(meta.display_phone_number || '').replace(/\D/g, '');
      let cfg = NUMBERS[display];
      if (!cfg) { const l = lineByPhoneId(env, meta.phone_number_id); if (l) cfg = { dept: l.dept, brand: l.brand }; }
      if (!cfg) continue;
      const base = { dept: cfg.dept, brand: cfg.brand, phone_number_id: String(meta.phone_number_id || ''), display_phone: display };
      if (change.field === 'messages') {
        const names = {};
        for (const c of (v.contacts || [])) names[c.wa_id] = (c.profile && c.profile.name) || '';
        for (const m of (v.messages || [])) {
          if (m.type === 'reaction' || m.type === 'system') continue;
          const rid = m.type === 'interactive' ? ((m.interactive.button_reply || m.interactive.list_reply || {}).id || '') : m.type === 'button' ? ((m.button && m.button.payload) || '') : '';
          out.push({ ...base, kind: 'message', wa_id: m.from, name: names[m.from] || '', type: m.type, text: String(describe(m)).trim(), reply_id: rid, msg_id: m.id, ts: Number(m.timestamp) || 0, media: mediaInfo(m) });
        }
        // إيصالات التسليم لما أرسلناه (sent/delivered/read/failed) — تظهر حالة كل رسالة في الصندوق وسبب الفشل
        for (const st of (v.statuses || [])) {
          const er = (st.errors || [])[0];
          out.push({ ...base, kind: 'status', msg_id: st.id, wa_id: st.recipient_id, status: st.status, error: er ? `${er.code}: ${er.title || er.message || ''}`.slice(0, 300) : null });
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
  const r = await fetch(`${env.WA_GRAPH_URL || GRAPH}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenForPath(env, path)}` }, // توكن خط الرقم المرسِل
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

// تنبيه الإدارة (واتساب ثم تلجرام عبر منصة hub) — لا يُفشل الرد أبداً؛ except: من وصلته الرسالة نفسها بالتحويل الفوري
export async function alertStaff(env, text, link = '#wa', except = null) {
  try { if (env.DB) await notifyRoles(env.DB, env, 'admin', text, { kind: 'lead', link }, except); } catch (e) { console.warn('alert', e.message); }
}

// تحويل كل رسالة واردة من العملاء فوراً لأرقام الإدارة الخاصة (بطلب إياد 22 أكتوبر 2026)
// المستلمون: الإعداد wa_forward_user_ids (معرّفات مستخدمي المنصة مفصولة بفواصل، الافتراضي إياد = 1؛ فارغ = إيقاف)
// يُرسل بقنوات المستخدم (واتساب ثم تلجرام ثم المنصة) حتى ليلاً — ويعيد المعرّفات حتى لا يتكرر لهم تنبيه المحادثة نفسها
export async function forwardIncoming(env, ev, name) {
  try {
    if (!env.DB) return [];
    const s = await getSettings(env.DB);
    const ids = String(s.wa_forward_user_ids ?? '1').split(',').map((x) => parseInt(x, 10)).filter((x) => x > 0);
    if (!ids.length) return [];
    const phone = String(ev.wa_id || '');
    const text = `📩 <b>واتساب ${deptLabel(ev.dept)}</b> — ${hx(name || phone)} · ${hx(phone)}\n${hx(String(ev.text || '').slice(0, 1200))}`
      + (ev.media && ev.media.t && ev.media.t !== 'button' && ev.media.t !== 'unsupported' ? '\n📎 المرفق في صندوق واتساب بالمنصة' : '')
      + `\n💬 فتح المحادثة: https://wa.me/${phone}`;
    for (const id of ids) await notifyUser(env.DB, env, id, text, null, { kind: 'wa_in', link: `#/wa/${threadKey(ev.dept, phone)}`, title: '📩 رسالة واتساب واردة', urgent: true });
    return ids;
  } catch (e) { console.warn('forward', e.message); return []; }
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

export function buildPrompt(ev, session, history) {
  let when = '';
  try {
    when = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  } catch { when = new Date().toISOString(); }
  const context = [
    '# سياق هذه المحادثة',
    '- الوقت الآن في جدة: ' + when,
    ev.channel === 'web' ? '- العميل يكتب من نافذة المحادثة في موقع ' + ev.brand + ' الإلكتروني (ليس واتساب): إن احتاج متابعة طويلة أو إرسال ملفات فاقترح عليه زر «أكمل على واتساب» في النافذة.' : '- العميل راسل رقم: ' + ev.brand + ' (قسم ' + deptLabel(ev.dept) + ')',
    '- اسم العميل في واتساب: ' + (ev.name || session.customer_name || 'غير معروف'),
    '- طلبات العميل في المنصة:',
    'تعذر الوصول لبيانات الطلبات الآن — لا تخمّن حالة أي طلب، واعرض تحويله لموظف.',
  ].join('\n');
  const OUTPUT = '# صيغة الإخراج\nاكتب نص الرد فقط كما سيصل للعميل في واتساب — بلا مقدمات ولا شرح ولا علامات اقتباس. إذا احتاجت المحادثة موظفاً اكتب ردك ثم [تحويل] في آخر سطر.';
  const LABEL = { customer: 'العميل', staff: ev.dept === 'morooj' ? 'موظف مروج' : 'موظف نبل', bot: 'أنت' };
  const transcript = history.map((x) => (LABEL[x.r] || x.r) + ': ' + x.t).join('\n');
  // مروج الحجاز لها معرفتها كاملة (هويتها وخدماتها) — لا تُبنى على COMMON نُبل وابتكار
  let system = (ev.dept === 'morooj' ? MOROOJ_FULL : COMMON + '\n\n' + (KB[ev.dept] || KB.advertising)) + '\n\n' + context + '\n\n' + OUTPUT;
  if (ev.dept === 'marketing') system += MARKETING_EXTRA;
  return { system, user: 'المحادثة حتى الآن (الأقدم أولاً):\n' + transcript + '\n\nاكتب ردك على آخر رسالة من العميل.' };
}

// ترتيب المحركات: Claude (إن ضُبط ANTHROPIC_API_KEY) ← Gemini ← Workers AI داخل Cloudflare — أي عطل ينتقل للتالي تلقائياً
async function claude(env, system, user, fast) {
  if (!env.ANTHROPIC_API_KEY) return { ok: false, error: 'no key', skip: true };
  // ردود العملاء: Sonnet 5.5 بجهد منخفض (عربية أجود بتكلفة قليلة مع التخزين المؤقت)، وعند تعذّره Haiku 5.5 الأرخص والأسرع
  const models = [env.CLAUDE_MODEL_CHAT || 'claude-sonnet-5-5', 'claude-haiku-5-5'];
  // تقسيم التعليمات: الجزء الثابت (المعرفة والأسلوب) يُخزَّن مؤقتاً لدى Claude فيصبح الرد أسرع وأرخص، والجزء المتغير (السياق) بعده
  const cut = ['\n\n# سياق هذه المحادثة', '\n\n# مهمتك الآن'].map((m) => system.indexOf(m)).filter((i) => i > 0).sort((a, b) => a - b)[0];
  const sys = cut ? [{ type: 'text', text: system.slice(0, cut), cache_control: { type: 'ephemeral' } }, { type: 'text', text: system.slice(cut) }]
    : [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];
  let lastErr = '';
  for (const model of (fast ? models.slice(0, 1) : models)) {
    const fb = model.startsWith('claude-sonnet-'); // رفض الأمان يُعاد على نموذج بديل داخل الطلب نفسه
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01',
          ...(fb ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}) },
        // effort منخفض: رد محادثة لا يحتاج تفكيراً عميقاً، والهامش 3000 يتسع للتفكير القصير والرد
        body: JSON.stringify({ model, max_tokens: 3000, output_config: { effort: 'low' }, ...(fb ? { fallbacks: 'default' } : {}),
          system: sys, messages: [{ role: 'user', content: user }] }),
      });
      const d = await r.json().catch(() => ({}));
      const text = (d.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
      if (r.ok && text && d.stop_reason !== 'refusal') return { ok: true, text, engine: 'claude:' + (d.model || model) };
      lastErr = `${model}: ` + ((d.error && d.error.message) || (d.stop_reason === 'refusal' ? 'رفض' : `HTTP ${r.status}`));
      if (r.status === 401 || r.status === 403) break; // المفتاح نفسه مرفوض: لا فائدة من نموذج آخر
    } catch (e) { lastErr = `${model}: ${e.message}`; }
  }
  return { ok: false, error: 'claude: ' + lastErr.slice(0, 300) };
}

export async function askAI(env, system, user, fast = false) {
  const c = await claude(env, system, user, fast);
  if (c.ok) return c;
  const g = await gemini(env, system, user, fast);
  if (g.ok) return g;
  return { ok: false, error: (c.skip ? '' : c.error + ' | ') + g.error };
}

// Gemini (احتياطي)، وعند نفاد الحصة أو أي عطل ننتقل إلى Workers AI داخل Cloudflare (بلا فوترة خارجية)
async function gemini(env, system, user, fast) {
  const model = env.GEMINI_MODEL || 'gemini-3.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  let lastErr = '';
  if (env.GEMINI_API_KEY) {
    for (let i = 0; i < (fast ? 1 : 2); i++) {
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
  // رسالة جديدة من العميل تعيد فتح محادثته المغلقة في الصندوق (wa_conv — منقول من Chatwoot)
  if (ev.kind === 'message') { try { await env.WA_DB.prepare("UPDATE wa_conv SET status = 'open', updated_at = datetime('now') WHERE dept = ? AND wa_id = ? AND status <> 'open'").bind(ev.dept, ev.wa_id).run(); } catch { /* الجدول لم يُنشأ بعد */ } }
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

  // عضو في الفريق (رقمه مسجّل في المنصة): إدارة المهام والتقارير — لا رد آلي للعملاء ولا تسجيل كعميل محتمل
  const staff = ev.dept === 'marketing' ? await findStaff(env.DB, ev.wa_id) : null;
  if (staff) {
    graph(env, `${ev.phone_number_id}/messages`, { messaging_product: 'whatsapp', status: 'read', message_id: ev.msg_id }).catch(() => {});
    await handleStaffMessage(env, ev, staff);
    return;
  }

  history.push({ r: 'customer', t: ev.text, at: new Date(now).toISOString() });
  await registerLead(env, origin, ev, ev.text);
  const fwd = await forwardIncoming(env, ev, s.customer_name);
  const skipAlert = fwd.length === 1 ? fwd[0] : null; // وصلته الرسالة كاملة بالتحويل فلا يتكرر له التنبيه

  const paused = s.handoff_until && Date.parse(s.handoff_until) > now;
  if (paused) {
    s.history = JSON.stringify(history.slice(-MAX_TURNS));
    const lastAlert = s.waiting_alert_at ? Date.parse(s.waiting_alert_at) : 0;
    if (now - lastAlert > WAIT_ALERT_MIN * 60 * 1000) {
      s.waiting_alert_at = new Date(now).toISOString();
      await alertStaff(env, `⏳ عميل ينتظر رداً على واتساب ${deptLabel(ev.dept)}\n<b>${hx(s.customer_name || ev.wa_id)}</b> · ${hx(ev.wa_id)}\n${hx(ev.text.slice(0, 300))}\n↩️ ردّ من صندوق واتساب في المنصة`, `#/wa/${threadKey(ev.dept, ev.wa_id)}`, skipAlert);
    }
    await saveSession(env, s);
    return;
  }

  // رسالة لا يسلّم واتساب محتواها للواجهة: لا تُعرض على الذكاء الاصطناعي (كان يرد على نص «unsupported»)، بل نطلب إعادتها بشكل عادي
  if (ev.type === 'unsupported') {
    const ask = 'وصلتنا رسالتك 🌷 لكنها من نوع لا يظهر لدينا (مثل الصور أو الفيديو بخاصية «عرض لمرة واحدة» أو الاستطلاعات). نرجو إرسالها مرة أخرى كرسالة أو صورة عادية، وسيتابع معك فريقنا.';
    const sentU = await sendText(env, ev.phone_number_id, ev.wa_id, ask);
    history.push({ r: 'bot', t: ask, at: new Date().toISOString() });
    s.history = JSON.stringify(history.slice(-MAX_TURNS));
    await saveSession(env, s);
    await logEvent(env, { dept: ev.dept, wa_id: ev.wa_id, kind: 'reply', reply: ask, status: sentU.ok ? 'sent' : 'send_failed', detail: JSON.stringify({ engine: 'unsupported', send_error: sentU.data?.error?.message || null }).slice(0, 1500) });
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
  if (ev.dept === 'morooj') reply = moroojWording(reply); // نشاط مروج تجاري مدفوع: لا «تبرع» في ردودها

  const sent = await sendText(env, ev.phone_number_id, ev.wa_id, reply);
  history.push({ r: 'bot', t: reply, at: new Date().toISOString() });
  s.history = JSON.stringify(history.slice(-MAX_TURNS));
  await saveSession(env, s);
  await logEvent(env, {
    dept: ev.dept, wa_id: ev.wa_id, kind: 'reply', reply, status: sent.ok ? 'sent' : 'send_failed',
    detail: JSON.stringify({ engine: ai.engine || null, ai_error: ai.ok ? null : ai.error, handoff, wamid: sent.data?.messages?.[0]?.id || null, send_error: sent.data?.error?.message || null }).slice(0, 1500),
  });
  if (handoff) {
    await alertStaff(env, `🙋 تحويل محادثة واتساب ${deptLabel(ev.dept)} لموظف\n<b>${hx(s.customer_name || ev.wa_id)}</b> · ${hx(ev.wa_id)}\nآخر رسالة: ${hx(ev.text.slice(0, 300))}${ai.ok ? '' : '\n⚠️ عطل مؤقت في الذكاء الاصطناعي'}`, `#/wa/${threadKey(ev.dept, ev.wa_id)}`, skipAlert);
  } else if (!row.session_key) {
    // أول رسالة من رقم جديد: تنبيه فوري حتى لو تولّى الرد الآلي المحادثة
    await alertStaff(env, `💬 محادثة جديدة على واتساب ${deptLabel(ev.dept)}\n<b>${hx(s.customer_name || ev.wa_id)}</b> · ${hx(ev.wa_id)}\n${hx(ev.text.slice(0, 300))}\n🤖 ${sent.ok ? 'ردّ الرد الآلي، ويمكنك المتابعة من صندوق واتساب في المنصة' : 'تعذّر إرسال الرد الآلي — ردّ بنفسك من المنصة'}`, `#/wa/${threadKey(ev.dept, ev.wa_id)}`, skipAlert);
  }
}

async function saveHistory(env, items) {
  if (!items.length) return;
  const stmts = items.map((x) => env.WA_DB.prepare('INSERT OR IGNORE INTO wa_history_import (dept, business_number, wa_id, direction, msg_type, text, ts, msg_id) VALUES (?,?,?,?,?,?,?,?)')
    .bind(x.dept, x.display_phone, x.wa_id, x.direction, x.type, x.text, x.ts, x.msg_id));
  for (let i = 0; i < stmts.length; i += 50) await env.WA_DB.batch(stmts.slice(i, i + 50));
}

export async function processWebhook(env, origin, body) {
  const events = parseEvents(body, env);
  await saveHistory(env, events.filter((e) => e.kind === 'history'));
  // الحالة لا تتراجع (قُرئت لا تعود «سُلّمت»)؛ الفشل يُسجَّل بسببه في detail.error
  const RANK = { sent: 1, delivered: 2, read: 3, failed: 4 };
  for (const s of events.filter((e) => e.kind === 'status' && RANK[e.status])) {
    try {
      await env.WA_DB.prepare(`UPDATE wa_events SET status = ?, detail = CASE WHEN ? IS NULL THEN detail ELSE json_set(COALESCE(detail, '{}'), '$.error', ?) END
        WHERE msg_id = ? AND (CASE status WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 WHEN 'failed' THEN 4 ELSE 1 END) <= ?`)
        .bind(s.status, s.error, s.error, s.msg_id, RANK[s.status]).run();
    } catch (e) { console.warn('status', e.message); }
  }
  for (const ev of events.filter((e) => e.kind !== 'history' && e.kind !== 'status')) {
    try { await handleLive(env, origin, ev); } catch (e) {
      console.error('wa', e.message);
      await logEvent(env, { dept: ev.dept, wa_id: ev.wa_id, kind: 'error', status: 'error', detail: String(e.message).slice(0, 1000) });
    }
  }
}

// التحقق من توقيع Meta (X-Hub-Signature-256) عند ضبط META_APP_SECRET
// كل خط قد يصل من تطبيق Meta مختلف: يُقبل التوقيع بسرّ تطبيق نُبل (META_APP_SECRET) أو تطبيق مروج (MOROOJ_APP_SECRET)
export async function validSignature(env, raw, header) {
  const secrets = [env.META_APP_SECRET, env.MOROOJ_APP_SECRET].filter(Boolean);
  if (!secrets.length) return true;
  if (!header || !header.startsWith('sha256=')) return false;
  const given = header.slice(7);
  for (const secret of secrets) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
    const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
    if (given.length !== hex.length) continue;
    let diff = 0; for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
    if (diff === 0) return true;
  }
  return false;
}
