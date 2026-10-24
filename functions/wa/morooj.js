// Webhook واتساب لرقم «مروج الحجاز» 0544004650 — https://nubl-ebtikar.online/wa/morooj (بديل Chatwoot، 24 أكتوبر 2026)
// يُوجَّه إليه الرقم من Meta بـ override_callback_uri على مستوى الرقم، فلا يمس إعداد تطبيق مروج ولا رقم التسويق.
// GET: تحقق Meta برمز مخزن في WA_DB (wa_config.morooj_verify) · POST: توقيع تطبيق مروج إلزامي (MOROOJ_APP_SECRET)
import { processWebhook } from './_lib/engine.js';

async function hmacOk(secret, raw, header) {
  if (!header || !header.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const given = header.slice(7);
  if (given.length !== hex.length) return false;
  let diff = 0; for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const want = env.WA_DB ? await env.WA_DB.prepare("SELECT value FROM wa_config WHERE key = 'morooj_verify'").first('value').catch(() => null) : null;
  if (q.get('hub.mode') === 'subscribe' && want && q.get('hub.verify_token') === want) return new Response(q.get('hub.challenge') || '', { status: 200 });
  return new Response('forbidden', { status: 403 });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  // بلا سرّ التطبيق لا نقبل رسائل غير موقّعة: 503 يجعل Meta تعيد المحاولة لاحقاً بدل ضياعها
  if (!env.WA_DB || !env.MOROOJ_WA_TOKEN || !env.MOROOJ_APP_SECRET) return new Response('not configured', { status: 503 });
  const raw = await request.text();
  const sim = env.WA_VERIFY_TOKEN && request.headers.get('x-nubl-sim') === env.WA_VERIFY_TOKEN; // اختبار داخلي
  if (!sim && !(await hmacOk(env.MOROOJ_APP_SECRET, raw, request.headers.get('x-hub-signature-256')))) return new Response('bad signature', { status: 401 });
  let body; try { body = JSON.parse(raw); } catch { return new Response('ok', { status: 200 }); }
  context.waitUntil(processWebhook(env, new URL(request.url).origin, body));
  return new Response('ok', { status: 200 });
}
