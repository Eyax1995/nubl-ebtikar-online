// صفحة ربط رقم «نُبل وابتكار للتسويق» بالحساب الموثّق مع إبقاء تطبيق واتساب للأعمال (Coexistence)
// https://nubl-ebtikar.online/wa/connect?c=<CONFIG_ID>
// GET: صفحة التسجيل المضمّن (Embedded Signup) · POST: حفظ معرّفات الحساب والرقم الناتجة في WA_DB
const APP_ID = '1399023689070366';
const GRAPH_V = 'v23.0';

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const cfg = (q.get('c') || env.WA_ES_CONFIG_ID || '').replace(/\D/g, '');
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>ربط واتساب — نبل وابتكار للتسويق</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
<style>body{font-family:Tajawal,sans-serif;background:#0d2b30;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}
.c{max-width:520px;background:#12393f;border-radius:16px;padding:28px;box-shadow:0 10px 40px #0006}
h1{color:#35c2b5;font-size:22px;margin:0 0 8px}p{line-height:1.8;color:#d6e6e8}
button{background:#f08a24;color:#fff;border:0;border-radius:10px;padding:14px 22px;font:700 17px Tajawal;cursor:pointer;width:100%}
button:disabled{opacity:.5}#log{margin-top:16px;font-size:14px;white-space:pre-wrap;color:#ffd9a8}</style></head>
<body><div class="c"><h1>ربط رقم التسويق بالحساب الموثّق</h1>
<p>اضغط الزر، سجّل الدخول، اختر المحفظة <b>نُبل و أبتكار</b>، ثم اختر <b>«ربط تطبيق WhatsApp Business الحالي»</b> وامسح رمز QR من جوال التسويق ووافق على مشاركة سجل المحادثات.</p>
<button id="b" ${cfg ? '' : 'disabled'}>ابدأ الربط</button><div id="log">${cfg ? '' : 'معرّف الإعداد (config_id) غير موجود في الرابط.'}</div></div>
<script>
const CFG='${cfg}';const log=t=>{document.getElementById('log').textContent+=t+'\\n'};
let result={};
window.addEventListener('message',e=>{
  if(!/facebook\\.com$/.test(new URL(e.origin).hostname))return;
  let d;try{d=JSON.parse(e.data)}catch{return}
  if(d.type!=='WA_EMBEDDED_SIGNUP')return;
  result={event:d.event,...(d.data||{})};
  log('الحدث: '+d.event+(d.data&&d.data.phone_number_id?' · رقم: '+d.data.phone_number_id:'')+(d.data&&d.data.waba_id?' · حساب: '+d.data.waba_id:''));
  fetch(location.pathname,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(result)}).catch(()=>{});
});
window.fbAsyncInit=function(){FB.init({appId:'${APP_ID}',autoLogAppEvents:true,xfbml:false,version:'${GRAPH_V}'})};
document.getElementById('b').onclick=()=>{
  FB.login(r=>{
    if(r.authResponse){log('تم الربط من جهة Meta ✓');fetch(location.pathname,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...result,code_received:true})}).catch(()=>{})}
    else log('لم يكتمل الربط أو أُلغي.');
  },{config_id:CFG,response_type:'code',override_default_response_type:true,
     extras:{setup:{},featureType:'whatsapp_business_app_onboarding',sessionInfoVersion:'3'}});
};
</script><script async defer crossorigin="anonymous" src="https://connect.facebook.net/ar_AR/sdk.js"></script>
</body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function onRequestPost({ request, env }) {
  if (!env.WA_DB) return new Response('not configured', { status: 503 });
  let b; try { b = await request.json(); } catch { return new Response('bad', { status: 400 }); }
  const clean = {
    event: String(b.event || '').slice(0, 60),
    waba_id: String(b.waba_id || '').replace(/\D/g, '').slice(0, 20),
    phone_number_id: String(b.phone_number_id || '').replace(/\D/g, '').slice(0, 20),
    business_id: String(b.business_id || '').replace(/\D/g, '').slice(0, 20),
    code_received: !!b.code_received,
    at: new Date().toISOString(),
  };
  if (!clean.event && !clean.code_received) return new Response('ignored', { status: 200 });
  await env.WA_DB.prepare('INSERT OR REPLACE INTO wa_config (key, value) VALUES (?, ?)')
    .bind('es_' + Date.now(), JSON.stringify(clean)).run();
  return new Response('ok', { status: 200 });
}
