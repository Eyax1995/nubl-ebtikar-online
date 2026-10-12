// جسر واتساب لإشعارات منصة hub (بديل جسر n8n) — https://nubl-ebtikar.online/wa/bridge
// المنصة ترسل { to, title, body, summary, link } مع ترويسة x-nubl-token = wa_bridge_token من إعداداتها.
import { getSettings } from '../marketing/hub/api/_lib/core.js';
import { sendText } from './_lib/engine.js';

const FROM_PHONE_ID = '1306709292528189'; // رقم التسويق

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.WA_TOKEN) return Response.json({ delivered: false, error: 'not configured' }, { status: 503 });
  const s = await getSettings(env.DB);
  if (!s.wa_bridge_token || request.headers.get('x-nubl-token') !== s.wa_bridge_token) return Response.json({ delivered: false }, { status: 403 });
  let d = {}; try { d = await request.json(); } catch { /* */ }
  const to = String(d.to || '').replace(/\D/g, '').replace(/^0(5\d{8})$/, '966$1');
  if (to.length < 10) return Response.json({ delivered: false, error: 'bad number' }, { status: 400 });
  const text = [`🔔 ${d.title || 'إشعار من منصة التسويق'}`, d.body || '', d.link ? `↗ ${d.link}` : ''].filter(Boolean).join('\n').slice(0, 3500);
  const r = await sendText(env, FROM_PHONE_ID, to, text);
  return Response.json({ delivered: r.ok, wamid: r.data?.messages?.[0]?.id || null, error: r.data?.error?.message || null }, { status: r.ok ? 200 : 502 });
}
