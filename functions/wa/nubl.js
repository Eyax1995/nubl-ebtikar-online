// Webhook واتساب لنُبل وابتكار — https://nubl-ebtikar.online/wa/nubl
// GET: تحقق Meta من الرابط · POST: رسائل العملاء (يُرد 200 فوراً والمعالجة في الخلفية)
import { processWebhook, validSignature } from './_lib/engine.js';

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  if (q.get('hub.mode') === 'subscribe' && env.WA_VERIFY_TOKEN && q.get('hub.verify_token') === env.WA_VERIFY_TOKEN) {
    return new Response(q.get('hub.challenge') || '', { status: 200 });
  }
  return new Response('forbidden', { status: 403 });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.WA_DB || !env.WA_TOKEN || !env.GEMINI_API_KEY) return new Response('not configured', { status: 503 });
  const raw = await request.text();
  // اختبار داخلي: ترويسة x-nubl-sim تساوي رمز التحقق تتجاوز فحص التوقيع
  const sim = env.WA_VERIFY_TOKEN && request.headers.get('x-nubl-sim') === env.WA_VERIFY_TOKEN;
  if (!sim && !(await validSignature(env, raw, request.headers.get('x-hub-signature-256')))) {
    return new Response('bad signature', { status: 401 });
  }
  let body; try { body = JSON.parse(raw); } catch { return new Response('ok', { status: 200 }); }
  const origin = new URL(request.url).origin;
  context.waitUntil(processWebhook(env, origin, body));
  return new Response('ok', { status: 200 });
}
