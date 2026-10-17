// محرك الذكاء الاصطناعي للمنصة: Claude (ANTHROPIC_API_KEY) ← Gemini (GEMINI_API_KEY) ← Workers AI (AI) احتياطياً
// كل الاستدعاءات تطلب JSON منظماً وتتحقق منه — والمنصة (لا الذكاء) تحسب الأسعار والمجاميع.

function extractJSON(text) {
  const t = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(t); } catch { /* */ }
  const a = t.indexOf('{'); const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* */ } }
  const c = t.indexOf('['); const d = t.lastIndexOf(']');
  if (c >= 0 && d > c) { try { return JSON.parse(t.slice(c, d + 1)); } catch { /* */ } }
  return null;
}

async function claude(env, system, user, max) {
  if (!env.ANTHROPIC_API_KEY) return { ok: false, skip: true, error: 'ANTHROPIC_API_KEY غير مضاف' };
  const model = env.CLAUDE_MODEL || 'claude-sonnet-4-5';
  try {
    const r = await fetch(`${env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: max, temperature: 0.4, system, messages: [{ role: 'user', content: user }] }),
    });
    const d = await r.json().catch(() => ({}));
    const text = (d.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
    if (r.ok && text) return { ok: true, text, engine: 'claude:' + model, truncated: d.stop_reason === 'max_tokens' };
    return { ok: false, error: 'Claude: ' + ((d.error && d.error.message) || `HTTP ${r.status}`) };
  } catch (e) { return { ok: false, error: 'Claude: ' + e.message }; }
}
async function gemini(env, system, user, max) {
  if (!env.GEMINI_API_KEY) return { ok: false, skip: true, error: '' };
  const model = env.GEMINI_MODEL || 'gemini-3.5-flash';
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: Math.min(max, 16000), responseMimeType: 'application/json' } }),
    });
    const d = await r.json().catch(() => ({}));
    const text = ((((d.candidates || [])[0] || {}).content || {}).parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
    if (r.ok && text) return { ok: true, text, engine: 'gemini:' + model };
    return { ok: false, error: 'Gemini: ' + ((d.error && d.error.message) || `HTTP ${r.status}`) };
  } catch (e) { return { ok: false, error: 'Gemini: ' + e.message }; }
}
async function workers(env, system, user, max) {
  if (!env.AI) return { ok: false, skip: true, error: '' };
  try {
    const r = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: Math.min(max, 4000) });
    const text = typeof r?.response === 'string' ? r.response : JSON.stringify(r?.response || '');
    return text ? { ok: true, text, engine: 'workers-ai' } : { ok: false, error: 'Workers AI: رد فارغ' };
  } catch (e) { return { ok: false, error: 'Workers AI: ' + e.message }; }
}

export const aiReady = (env) => !!(env.ANTHROPIC_API_KEY || env.GEMINI_API_KEY || env.AI);

// يعيد { data, engine } أو يرمي خطأً مفهوماً
export async function aiJSON(env, system, user, { max = 8000 } = {}) {
  const sys = `${system}\n\nأعد JSON صالحاً فقط دون أي نص قبله أو بعده ودون علامات Markdown.`;
  const errs = [];
  for (const fn of [claude, gemini, workers]) {
    const r = await fn(env, sys, user, max);
    if (!r.ok) { if (!r.skip) errs.push(r.error); continue; }
    const data = extractJSON(r.text);
    if (data) return { data, engine: r.engine };
    errs.push(`${r.engine}: رد غير منظم${r.truncated ? ' (تجاوز الطول)' : ''}`);
  }
  const e = new Error(errs.length ? 'تعذّر التوليد بالذكاء الاصطناعي — ' + errs.join(' | ').slice(0, 400) : 'الذكاء الاصطناعي غير مفعّل: أضف ANTHROPIC_API_KEY في إعدادات Cloudflare Pages');
  e.status = 503; throw e;
}

// السياق الثابت للكيان — يُرسل مع كل طلب
export const BRAND = `أنت فريق «نُبل وابتكار للخدمات التسويقية» في جدة (قطاع التسويق في مجموعة نُبل وابتكار، ويتكامل مع قطاع الإنتاج للتصوير والمونتاج).
اكتب بعربية فصحى مهنية معاصرة بمصطلحات سعودية/خليجية، واضحة ومقنعة تجارياً، بلا مبالغة ولا وعود بأرقام مضمونة، ولا تختلق أرقاماً عن العميل أو السوق.
أبقِ المصطلح الإنجليزي بين قوسين عند الحاجة فقط. استخدم الأرقام كما تُعطى لك.`;
