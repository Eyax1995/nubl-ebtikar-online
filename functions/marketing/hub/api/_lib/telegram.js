// واجهة Telegram Bot API — الإرسال والإشعارات (بلا مكتبات خارجية)
import { getSettings } from './core.js';

export const HUB_URL = 'https://nubl-ebtikar.online/marketing/hub/';

export async function tgToken(db, env) {
  if (env && env.TG_BOT_TOKEN) return env.TG_BOT_TOKEN;
  const s = await getSettings(db);
  return s.tg_token || null;
}

export async function tgCall(env, token, method, payload) {
  const base = (env && env.TG_API) || 'https://api.telegram.org';
  const r = await fetch(`${base}/bot${token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload || {}),
  });
  let d = {}; try { d = await r.json(); } catch { /* */ }
  if (!d.ok) console.warn('telegram', method, d.description || r.status);
  return d;
}

// يحوّل الرموز الخاصة لنمط HTML في تلجرام
export const h = (v) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// ======================================================================
// الإشعارات متعددة القنوات: مركز الإشعارات في المنصة + تلجرام + واتساب (عبر جسر n8n)
// لا تُفشل العملية الأصلية أبداً — كل قناة مستقلة عن الأخرى
const plainText = (t) => String(t ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();

function guessKind(text) {
  const t = String(text || '');
  if (/مهمة جديدة/.test(t)) return 'task_assigned';
  if (/مهمة|📌/.test(t)) return 'task_update';
  if (/عميل محتمل|عميل جديد/.test(t)) return 'lead';
  if (/فاتورة|سداد|دفعة|عقد/.test(t)) return 'finance';
  if (/ملاحظة/.test(t)) return 'note';
  return 'general';
}

function linkFrom(keyboard) {
  try {
    for (const row of keyboard || []) for (const b of row) {
      const m = /^k:(\d+)$/.exec(b.callback_data || '');
      if (m) return `#tasks/${m[1]}`;
    }
  } catch { /* */ }
  return '';
}

// يرسل لجسر واتساب في n8n — يُستخدم أيضاً لاختبار الجسر من الإعدادات
export async function waBridge(db, payload) {
  const s = await getSettings(db);
  if (!s.wa_bridge_url || !s.wa_bridge_token) return { ok: false, error: 'جسر واتساب غير مضبوط' };
  try {
    const r = await fetch(s.wa_bridge_url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nubl-token': s.wa_bridge_token },
      body: JSON.stringify({ source: 'marketing-hub', ...payload }),
      signal: AbortSignal.timeout(6000),
    });
    let d = {}; try { d = await r.json(); } catch { /* */ }
    return { ok: r.ok && d.delivered !== false, status: r.status, ...d };
  } catch (e) { return { ok: false, error: e.message }; }
}

export async function notifyUser(db, env, userId, text, keyboard, opts = {}) {
  try {
    if (!userId) return false;
    const u = await db.prepare('SELECT id, name, phone, tg_chat_id, notify_wa, notify_tg FROM users WHERE id = ? AND active = 1').bind(userId).first();
    if (!u) return false;
    const plain = plainText(text);
    const lines = plain.split('\n').map((x) => x.trim()).filter(Boolean);
    const title = (opts.title || lines[0] || 'إشعار').slice(0, 160);
    const bodyTxt = (opts.title ? lines : lines.slice(1)).join('\n').slice(0, 1500);
    const kind = opts.kind || guessKind(plain);
    const link = opts.link || linkFrom(keyboard);
    const channels = ['app'];
    let ok = false;

    // 1) تلجرام
    if (u.tg_chat_id && u.notify_tg !== 0 && !opts.skipTg) {
      const token = await tgToken(db, env);
      if (token) {
        const payload = { chat_id: u.tg_chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true };
        if (keyboard) payload.reply_markup = { inline_keyboard: keyboard };
        const r = await tgCall(env, token, 'sendMessage', payload);
        if (r.ok) { ok = true; channels.push('tg'); }
      }
    }
    // 2) واتساب — للمستخدم الذي سجّل جواله ولم يوقف القناة
    const ksaHour = (new Date().getUTCHours() + 3) % 24;
    const quiet = (ksaHour >= 23 || ksaHour < 7) && !opts.urgent; // لا واتساب ليلاً — يبقى في المنصة وتلجرام
    if (u.phone && u.notify_wa !== 0 && !opts.skipWa && !quiet) {
      const r = await waBridge(db, {
        to: u.phone, name: u.name, kind, title, body: bodyTxt,
        summary: (title + (bodyTxt ? ' · ' + bodyTxt : '')).replace(/\s+/g, ' ').slice(0, 900),
        link: HUB_URL + (link || ''),
      });
      if (r.ok) { ok = true; channels.push('wa'); }
    }
    // 3) مركز الإشعارات داخل المنصة — دائماً
    await db.prepare('INSERT INTO notifications (user_id, kind, title, body, link, channels) VALUES (?,?,?,?,?,?)')
      .bind(u.id, kind, title, bodyTxt || null, link || null, channels.join(',')).run();
    return ok;
  } catch (e) { console.warn('notify', e.message); return false; }
}

// إشعار مجموعة أدوار (مثلاً: عميل محتمل جديد للإدارة والمبيعات)
export async function notifyRoles(db, env, roles, text, opts = {}, exceptId = null) {
  try {
    const list = (Array.isArray(roles) ? roles : String(roles || '').split(',')).map((r) => r.trim()).filter(Boolean);
    if (!list.length) return 0;
    const { results } = await db.prepare(`SELECT id FROM users WHERE active = 1 AND role IN (${list.map(() => '?').join(',')})`).bind(...list).all();
    let n = 0;
    for (const r of results) if (r.id !== exceptId) { await notifyUser(db, env, r.id, text, null, opts); n++; }
    return n;
  } catch (e) { console.warn('notifyRoles', e.message); return 0; }
}

// بطاقة مهمة مختصرة للإشعارات
export function taskLine(t, clientName) {
  return `📌 <b>${h(t.title)}</b>${clientName ? `\n🏷️ ${h(clientName)}` : ''}${t.due_date ? `\n📅 ${h(t.due_date)}` : ''}${t.priority && t.priority !== 'عادية' ? ` · ${h(t.priority)}` : ''}`;
}
export const openTaskKb = (id) => [[{ text: 'فتح المهمة', callback_data: `k:${id}` }]];
