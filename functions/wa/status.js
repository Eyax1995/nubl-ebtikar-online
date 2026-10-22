// حالة النظام: توثيق محفظة Meta + جاهزية الإعدادات — https://nubl-ebtikar.online/wa/status
const BUSINESS_ID = '907479692454066'; // المحفظة الموثّقة
const PHONE_ID = '1368158866379375'; // رقم التسويق 0563413040

export async function onRequestGet({ request, env }) {
  const out = {
    configured: { WA_DB: !!env.WA_DB, WA_TOKEN: !!env.WA_TOKEN, GEMINI_API_KEY: !!env.GEMINI_API_KEY, WA_VERIFY_TOKEN: !!env.WA_VERIFY_TOKEN, META_APP_SECRET: !!env.META_APP_SECRET },
    verification_status: null, webhook_subscribed: null, error: null,
  };
  // تشخيص مؤقت لصفحة الربط (?diag=1): حالة تطبيق Meta ونطاقاته وإعداد Embedded Signup — بلا أسرار
  if (new URL(request.url).searchParams.get('diag') && env.META_APP_SECRET) {
    const at = encodeURIComponent('1399023689070366|' + env.META_APP_SECRET);
    const j = async (u) => { try { return await (await fetch(u)).json(); } catch (e) { return { error: { message: e.message } }; } };
    out.diag = {
      app: await j(`https://graph.facebook.com/v23.0/1399023689070366?fields=name,app_domains,category,link,namespace,restrictions,supported_platforms,website_url&access_token=${at}`),
      config: await j(`https://graph.facebook.com/v23.0/1676326380744691?access_token=${at}`),
      roles: await j(`https://graph.facebook.com/v23.0/1399023689070366/roles?access_token=${at}`),
      permissions: await j(`https://graph.facebook.com/v23.0/1399023689070366/permissions?access_token=${at}`),
    };
    if (out.diag.roles && out.diag.roles.data) out.diag.roles = { count: out.diag.roles.data.length, roles: out.diag.roles.data.map((r) => r.role) };
  }
  try {
    if (env.WA_TOKEN) {
      const auth = { headers: { authorization: `Bearer ${env.WA_TOKEN}` } };
      const b = await (await fetch(`https://graph.facebook.com/v23.0/${BUSINESS_ID}?fields=verification_status`, auth)).json();
      out.verification_status = b.verification_status || null;
      if (b.error) out.error = b.error.message;
      const p = await (await fetch(`https://graph.facebook.com/v23.0/${env.WA_PHONE_ID || PHONE_ID}?fields=health_status,status,platform_type,is_on_biz_app,code_verification_status,quality_rating,verified_name,name_status`, auth)).json();
      // وضع التعايش: is_on_biz_app=true يعني أن الرقم يعمل في تطبيق واتساب أعمال على الجوال والمنصة معاً
      out.phone = { status: p.status || null, platform_type: p.platform_type || null, is_on_biz_app: p.is_on_biz_app ?? null,
        code_verification_status: p.code_verification_status || null, quality_rating: p.quality_rating || null, verified_name: p.verified_name || null, name_status: p.name_status || null };
      if (p.error) out.phone_error = p.error.message;
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
