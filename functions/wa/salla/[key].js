// استقبال أحداث متجر «مروج الحجاز» من سلة — POST /wa/salla/<المفتاح> (بديل Worker «morooj-whatsapp»)
// المفتاح سرّ المسار نفسه (MOROOJ_SALLA_KEY، وإلا مفتاح الـ Worker القديم) — يُرد فوراً والمعالجة في الخلفية كما تشترط سلة.
import { handleSalla, mapSallaEvent, SALLA_KEY_DEFAULT } from '../_lib/store.js';

export async function onRequestPost({ request, env, params, waitUntil }) {
  if (String(params.key || '') !== (env.MOROOJ_SALLA_KEY || SALLA_KEY_DEFAULT)) return Response.json({ ok: false, error: 'not found' }, { status: 404 });
  if (!env.DB) return Response.json({ ok: false, error: 'not configured' }, { status: 503 });
  let body; try { body = await request.json(); } catch { return Response.json({ ok: false, error: 'bad json' }, { status: 400 }); }
  const plan = mapSallaEvent(body);
  waitUntil(handleSalla(env, body).catch((e) => console.error('salla', e.message)));
  return Response.json({ ok: true, queued: plan.ready, template: plan.template, review: plan.review });
}

export async function onRequestGet({ params, env }) {
  if (String(params.key || '') !== (env.MOROOJ_SALLA_KEY || SALLA_KEY_DEFAULT)) return new Response('not found', { status: 404 });
  return Response.json({ ok: true, service: 'morooj-store-wa', token_set: !!env.MOROOJ_WA_TOKEN });
}
