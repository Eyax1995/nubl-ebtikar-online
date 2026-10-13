// حالة النظام: توثيق محفظة Meta + جاهزية الإعدادات — https://nubl-ebtikar.online/wa/status
const BUSINESS_ID = '907479692454066'; // المحفظة الموثّقة
const PHONE_ID = '1368158866379375'; // رقم التسويق 0563413040

export async function onRequestGet({ env }) {
  const out = {
    configured: { WA_DB: !!env.WA_DB, WA_TOKEN: !!env.WA_TOKEN, GEMINI_API_KEY: !!env.GEMINI_API_KEY, WA_VERIFY_TOKEN: !!env.WA_VERIFY_TOKEN, META_APP_SECRET: !!env.META_APP_SECRET },
    verification_status: null, webhook_subscribed: null, error: null,
  };
  try {
    if (env.WA_TOKEN) {
      const auth = { headers: { authorization: `Bearer ${env.WA_TOKEN}` } };
      const b = await (await fetch(`https://graph.facebook.com/v23.0/${BUSINESS_ID}?fields=verification_status`, auth)).json();
      out.verification_status = b.verification_status || null;
      if (b.error) out.error = b.error.message;
      const p = await (await fetch(`https://graph.facebook.com/v23.0/${PHONE_ID}?fields=health_status`, auth)).json();
      const ents = (p.health_status && p.health_status.entities) || [];
      const app = ents.find((e) => e.entity_type === 'APP');
      out.webhook_subscribed = app ? !(app.additional_info || []).some((t) => /not subscribed to the message webhook/i.test(t)) : null;
    }
    if (env.WA_DB) {
      out.last_event = await env.WA_DB.prepare('SELECT at, dept, kind, status FROM wa_events ORDER BY id DESC LIMIT 1').first();
    }
  } catch (e) { out.error = e.message; }
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
