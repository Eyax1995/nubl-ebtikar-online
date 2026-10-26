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

// توجيه النماذج حسب قيمة المهمة (أكتوبر 2026) — الأرخص لما يكفيه، والأقوى لما يستحقه:
//   fast  Haiku 5.5  ($0.10/$0.50 للمليون)  أوامر قصيرة وتصنيف وفحص الاتصال
//   smart Sonnet 5.5 ($2/$10)               محتوى بالجملة وتعديلات ومحادثات
//   deep  Opus 5.5   ($4/$20)               عروض الأسعار والعقود وتحليل جلسات التشخيص
//   top   Fable 5.1  ($10/$50)              الجزء الاستراتيجي من الخطة فقط — باعتدال
// عند تعذّر نموذج (ضغط أو رفض) ينزل الطلب للدرجة الأرخص التالية ثم Gemini.
// يمكن استبدال نموذج أي درجة من لوحة Cloudflare: CLAUDE_MODEL_FAST / _SMART / _DEEP / _TOP
export const TIERS = {
  fast: { model: 'claude-haiku-5-5', effort: 'low', env: 'CLAUDE_MODEL_FAST' },
  smart: { model: 'claude-sonnet-5-5', effort: 'medium', env: 'CLAUDE_MODEL_SMART' },
  deep: { model: 'claude-opus-5-5', effort: 'medium', env: 'CLAUDE_MODEL_DEEP' },
  top: { model: 'claude-fable-5-1', effort: 'medium', env: 'CLAUDE_MODEL_TOP' },
};
const LADDER = ['top', 'deep', 'smart', 'fast'];
// رفض الأمان في Fable/Opus/Sonnet يُعاد تلقائياً على نموذج بديل داخل الطلب نفسه (fallbacks: default) — Haiku لا يدعمه
const FALLBACK_OK = (m) => /^claude-(fable|opus|sonnet)-/.test(m);

// بث (stream) من Claude: لا مهلة خمول على الاتصال الطويل، ويُجمَّع النص كاملاً.
// التعليمات الثابتة (BRAND والقواعد) تُخزَّن مؤقتاً لدى Claude فتُقرأ بعُشر السعر في الطلبات التالية.
// التفكير التكيفي يعمل تلقائياً في هذه النماذج وعمقه يُضبط بـ effort (temperature و budget_tokens مرفوضان فيها).
async function claudeOnce(env, model, effort, system, user, max) {
  const fb = FALLBACK_OK(model);
  const r = await fetch(`${env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'}/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01',
      ...(fb ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}) },
    body: JSON.stringify({
      model, max_tokens: max + (effort === 'low' ? 2000 : 8000), // هامش للتفكير فوق طول الرد المطلوب
      stream: true, output_config: { effort }, ...(fb ? { fallbacks: 'default' } : {}),
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    }),
  });
  const ct = r.headers.get('content-type') || '';
  if (!r.ok || !ct.includes('event-stream')) {
    const d = await r.json().catch(() => ({}));
    if (r.ok) { // خادم لا يدعم البث (اختبار) — رد كامل
      const text = (d.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
      if (text && d.stop_reason !== 'refusal') return { ok: true, text, engine: 'claude:' + (d.model || model), truncated: d.stop_reason === 'max_tokens' };
    }
    return { ok: false, status: r.status, error: `${model}: ` + ((d.error && d.error.message) || (d.stop_reason === 'refusal' ? 'رفض' : `HTTP ${r.status}`)) };
  }
  const reader = r.body.getReader(); const dec = new TextDecoder();
  let buf = ''; let text = ''; let stop = null; let err = null; let served = model;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') text += ev.delta.text;
      else if (ev.type === 'message_start' && ev.message?.model) served = ev.message.model;
      else if (ev.type === 'message_delta' && ev.delta?.stop_reason) stop = ev.delta.stop_reason;
      else if (ev.type === 'error') err = ev.error?.message || 'خطأ';
    }
  }
  text = text.trim();
  if (stop === 'refusal') return { ok: false, error: model + ': رفض' };
  if (text && !err) return { ok: true, text, engine: 'claude:' + served, truncated: stop === 'max_tokens' };
  return { ok: false, error: model + ': ' + (err || 'رد فارغ') };
}
async function claude(env, system, user, max, tier = 'smart') {
  if (!env.ANTHROPIC_API_KEY) return { ok: false, skip: true, error: 'ANTHROPIC_API_KEY غير مضاف' };
  const errs = [];
  for (const t of LADDER.slice(Math.max(0, LADDER.indexOf(tier)))) {
    const T = TIERS[t]; const model = env[T.env] || T.model;
    try {
      const r = await claudeOnce(env, model, T.effort, system, user, max);
      if (r.ok) return errs.length ? { ...r, engine: `${r.engine} (بعد: ${errs.join(' | ').slice(0, 120)})` } : r;
      errs.push(r.error);
      if (r.status === 401 || r.status === 403) break; // المفتاح نفسه مرفوض: لا فائدة من نموذج آخر
    } catch (e) { errs.push(model + ': ' + e.message); }
  }
  return { ok: false, error: 'Claude: ' + errs.join(' | ') };
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

// فحص سريع لمحرك Claude يعيد سبب الفشل إن وُجد (للإعداد والمتابعة)
export async function aiPing(env) {
  const r = await claude(env, 'رد بكلمة واحدة.', 'قل: جاهز', 20, 'fast');
  return r.ok ? { ok: true, engine: r.engine } : { ok: false, error: r.error, model: env.CLAUDE_MODEL_FAST || TIERS.fast.model };
}
export const aiReady = (env) => !!(env.ANTHROPIC_API_KEY || env.GEMINI_API_KEY || env.AI);

// يعيد { data, engine } أو يرمي خطأً مفهوماً
// tier: fast | smart (الافتراضي) | deep | top — انظر TIERS أعلاه
export async function aiJSON(env, system, user, { max = 8000, tier = 'smart' } = {}) {
  const sys = `${system}\n\nأعد JSON صالحاً فقط دون أي نص قبله أو بعده ودون علامات Markdown.`;
  const errs = [];
  for (const fn of [claude, gemini, workers]) {
    const r = await fn(env, sys, user, max, tier);
    if (!r.ok) { if (!r.skip) errs.push(r.error); continue; }
    const data = extractJSON(r.text);
    if (data) return { data, engine: errs.length ? `${r.engine} (بعد تعذّر: ${errs.join(' | ').slice(0, 160)})` : r.engine };
    errs.push(`${r.engine}: رد غير منظم${r.truncated ? ' (تجاوز الطول)' : ''}`);
  }
  const e = new Error(errs.length ? 'تعذّر التوليد بالذكاء الاصطناعي — ' + errs.join(' | ').slice(0, 400) : 'الذكاء الاصطناعي غير مفعّل: أضف ANTHROPIC_API_KEY في إعدادات Cloudflare Pages');
  e.status = 503; throw e;
}

// قراءة صورة/PDF (إيصال تحويل، سند) بالرؤية — Claude فقط (Gemini وWorkers هنا نصّيان). blocks: مصفوفة محتوى Anthropic (image/document + text)
export async function aiVisionJSON(env, system, blocks, { max = 1500, tier = 'smart' } = {}) {
  const sys = `${system}\n\nأعد JSON صالحاً فقط دون أي نص قبله أو بعده ودون علامات Markdown.`;
  const r = await claude(env, sys, blocks, max, tier);
  if (!r.ok) { const e = new Error(r.skip ? 'الذكاء الاصطناعي غير مفعّل: أضف ANTHROPIC_API_KEY' : 'تعذّرت قراءة المرفق — ' + String(r.error).slice(0, 300)); e.status = 503; throw e; }
  const data = extractJSON(r.text);
  if (!data) { const e = new Error('تعذّر فهم المرفق (رد غير منظم)'); e.status = 502; throw e; }
  return { data, engine: r.engine };
}

// السياق الثابت للكيان — يُرسل مع كل طلب
export const BRAND = `أنت فريق «نُبل وابتكار للخدمات التسويقية» في جدة (قطاع التسويق في مجموعة نُبل وابتكار، ويتكامل مع قطاع الإنتاج للتصوير والمونتاج).
اكتب بعربية فصحى مهنية معاصرة بمصطلحات سعودية/خليجية، واضحة ومقنعة تجارياً، بلا مبالغة ولا وعود بأرقام مضمونة، ولا تختلق أرقاماً عن العميل أو السوق.
أبقِ المصطلح الإنجليزي بين قوسين عند الحاجة فقط. استخدم الأرقام كما تُعطى لك.`;
