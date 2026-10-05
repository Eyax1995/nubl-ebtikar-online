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

// إرسال رسالة لعضو فريق مرتبط بتلجرام — لا يُفشل العملية الأصلية أبداً
export async function notifyUser(db, env, userId, text, keyboard) {
  try {
    if (!userId) return false;
    const token = await tgToken(db, env); if (!token) return false;
    const u = await db.prepare('SELECT tg_chat_id FROM users WHERE id = ? AND active = 1').bind(userId).first();
    if (!u || !u.tg_chat_id) return false;
    const payload = { chat_id: u.tg_chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true };
    if (keyboard) payload.reply_markup = { inline_keyboard: keyboard };
    const r = await tgCall(env, token, 'sendMessage', payload);
    return !!r.ok;
  } catch (e) { console.warn('notify', e.message); return false; }
}

// بطاقة مهمة مختصرة للإشعارات
export function taskLine(t, clientName) {
  return `📌 <b>${h(t.title)}</b>${clientName ? `\n🏷️ ${h(clientName)}` : ''}${t.due_date ? `\n📅 ${h(t.due_date)}` : ''}${t.priority && t.priority !== 'عادية' ? ` · ${h(t.priority)}` : ''}`;
}
export const openTaskKb = (id) => [[{ text: 'فتح المهمة', callback_data: `k:${id}` }]];
