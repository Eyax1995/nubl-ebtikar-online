// معرّف رقم التسويق لدى Meta (phone_number_id) — مصدر واحد لكل الإرسال
// يتغيّر المعرّف عند إعادة ربط الرقم بوضع التعايش (تطبيق واتساب أعمال + المنصة)، فتحفظه صفحة الربط /wa/connect
// في wa_config.phone_id، ويضعه الوسيط (_middleware) في env.WA_PHONE_ID الذي تقرؤه كل نقاط الإرسال قبل القيمة الثابتة
export const PHONE_ID_FALLBACK = '1368158866379375'; // المعرّف قبل التعايش (المنصة فقط — Cloud API)
export const BUSINESS_PHONE = '966563413040';

let CACHE = { v: undefined, at: 0 };

export async function storedPhoneId(env) {
  if (CACHE.v !== undefined && Date.now() - CACHE.at < 5 * 60 * 1000) return CACHE.v;
  let v = null;
  try { if (env.WA_DB) v = await env.WA_DB.prepare("SELECT value FROM wa_config WHERE key = 'phone_id'").first('value'); } catch { /* الجدول قبل التهيئة */ }
  CACHE = { v: v || null, at: Date.now() };
  return CACHE.v;
}

export function forgetPhoneId() { CACHE = { v: undefined, at: 0 }; }

/** يضع المعرّف المحفوظ (إن وُجد) في env.WA_PHONE_ID لهذا الطلب */
export async function applyPhoneId(env) {
  const v = await storedPhoneId(env);
  if (v) env.WA_PHONE_ID = v;
  return env.WA_PHONE_ID || PHONE_ID_FALLBACK;
}
