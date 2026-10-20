// المرحلة 2 — التشغيل التعاوني: أطراف المهمة (تعدد المكلّفين والأطراف الخارجية) · التذكيرات · تقويم المتابعة الشخصي
// المسارات: GET|PUT people/<task_id> · GET|POST reminders · PUT|DELETE reminders/<id> · GET agenda?from=&to=&user=
import { json, bad, HttpError, today } from './core.js';
import { ENTITIES } from './schema.js';
import { allowed } from './sections.js';
import { notifyUser } from './telegram.js';

const ROLES_P = ['مكلّف', 'مراجع', 'مطّلع', 'طرف خارجي'];
const EXT_KINDS = ['عميل', 'قطاع الإنتاج', 'الدعاية والإعلان', 'مورد', 'أخرى'];
const REM_ENT = ['tasks', 'leads', 'deals', 'activities', 'clients', 'contracts', 'invoices', 'quotes', 'projects', 'content', 'visits'];
const ENT_AR = { tasks: 'مهمة', leads: 'عميل محتمل', deals: 'صفقة', activities: 'تواصل', clients: 'عميل', contracts: 'عقد', invoices: 'فاتورة', quotes: 'عرض سعر', projects: 'مشروع', content: 'منشور', visits: 'زيارة' };
const LINK = { tasks: () => '#/tasks', leads: (id) => `#/lead/${id}`, clients: (id) => `#/client/${id}`, contracts: (id) => `#/contract/${id}`, invoices: (id) => `#/invoice/${id}`, quotes: (id) => `#/quote/${id}`, deals: () => '#/pipeline', content: () => '#/content', activities: () => '#/activities', projects: () => '#/projects', visits: () => '#/visits' };
const isBoss = (u) => ['admin', 'manager'].includes(u.role);
const canRead = (u, ent) => allowed(u, ent, 'r');
const h = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function body(request) { try { return await request.json(); } catch { return {}; } }
async function recTitle(db, ent, id) {
  const col = { tasks: 'title', leads: "COALESCE(company, name)", deals: 'title', activities: 'subject', clients: 'name', contracts: "COALESCE(number,'') || ' ' || COALESCE(title,'')",
    invoices: 'number', quotes: "COALESCE(number,'') || ' ' || COALESCE(title,'')", projects: 'name', content: 'title', visits: 'place_name' }[ent];
  if (!col) return '';
  try { return (await db.prepare(`SELECT ${col} AS t FROM ${ent} WHERE id = ?`).bind(id).first('t')) || ''; } catch { return ''; }
}

export async function opsRoute(db, env, request, user, sec, id) {
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  // ---------------- أطراف المهمة ----------------
  if (sec === 'people') {
    const tid = Number(id); if (!tid) return bad('مهمة غير محددة', 400);
    const task = await db.prepare('SELECT id, title, assignee_id, created_by, due_date FROM tasks WHERE id = ?').bind(tid).first();
    if (!task) return bad('المهمة غير موجودة', 404);
    if (method === 'GET') {
      const { results } = await db.prepare('SELECT id, user_id, ext_name, ext_phone, ext_kind, role FROM task_people WHERE task_id = ? ORDER BY id').bind(tid).all();
      return json({ people: results || [], assignee_id: task.assignee_id });
    }
    if (method === 'PUT') {
      const mine = task.assignee_id === user.id || task.created_by === user.id || isBoss(user);
      if (!mine) return bad('تعديل أطراف المهمة لمكلّفها أو منشئها أو المدير', 403);
      const b = await body(request);
      const list = (Array.isArray(b.people) ? b.people : []).slice(0, 20).map((p) => ({
        user_id: p.user_id ? Number(p.user_id) : null,
        ext_name: p.user_id ? null : String(p.ext_name || '').trim().slice(0, 80) || null,
        ext_phone: p.user_id ? null : String(p.ext_phone || '').replace(/[^\d+]/g, '').slice(0, 20) || null,
        ext_kind: p.user_id ? null : (EXT_KINDS.includes(p.ext_kind) ? p.ext_kind : 'أخرى'),
        role: ROLES_P.includes(p.role) ? p.role : (p.user_id ? 'مكلّف' : 'طرف خارجي'),
      })).filter((p) => p.user_id || p.ext_name);
      const before = new Set(((await db.prepare('SELECT user_id FROM task_people WHERE task_id = ? AND user_id IS NOT NULL').bind(tid).all()).results || []).map((r) => r.user_id));
      const stmts = [db.prepare('DELETE FROM task_people WHERE task_id = ?').bind(tid)];
      const seen = new Set();
      for (const p of list) {
        if (p.user_id && (seen.has(p.user_id) || p.user_id === task.assignee_id)) continue;
        if (p.user_id) seen.add(p.user_id);
        stmts.push(db.prepare('INSERT INTO task_people (task_id, user_id, ext_name, ext_phone, ext_kind, role, added_by) VALUES (?,?,?,?,?,?,?)')
          .bind(tid, p.user_id, p.ext_name, p.ext_phone, p.ext_kind, p.role, user.id));
      }
      await db.batch(stmts);
      for (const uid of seen) {
        if (before.has(uid) || uid === user.id) continue;
        const role = list.find((p) => p.user_id === uid)?.role || 'مكلّف';
        await notifyUser(db, env, uid, `👥 أُضفت إلى مهمة بصفة «${role}» من ${h(user.name)}\n\n<b>${h(task.title)}</b>${task.due_date ? `\nالاستحقاق: ${task.due_date}` : ''}`, null, { link: '#/tasks', kind: 'task' });
      }
      return json({ ok: true, count: stmts.length - 1 });
    }
  }

  // ---------------- التذكيرات ----------------
  if (sec === 'reminders') {
    if (method === 'GET' && !id) {
      const ent = url.searchParams.get('entity'); const eid = Number(url.searchParams.get('entity_id'));
      let rows;
      if (ent && eid) {
        if (!canRead(user, ent)) return bad('خارج صلاحيتك', 403);
        rows = (await db.prepare('SELECT * FROM reminders WHERE entity = ? AND entity_id = ? ORDER BY remind_at').bind(ent, eid).all()).results || [];
      } else {
        rows = (await db.prepare(`SELECT * FROM reminders WHERE (',' || user_ids || ',' LIKE ? OR created_by = ?) AND status = 'pending' ORDER BY remind_at LIMIT 200`)
          .bind(`%,${user.id},%`, user.id).all()).results || [];
      }
      return json({ rows });
    }
    if (method === 'POST' && !id) {
      const b = await body(request);
      const r = cleanReminder(b, user);
      if (r.error) return bad(r.error, 400);
      if (!canRead(user, r.entity)) return bad('خارج صلاحيتك', 403);
      const title = r.title || await recTitle(db, r.entity, r.entity_id);
      const ins = await db.prepare('INSERT INTO reminders (entity, entity_id, title, remind_at, user_ids, channels, note, created_by) VALUES (?,?,?,?,?,?,?,?)')
        .bind(r.entity, r.entity_id, title.slice(0, 200), r.remind_at, r.user_ids, r.channels, r.note, user.id).run();
      return json({ id: ins.meta.last_row_id }, 201);
    }
    const rid = Number(id); if (!rid) return bad('تذكير غير محدد', 400);
    const cur = await db.prepare('SELECT * FROM reminders WHERE id = ?').bind(rid).first();
    if (!cur) return bad('التذكير غير موجود', 404);
    const own = cur.created_by === user.id || (',' + cur.user_ids + ',').includes(',' + user.id + ',') || isBoss(user);
    if (!own) return bad('خارج صلاحيتك', 403);
    if (method === 'DELETE') { await db.prepare('DELETE FROM reminders WHERE id = ?').bind(rid).run(); return json({ ok: true }); }
    if (method === 'PUT') {
      const b = await body(request);
      if (b.status === 'done' || b.status === 'pending') {
        await db.prepare('UPDATE reminders SET status = ? WHERE id = ?').bind(b.status, rid).run();
        return json({ ok: true });
      }
      if (b.snooze) { // تأجيل بالدقائق
        const m = Math.min(Math.max(Number(b.snooze) || 60, 5), 60 * 24 * 14);
        const at = ksaLocal(Date.now() + m * 60e3);
        await db.prepare("UPDATE reminders SET remind_at = ?, status = 'pending', sent_at = NULL WHERE id = ?").bind(at, rid).run();
        return json({ ok: true, remind_at: at });
      }
      const r = cleanReminder({ ...cur, ...b }, user);
      if (r.error) return bad(r.error, 400);
      await db.prepare("UPDATE reminders SET remind_at = ?, user_ids = ?, channels = ?, note = ?, status = 'pending', sent_at = NULL WHERE id = ?")
        .bind(r.remind_at, r.user_ids, r.channels, r.note, rid).run();
      return json({ ok: true });
    }
  }

  // ---------------- تقويم المتابعة الشخصي ----------------
  if (sec === 'agenda' && method === 'GET') {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('from') || '') ? url.searchParams.get('from') : today();
    const to = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('to') || '') ? url.searchParams.get('to') : from;
    let uid = Number(url.searchParams.get('user')) || user.id;
    if (uid !== user.id && !isBoss(user)) uid = user.id;
    return json({ from, to, user: uid, items: await agenda(db, uid, from, to) });
  }

  return bad('مسار غير معروف', 404);
}

// تحويل وقت إلى «YYYY-MM-DD HH:MM» بتوقيت الرياض
const ksaLocal = (ms) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

function cleanReminder(b, user) {
  const entity = String(b.entity || '');
  if (!REM_ENT.includes(entity)) return { error: 'نوع السجل غير مدعوم للتذكير' };
  const entity_id = Number(b.entity_id); if (!entity_id) return { error: 'السجل غير محدد' };
  const at = String(b.remind_at || '').replace('T', ' ').slice(0, 16);
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(at)) return { error: 'حدد تاريخ ووقت التذكير' };
  const ids = [...new Set((Array.isArray(b.user_ids) ? b.user_ids : String(b.user_ids || '').split(',')).map(Number).filter(Boolean))].slice(0, 15);
  if (!ids.length) ids.push(user.id);
  const ch = (Array.isArray(b.channels) ? b.channels : String(b.channels || 'app,wa,tg').split(',')).filter((c) => ['app', 'wa', 'tg'].includes(c));
  if (!ch.includes('app')) ch.unshift('app');
  return { entity, entity_id, remind_at: at, user_ids: ids.join(','), channels: ch.join(','), note: String(b.note || '').trim().slice(0, 500) || null, title: String(b.title || '').trim() };
}

// تُستدعى كل 10 دقائق من /wa/health (عامل الجدولة) — ترسل التذكيرات المستحقة بالقنوات المختارة
export async function processReminders(db, env) {
  const now = ksaLocal(Date.now());
  let rows = [];
  try { rows = (await db.prepare("SELECT * FROM reminders WHERE status = 'pending' AND remind_at <= ? ORDER BY remind_at LIMIT 50").bind(now).all()).results || []; }
  catch { return { sent: 0, error: 'no table' }; }
  let sent = 0;
  for (const r of rows) {
    const ch = String(r.channels || 'app').split(',');
    const link = (LINK[r.entity] || (() => ''))(r.entity_id);
    const by = r.created_by ? await db.prepare('SELECT name FROM users WHERE id = ?').bind(r.created_by).first('name') : '';
    const text = `⏰ تذكير — ${ENT_AR[r.entity] || ''}\n<b>${h(r.title || '')}</b>${r.note ? `\n${h(r.note)}` : ''}${by ? `\nبواسطة: ${h(by)}` : ''}`;
    for (const uid of String(r.user_ids || '').split(',').map(Number).filter(Boolean)) {
      await notifyUser(db, env, uid, text, null, { link, kind: 'reminder', title: `⏰ تذكير: ${r.title || ENT_AR[r.entity] || ''}`, skipWa: !ch.includes('wa'), skipTg: !ch.includes('tg'), urgent: true });
    }
    await db.prepare("UPDATE reminders SET status = 'sent', sent_at = datetime('now') WHERE id = ?").bind(r.id).run();
    sent++;
  }
  return { sent };
}

// عناصر التقويم للمستخدم بين تاريخين
async function agenda(db, uid, from, to) {
  const all = async (sql, ...a) => { try { return (await db.prepare(sql).bind(...a).all()).results || []; } catch { return []; } };
  const out = [];
  const tasks = await all(`SELECT id, title, due_date AS d, status, priority FROM tasks WHERE due_date BETWEEN ? AND ? 
    AND (assignee_id = ? OR id IN (SELECT task_id FROM task_people WHERE user_id = ?))`, from, to, uid, uid);
  tasks.forEach((t) => out.push({ d: t.d, kind: 'task', title: t.title, link: '#/tasks', done: t.status === 'منجزة', id: t.id, tag: t.priority }));
  (await all(`SELECT id, COALESCE(company, name) AS t, next_followup AS d, status FROM leads WHERE owner_id = ? AND next_followup BETWEEN ? AND ? AND status NOT IN ('غير مهتم','غير صالح','محوّل لعميل')`, uid, from, to))
    .forEach((x) => out.push({ d: x.d, kind: 'followup', title: `متابعة: ${x.t}`, link: `#/lead/${x.id}`, tag: x.status }));
  (await all(`SELECT id, subject, next_step, next_date AS d FROM activities WHERE user_id = ? AND next_date BETWEEN ? AND ?`, uid, from, to))
    .forEach((x) => out.push({ d: x.d, kind: 'followup', title: x.next_step || `خطوة تالية: ${x.subject || ''}`, link: '#/activities' }));
  (await all(`SELECT id, entity, entity_id, title, remind_at, note, status FROM reminders WHERE ',' || user_ids || ',' LIKE ? AND substr(remind_at,1,10) BETWEEN ? AND ?`, `%,${uid},%`, from, to))
    .forEach((x) => out.push({ d: x.remind_at.slice(0, 10), time: x.remind_at.slice(11, 16), kind: 'reminder', title: x.title || 'تذكير', note: x.note, link: (LINK[x.entity] || (() => ''))(x.entity_id), done: x.status !== 'pending', id: x.id }));
  (await all(`SELECT c.id, c.title, c.publish_date AS d, c.status, cl.name AS client FROM content c LEFT JOIN clients cl ON cl.id = c.client_id
    WHERE (c.assignee_id = ? OR c.designer_id = ?) AND c.publish_date BETWEEN ? AND ?`, uid, uid, from, to))
    .forEach((x) => out.push({ d: x.d, kind: 'content', title: `${x.client ? x.client + ' — ' : ''}${x.title}`, link: '#/content', done: x.status === 'منشور', tag: x.status }));
  (await all(`SELECT c.id, c.number, c.end_date AS d, cl.name AS client FROM contracts c LEFT JOIN clients cl ON cl.id = c.client_id
    WHERE c.owner_id = ? AND c.end_date BETWEEN ? AND ? AND c.status IN ('نشط','موقّع')`, uid, from, to))
    .forEach((x) => out.push({ d: x.d, kind: 'renewal', title: `تجديد عقد ${x.client || x.number}`, link: `#/contract/${x.id}` }));
  (await all(`SELECT name, date AS d FROM seasons WHERE date BETWEEN ? AND ?`, from, to))
    .forEach((x) => out.push({ d: x.d, kind: 'season', title: x.name, link: '#/seasons' }));
  return out.sort((a, b) => (a.d + (a.time || '99')).localeCompare(b.d + (b.time || '99')));
}

export { HttpError };
