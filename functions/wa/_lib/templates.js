// عرض قوالب واتساب في الصندوق كما تصل للعميل (24 أكتوبر 2026): النص بمتغيراته + التذييل + الأزرار
// القوالب المعتمدة لكل خط تُجلب من Meta (حساب WABA للخط) وتُحفظ في الذاكرة ساعة.
const GRAPH = 'https://graph.facebook.com/v23.0';
const CACHE = {}; // dept → { at, list }

export async function lineTemplates(env, L) {
  const c = CACHE[L.dept];
  if (c && Date.now() - c.at < 3600e3) return c.list;
  const token = L.token(env); const waba = L.waba(env);
  if (!token || !waba) return [];
  try {
    const r = await fetch(`${GRAPH}/${waba}/message_templates?fields=name,language,status,components&limit=100`, { headers: { authorization: 'Bearer ' + token } });
    const d = await r.json();
    const list = (d.data || []).filter((t) => t.status === 'APPROVED');
    CACHE[L.dept] = { at: Date.now(), list };
    return list;
  } catch { return (c && c.list) || []; }
}

// النص الكامل للقالب: {header:'IMAGE'|'TEXT'|..., text}
export function renderTemplate(tpl, params = [], headerText = '') {
  if (!tpl) return null;
  const comps = tpl.components || [];
  const fill = (s) => String(s || '').replace(/\{\{(\d+)\}\}/g, (m, i) => (params[+i - 1] !== undefined ? params[+i - 1] : m));
  const head = comps.find((x) => x.type === 'HEADER') || {};
  const body = comps.find((x) => x.type === 'BODY') || {};
  const foot = comps.find((x) => x.type === 'FOOTER') || {};
  const btns = (comps.find((x) => x.type === 'BUTTONS') || {}).buttons || [];
  const parts = [];
  if (head.format === 'TEXT' && head.text) parts.push(`*${head.text.replace(/\{\{1\}\}/g, headerText || '{{1}}')}*`);
  parts.push(fill(body.text));
  if (foot.text) parts.push(`_${foot.text}_`);
  if (btns.length) parts.push(btns.map((b) => (b.type === 'URL' ? `🔗 ${b.text}: ${b.url}` : b.type === 'PHONE_NUMBER' ? `📞 ${b.text}: ${b.phone_number}` : `▫️ ${b.text}`)).join('\n'));
  return { header: head.format || '', text: parts.filter(Boolean).join('\n\n') };
}

export async function renderByName(env, L, name, params, lang) {
  const list = await lineTemplates(env, L);
  const tpl = list.find((t) => t.name === name && (!lang || t.language === lang)) || list.find((t) => t.name === name);
  return renderTemplate(tpl, params);
}
