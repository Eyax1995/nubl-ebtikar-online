// /.well-known/* — يمنع الموقع من إرجاع الصفحة الرئيسية (HTML بحالة 200) لمسارات الاكتشاف.
// عملاء MCP (مثل Claude) يفحصون /.well-known/oauth-* قبل الاتصال؛ إرجاع HTML يوهمهم بوجود OAuth فيفشل الربط.
// أي ملف حقيقي موجود داخل /.well-known/ يُخدم كما هو.
export async function onRequest(ctx) {
  const res = await ctx.next();
  const type = res.headers.get('content-type') || '';
  if (res.status === 200 && !type.includes('text/html')) return res;
  return new Response(JSON.stringify({ error: 'not_found' }), {
    status: 404, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
