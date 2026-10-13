// جسر واتساب لإشعارات منصة hub (بديل جسر n8n) — https://nubl-ebtikar.online/wa/bridge
// المنصة ترسل { to, title, body, summary, link } مع ترويسة x-nubl-token = wa_bridge_token من إعداداتها.
// قاعدة واتساب: الرسالة الحرة تصل فقط إذا راسلنا الموظف خلال آخر 24 ساعة؛ وإلا نرسل القالب الخدمي المعتمد nubl_team_alert.
import { getSettings } from '../marketing/hub/api/_lib/core.js';
import { sendText } from './_lib/engine.js';

const FROM_PHONE_ID = '1368158866379375'; // رقم التسويق 0563413040 (الحساب الموثّق)
const TEMPLATE = 'nubl_team_alert';
const clip = (s, n) => String(s || '').replace(/[\n\t]+/g, ' — ').replace(/ {4,}/g, '   ').trim().slice(0, n);

async function windowOpen(env, to) {
  if (!env.WA_DB) return false;
  try {
    const r = await env.WA_DB.prepare("SELECT at FROM wa_events WHERE wa_id = ? AND kind = 'message' ORDER BY id DESC LIMIT 1").bind(to).first();
    return !!(r && Date.now() - Date.parse(String(r.at).replace(' ', 'T') + 'Z') < 23.5 * 3600e3);
  } catch { return false; }
}

async function sendTemplate(env, to, title, details) {
  const r = await fetch(`https://graph.facebook.com/v23.0/${FROM_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.WA_TOKEN },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to, type: 'template',
      template: { name: TEMPLATE, language: { code: 'ar' }, components: [{ type: 'body', parameters: [{ type: 'text', text: title }, { type: 'text', text: details }] }] },
    }),
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.WA_TOKEN) return Response.json({ delivered: false, error: 'not configured' }, { status: 503 });
  const s = await getSettings(env.DB);
  if (!s.wa_bridge_token || request.headers.get('x-nubl-token') !== s.wa_bridge_token) return Response.json({ delivered: false }, { status: 403 });
  let d = {}; try { d = await request.json(); } catch { /* */ }
  const to = String(d.to || '').replace(/\D/g, '').replace(/^0(5\d{8})$/, '966$1');
  if (to.length < 10) return Response.json({ delivered: false, error: 'bad number' }, { status: 400 });

  let r; let mode;
  if (await windowOpen(env, to)) {
    mode = 'text';
    const text = [`🔔 ${d.title || 'إشعار من منصة التسويق'}`, d.body || '', d.link ? `↗ ${d.link}` : ''].filter(Boolean).join('\n').slice(0, 3500);
    r = await sendText(env, FROM_PHONE_ID, to, text);
  } else {
    mode = 'template';
    const title = clip(d.title || 'إشعار من منصة التسويق', 200) || 'إشعار';
    const details = clip([d.body || d.summary || '', d.link ? `الرابط: ${d.link}` : ''].filter(Boolean).join(' — '), 900) || 'افتح المنصة للتفاصيل';
    r = await sendTemplate(env, to, title, details);
  }
  return Response.json({ delivered: r.ok, mode, wamid: r.data?.messages?.[0]?.id || null, error: r.data?.error?.message || null }, { status: r.ok ? 200 : 502 });
}
