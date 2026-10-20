// ربط وكلاء الذكاء الاصطناعي بالمنصة: مفاتيح API شخصية + خادم MCP (Streamable HTTP / JSON-RPC)
// كل مفتاح يعمل بصلاحيات صاحبه نفسها (الدور + نطاق السجلات)، ونطاقه «قراءة» أو «قراءة وكتابة».
import { json, bad, randomToken, audit } from './core.js';
import { ENTITIES, ROLES } from './schema.js';
import { allowed, permsFor } from './sections.js';

const PREFIX = 'nhk_';
const enc = new TextEncoder();
async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- التحقق من المفتاح ----------
export function bearerOf(request) {
  const h = request.headers.get('authorization') || '';
  const m = /^Bearer\s+(nhk_[a-f0-9]{40})\s*$/i.exec(h);
  if (m) return m[1];
  const x = request.headers.get('x-api-key') || '';
  return /^nhk_[a-f0-9]{40}$/.test(x) ? x : null;
}

export async function tokenUser(db, raw) {
  if (!raw || !/^nhk_[a-f0-9]{40}$/.test(raw)) return null;
  const hash = await sha256(raw);
  const row = await db.prepare(
    `SELECT t.id AS token_id, t.scope, t.expires_at AS token_expires, t.revoked_at, t.last_used_at,
            u.id, u.name, u.email, u.role, u.title, u.must_change, u.active, u.commission_rate, u.tg_chat_id, u.tg_username, u.sections
     FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?`).bind(hash).first();
  if (!row || row.revoked_at || !row.active || row.must_change) return null;
  if (row.token_expires && row.token_expires < new Date().toISOString()) return null;
  // تحديث آخر استخدام مرة كل دقيقة على الأكثر
  if (!row.last_used_at || Date.now() - Date.parse(row.last_used_at + 'Z') > 60e3) {
    await db.prepare("UPDATE api_tokens SET last_used_at = datetime('now'), uses = uses + 1 WHERE id = ?").bind(row.token_id).run();
  }
  row.via = 'token';
  row.token = null;
  return row;
}

// مسارات لا يصلها المفتاح أبداً (إدارة الحساب والأسرار)
export function tokenBlocked(user, parts, method) {
  const p = parts[0];
  if (['auth', 'tokens', 'users', 'settings', 'export', 'import', 'telegram', 'backups'].includes(p)) return 'هذا المسار متاح من داخل المنصة فقط';
  if (p === 'notifications' && ['prefs', 'bridge', 'bridge-test', 'test'].includes(parts[1])) return 'هذا المسار متاح من داخل المنصة فقط';
  if (p === 'commissions' && method !== 'GET') return 'اعتماد العمولات وصرفها وروابط المناديب من داخل المنصة فقط';
  if (user.scope !== 'write' && method !== 'GET' && !(p === 'notifications' && parts[1] === 'read')) return 'المفتاح للقراءة فقط';
  return null;
}

// ---------- إدارة المفاتيح (من داخل المنصة بالجلسة فقط) ----------
export async function tokensRoute(db, request, user, id) {
  if (user.via === 'token') return bad('إدارة المفاتيح من داخل المنصة فقط', 403);
  const method = request.method.toUpperCase();
  if (method === 'GET' && !id) {
    const all = new URL(request.url).searchParams.get('all') && user.role === 'admin';
    const { results } = await db.prepare(`SELECT t.id, t.name, t.prefix, t.scope, t.expires_at, t.last_used_at, t.uses, t.revoked_at, t.created_at, u.name AS user_name
      FROM api_tokens t JOIN users u ON u.id = t.user_id ${all ? '' : 'WHERE t.user_id = ?'} ORDER BY t.revoked_at IS NOT NULL, t.id DESC LIMIT 100`)
      .bind(...(all ? [] : [user.id])).all();
    return json({ rows: results });
  }
  if (method === 'POST' && !id) {
    let d = {}; try { d = await request.json(); } catch { /* */ }
    const name = String(d.name || 'وكيل ذكاء اصطناعي').trim().slice(0, 60);
    const scope = d.scope === 'write' ? 'write' : 'read';
    const days = Math.max(0, Math.min(365, parseInt(d.days, 10) || 0));
    const active = await db.prepare('SELECT COUNT(*) AS n FROM api_tokens WHERE user_id = ? AND revoked_at IS NULL').bind(user.id).first('n');
    if (active >= 10) return bad('لديك 10 مفاتيح فعّالة — ألغِ مفتاحاً قديماً أولاً');
    const raw = PREFIX + randomToken(20);
    const exp = days ? new Date(Date.now() + days * 86400e3).toISOString() : null;
    const r = await db.prepare('INSERT INTO api_tokens (user_id, name, prefix, token_hash, scope, expires_at) VALUES (?,?,?,?,?,?)')
      .bind(user.id, name, raw.slice(0, 10), await sha256(raw), scope, exp).run();
    await audit(db, user, 'create', 'api_tokens', r.meta.last_row_id, `${name} (${scope})`);
    return json({ id: r.meta.last_row_id, token: raw, scope, expires_at: exp }, 201);
  }
  if (method === 'DELETE' && id) {
    const t = await db.prepare('SELECT user_id FROM api_tokens WHERE id = ?').bind(id).first();
    if (!t) return bad('المفتاح غير موجود', 404);
    if (t.user_id !== user.id && user.role !== 'admin') return bad('لا تملك صلاحية', 403);
    await db.prepare("UPDATE api_tokens SET revoked_at = datetime('now') WHERE id = ?").bind(id).run();
    await audit(db, user, 'revoke', 'api_tokens', id);
    return json({ ok: true });
  }
  return bad('إجراء غير معروف', 404);
}

// ======================================================================
// خادم MCP
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER = { name: 'nubl-marketing-hub', title: 'منصة نُبل وابتكار للتسويق', version: '1.0.0' };
const READ_ENTITIES = Object.keys(ENTITIES).filter((e) => e !== 'users');

const INSTRUCTIONS = `منصة نُبل وابتكار للتسويق (CRM ونظام إداري لقطاع التسويق — جدة).
تعمل الأدوات بصلاحيات صاحب المفتاح نفسها؛ أي كيان لا يملك صلاحيته سيعيد خطأ 403.
ابدأ بـ hub_describe لمعرفة الكيانات والحقول وصلاحياتك، ثم hub_search أو hub_list.
التواريخ بصيغة YYYY-MM-DD والمبالغ بالريال السعودي. لا تختلق أرقاماً: اعرض ما تعيده الأدوات فقط.
قبل أي إنشاء أو تعديل اعرض على المستخدم ما ستكتبه واطلب تأكيده.`;

const entEnum = { type: 'string', enum: READ_ENTITIES };
const TOOLS = [
  { name: 'hub_describe', title: 'وصف المنصة والصلاحيات', description: 'يعيد الكيانات المتاحة وحقولها وصلاحياتك (r قراءة / w كتابة / d حذف) ودورك ونطاق المفتاح. استدعه أولاً.',
    inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'hub_overview', title: 'لوحة القيادة ويومي', description: 'ملخص لوحة القيادة (العملاء المحتملون، الصفقات، الإيراد، المهام…) ومهامك ومتابعاتك لليوم.',
    inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'hub_search', title: 'بحث شامل', description: 'بحث بالاسم أو الجوال أو الرقم في العملاء المحتملين والعملاء والصفقات وعروض الأسعار والعقود والفواتير والمهام والمشاريع.',
    inputSchema: { type: 'object', properties: { q: { type: 'string', description: 'نص البحث' } }, required: ['q'] }, annotations: { readOnlyHint: true } },
  { name: 'hub_list', title: 'عرض سجلات كيان', description: 'يعرض سجلات كيان مع بحث وفلاتر اختيارية. الفلاتر: {"status":"جديد"} لتطابق تام، و{"gte_due_date":"2026-10-01"} أو {"lte_...":...} للمدى.',
    inputSchema: { type: 'object', properties: { entity: entEnum, q: { type: 'string' }, filters: { type: 'object', additionalProperties: { type: 'string' } }, limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 } }, required: ['entity'] },
    annotations: { readOnlyHint: true } },
  { name: 'hub_get', title: 'تفاصيل سجل', description: 'يعيد سجلاً واحداً، ومعه سجل التواصل والزيارات إن كان عميلاً محتملاً أو عميلاً أو صفقة.',
    inputSchema: { type: 'object', properties: { entity: entEnum, id: { type: 'integer' } }, required: ['entity', 'id'] }, annotations: { readOnlyHint: true } },
  { name: 'hub_notifications', title: 'إشعاراتي', description: 'آخر إشعاراتك في المنصة وعدد غير المقروء.',
    inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'hub_report', title: 'تقرير الأداء', description: 'تقرير المبيعات والتحويل والإيراد لفترة (للإدارة والمالية فقط).',
    inputSchema: { type: 'object', properties: { from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD' } } }, annotations: { readOnlyHint: true } },
  { name: 'hub_commissions', title: 'المناديب والعمولات', description: 'ملخص المناديب الخارجيين (المستحق/المعتمد/المصروف) وآخر العمولات والصرفيات، أو كشف حساب مندوب محدد بـ rep_id (للإدارة والمالية).',
    inputSchema: { type: 'object', properties: { rep_id: { type: 'integer' }, status: { type: 'string', enum: ['مستحقة', 'معتمدة', 'مصروفة'] } } }, annotations: { readOnlyHint: true } },
  { name: 'hub_studio', title: 'استوديو الذكاء (عروض/عقود/خطط/منشورات)', description: 'يولّد بذكاء نُبل داخل المنصة ويحفظ في قاعدة البيانات: quote (عرض سعر بنموذج الكيان من client_id أو lead_id + brief)، contract (عقد من quote_id بعد اعتماد أسعاره)، plan (خطة تسويقية لـ client_id بـ goals/months/budget)، posts (منشورات شهر month=YYYY-MM لـ client_id وتوزيعها على تقويم المحتوى). أسعار الكتالوج مقفلة. يتطلب مفتاح «قراءة وكتابة» واعرض على المستخدم ما ستنشئه قبل التنفيذ.',
    inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['quote', 'contract', 'plan', 'posts'] }, client_id: { type: 'integer' }, lead_id: { type: 'integer' }, deal_id: { type: 'integer' }, quote_id: { type: 'integer' }, brief: { type: 'string' }, goals: { type: 'string' }, budget: { type: 'string' }, months: { type: 'integer' }, month: { type: 'string', description: 'YYYY-MM' }, count: { type: 'integer' }, platforms: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['action'] },
    annotations: { readOnlyHint: false, destructiveHint: false } },
  { name: 'hub_create', title: 'إنشاء سجل', description: 'ينشئ سجلاً جديداً (عميل محتمل، مهمة، تسجيل تواصل، صفقة…). يتطلب مفتاح «قراءة وكتابة». استخدم hub_describe لمعرفة الحقول.',
    inputSchema: { type: 'object', properties: { entity: entEnum, data: { type: 'object', description: 'الحقول والقيم' } }, required: ['entity', 'data'] },
    annotations: { readOnlyHint: false, destructiveHint: false } },
  { name: 'hub_update', title: 'تعديل سجل', description: 'يعدّل حقولاً في سجل موجود (مثل حالة مهمة أو موعد متابعة). يتطلب مفتاح «قراءة وكتابة».',
    inputSchema: { type: 'object', properties: { entity: entEnum, id: { type: 'integer' }, data: { type: 'object' } }, required: ['entity', 'id', 'data'] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true } },
  { name: 'hub_templates', title: 'قوالب المهام', description: 'قوالب المهام المتاحة لك وأسئلة كل قالب. كل مهمة في المنصة تُنشأ من قالب عبر hub_run_template.',
    inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'hub_run_template', title: 'إنشاء مهمة من قالب', description: 'ينشئ مهمة (أو سجلاً) من قالب بإجابات أسئلته (answers: {مفتاح السؤال: القيمة}). يتطلب مفتاح «قراءة وكتابة».',
    inputSchema: { type: 'object', properties: { template_id: { type: 'integer' }, answers: { type: 'object' } }, required: ['template_id'] },
    annotations: { readOnlyHint: false, destructiveHint: false } },
  { name: 'hub_log_activity', title: 'تسجيل تواصل أو ملاحظة', description: 'يسجّل مكالمة أو رسالة أو ملاحظة على عميل محتمل أو عميل أو صفقة، مع موعد المتابعة التالي اختيارياً.',
    inputSchema: { type: 'object', properties: { lead_id: { type: 'integer' }, client_id: { type: 'integer' }, deal_id: { type: 'integer' },
      kind: { type: 'string', enum: ['مكالمة', 'واتساب', 'اجتماع', 'زيارة', 'بريد', 'جلسة تشخيص', 'ملاحظة'], default: 'ملاحظة' },
      subject: { type: 'string' }, notes: { type: 'string' }, next_step: { type: 'string' }, next_date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['notes'] },
    annotations: { readOnlyHint: false, destructiveHint: false } },
];
const WRITE_TOOLS = new Set(['hub_create', 'hub_update', 'hub_log_activity', 'hub_run_template', 'hub_studio']);

const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const textOut = (data, isError = false) => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 1) }], isError });

// call(method, path, body) → { status, data } — يمرّر الطلب لمسارات المنصة نفسها بالصلاحيات نفسها
export async function mcpHandle(db, env, request, user, call) {
  const method = request.method.toUpperCase();
  if (method === 'GET') return json({ error: 'استخدم POST (MCP Streamable HTTP)' }, 405, { allow: 'POST' });
  if (method === 'DELETE') return new Response(null, { status: 204 });
  if (method !== 'POST') return bad('طريقة غير مدعومة', 405);
  let msg; try { msg = await request.json(); } catch { return json(rpcError(null, -32700, 'Parse error'), 400); }
  const batch = Array.isArray(msg);
  const out = [];
  for (const m of (batch ? msg : [msg])) {
    const r = await handleOne(db, env, user, m, call);
    if (r) out.push(r);
  }
  if (!out.length) return new Response(null, { status: 202 });
  return json(batch ? out : out[0]);
}

async function handleOne(db, env, user, m, call) {
  if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return rpcError(m?.id, -32600, 'Invalid Request');
  const isNotification = m.id === undefined || m.id === null;
  switch (m.method) {
    case 'initialize': {
      const want = m.params?.protocolVersion;
      return rpcResult(m.id, {
        protocolVersion: PROTOCOLS.includes(want) ? want : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: INSTRUCTIONS + `\nأنت تعمل باسم: ${user.name} (${ROLES[user.role] || user.role}) — نطاق المفتاح: ${user.scope === 'write' ? 'قراءة وكتابة' : 'قراءة فقط'}.`,
      });
    }
    case 'ping': return rpcResult(m.id, {});
    case 'tools/list': {
      const tools = TOOLS.filter((t) => user.scope === 'write' || !WRITE_TOOLS.has(t.name));
      return rpcResult(m.id, { tools });
    }
    case 'tools/call': {
      const name = m.params?.name; const args = m.params?.arguments || {};
      try {
        const res = await runTool(db, env, user, name, args, call);
        await audit(db, user, 'mcp', name, null, JSON.stringify(args).slice(0, 300));
        return rpcResult(m.id, res);
      } catch (e) {
        return rpcResult(m.id, textOut('خطأ: ' + (e.message || e), true));
      }
    }
    case 'resources/list': return rpcResult(m.id, { resources: [] });
    case 'prompts/list': return rpcResult(m.id, { prompts: [] });
    default:
      if (isNotification) return null; // notifications/initialized وغيرها
      return rpcError(m.id, -32601, 'Method not found: ' + m.method);
  }
}

const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])).toString();
async function must(call, method, path, body) {
  const r = await call(method, path, body);
  if (r.status >= 400) throw new Error(r.data?.error || `HTTP ${r.status}`);
  return r.data;
}
function checkEntity(e) { if (!READ_ENTITIES.includes(e)) throw new Error('كيان غير معروف: ' + e); }

async function runTool(db, env, user, name, a, call) {
  if (WRITE_TOOLS.has(name) && user.scope !== 'write') return textOut('هذا المفتاح للقراءة فقط — أنشئ مفتاح «قراءة وكتابة» من المنصة.', true);
  switch (name) {
    case 'hub_describe': {
      const ents = {};
      for (const [k, v] of Object.entries(ENTITIES)) { if (k === 'users') continue; const p = permsFor(user, k); if (p) ents[k] = { perms: p, fields: v.cols, search: v.search }; }
      const meta = await must(call, 'GET', 'meta');
      return textOut({ user: { name: user.name, role: user.role, role_label: ROLES[user.role] }, key_scope: user.scope, entities: ents,
        team: (meta.users || []).filter((u) => u.active).map((u) => ({ id: u.id, name: u.name, role: u.role })), sectors: meta.sectors });
    }
    case 'hub_overview': {
      const [dash, day] = await Promise.all([call('GET', 'dashboard'), call('GET', 'myday')]);
      return textOut({ dashboard: dash.status < 400 ? dash.data : dash.data?.error, my_day: day.status < 400 ? day.data : day.data?.error });
    }
    case 'hub_search': {
      const q = String(a.q || '').trim(); if (!q) throw new Error('اكتب نص البحث');
      const targets = ['leads', 'clients', 'deals', 'quotes', 'contracts', 'invoices', 'tasks', 'projects'].filter((e) => allowed(user, e, 'r'));
      const res = {};
      await Promise.all(targets.map(async (e) => { const r = await call('GET', `e/${e}?${qs({ q, limit: 10 })}`); if (r.status < 400 && r.data.rows?.length) res[e] = r.data.rows; }));
      return textOut(Object.keys(res).length ? res : 'لا نتائج');
    }
    case 'hub_list': {
      checkEntity(a.entity);
      const p = { q: a.q, limit: Math.min(200, a.limit || 50) };
      for (const [k, v] of Object.entries(a.filters || {})) p[/^(gte|lte|f)_/.test(k) ? k : 'f_' + k] = v;
      const d = await must(call, 'GET', `e/${a.entity}?${qs(p)}`);
      return textOut({ count: d.rows?.length || 0, total: d.total, rows: d.rows });
    }
    case 'hub_get': {
      checkEntity(a.entity);
      const d = await must(call, 'GET', `e/${a.entity}/${Number(a.id)}`);
      const kind = { leads: 'lead', clients: 'client', deals: 'deal' }[a.entity];
      if (kind) { const t = await call('GET', `timeline/${kind}/${Number(a.id)}`); if (t.status < 400) d.timeline = t.data; }
      return textOut(d);
    }
    case 'hub_notifications': return textOut(await must(call, 'GET', 'notifications'));
    case 'hub_report': return textOut(await must(call, 'GET', `reports?${qs({ from: a.from, to: a.to })}`));
    case 'hub_commissions': return textOut(await must(call, 'GET', a.rep_id ? `commissions/statement/${Number(a.rep_id)}` : `commissions?${qs({ status: a.status })}`));
    case 'hub_studio': {
      const { action, quote_id, ...rest } = a;
      const path = action === 'contract' ? `studio/contract/${Number(quote_id)}` : `studio/${action === 'posts' ? 'posts' : action === 'plan' ? 'plan' : 'quote'}`;
      return textOut(await must(call, 'POST', path, rest));
    }
    case 'hub_create': {
      checkEntity(a.entity);
      const d = await must(call, 'POST', `e/${a.entity}`, a.data || {});
      return textOut({ created: true, entity: a.entity, row: d.row || d });
    }
    case 'hub_update': {
      checkEntity(a.entity);
      const d = await must(call, 'PUT', `e/${a.entity}/${Number(a.id)}`, a.data || {});
      return textOut({ updated: true, entity: a.entity, row: d.row || d });
    }
    case 'hub_templates': {
      const d = await must(call, 'GET', 'templates/mine');
      return textOut((d.rows || []).map((t) => { let f = Array.isArray(t.fields) ? t.fields : []; if (!f.length && typeof t.fields === 'string') { try { f = JSON.parse(t.fields || '[]'); } catch { /* */ } }
        return { id: t.id, name: t.name, category: t.category, kind: t.kind || 'task', description: t.description, questions: f.map((q) => ({ key: q.key || q.k || q.id, label: q.label || q.l || q.q, type: q.type || q.t, required: !!(q.required || q.req || q.r), options: q.options || q.o })) }; }));
    }
    case 'hub_run_template': {
      const d = await must(call, 'POST', `templates/${Number(a.template_id)}/run`, { answers: a.answers || {} });
      return textOut({ created: true, result: d });
    }
    case 'hub_log_activity': {
      if (!a.lead_id && !a.client_id && !a.deal_id) throw new Error('حدّد lead_id أو client_id أو deal_id');
      const rec = { kind: a.kind || 'ملاحظة', lead_id: a.lead_id, client_id: a.client_id, deal_id: a.deal_id, subject: a.subject, notes: a.notes, next_step: a.next_step, next_date: a.next_date };
      Object.keys(rec).forEach((k) => rec[k] == null && delete rec[k]);
      const d = await must(call, 'POST', 'e/activities', rec);
      return textOut({ logged: true, row: d.row || d });
    }
    default: throw new Error('أداة غير معروفة: ' + name);
  }
}
