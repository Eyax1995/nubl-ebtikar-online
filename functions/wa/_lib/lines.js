// خطوط واتساب التي تخدمها المنصة — مصدر واحد للمعرّفات والتوكنات لكل رقم (24 أكتوبر 2026)
// marketing: «نُبل وابتكار للتسويق» 0563413040 (القسم الأصلي) · morooj: «مروج الحجاز للأعمال التجارية» 0544004650 (نُقل من Chatwoot)
// لكل خط توكنه: مروج على حساب أعمال Meta مستقل، فتوكنها MOROOJ_WA_TOKEN وسرّ تطبيقها MOROOJ_APP_SECRET (أسرار Cloudflare فقط).
// معرّف المحادثة في الواجهة: رقم العميل وحده لخط التسويق (كما كان)، و«morooj.<الرقم>» لخط مروج — فتحمل كل الروابط والمسارات خطّها.

export const LINES = {
  marketing: {
    dept: 'marketing', org: 'nubl', brand: 'نبل وابتكار للتسويق', label: 'التسويق', display: '966563413040',
    phoneId: (env) => env.WA_PHONE_ID || '1368158866379375', token: (env) => env.WA_TOKEN,
    waba: () => '1686695736383983', appId: (env) => env.META_APP_ID || '1399023689070366',
  },
  morooj: {
    dept: 'morooj', org: 'morooj', brand: 'مروج الحجاز للأعمال التجارية', label: 'مروج الحجاز', display: '966544004650',
    phoneId: (env) => env.MOROOJ_WA_PHONE_ID || '1300528429818298', token: (env) => env.MOROOJ_WA_TOKEN,
    waba: (env) => env.MOROOJ_WABA_ID || '', appId: (env) => env.MOROOJ_APP_ID || '1573826707396743', // تطبيق «Morooj Alhijaz Automation»
  },
};

// الخط من القسم، أو من معرّف الرقم لدى Meta
export const lineOf = (dept) => LINES[dept] || LINES.marketing;
export function lineByPhoneId(env, phoneId) {
  const id = String(phoneId || '');
  return Object.values(LINES).find((l) => l.phoneId(env) === id) || null;
}
// توكن الطلب بحسب الرقم الذي يبدأ به مسار Graph (مثل «<phone_id>/messages»)؛ الافتراضي توكن التسويق
export function tokenForPath(env, path) {
  const l = lineByPhoneId(env, String(path || '').split('/')[0]);
  return (l && l.token(env)) || env.WA_TOKEN;
}

// معرّف المحادثة ↔ (القسم، رقم العميل)
export const threadKey = (dept, waId) => (dept && dept !== 'marketing' ? `${dept}.${waId}` : String(waId));
export function parseThread(id) {
  const s = String(id || '');
  const m = s.match(/^([a-z]+)\.(\d{6,20})$/);
  if (m && LINES[m[1]]) return { dept: m[1], waId: m[2] };
  return { dept: 'marketing', waId: s.replace(/\D/g, '').slice(0, 20) };
}

// الأقسام الظاهرة بحسب الجهة المختارة في المنصة (رأس x-org)
export function deptsForOrg(org) {
  if (org === 'morooj') return ['morooj'];
  if (org === 'nubl') return ['marketing'];
  return ['marketing', 'morooj'];
}
