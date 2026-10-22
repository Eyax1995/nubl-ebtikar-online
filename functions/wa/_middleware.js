// مسارات واتساب: معرّف الرقم الحالي من إعداد الربط (انظر _lib/phone.js)
import { applyPhoneId } from './_lib/phone.js';

export async function onRequest(ctx) {
  try { await applyPhoneId(ctx.env); } catch { /* يبقى المعرّف الافتراضي */ }
  return ctx.next();
}
