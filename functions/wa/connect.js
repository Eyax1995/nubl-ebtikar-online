// صفحة ربط رقم «نُبل وابتكار للتسويق» بوضع التعايش (Coexistence): تطبيق واتساب أعمال على الجوال + المنصة معاً
// https://nubl-ebtikar.online/wa/connect?c=<CONFIG_ID>   (معرّف إعداد Embedded Signup من تطبيق Meta، أو WA_ES_CONFIG_ID)
// GET: صفحة الربط · POST: يكمل الربط آلياً بعد مسح رمز QR من التطبيق:
//   1) تحويل رمز Meta إلى صلاحية للحساب (META_APP_SECRET)  2) تحديد الحساب والرقم 966563413040
//   3) اشتراك تطبيقنا في الحساب + حقول الويب هوك (messages، smb_message_echoes، history، smb_app_state_sync)
//   4) حفظ معرّف الرقم الجديد (wa_config.phone_id) فتعتمده كل نقاط الإرسال  5) طلب مزامنة جهات الاتصال والمحادثات (خلال 24 ساعة)
import { BUSINESS_PHONE, forgetPhoneId } from './_lib/phone.js';

const APP_ID = '1399023689070366';
const GRAPH_V = 'v23.0';
const G = `https://graph.facebook.com/${GRAPH_V}`;
const WEBHOOK_FIELDS = ['messages', 'smb_message_echoes', 'history', 'smb_app_state_sync'];

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const cfg = (q.get('c') || env.WA_ES_CONFIG_ID || '').replace(/\D/g, '');
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>ربط واتساب — نبل وابتكار للتسويق</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
<style>body{font-family:Tajawal,sans-serif;background:#0d2b30;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}
.c{max-width:560px;background:#12393f;border-radius:16px;padding:28px;box-shadow:0 10px 40px #0006}
h1{color:#35c2b5;font-size:22px;margin:0 0 8px}p,li{line-height:1.8;color:#d6e6e8}ol{padding-inline-start:20px;margin:8px 0 16px}
button{background:#f08a24;color:#fff;border:0;border-radius:10px;padding:14px 22px;font:700 17px Tajawal;cursor:pointer;width:100%}
button:disabled{opacity:.5}#log{margin-top:16px;font-size:14px;white-space:pre-wrap;color:#ffd9a8}.ok{color:#7fe0a3}.bad{color:#ff9a8a}</style></head>
<body><div class="c"><h1>ربط رقم التسويق بوضع التعايش</h1>
<p>يعمل الرقم <b>0563413040</b> بعدها في تطبيق واتساب أعمال على الجوال وفي المنصة معاً، وتتزامن الرسائل بينهما.</p>
<ol><li>تأكد أن الرقم مفعّل الآن في <b>تطبيق واتساب أعمال</b> على الجوال (إصدار حديث).</li>
<li>اضغط «ابدأ الربط» وسجّل الدخول بحساب فيسبوك المدير للمحفظة <b>نُبل و أبتكار</b>.</li>
<li>اختر <b>«ربط تطبيق WhatsApp Business الحالي»</b> ثم امسح رمز QR من التطبيق على الجوال.</li>
<li>وافق على مشاركة سجل المحادثات لتظهر في المنصة.</li></ol>
<button id="b" ${cfg ? '' : 'disabled'}>ابدأ الربط</button><div id="log">${cfg ? '' : 'معرّف الإعداد (config_id) غير موجود في الرابط.'}</div></div>
<script>
const CFG='${cfg}';const L=document.getElementById('log');const log=(t,c)=>{const d=document.createElement('div');if(c)d.className=c;d.textContent=t;L.appendChild(d)};
let info={};
window.addEventListener('message',e=>{
  let host='';try{host=new URL(e.origin).hostname}catch{return}
  if(!/(^|\\.)facebook\\.com$/.test(host))return;
  let d;try{d=typeof e.data==='string'?JSON.parse(e.data):e.data}catch{return}
  if(!d||d.type!=='WA_EMBEDDED_SIGNUP')return;
  info={event:d.event||'',...(d.data||{})};
  log('حدث Meta: '+(d.event||'')+(info.waba_id?' · الحساب '+info.waba_id:'')+(info.phone_number_id?' · الرقم '+info.phone_number_id:''));
});
window.fbAsyncInit=function(){FB.init({appId:'${APP_ID}',autoLogAppEvents:true,xfbml:false,version:'${GRAPH_V}'})};
document.getElementById('b').onclick=()=>{
  const btn=document.getElementById('b');btn.disabled=true;
  FB.login(r=>{
    const code=r.authResponse&&r.authResponse.code;
    if(!code){log('لم يكتمل الربط أو أُلغي — يمكنك المحاولة مرة أخرى.','bad');btn.disabled=false;return;}
    log('اكتمل الربط من جهة Meta — جارٍ إكمال الإعداد في المنصة…');
    setTimeout(()=>fetch(location.pathname,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,...info})})
      .then(x=>x.json()).then(res=>{(res.steps||[]).forEach(s=>log((s.ok?'✓ ':'✗ ')+s.step+(s.note?' — '+s.note:''),s.ok?'ok':'bad'));
        log(res.ok?'تم الربط بوضع التعايش ✓ — جرّب إرسال رسالة من التطبيق وستظهر في صندوق المنصة.':'لم تكتمل كل الخطوات — أرسل لقطة هذه الصفحة للدعم الفني.',res.ok?'ok':'bad');btn.disabled=false})
      .catch(()=>{log('تعذّر الاتصال بالمنصة','bad');btn.disabled=false}),1500); // مهلة قصيرة لوصول حدث Meta بمعرّفات الحساب والرقم
  },{config_id:CFG,response_type:'code',override_default_response_type:true,
     extras:{setup:{},featureType:'whatsapp_business_app_onboarding',sessionInfoVersion:'3'}});
};
</script><script async defer crossorigin="anonymous" src="https://connect.facebook.net/ar_AR/sdk.js"></script>
</body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

async function gget(path, token) {
  const r = await fetch(`${G}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`);
  let d = {}; try { d = await r.json(); } catch { /* */ }
  return { ok: r.ok && !d.error, d };
}
async function gpost(path, token, body) {
  const r = await fetch(`${G}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body || {}) });
  let d = {}; try { d = await r.json(); } catch { /* */ }
  return { ok: r.ok && !d.error, d };
}
const errOf = (d) => (d && d.error && (d.error.error_user_msg || d.error.message)) || '';

export async function onRequestPost({ request, env }) {
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  if (!env.WA_DB) return json({ ok: false, steps: [{ step: 'قاعدة واتساب غير مربوطة', ok: false }] }, 503);
  let b; try { b = await request.json(); } catch { return json({ ok: false }, 400); }
  const steps = [];
  const save = (k, v) => env.WA_DB.prepare('INSERT OR REPLACE INTO wa_config (key, value) VALUES (?, ?)').bind(k, v).run();
  const digits = (v) => String(v || '').replace(/\D/g, '').slice(0, 25);
  // سجل المحاولة (بلا الرمز)
  await save('es_' + Date.now(), JSON.stringify({ event: String(b.event || '').slice(0, 60), waba_id: digits(b.waba_id), phone_number_id: digits(b.phone_number_id), code_received: !!b.code, at: new Date().toISOString() }));
  if (!b.code) return json({ ok: false, steps: [{ step: 'لم يصل رمز Meta', ok: false }] });
  if (!env.META_APP_SECRET) return json({ ok: false, steps: [{ step: 'سرّ تطبيق Meta غير مضبوط (META_APP_SECRET)', ok: false }] });
  const appToken = `${APP_ID}|${env.META_APP_SECRET}`;

  // 1) صلاحية الحساب من الرمز
  const ex = await gget(`oauth/access_token?client_id=${APP_ID}&client_secret=${encodeURIComponent(env.META_APP_SECRET)}&code=${encodeURIComponent(b.code)}`, appToken);
  const token = ex.d && ex.d.access_token;
  steps.push({ step: 'تحويل رمز Meta إلى صلاحية', ok: !!token, note: token ? '' : errOf(ex.d) });
  if (!token) return json({ ok: false, steps });

  // 2) الحساب والرقم: من حدث Meta، وإلا من نطاق الصلاحية
  let waba = digits(b.waba_id);
  if (!waba) {
    const dbg = await gget(`debug_token?input_token=${encodeURIComponent(token)}`, appToken);
    const sc = ((dbg.d.data && dbg.d.data.granular_scopes) || []).find((s) => s.scope === 'whatsapp_business_management');
    waba = digits(sc && sc.target_ids && sc.target_ids[0]);
  }
  let phoneId = '';
  if (waba) {
    const pn = await gget(`${waba}/phone_numbers?fields=id,display_phone_number,is_on_biz_app,platform_type`, token);
    const hit = ((pn.d && pn.d.data) || []).find((p) => digits(p.display_phone_number).endsWith(BUSINESS_PHONE.slice(-9)));
    if (hit) phoneId = String(hit.id);
    steps.push({ step: 'تحديد حساب واتساب ورقم التسويق', ok: !!phoneId, note: phoneId ? `الرقم ${hit.display_phone_number} · ${hit.is_on_biz_app ? 'يعمل في التطبيق أيضاً (تعايش)' : 'ليس في وضع التعايش'}` : (errOf(pn.d) || 'الرقم 0563413040 غير موجود في الحساب المختار') });
  } else steps.push({ step: 'تحديد حساب واتساب', ok: false, note: 'لم يُعرف الحساب من Meta' });
  if (!phoneId) return json({ ok: false, steps });

  // 3) اشتراك التطبيق في الحساب + حقول الويب هوك (مع إبقاء الحقول الموجودة)
  const sub = await gpost(`${waba}/subscribed_apps`, token, {});
  steps.push({ step: 'اشتراك المنصة في حساب واتساب', ok: sub.ok, note: sub.ok ? '' : errOf(sub.d) });
  const cur = await gget(`${APP_ID}/subscriptions`, appToken);
  const obj = ((cur.d && cur.d.data) || []).find((x) => x.object === 'whatsapp_business_account');
  const have = obj ? (obj.fields || []).map((f) => (typeof f === 'string' ? f : f.name)) : [];
  const fields = [...new Set([...have, ...WEBHOOK_FIELDS])];
  const hook = await fetch(`${G}/${APP_ID}/subscriptions`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ object: 'whatsapp_business_account', callback_url: new URL('/wa/nubl', request.url).href, verify_token: env.WA_VERIFY_TOKEN || '', fields: fields.join(','), access_token: appToken }),
  }).then((r) => r.json()).catch((e) => ({ error: { message: e.message } }));
  steps.push({ step: 'تفعيل وصول رسائل التطبيق والمحادثات السابقة للمنصة', ok: !hook.error, note: hook.error ? errOf(hook) : fields.join('، ') });

  // 4) المعرّف الجديد لكل نقاط الإرسال
  await save('phone_id', phoneId); await save('waba_id', waba); await save('coex_token', token); await save('coex_at', new Date().toISOString());
  forgetPhoneId();
  steps.push({ step: 'اعتماد معرّف الرقم في المنصة', ok: true, note: phoneId });

  // 5) مزامنة جهات الاتصال ثم المحادثات السابقة (تُطلب خلال 24 ساعة من الربط)
  for (const [t, label] of [['smb_app_state_sync', 'مزامنة جهات الاتصال'], ['history', 'استيراد المحادثات السابقة']]) {
    const s = await gpost(`${phoneId}/smb_app_data`, token, { messaging_product: 'whatsapp', sync_type: t });
    steps.push({ step: label, ok: s.ok, note: s.ok ? 'بدأت — تصل خلال دقائق' : errOf(s.d) });
  }
  return json({ ok: steps.every((s) => s.ok), steps });
}
