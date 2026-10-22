// واجهة المنصة: معرّف رقم واتساب الحالي من إعداد الربط (صندوق واتساب، البوابة، مسار العميل) — انظر wa/_lib/phone.js
import { applyPhoneId } from '../../../wa/_lib/phone.js';

export async function onRequest(ctx) {
  try { await applyPhoneId(ctx.env); } catch { /* يبقى المعرّف الافتراضي */ }
  return ctx.next();
}
