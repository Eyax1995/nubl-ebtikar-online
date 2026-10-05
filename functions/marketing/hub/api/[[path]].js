// منصة نُبل وابتكار للتسويق — الواجهة الخلفية (Cloudflare Pages Functions + D1)
// كل الطلبات تمر من هنا: /marketing/hub/api/...
import {
  json, bad, HttpError, ensureDb, currentUser, createSession, sessionCookie, hashPassword, verifyPassword,
  tempPassword, getSettings, publicSettings, tableCols, audit, nextNumber, today, addMonths, addDays, round2, randomToken,
} from './_lib/core.js';
import { SECRET_SETTINGS } from './_lib/schema.js';
import { tgCall, tgToken, notifyUser } from './_lib/telegram.js';
import { handleUpdate, dailyDigest, newLinkCode } from './_lib/bot.js';
import { loadTemplate, templatesFor, tplAllowed, runTemplate, taskChanged } from './_lib/engine.js';
import { ENTITIES, HIDDEN, ROLES } from './_lib/schema.js';
import { SECTORS } from './_lib/seed.js';

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  if (!env.DB) return bad('قاعدة البيانات غير مربوطة (DB binding). راجع wrangler.toml.', 503);
  const db = env.DB;
  const parts = (params.path || []).filter(Boolean);
  const method = request.method.toUpperCase();
  try {
    await ensureDb(db);
    // ---------- مسارات عامة ----------
    if (parts[0] === 'health') return json({ ok: true, time: new Date().toISOString() });
    if (parts[0] === 'public' && parts[1] === 'lead' && method === 'POST') return await publicLead(db, request);
    if (parts[0] === 'auth' && parts[1] === 'login' && method === 'POST') return await login(db, request);
    if (parts[0] === 'telegram' && parts[1] === 'webhook' && method === 'POST') return await tgWebhook(ctx, db, env, request);
    if (parts[0] === 'telegram' && parts[1] === 'digest') return await tgDigest(db, env, request);

    // ---------- كل ما بعده يتطلب تسجيل دخول ----------
    const user = await currentUser(db, request);
    if (!user) return bad('انتهت الجلسة — سجّل الدخول من جديد', 401);
    if (method !== 'GET' && !sameOrigin(request)) return bad('طلب مرفوض', 403);

    if (parts[0] === 'auth') {
      if (parts[1] === 'logout') {
        await db.prepare('DELETE FROM sessions WHERE token = ?').bind(user.token).run();
        return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
      }
      if (parts[1] === 'me') return json({ user: publicUser(user) });
      if (parts[1] === 'password' && method === 'POST') return await changePassword(db, request, user);
    }
    if (user.must_change && !(parts[0] === 'meta')) return bad('يجب تغيير كلمة المرور المؤقتة أولاً', 428);

    return await dispatch(db, env, request, user, parts);
  } catch (e) {
    if (e instanceof HttpError) return bad(e.message, e.status);
    console.error(e);
    return bad('خطأ في الخادم: ' + (e.message || e), 500);
  }
}

async function dispatch(db, env, request, user, parts) {
    switch (parts[0]) {
      case 'meta': return meta(db, user);
      case 'e': return entityRoute(db, request, user, parts[1], parts[2], env);
      case 'templates': return templatesRoute(db, env, request, user, parts[1], parts[2]);
      case 'telegram': return telegramRoute(db, env, request, user, parts[1]);
      case 'dashboard': return dashboard(db, user);
      case 'myday': return myDay(db, user);
      case 'reports': return reports(db, request, user);
      case 'settings': return settingsRoute(db, request, user);
      case 'users': return usersRoute(db, request, user, parts[1], parts[2]);
      case 'leads': return leadAction(db, request, user, parts[1], parts[2]);
      case 'quotes': return quoteAction(db, request, user, parts[1], parts[2]);
      case 'contracts': return contractAction(db, request, user, parts[1], parts[2]);
      case 'invoices': return invoiceAction(db, request, user, parts[1], parts[2]);
      case 'files': return filesRoute(db, request, user, parts[1]);
      case 'import': return importRoute(db, request, user, parts[1]);
      case 'export': return exportAll(db, user);
      case 'timeline': return timeline(db, user, parts[1], parts[2]);
      case 'ai': return aiRoute(env, db, request, user);
      default: return bad('مسار غير معروف', 404);
    }
}

// ======================================================================
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, title: u.title, must_change: !!u.must_change, tg_linked: !!u.tg_chat_id, tg_username: u.tg_username || null });
function sameOrigin(request) {
  const o = request.headers.get('origin');
  if (!o) return true;
  try { return new URL(o).host === new URL(request.url).host; } catch { return false; }
}
async function body(request) {
  try { return await request.json(); } catch { throw new HttpError(400, 'بيانات غير صالحة'); }
}
const can = (user, entity, op) => (ENTITIES[entity]?.perms[user.role] || '').includes(op);
function need(user, entity, op) { if (!can(user, entity, op)) throw new HttpError(403, 'لا تملك صلاحية لهذا الإجراء'); }
const isBoss = (u) => u.role === 'admin' || u.role === 'manager';
function strip(user, row) {
  const h = HIDDEN[user.role]; if (!h || !row) return row;
  for (const k of h) delete row[k]; return row;
}

// ---------- الدخول ----------
async function login(db, request) {
  const { email, password } = await body(request);
  if (!email || !password) return bad('أدخل البريد وكلمة المرور');
  const u = await db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').bind(String(email).trim()).first();
  if (!u || !(await verifyPassword(password, u.pass_hash, u.pass_salt))) {
    await new Promise((r) => setTimeout(r, 400));
    return bad('البريد أو كلمة المرور غير صحيحة', 401);
  }
  const token = await createSession(db, u.id);
  await db.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(new Date().toISOString()).run();
  await audit(db, u, 'login', 'users', u.id);
  return json({ user: publicUser(u) }, 200, { 'set-cookie': sessionCookie(token) });
}
async function changePassword(db, request, user) {
  const { current, next } = await body(request);
  if (!next || String(next).length < 8) return bad('كلمة المرور الجديدة 8 أحرف على الأقل');
  const u = await db.prepare('SELECT pass_hash, pass_salt FROM users WHERE id = ?').bind(user.id).first();
  if (!(await verifyPassword(current || '', u.pass_hash, u.pass_salt))) return bad('كلمة المرور الحالية غير صحيحة');
  const h = await hashPassword(next);
  await db.prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, must_change = 0 WHERE id = ?').bind(h.hash, h.salt, user.id).run();
  await db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').bind(user.id, user.token).run();
  await audit(db, user, 'password', 'users', user.id);
  return json({ ok: true });
}

// ---------- البيانات الوصفية ----------
async function meta(db, user) {
  const { results: users } = await db.prepare('SELECT id, name, role, title, active, (tg_chat_id IS NOT NULL) AS tg FROM users ORDER BY active DESC, name').all();
  const settings = await publicSettings(db);
  const perms = {};
  for (const [k, v] of Object.entries(ENTITIES)) perms[k] = v.perms[user.role] || '';
  return json({ user: publicUser(user), users, roles: ROLES, perms, settings, sectors: SECTORS });
}

// ---------- CRUD عام ----------
function scopeSql(user, entity) {
  const def = ENTITIES[entity];
  const field = def.own?.[user.role];
  if (!field) return { sql: '', args: [] };
  if (def.ownOrNull) return { sql: `(${field} = ? OR ${field} IS NULL)`, args: [user.id] };
  if (def.ownAlsoCreator) return { sql: `(${field} = ? OR created_by = ?)`, args: [user.id, user.id] };
  return { sql: `${field} = ?`, args: [user.id] };
}
async function inScope(db, user, entity, id) {
  const sc = scopeSql(user, entity);
  const row = await db.prepare(`SELECT * FROM ${entity} WHERE id = ?${sc.sql ? ' AND ' + sc.sql : ''}`).bind(id, ...sc.args).first();
  if (!row) throw new HttpError(404, 'السجل غير موجود أو خارج صلاحيتك');
  return row;
}

async function entityRoute(db, request, user, entity, id, env) {
  const def = ENTITIES[entity];
  if (!def) return bad('كيان غير معروف', 404);
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  if (method === 'GET' && !id) {
    need(user, entity, 'r');
    const where = []; const args = [];
    const sc = scopeSql(user, entity); if (sc.sql) { where.push(sc.sql); args.push(...sc.args); }
    const q = (url.searchParams.get('q') || '').trim();
    if (q) { where.push('(' + def.search.map((c) => `${c} LIKE ?`).join(' OR ') + ')'); def.search.forEach(() => args.push(`%${q}%`)); }
    for (const [k, v] of url.searchParams) {
      if (k.startsWith('f_')) {
        const col = k.slice(2); if (!def.cols.includes(col) && col !== 'id' && col !== 'created_by') continue;
        if (v === '__null') where.push(`${col} IS NULL`);
        else if (v.includes('|')) { const vs = v.split('|'); where.push(`${col} IN (${vs.map(() => '?').join(',')})`); args.push(...vs); }
        else { where.push(`${col} = ?`); args.push(v); }
      }
      if (k.startsWith('gte_') || k.startsWith('lte_')) {
        const col = k.slice(4); if (!def.cols.includes(col) && col !== 'created_at') continue;
        where.push(`${col} ${k.startsWith('gte_') ? '>=' : '<='} ?`); args.push(v);
      }
    }
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '500', 10) || 500, 2000);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10) || 0;
    const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const sel = entity === 'users' ? 'id, name, email, phone, role, title, active, commission_rate, last_login, created_at, tg_username, (tg_chat_id IS NOT NULL) AS tg_linked'
      : entity === 'files' ? 'id, name, mime, size' : '*';
    const { results } = await db.prepare(`SELECT ${sel} FROM ${entity}${w} ORDER BY ${def.order} LIMIT ? OFFSET ?`)
      .bind(...args, limit, offset).all();
    const total = await db.prepare(`SELECT COUNT(*) AS n FROM ${entity}${w}`).bind(...args).first('n');
    return json({ rows: results.map((r) => strip(user, r)), total });
  }

  if (method === 'GET' && id) {
    need(user, entity, 'r');
    const row = await inScope(db, user, entity, id);
    if (entity === 'users') { delete row.pass_hash; delete row.pass_salt; delete row.tg_chat_id; }
    return json({ row: strip(user, row) });
  }

  if (method === 'POST' && !id) {
    need(user, entity, 'w');
    if (entity === 'users') return bad('استخدم شاشة الفريق لإضافة مستخدم');
    if (entity === 'tasks') return bad('كل مهمة تبدأ من قالب — استخدم «مهمة جديدة» واختر القالب المناسب');
    const data = await body(request);
    const cols = await tableCols(db, entity);
    const rec = {};
    for (const c of def.cols) if (data[c] !== undefined) rec[c] = normalize(data[c]);
    // الملكية الافتراضية
    const ownField = def.own?.[user.role];
    if (ownField && ownField !== 'created_by' && rec[ownField] == null) rec[ownField] = user.id;
    if (ownField && ownField !== 'created_by' && rec[ownField] != user.id && !def.ownAlsoCreator) rec[ownField] = user.id;
    if (cols.has('owner_id') && rec.owner_id == null && ['leads', 'deals', 'contracts', 'projects'].includes(entity)) rec.owner_id = user.id;
    if (cols.has('user_id') && rec.user_id == null) rec.user_id = user.id;
    if (cols.has('created_by')) rec.created_by = user.id;
    if (entity === 'quotes' && !rec.number) rec.number = await nextNumber(db, 'quotes', 'Q');
    if (entity === 'contracts' && !rec.number) rec.number = await nextNumber(db, 'contracts', 'C');
    if (entity === 'invoices' && !rec.number) rec.number = await nextNumber(db, 'invoices', 'INV');
    await beforeSave(db, entity, rec, null);
    const keys = Object.keys(rec);
    if (!keys.length) return bad('لا توجد بيانات');
    const r = await db.prepare(`INSERT INTO ${entity} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).bind(...keys.map((k) => rec[k])).run();
    const newId = r.meta.last_row_id;
    await afterSave(db, user, entity, newId, rec, null);
    await audit(db, user, 'create', entity, newId, rec.title || rec.name || rec.number);
    const row = await db.prepare(`SELECT * FROM ${entity} WHERE id = ?`).bind(newId).first();
    return json({ row: strip(user, row) }, 201);
  }

  if (method === 'PUT' && id) {
    need(user, entity, 'w');
    if (entity === 'users' && user.role !== 'admin') return bad('للمدير فقط', 403);
    const before = await inScope(db, user, entity, id);
    const data = await body(request);
    const cols = await tableCols(db, entity);
    const rec = {};
    for (const c of def.cols) if (data[c] !== undefined) rec[c] = normalize(data[c]);
    for (const h of HIDDEN[user.role] || []) delete rec[h];
    const ownField = def.own?.[user.role];
    if (ownField && ownField !== 'created_by' && !def.ownAlsoCreator && !def.ownOrNull) delete rec[ownField];
    if (def.ownOrNull && ownField && rec[ownField] != null && rec[ownField] != user.id) delete rec[ownField];
    if (entity === 'users' && Number(id) === user.id) { delete rec.role; delete rec.active; }
    await beforeSave(db, entity, rec, before);
    if (cols.has('updated_at')) rec.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const keys = Object.keys(rec);
    if (!keys.length) return json({ row: strip(user, before) });
    await db.prepare(`UPDATE ${entity} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...keys.map((k) => rec[k]), id).run();
    await afterSave(db, user, entity, Number(id), rec, before);
    await audit(db, user, 'update', entity, id, keys.join(','));
    let row = await db.prepare(`SELECT * FROM ${entity} WHERE id = ?`).bind(id).first();
    if (entity === 'tasks') await taskChanged(db, env, user, before, row);
    if (entity === 'users') { delete row.pass_hash; delete row.pass_salt; delete row.tg_chat_id; }
    return json({ row: strip(user, row) });
  }

  if (method === 'DELETE' && id) {
    need(user, entity, 'd');
    if (entity === 'users') return bad('عطّل المستخدم بدل حذفه');
    const before = await inScope(db, user, entity, id);
    await db.prepare(`DELETE FROM ${entity} WHERE id = ?`).bind(id).run();
    if (entity === 'payments' && before.invoice_id) await recalcInvoice(db, before.invoice_id);
    await audit(db, user, 'delete', entity, id, before.title || before.name || before.number);
    return json({ ok: true });
  }
  return bad('طريقة غير مدعومة', 405);
}

function normalize(v) {
  if (v === '' || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object' && v !== null) return JSON.stringify(v);
  return v;
}

async function beforeSave(db, entity, rec, before) {
  const s = await getSettings(db);
  const vat = Number(s.vat_rate || 15) / 100;
  if (entity === 'quotes' && rec.items !== undefined) {
    let items = []; try { items = JSON.parse(rec.items || '[]'); } catch { items = []; }
    const sub = items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    const disc = Number(rec.discount ?? before?.discount ?? 0) || 0;
    rec.subtotal = round2(sub); rec.vat = round2((sub - disc) * vat); rec.total = round2(sub - disc + rec.vat);
  } else if (entity === 'quotes' && rec.discount !== undefined && before) {
    const sub = Number(before.subtotal) || 0; const disc = Number(rec.discount) || 0;
    rec.vat = round2((sub - disc) * vat); rec.total = round2(sub - disc + rec.vat);
  }
  if (entity === 'invoices' && rec.subtotal !== undefined) {
    rec.vat = round2(Number(rec.subtotal) * vat); rec.total = round2(Number(rec.subtotal) + rec.vat);
  }
  if (entity === 'contracts') {
    const months = Number(rec.months ?? before?.months ?? 1) || 1;
    if (rec.total_value !== undefined && rec.monthly_value === undefined) rec.monthly_value = round2(Number(rec.total_value) / months);
    if (rec.monthly_value !== undefined && rec.total_value === undefined) rec.total_value = round2(Number(rec.monthly_value) * months);
    const start = rec.start_date ?? before?.start_date;
    if (start && (rec.start_date !== undefined || rec.months !== undefined) && !rec.end_date) rec.end_date = addDays(addMonths(start, months), -1);
  }
  if (entity === 'deals' && rec.stage) {
    const probs = { 'جديدة': 10, 'تواصل أول': 20, 'جلسة تشخيص': 40, 'عرض سعر': 60, 'تفاوض': 75, 'مكسوبة': 100, 'خاسرة': 0 };
    if (rec.probability === undefined && probs[rec.stage] !== undefined) rec.probability = probs[rec.stage];
    if (['مكسوبة', 'خاسرة'].includes(rec.stage) && (!before || before.stage !== rec.stage)) rec.closed_at = today();
  }
  if (entity === 'tasks' && rec.status) {
    if (rec.status === 'منجزة' && (!before || before.status !== 'منجزة')) rec.done_at = today();
    if (rec.status !== 'منجزة') rec.done_at = null;
    if (rec.status === 'تعديلات' && before && before.status !== 'تعديلات' && rec.revisions === undefined) rec.revisions = (Number(before.revisions) || 0) + 1;
  }
  if (entity === 'content' && rec.status === 'تعديلات' && before && before.status !== 'تعديلات' && rec.revisions === undefined) {
    rec.revisions = (Number(before.revisions) || 0) + 1;
  }
  if (entity === 'leads' && rec.phone) rec.phone = normPhone(rec.phone);
  if (entity === 'clients' && rec.phone) rec.phone = normPhone(rec.phone);
}

async function afterSave(db, user, entity, id, rec, before) {
  // آخر تواصل يحدّث حالة العميل المحتمل وموعد المتابعة
  if (entity === 'activities' && rec.lead_id) {
    const lead = await db.prepare('SELECT status FROM leads WHERE id = ?').bind(rec.lead_id).first();
    const sets = []; const args = [];
    if (lead && lead.status === 'جديد') { sets.push("status = 'قيد التواصل'"); }
    if (rec.next_date) { sets.push('next_followup = ?'); args.push(rec.next_date); }
    if (sets.length) await db.prepare(`UPDATE leads SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...args, rec.lead_id).run();
  }
  if (entity === 'activities' && rec.deal_id) {
    await db.prepare("UPDATE deals SET updated_at = datetime('now') WHERE id = ?").bind(rec.deal_id).run();
  }
}

// ---------- الإجراءات الخاصة ----------
export function normPhone(p) {
  let d = String(p).replace(/[^\d+]/g, '').replace(/^\+/, '');
  d = d.replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c));
  if (d.startsWith('00')) d = d.slice(2);
  if (/^05\d{8}$/.test(d)) d = '966' + d.slice(1);
  if (/^5\d{8}$/.test(d)) d = '966' + d;
  return d;
}

async function leadAction(db, request, user, id, action) {
  if (action === 'convert' && request.method === 'POST') {
    need(user, 'clients', 'w') ; need(user, 'leads', 'r');
    const lead = await inScope(db, user, 'leads', id);
    if (lead.client_id) return json({ client_id: lead.client_id });
    const r = await db.prepare(`INSERT INTO clients (name, brand, sector, contact_name, phone, email, city, lead_id, account_manager_id, created_by, start_date)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(lead.company || lead.name, lead.company, lead.sector, lead.name, lead.phone, lead.email, lead.city,
      lead.id, null, user.id, today()).run();
    const cid = r.meta.last_row_id;
    await db.batch([
      db.prepare("UPDATE leads SET client_id = ?, status = 'محوّل لعميل', updated_at = datetime('now') WHERE id = ?").bind(cid, lead.id),
      db.prepare('UPDATE deals SET client_id = ? WHERE lead_id = ? AND client_id IS NULL').bind(cid, lead.id),
      db.prepare('UPDATE quotes SET client_id = ? WHERE lead_id = ? AND client_id IS NULL').bind(cid, lead.id),
      db.prepare('UPDATE activities SET client_id = ? WHERE lead_id = ? AND client_id IS NULL').bind(cid, lead.id),
    ]);
    await audit(db, user, 'convert', 'leads', lead.id, 'client ' + cid);
    return json({ client_id: cid });
  }
  return bad('إجراء غير معروف', 404);
}

async function quoteAction(db, request, user, id, action) {
  if (action === 'to-contract' && request.method === 'POST') {
    need(user, 'contracts', 'w'); need(user, 'quotes', 'r');
    const q = await inScope(db, user, 'quotes', id);
    let clientId = q.client_id;
    if (!clientId && q.lead_id) {
      const res = await leadAction(db, new Request(request.url, { method: 'POST' }), { ...user, role: isBoss(user) ? user.role : 'manager' }, q.lead_id, 'convert');
      clientId = (await res.json()).client_id;
    }
    if (!clientId) return bad('اربط العرض بعميل أو عميل محتمل أولاً');
    const exist = await db.prepare('SELECT id FROM contracts WHERE quote_id = ?').bind(q.id).first('id');
    if (exist) return json({ contract_id: exist });
    const months = Number(q.months) || 1;
    const net = round2((Number(q.subtotal) || 0) - (Number(q.discount) || 0));
    const start = today();
    let items = []; try { items = JSON.parse(q.items || '[]'); } catch {}
    const pkg = items.map((i) => i.name).join(' + ').slice(0, 300);
    const number = await nextNumber(db, 'contracts', 'C');
    const r = await db.prepare(`INSERT INTO contracts (number, client_id, quote_id, title, package, start_date, end_date, months, monthly_value, total_value, plan, status, owner_id, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(number, clientId, q.id, q.title || pkg, pkg, start, addDays(addMonths(start, months), -1), months,
      round2(net / months), net, q.plan || (months > 1 ? 'monthly' : 'single'), 'مسودة', user.id, user.id).run();
    const cid = r.meta.last_row_id;
    const stmts = [db.prepare("UPDATE quotes SET status = 'مقبول', client_id = ?, updated_at = datetime('now') WHERE id = ?").bind(clientId, q.id)];
    if (q.deal_id) stmts.push(db.prepare("UPDATE deals SET stage = 'مكسوبة', probability = 100, closed_at = ?, client_id = ?, value = ?, updated_at = datetime('now') WHERE id = ?").bind(today(), clientId, net, q.deal_id));
    stmts.push(db.prepare('UPDATE clients SET package = COALESCE(package, ?), start_date = COALESCE(start_date, ?), renewal_date = ? WHERE id = ?').bind(pkg, start, addDays(addMonths(start, months), -30), clientId));
    await db.batch(stmts);
    await audit(db, user, 'to-contract', 'quotes', q.id, number);
    return json({ contract_id: cid, number });
  }
  return bad('إجراء غير معروف', 404);
}

function planSplits(plan, months) {
  months = Math.max(1, Number(months) || 1);
  switch (plan) {
    case 'monthly': return Array.from({ length: months }, (_, i) => ({ pct: 1 / months, at: i, label: `الشهر ${i + 1} من ${months}` }));
    case '60-40': return [{ pct: 0.6, at: 0, label: 'الدفعة الأولى 60%' }, { pct: 0.4, at: Math.floor(months / 2), label: 'الدفعة الثانية 40%' }];
    case '50-30-20': return [{ pct: 0.5, at: 0, label: 'الدفعة الأولى 50%' }, { pct: 0.3, at: Math.floor(months / 2), label: 'الدفعة الثانية 30%' }, { pct: 0.2, at: Math.max(0, months - 1), label: 'الدفعة الأخيرة 20%' }];
    case '3q': return [0, 1, 2].map((i) => ({ pct: 1 / 3, at: Math.round(i * months / 3), label: `الدفعة ${i + 1} من 3` }));
    case '4q': return [0, 1, 2, 3].map((i) => ({ pct: 1 / 4, at: Math.round(i * months / 4), label: `الدفعة ${i + 1} من 4` }));
    default: return [{ pct: 1, at: 0, label: 'دفعة واحدة' }];
  }
}

async function contractAction(db, request, user, id, action) {
  if (action === 'schedule' && request.method === 'POST') {
    need(user, 'invoices', 'w');
    const c = await db.prepare('SELECT * FROM contracts WHERE id = ?').bind(id).first();
    if (!c) return bad('العقد غير موجود', 404);
    const existing = await db.prepare('SELECT COUNT(*) AS n FROM invoices WHERE contract_id = ?').bind(id).first('n');
    if (existing) return bad(`للعقد ${existing} فواتير مسبقاً — احذفها أولاً لإعادة التوليد`);
    const s = await getSettings(db); const vat = Number(s.vat_rate || 15) / 100;
    const start = c.start_date || today();
    const splits = planSplits(c.plan, c.months);
    let acc = 0; const stmts = [];
    const y = new Date().getFullYear();
    const lastNo = await db.prepare('SELECT number FROM invoices WHERE number LIKE ? ORDER BY id DESC LIMIT 1').bind(`INV-${y}-%`).first('number');
    let n = lastNo ? parseInt(lastNo.split('-').pop(), 10) : 0;
    splits.forEach((sp, i) => {
      const sub = i === splits.length - 1 ? round2(c.total_value - acc) : round2(c.total_value * sp.pct);
      acc = round2(acc + sub);
      const issue = addMonths(start, sp.at);
      n += 1;
      stmts.push(db.prepare(`INSERT INTO invoices (number, client_id, contract_id, issue_date, due_date, description, subtotal, vat, total, status, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(`INV-${y}-${String(n).padStart(4, '0')}`, c.client_id, c.id, issue, addDays(issue, 7),
        `${c.title || c.package || 'عقد ' + c.number} — ${sp.label}`, sub, round2(sub * vat), round2(sub * (1 + vat)), 'مسودة', user.id));
    });
    await db.batch(stmts);
    await audit(db, user, 'schedule', 'contracts', c.id, `${stmts.length} invoices`);
    return json({ created: stmts.length });
  }
  if (action === 'renew' && request.method === 'POST') {
    need(user, 'contracts', 'w');
    const c = await db.prepare('SELECT * FROM contracts WHERE id = ?').bind(id).first();
    if (!c) return bad('العقد غير موجود', 404);
    const s = await getSettings(db); const up = 1 + (Number(s.renewal_uplift || 0) / 100);
    const start = c.end_date ? addDays(c.end_date, 1) : today();
    const number = await nextNumber(db, 'contracts', 'C');
    const monthly = round2(c.monthly_value * up);
    const r = await db.prepare(`INSERT INTO contracts (number, client_id, title, package, start_date, end_date, months, monthly_value, total_value, plan, auto_renew, notice_days, status, owner_id, notes, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(number, c.client_id, c.title, c.package, start, addDays(addMonths(start, c.months), -1), c.months,
      monthly, round2(monthly * c.months), c.plan, c.auto_renew, c.notice_days, 'مسودة', c.owner_id, `تجديد للعقد ${c.number} (+${s.renewal_uplift || 0}%)`, user.id).run();
    await audit(db, user, 'renew', 'contracts', c.id, number);
    return json({ contract_id: r.meta.last_row_id, number });
  }
  return bad('إجراء غير معروف', 404);
}

async function recalcInvoice(db, invoiceId) {
  const inv = await db.prepare('SELECT total, status FROM invoices WHERE id = ?').bind(invoiceId).first();
  if (!inv) return;
  const paid = round2(await db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE invoice_id = ?').bind(invoiceId).first('s'));
  let status = inv.status;
  if (paid >= inv.total - 0.01 && inv.total > 0) status = 'مدفوعة';
  else if (paid > 0) status = 'مدفوعة جزئياً';
  else if (['مدفوعة', 'مدفوعة جزئياً'].includes(status)) status = 'مصدرة';
  await db.prepare("UPDATE invoices SET paid = ?, status = ?, updated_at = datetime('now') WHERE id = ?").bind(paid, status, invoiceId).run();
}

async function invoiceAction(db, request, user, id, action) {
  if (action === 'pay' && request.method === 'POST') {
    need(user, 'payments', 'w');
    const inv = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
    if (!inv) return bad('الفاتورة غير موجودة', 404);
    const d = await body(request);
    const amount = round2(d.amount ?? (inv.total - inv.paid));
    if (!(amount > 0)) return bad('أدخل مبلغاً صحيحاً');
    await db.prepare('INSERT INTO payments (invoice_id, client_id, amount, method, ref, paid_at, notes, user_id) VALUES (?,?,?,?,?,?,?,?)')
      .bind(inv.id, inv.client_id, amount, d.method || 'تحويل بنكي', d.ref || null, d.paid_at || today(), d.notes || null, user.id).run();
    await recalcInvoice(db, inv.id);
    await audit(db, user, 'pay', 'invoices', inv.id, amount);
    return json({ ok: true });
  }
  return bad('إجراء غير معروف', 404);
}

// ---------- لوحة القيادة ----------
async function dashboard(db, user) {
  const t = today(); const m0 = t.slice(0, 8) + '01'; const in30 = addDays(t, 30); const wk = addDays(t, 7);
  const sales = user.role === 'sales';
  const own = (col) => (sales ? ` AND ${col} = ${Number(user.id)}` : '');
  const one = (sql, ...a) => db.prepare(sql).bind(...a).first();
  const all = async (sql, ...a) => (await db.prepare(sql).bind(...a).all()).results;
  const finance = can(user, 'invoices', 'r');
  const out = {};
  if (can(user, 'leads', 'r')) {
    out.leads = await one(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS month,
      SUM(CASE WHEN next_followup IS NOT NULL AND next_followup <= ? AND status NOT IN ('محوّل لعميل','غير مهتم','غير صالح') THEN 1 ELSE 0 END) AS due
      FROM leads WHERE 1=1${sales ? ` AND (owner_id = ${Number(user.id)} OR owner_id IS NULL)` : ''}`, m0, t);
    out.leadSources = await all(`SELECT COALESCE(source,'غير محدد') AS k, COUNT(*) AS n FROM leads WHERE 1=1${own('owner_id')} GROUP BY k ORDER BY n DESC LIMIT 8`);
    out.leadStatus = await all(`SELECT status AS k, COUNT(*) AS n FROM leads WHERE 1=1${own('owner_id')} GROUP BY status`);
  }
  if (can(user, 'deals', 'r')) {
    out.pipeline = await all(`SELECT stage AS k, COUNT(*) AS n, COALESCE(SUM(value),0) AS v FROM deals WHERE 1=1${own('owner_id')} GROUP BY stage`);
    out.deals = await one(`SELECT
      COALESCE(SUM(CASE WHEN stage NOT IN ('مكسوبة','خاسرة') THEN value END),0) AS open_value,
      COALESCE(SUM(CASE WHEN stage NOT IN ('مكسوبة','خاسرة') THEN value*probability/100.0 END),0) AS weighted,
      SUM(CASE WHEN stage = 'مكسوبة' AND closed_at >= ? THEN 1 ELSE 0 END) AS won_month,
      COALESCE(SUM(CASE WHEN stage = 'مكسوبة' AND closed_at >= ? THEN value END),0) AS won_month_value,
      SUM(CASE WHEN stage = 'مكسوبة' AND closed_at >= ? THEN 1 ELSE 0 END) AS won90,
      SUM(CASE WHEN stage = 'خاسرة' AND closed_at >= ? THEN 1 ELSE 0 END) AS lost90
      FROM deals WHERE 1=1${own('owner_id')}`, m0, m0, addDays(t, -90), addDays(t, -90));
    const st = (await getSettings(db)).stale_days || 7;
    out.stale = await all(`SELECT id, title, stage, value, updated_at FROM deals WHERE stage NOT IN ('مكسوبة','خاسرة')
      AND COALESCE(updated_at, created_at) < datetime('now', ?)${own('owner_id')} ORDER BY COALESCE(updated_at, created_at) LIMIT 8`, `-${Number(st)} days`);
  }
  if (can(user, 'contracts', 'r')) {
    out.contracts = await one(`SELECT COUNT(*) AS active, COALESCE(SUM(monthly_value),0) AS mrr FROM contracts WHERE status IN ('نشط','موقّع')${own('owner_id')}`);
    out.renewals = await all(`SELECT c.id, c.number, c.end_date, c.monthly_value, cl.name AS client FROM contracts c LEFT JOIN clients cl ON cl.id = c.client_id
      WHERE c.status IN ('نشط','موقّع') AND c.end_date BETWEEN ? AND ?${sales ? ` AND c.owner_id = ${Number(user.id)}` : ''} ORDER BY c.end_date LIMIT 8`, t, in30);
  }
  if (finance) {
    out.money = await one(`SELECT
      COALESCE(SUM(CASE WHEN status IN ('مصدرة','مدفوعة جزئياً','متأخرة') THEN total - paid END),0) AS receivable,
      COALESCE(SUM(CASE WHEN status IN ('مصدرة','مدفوعة جزئياً','متأخرة') AND due_date < ? THEN total - paid END),0) AS overdue,
      SUM(CASE WHEN status IN ('مصدرة','مدفوعة جزئياً','متأخرة') AND due_date < ? THEN 1 ELSE 0 END) AS overdue_n
      FROM invoices`, t, t);
    out.collected = await one('SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE paid_at >= ?', m0);
    out.expensesMonth = await one('SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE date >= ?', m0);
    out.revenue = await all(`SELECT substr(paid_at,1,7) AS k, SUM(amount) AS v FROM payments WHERE paid_at >= ? GROUP BY k ORDER BY k`, addMonths(m0, -5));
  }
  if (can(user, 'tasks', 'r')) {
    const tw = user.role === 'designer' || user.role === 'sales' || user.role === 'finance' ? ` AND assignee_id = ${Number(user.id)}` : '';
    out.tasks = await one(`SELECT SUM(CASE WHEN status != 'منجزة' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN status != 'منجزة' AND due_date < ? THEN 1 ELSE 0 END) AS overdue,
      SUM(CASE WHEN status != 'منجزة' AND due_date BETWEEN ? AND ? THEN 1 ELSE 0 END) AS week,
      SUM(CASE WHEN status = 'منجزة' AND done_at >= ? THEN 1 ELSE 0 END) AS done_month,
      SUM(CASE WHEN status = 'منجزة' AND done_at >= ? AND (due_date IS NULL OR done_at <= due_date) THEN 1 ELSE 0 END) AS ontime_month
      FROM tasks WHERE 1=1${tw}`, t, t, wk, m0, m0);
  }
  if (can(user, 'content', 'r')) {
    out.content = await one(`SELECT SUM(CASE WHEN publish_date BETWEEN ? AND ? THEN 1 ELSE 0 END) AS week,
      SUM(CASE WHEN status IN ('بانتظار اعتماد العميل','مراجعة') THEN 1 ELSE 0 END) AS approval,
      SUM(CASE WHEN publish_date < ? AND status NOT IN ('منشور','ملغي') THEN 1 ELSE 0 END) AS late
      FROM content`, t, wk, t);
  }
  out.seasons = await all(`SELECT id, name, date, plan_days, print_days, sectors FROM seasons WHERE date >= ? ORDER BY date LIMIT 5`, t);
  out.today = t;
  return json(out);
}

async function myDay(db, user) {
  const t = today(); const tomorrow = addDays(t, 1); const in3 = addDays(t, 3);
  const all = async (sql, ...a) => (await db.prepare(sql).bind(...a).all()).results;
  const out = {};
  out.tasks = await all(`SELECT t.*, c.name AS client FROM tasks t LEFT JOIN clients c ON c.id = t.client_id
    WHERE t.assignee_id = ? AND t.status != 'منجزة' AND (t.due_date IS NULL OR t.due_date <= ?) ORDER BY t.due_date IS NULL, t.due_date LIMIT 50`, user.id, tomorrow);
  if (can(user, 'leads', 'r')) {
    out.followups = await all(`SELECT id, name, company, phone, status, next_followup, sector FROM leads
      WHERE next_followup IS NOT NULL AND next_followup <= ? AND status NOT IN ('محوّل لعميل','غير مهتم','غير صالح')
      ${isBoss(user) ? '' : 'AND owner_id = ' + Number(user.id)} ORDER BY next_followup LIMIT 50`, t);
  }
  out.content = await all(`SELECT ct.*, c.name AS client FROM content ct LEFT JOIN clients c ON c.id = ct.client_id
    WHERE (ct.assignee_id = ? OR ct.designer_id = ?) AND ct.status NOT IN ('منشور','ملغي') AND ct.publish_date <= ? ORDER BY ct.publish_date LIMIT 50`, user.id, user.id, in3);
  if (can(user, 'invoices', 'r')) {
    out.invoices = await all(`SELECT i.id, i.number, i.due_date, i.total, i.paid, c.name AS client FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
      WHERE i.status IN ('مصدرة','مدفوعة جزئياً','متأخرة') AND i.due_date <= ? ORDER BY i.due_date LIMIT 30`, t);
  }
  if (can(user, 'clients', 'r') && ['admin', 'manager', 'account'].includes(user.role)) {
    const dom = Number(t.slice(8, 10));
    out.reports = await all(`SELECT id, name, report_day FROM clients WHERE status = 'نشط' AND report_day BETWEEN ? AND ?
      ${user.role === 'account' ? 'AND account_manager_id = ' + Number(user.id) : ''} ORDER BY report_day`, dom, dom + 2);
  }
  out.seasons = await all(`SELECT id, name, date, plan_days, print_days FROM seasons
    WHERE date(date, '-' || plan_days || ' days') BETWEEN ? AND ? OR date(date, '-' || print_days || ' days') BETWEEN ? AND ?`, addDays(t, -3), addDays(t, 7), addDays(t, -3), addDays(t, 7));
  out.today = t;
  return json(out);
}

// ---------- التقارير ----------
async function reports(db, request, user) {
  if (!isBoss(user) && user.role !== 'finance') return bad('التقارير للإدارة والمالية', 403);
  const url = new URL(request.url);
  const from = url.searchParams.get('from') || addDays(today(), -90);
  const to = url.searchParams.get('to') || today();
  const toEnd = to + ' 23:59:59';
  const all = async (sql, ...a) => (await db.prepare(sql).bind(...a).all()).results;
  const one = (sql, ...a) => db.prepare(sql).bind(...a).first();
  const s = await getSettings(db);
  const out = { from, to };
  out.funnel = await one(`SELECT
    (SELECT COUNT(*) FROM leads WHERE created_at BETWEEN ?1 AND ?2) AS leads,
    (SELECT COUNT(DISTINCT lead_id) FROM activities WHERE lead_id IS NOT NULL AND at BETWEEN ?1 AND ?2) AS contacted,
    (SELECT COUNT(*) FROM deals WHERE created_at BETWEEN ?1 AND ?2) AS deals,
    (SELECT COUNT(*) FROM quotes WHERE created_at BETWEEN ?1 AND ?2) AS quotes,
    (SELECT COUNT(*) FROM deals WHERE stage = 'مكسوبة' AND closed_at BETWEEN ?3 AND ?4) AS won,
    (SELECT COALESCE(SUM(value),0) FROM deals WHERE stage = 'مكسوبة' AND closed_at BETWEEN ?3 AND ?4) AS won_value,
    (SELECT COUNT(*) FROM deals WHERE stage = 'خاسرة' AND closed_at BETWEEN ?3 AND ?4) AS lost`, from, toEnd, from, to);
  out.lossReasons = await all(`SELECT COALESCE(loss_reason,'غير موثّق') AS k, COUNT(*) AS n FROM deals WHERE stage = 'خاسرة' AND closed_at BETWEEN ? AND ? GROUP BY k ORDER BY n DESC`, from, to);
  out.sources = await all(`SELECT COALESCE(l.source,'غير محدد') AS k, COUNT(*) AS leads,
    SUM(CASE WHEN l.status = 'محوّل لعميل' THEN 1 ELSE 0 END) AS converted
    FROM leads l WHERE l.created_at BETWEEN ? AND ? GROUP BY k ORDER BY leads DESC`, from, toEnd);
  out.sectors = await all(`SELECT COALESCE(cl.sector,'غير محدد') AS k, COUNT(c.id) AS contracts, COALESCE(SUM(c.total_value),0) AS value
    FROM contracts c LEFT JOIN clients cl ON cl.id = c.client_id WHERE c.status IN ('نشط','موقّع','منتهي') AND c.start_date BETWEEN ? AND ? GROUP BY k ORDER BY value DESC`, from, to);
  out.cash = await all(`SELECT substr(paid_at,1,7) AS k, SUM(amount) AS v FROM payments WHERE paid_at BETWEEN ? AND ? GROUP BY k ORDER BY k`, from, to);
  out.expenses = await all(`SELECT COALESCE(category,'أخرى') AS k, SUM(amount) AS v FROM expenses WHERE date BETWEEN ? AND ? GROUP BY k ORDER BY v DESC`, from, to);
  out.aging = await one(`SELECT
    COALESCE(SUM(CASE WHEN due_date >= ?1 THEN total-paid END),0) AS current,
    COALESCE(SUM(CASE WHEN due_date < ?1 AND due_date >= date(?1,'-30 days') THEN total-paid END),0) AS d30,
    COALESCE(SUM(CASE WHEN due_date < date(?1,'-30 days') AND due_date >= date(?1,'-60 days') THEN total-paid END),0) AS d60,
    COALESCE(SUM(CASE WHEN due_date < date(?1,'-60 days') THEN total-paid END),0) AS d90
    FROM invoices WHERE status IN ('مصدرة','مدفوعة جزئياً','متأخرة')`, today());
  const rep = Number(s.commission_rep || 0); const close = Number(s.commission_close || 0);
  out.team = await all(`SELECT u.id, u.name, u.role, u.commission_rate,
    (SELECT COUNT(*) FROM activities a WHERE a.user_id = u.id AND a.at BETWEEN ?1 AND ?2) AS activities,
    (SELECT COUNT(*) FROM visits v WHERE v.user_id = u.id AND v.at BETWEEN ?1 AND ?2) AS visits,
    (SELECT COUNT(*) FROM deals d WHERE d.owner_id = u.id AND d.stage = 'مكسوبة' AND d.closed_at BETWEEN ?3 AND ?4) AS won,
    (SELECT COALESCE(SUM(value),0) FROM deals d WHERE d.owner_id = u.id AND d.stage = 'مكسوبة' AND d.closed_at BETWEEN ?3 AND ?4) AS won_value,
    (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status = 'منجزة' AND t.done_at BETWEEN ?3 AND ?4) AS tasks_done,
    (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status = 'منجزة' AND t.done_at BETWEEN ?3 AND ?4 AND (t.due_date IS NULL OR t.done_at <= t.due_date)) AS tasks_ontime,
    (SELECT ROUND(AVG(revisions),2) FROM tasks t WHERE t.assignee_id = u.id AND t.status = 'منجزة' AND t.done_at BETWEEN ?3 AND ?4) AS avg_rev
    FROM users u WHERE u.active = 1 ORDER BY won_value DESC, activities DESC`, from, toEnd, from, to);
  out.team.forEach((r) => { const rate = Number(r.commission_rate) || (r.role === 'sales' ? rep + close : 0); r.commission = round2(r.won_value * rate / 100); });
  return json(out);
}

// ---------- الإعدادات والمستخدمون ----------
async function settingsRoute(db, request, user) {
  if (request.method === 'GET') return json({ settings: await publicSettings(db) });
  if (request.method === 'PUT') {
    if (user.role !== 'admin') return bad('للمدير فقط', 403);
    const d = await body(request);
    const stmts = Object.entries(d).filter(([k]) => /^[a-z_]{2,40}$/.test(k) && k !== 'schema_version' && !SECRET_SETTINGS.includes(k) && !k.startsWith('tg_'))
      .map(([k, v]) => db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(k, v == null ? '' : String(v)));
    if (stmts.length) await db.batch(stmts);
    await audit(db, user, 'settings', 'settings', null, Object.keys(d).join(','));
    return json({ settings: await publicSettings(db) });
  }
  return bad('طريقة غير مدعومة', 405);
}

async function usersRoute(db, request, user, id, action) {
  if (user.role !== 'admin') return bad('إدارة المستخدمين للمدير فقط', 403);
  if (!id && request.method === 'POST') {
    const d = await body(request);
    if (!d.name || !d.email) return bad('الاسم والبريد مطلوبان');
    if (!ROLES[d.role]) return bad('دور غير صالح');
    const pw = tempPassword(); const h = await hashPassword(pw);
    try {
      const r = await db.prepare(`INSERT INTO users (name, email, phone, role, title, pass_hash, pass_salt, must_change, commission_rate) VALUES (?,?,?,?,?,?,?,1,?)`)
        .bind(d.name, String(d.email).trim().toLowerCase(), d.phone || null, d.role, d.title || null, h.hash, h.salt, Number(d.commission_rate) || 0).run();
      await audit(db, user, 'create', 'users', r.meta.last_row_id, d.email);
      return json({ id: r.meta.last_row_id, temp_password: pw }, 201);
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return bad('البريد مستخدم مسبقاً');
      throw e;
    }
  }
  if (id && action === 'reset' && request.method === 'POST') {
    const pw = tempPassword(); const h = await hashPassword(pw);
    await db.prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, must_change = 1 WHERE id = ?').bind(h.hash, h.salt, id).run();
    await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
    await audit(db, user, 'reset', 'users', id);
    return json({ temp_password: pw });
  }
  return bad('إجراء غير معروف', 404);
}

// ---------- الملفات (صور إثبات الزيارات وغيرها) ----------
async function filesRoute(db, request, user, id) {
  if (request.method === 'POST' && !id) {
    const d = await body(request);
    if (!d.data || !/^[A-Za-z0-9+/=]+$/.test(d.data)) return bad('ملف غير صالح');
    const size = Math.floor(d.data.length * 3 / 4);
    if (size > 1_400_000) return bad('حجم الملف أكبر من المسموح (1.4MB) — صغّر الصورة');
    const mime = /^image\/(jpeg|png|webp)$|^application\/pdf$/.test(d.mime) ? d.mime : 'application/octet-stream';
    const r = await db.prepare('INSERT INTO files (name, mime, size, data, user_id) VALUES (?,?,?,?,?)').bind(d.name || 'file', mime, size, d.data, user.id).run();
    return json({ id: r.meta.last_row_id }, 201);
  }
  if (request.method === 'GET' && id) {
    const f = await db.prepare('SELECT name, mime, data FROM files WHERE id = ?').bind(id).first();
    if (!f) return bad('غير موجود', 404);
    const bin = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
    return new Response(bin, { headers: { 'content-type': f.mime, 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff' } });
  }
  return bad('طريقة غير مدعومة', 405);
}

// ---------- استيراد قاعدة جهات الاتصال ----------
async function importRoute(db, request, user, what) {
  if (what !== 'leads' || request.method !== 'POST') return bad('غير مدعوم', 404);
  need(user, 'leads', 'w');
  if (!isBoss(user)) return bad('الاستيراد للإدارة فقط', 403);
  const d = await body(request);
  const rows = Array.isArray(d.rows) ? d.rows.slice(0, 5000) : [];
  if (!rows.length) return bad('لا توجد صفوف');
  const { results } = await db.prepare('SELECT phone FROM leads WHERE phone IS NOT NULL').all();
  const seen = new Set(results.map((r) => r.phone));
  const cols = ['name', 'company', 'phone', 'email', 'city', 'sector', 'segment', 'source', 'status', 'notes', 'owner_id', 'interest'];
  let inserted = 0, dup = 0, invalid = 0; const stmts = [];
  for (const r of rows) {
    const rec = {};
    for (const c of cols) if (r[c] != null && String(r[c]).trim() !== '') rec[c] = String(r[c]).trim().slice(0, 1000);
    if (rec.phone) rec.phone = normPhone(rec.phone);
    if (!rec.name && !rec.company && !rec.phone) { invalid++; continue; }
    if (rec.phone && seen.has(rec.phone)) { dup++; continue; }
    if (rec.phone) seen.add(rec.phone);
    rec.source = rec.source || d.source || 'استيراد';
    rec.segment = rec.segment || d.segment || null;
    rec.status = rec.status || 'جديد';
    if (d.owner_id && !rec.owner_id) rec.owner_id = d.owner_id;
    rec.created_by = user.id;
    const k = Object.keys(rec);
    stmts.push(db.prepare(`INSERT INTO leads (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).bind(...k.map((x) => rec[x])));
    inserted++;
  }
  for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80));
  await audit(db, user, 'import', 'leads', null, `${inserted} inserted, ${dup} dup`);
  return json({ inserted, duplicates: dup, invalid });
}

async function exportAll(db, user) {
  if (user.role !== 'admin') return bad('للمدير فقط', 403);
  const out = { exported_at: new Date().toISOString() };
  for (const t of Object.keys(ENTITIES)) {
    const sel = t === 'users' ? 'id, name, email, phone, role, title, active, commission_rate, created_at' : '*';
    if (t === 'files') continue;
    out[t] = (await db.prepare(`SELECT ${sel} FROM ${t}`).all()).results;
  }
  out.settings = await publicSettings(db);
  return json(out, 200, { 'content-disposition': `attachment; filename="nubl-hub-backup-${today()}.json"` });
}

// ---------- السجل الزمني لسجل واحد ----------
async function timeline(db, user, kind, id) {
  const map = { lead: 'lead_id', client: 'client_id', deal: 'deal_id' };
  const col = map[kind]; if (!col) return bad('نوع غير معروف');
  need(user, 'activities', 'r');
  const sc = scopeSql(user, 'activities');
  const { results } = await db.prepare(`SELECT a.*, u.name AS user_name FROM activities a LEFT JOIN users u ON u.id = a.user_id
    WHERE a.${col} = ?${sc.sql ? ' AND a.' + sc.sql : ''} ORDER BY a.at DESC, a.id DESC LIMIT 200`).bind(id, ...sc.args).all();
  let visits = [];
  if (kind !== 'deal' && can(user, 'visits', 'r')) {
    visits = (await db.prepare(`SELECT v.*, u.name AS user_name FROM visits v LEFT JOIN users u ON u.id = v.user_id WHERE v.${col} = ? ORDER BY v.at DESC LIMIT 50`).bind(id).all()).results;
  }
  return json({ activities: results, visits });
}

// ---------- نموذج الموقع العام ----------
async function publicLead(db, request) {
  const d = await body(request);
  if (d.website) return json({ ok: true }); // فخ الروبوتات
  const name = String(d.name || '').trim().slice(0, 120);
  const phone = normPhone(String(d.phone || '').slice(0, 30));
  if (!name || phone.length < 9) return bad('الاسم ورقم الجوال مطلوبان');
  const exists = await db.prepare('SELECT id FROM leads WHERE phone = ?').bind(phone).first('id');
  const note = [d.message, d.service && 'الخدمة: ' + d.service, d.page && 'الصفحة: ' + d.page].filter(Boolean).join(' · ').slice(0, 1500);
  if (exists) {
    await db.prepare(`INSERT INTO activities (kind, lead_id, subject, notes, at) VALUES ('نموذج الموقع', ?, 'طلب جديد من الموقع', ?, datetime('now'))`).bind(exists, note).run();
    await db.prepare("UPDATE leads SET next_followup = date('now'), updated_at = datetime('now') WHERE id = ?").bind(exists).run();
    return json({ ok: true });
  }
  await db.prepare(`INSERT INTO leads (name, company, phone, email, city, sector, source, status, next_followup, notes)
    VALUES (?,?,?,?,?,?,?,'جديد',date('now'),?)`).bind(name, d.company || null, phone, d.email || null, d.city || null,
    d.sector || null, String(d.source || 'الموقع').slice(0, 60), note || null).run();
  return json({ ok: true }, 201);
}

// ---------- ذكاء نُبل (Workers AI) ----------
async function aiRoute(env, db, request, user) {
  if (!env.AI) return bad('خدمة الذكاء الاصطناعي غير مفعّلة', 503);
  const d = await body(request);
  const ctx = String(d.context || '').slice(0, 4000);
  const prompts = {
    followup: 'اكتب رسالة واتساب متابعة قصيرة (3-4 أسطر) بلهجة سعودية مهذبة باسم فريق نُبل وابتكار للخدمات التسويقية، بلا وعود مطلقة ولا مبالغة، تنتهي بدعوة لجلسة تشخيص مجانية 45 دقيقة. معلومات العميل:',
    ideas: 'اقترح 10 أفكار منشورات لشهر قادم لعلامة تجارية سعودية، موزعة على محاور (تعليمي، عرض، خلف الكواليس، موسمي، دليل اجتماعي)، لكل فكرة سطر واحد مع المنصة المناسبة. لا تقترح نصاً داخل الصور. المعلومات:',
    summary: 'لخّص سجل التواصل التالي في 5 نقاط: الوضع الحالي، الاهتمام، الاعتراضات، الخطوة التالية المقترحة، وتاريخها. السجل:',
    caption: 'اكتب نص منشور (كابشن) عربي جذاب ومختصر لمنصات التواصل مع دعوة واضحة لاتخاذ إجراء و3 وسوم مناسبة، بنبرة العلامة الموضحة. الفكرة:',
  };
  const p = prompts[d.action]; if (!p) return bad('إجراء غير معروف');
  const res = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      { role: 'system', content: 'أنت مساعد تسويق محترف يكتب بالعربية الفصحى المعاصرة أو اللهجة السعودية حسب الطلب، بدقة ودون اختلاق أرقام.' },
      { role: 'user', content: `${p}\n${ctx}` },
    ],
    max_tokens: 700,
  });
  await audit(db, user, 'ai', d.action, null);
  return json({ text: res.response || '' });
}

// ======================================================================
// القوالب: كل مهمة تُنشأ من قالب — من المنصة أو من بوت تلجرام
async function templatesRoute(db, env, request, user, id, action) {
  const method = request.method.toUpperCase();
  if (id === 'mine' && method === 'GET') return json({ rows: await templatesFor(db, user) });
  if (id && action === 'run' && method === 'POST') {
    const tpl = await loadTemplate(db, id);
    if (!tpl) return bad('القالب غير موجود', 404);
    if (!tplAllowed(user, tpl)) return bad('لا تملك صلاحية استخدام هذا القالب', 403);
    const d = await body(request);
    const r = await runTemplate(db, env, user, tpl, d.answers || {}, 'المنصة');
    return json(r, 201);
  }
  if (id && action === 'duplicate' && method === 'POST') {
    need(user, 'templates', 'w');
    const t = await db.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first();
    if (!t) return bad('القالب غير موجود', 404);
    const r = await db.prepare(`INSERT INTO templates (code, name, category, kind, emoji, description, role, default_assignee_id, priority, due_days, est_hours, title_tpl, fields, checklist, roles, active, sort, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`).bind(null, t.name + ' (نسخة)', t.category, t.kind, t.emoji, t.description, t.role, t.default_assignee_id, t.priority, t.due_days,
      t.est_hours, t.title_tpl, t.fields, t.checklist, t.roles, (t.sort || 0) + 1, user.id).run();
    await audit(db, user, 'duplicate', 'templates', id, r.meta.last_row_id);
    return json({ id: r.meta.last_row_id }, 201);
  }
  return bad('إجراء غير معروف', 404);
}

// ======================================================================
// تلجرام
async function tgWebhook(ctx, db, env, request) {
  const s = await getSettings(db);
  const secret = request.headers.get('x-telegram-bot-api-secret-token');
  if (!s.tg_secret || secret !== s.tg_secret) return bad('مرفوض', 403);
  let update = null; try { update = await request.json(); } catch { return json({ ok: true }); }
  const p = handleUpdate(db, env, update, new URL(request.url).origin);
  if (ctx.waitUntil) ctx.waitUntil(p); else await p;
  return json({ ok: true });
}

async function tgDigest(db, env, request) {
  const s = await getSettings(db);
  const key = new URL(request.url).searchParams.get('key') || request.headers.get('x-cron-key');
  if (!s.tg_cron_key || key !== s.tg_cron_key) return bad('مرفوض', 403);
  return json(await dailyDigest(db, env));
}

const BOT_COMMANDS = [
  { command: 'new', description: 'مهمة جديدة من قالب' }, { command: 'tasks', description: 'مهامي المفتوحة' },
  { command: 'today', description: 'ملخص يومي' }, { command: 'lead', description: 'عميل محتمل جديد' },
  { command: 'log', description: 'تسجيل تواصل' }, { command: 'visit', description: 'زيارة ميدانية' },
  { command: 'search', description: 'بحث' }, { command: 'board', description: 'لوحة القطاع (للإدارة)' },
  { command: 'cancel', description: 'إلغاء العملية الحالية' }, { command: 'help', description: 'مساعدة' },
];

async function telegramRoute(db, env, request, user, action) {
  const method = request.method.toUpperCase();
  const origin = new URL(request.url).origin;
  const saveSet = (pairs) => db.batch(Object.entries(pairs).map(([k, v]) => db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(k, v == null ? '' : String(v))));

  if (action === 'link' && method === 'POST') {
    const s = await getSettings(db);
    if (!(await tgToken(db, env)) || !s.tg_bot_username) return bad('البوت غير مفعّل بعد — يفعّله المدير من الإعدادات', 409);
    const code = newLinkCode();
    await db.prepare('DELETE FROM tg_codes WHERE user_id = ?').bind(user.id).run();
    await db.prepare('INSERT INTO tg_codes (code, user_id, expires_at) VALUES (?,?,?)').bind(code, user.id, new Date(Date.now() + 20 * 60e3).toISOString()).run();
    return json({ url: `https://t.me/${s.tg_bot_username}?start=${code}`, bot: s.tg_bot_username, expires_in: 20 });
  }
  if (action === 'unlink' && method === 'POST') {
    await db.prepare('UPDATE users SET tg_chat_id = NULL, tg_username = NULL WHERE id = ?').bind(user.id).run();
    await audit(db, user, 'tg-unlink', 'users', user.id);
    return json({ ok: true });
  }
  if (action === 'test' && method === 'POST') {
    const ok = await notifyUser(db, env, user.id, `✅ رسالة اختبار من منصة نُبل وابتكار للتسويق — أهلاً ${user.name}`);
    return ok ? json({ ok }) : bad('لم تصل الرسالة — تأكد من ربط حسابك وتفعيل البوت');
  }

  if (user.role !== 'admin') return bad('للمدير فقط', 403);

  if (action === 'setup' && method === 'POST') {
    const d = await body(request);
    const token = String(d.token || '').trim();
    if (!/^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(token)) return bad('صيغة التوكن غير صحيحة — انسخه كما هو من BotFather');
    const me = await tgCall(env, token, 'getMe', {});
    if (!me.ok) return bad('التوكن مرفوض من تلجرام: ' + (me.description || 'تحقق منه'));
    const secret = randomToken(24);
    const s = await getSettings(db);
    const cron = s.tg_cron_key || randomToken(16);
    const hook = await tgCall(env, token, 'setWebhook', {
      url: `${origin}/marketing/hub/api/telegram/webhook`, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true,
    });
    if (!hook.ok) return bad('تعذّر ضبط Webhook: ' + (hook.description || ''));
    await tgCall(env, token, 'setMyCommands', { commands: BOT_COMMANDS });
    await tgCall(env, token, 'setMyDescription', { description: 'البوت الداخلي لفريق نُبل وابتكار للتسويق — المهام والقوالب والعملاء المحتملون والزيارات، متصل مباشرة بمنصة التسويق.' });
    await tgCall(env, token, 'setMyShortDescription', { short_description: 'بوت فريق نُبل وابتكار للتسويق — خاص بالفريق' });
    await saveSet({ tg_token: token, tg_secret: secret, tg_cron_key: cron, tg_bot_username: me.result.username, tg_bot_name: me.result.first_name });
    await audit(db, user, 'tg-setup', 'settings', null, me.result.username);
    return json({ ok: true, bot: me.result.username });
  }
  if (action === 'status' && method === 'GET') {
    const s = await getSettings(db);
    const token = await tgToken(db, env);
    if (!token) return json({ connected: false });
    const info = await tgCall(env, token, 'getWebhookInfo', {});
    const linked = await db.prepare('SELECT COUNT(*) AS n FROM users WHERE tg_chat_id IS NOT NULL AND active = 1').first('n');
    return json({
      connected: true, bot: s.tg_bot_username, name: s.tg_bot_name, linked,
      webhook: info.result ? { url: info.result.url, pending: info.result.pending_update_count, last_error: info.result.last_error_message || null } : null,
      digest_url: `${origin}/marketing/hub/api/telegram/digest?key=${s.tg_cron_key}`,
    });
  }
  if (action === 'disconnect' && method === 'POST') {
    const token = await tgToken(db, env);
    if (token) await tgCall(env, token, 'deleteWebhook', {});
    await saveSet({ tg_token: '', tg_secret: '', tg_bot_username: '', tg_bot_name: '' });
    await audit(db, user, 'tg-disconnect', 'settings', null);
    return json({ ok: true });
  }
  if (action === 'digest' && method === 'POST') return json(await dailyDigest(db, env));
  return bad('إجراء غير معروف', 404);
}
