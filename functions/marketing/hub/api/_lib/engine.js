// محرك القوالب — يحوّل إجابات القالب إلى سجل في المنصة (مهمة / عميل محتمل / تواصل / زيارة)
// يُستدعى من المنصة (POST /templates/:id/run) ومن بوت تلجرام بنفس المنطق تماماً.
import { HttpError, today, addDays, audit } from './core.js';
import { ENTITIES } from './schema.js';
import { SECTORS } from './seed.js';
import { notifyUser, taskLine, openTaskKb, h } from './telegram.js';

export const canDo = (user, entity, op) => (ENTITIES[entity]?.perms[user.role] || '').includes(op);

export function parseTpl(row) {
  if (!row) return null;
  const j = (v, d) => { try { return JSON.parse(v || '') || d; } catch { return d; } };
  return { ...row, fields: j(row.fields, []), checklist: j(row.checklist, []) };
}
export async function loadTemplate(db, id) {
  const row = await db.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first();
  return parseTpl(row);
}
// هل يحق لهذا المستخدم استخدام القالب؟
export function tplAllowed(user, tpl) {
  if (!tpl || !tpl.active) return false;
  const roles = String(tpl.roles || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (roles.length && !roles.includes(user.role)) return false;
  const ent = { task: 'tasks', lead: 'leads', activity: 'activities', visit: 'visits' }[tpl.kind || 'task'];
  return canDo(user, ent, 'w');
}
export async function templatesFor(db, user) {
  const { results } = await db.prepare('SELECT * FROM templates WHERE active = 1 ORDER BY sort, id').all();
  return results.map(parseTpl).filter((t) => tplAllowed(user, t));
}

const normPhone = (p) => {
  let d = String(p || '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (/^05\d{8}$/.test(d)) d = '966' + d.slice(1);
  if (/^5\d{8}$/.test(d)) d = '966' + d;
  return d;
};

// تسمية قيمة إجابة للعرض
export async function answerLabel(db, f, v) {
  if (v == null || v === '') return '';
  if (f.t === 'client') { const r = await db.prepare('SELECT name FROM clients WHERE id = ?').bind(v).first(); return r ? r.name : ''; }
  if (f.t === 'lead') { const r = await db.prepare('SELECT name, company FROM leads WHERE id = ?').bind(v).first(); return r ? [r.company, r.name].filter(Boolean).join(' — ') : ''; }
  if (f.t === 'user') { const r = await db.prepare('SELECT name FROM users WHERE id = ?').bind(v).first(); return r ? r.name : ''; }
  if (f.t === 'sector') return SECTORS.find((s) => s.id === v)?.name || v;
  if (f.t === 'location') return v && v.lat ? `${Number(v.lat).toFixed(5)}, ${Number(v.lng).toFixed(5)}` : '';
  if (f.t === 'photo') return v ? 'صورة مرفقة' : '';
  return String(v);
}

// المكلّف الافتراضي: المحدد في القالب، وإلا أقل عضو انشغالاً في الدور، وإلا المنشئ
async function pickAssignee(db, tpl, user) {
  if (tpl.default_assignee_id) {
    const ok = await db.prepare('SELECT id FROM users WHERE id = ? AND active = 1').bind(tpl.default_assignee_id).first('id');
    if (ok) return ok;
  }
  if (tpl.role && tpl.role !== user.role) {
    const r = await db.prepare(`SELECT u.id, (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status != 'منجزة') AS load
      FROM users u WHERE u.active = 1 AND u.role = ? ORDER BY load, u.id LIMIT 1`).bind(tpl.role).first();
    if (r) return r.id;
  }
  return user.id;
}

const RESERVED_TASK = ['client', 'due', 'assignee', 'link', 'priority'];

// التحقق من الإجابات المطلوبة
export function missingRequired(tpl, answers) {
  return tpl.fields.filter((f) => f.req && (answers[f.k] == null || answers[f.k] === '')).map((f) => f.l);
}

export async function runTemplate(db, env, user, tpl, answers, source = 'المنصة') {
  if (!tplAllowed(user, tpl)) throw new HttpError(403, 'لا تملك صلاحية استخدام هذا القالب');
  answers = answers || {};
  const miss = missingRequired(tpl, answers);
  if (miss.length) throw new HttpError(400, 'حقول مطلوبة ناقصة: ' + miss.join('، '));
  const kind = tpl.kind || 'task';
  let out;
  if (kind === 'lead') out = await runLead(db, user, tpl, answers);
  else if (kind === 'activity') out = await runActivity(db, user, tpl, answers);
  else if (kind === 'visit') out = await runVisit(db, user, tpl, answers);
  else out = await runTask(db, env, user, tpl, answers, source);
  await db.prepare('UPDATE templates SET uses = COALESCE(uses,0) + 1 WHERE id = ?').bind(tpl.id).run();
  await audit(db, user, 'template', out.entity, out.id, `${tpl.code || tpl.id} · ${source}`);
  return out;
}

async function runTask(db, env, user, tpl, a, source) {
  const labels = {};
  for (const f of tpl.fields) labels[f.k] = await answerLabel(db, f, a[f.k]);
  let title = String(tpl.title_tpl || '').replace(/\{(\w+)\}/g, (_, k) => labels[k] || '').replace(/\s*[—\-:]\s*$/, '').replace(/^\s*[—\-:]\s*/, '').replace(/\s{2,}/g, ' ').trim();
  if (!title || /^(تصميم|مونتاج|متابعة|تحصيل|تعديلات|تصوير|خطة محتوى|خطة موسم|ملف طباعة|التقرير الشهري|طلب عميل|جدولة محتوى|عرض سعر|جلسة تشخيص|إعلان ممول|تهيئة العميل)$/.test(title)) {
    title = [title || tpl.name, labels.client].filter(Boolean).join(' — ');
  }
  title = title.slice(0, 200);
  const desc = tpl.fields.filter((f) => !RESERVED_TASK.includes(f.k) && labels[f.k])
    .map((f) => `${f.l}: ${labels[f.k]}`).join('\n');
  const assignee = a.assignee ? Number(a.assignee) : await pickAssignee(db, tpl, user);
  const due = a.due || (tpl.due_days ? addDays(today(), Number(tpl.due_days)) : null);
  const checklist = JSON.stringify((tpl.checklist || []).map((t) => ({ t, d: 0 })));
  const r = await db.prepare(`INSERT INTO tasks (title, client_id, assignee_id, status, priority, due_date, est_hours, description, link,
      template_id, checklist, data, source, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(title, a.client ? Number(a.client) : null, assignee, 'جديدة', a.priority || tpl.priority || 'عادية', due, tpl.est_hours || null,
      desc || null, a.link || null, tpl.id, checklist, JSON.stringify(a), source, user.id).run();
  const id = r.meta.last_row_id;
  const task = { id, title, due_date: due, priority: a.priority || tpl.priority };
  if (assignee !== user.id) {
    await notifyUser(db, env, assignee, `🆕 مهمة جديدة من ${h(user.name)}\n\n${taskLine(task, labels.client)}${desc ? `\n\n${h(desc).slice(0, 700)}` : ''}`, openTaskKb(id));
  }
  return { entity: 'tasks', id, title, assignee_id: assignee, due_date: due, client: labels.client };
}

async function runLead(db, user, tpl, a) {
  const phone = a.phone ? normPhone(a.phone) : null;
  const note = [a.notes, a.contact && `صاحب القرار: ${a.contact}`].filter(Boolean).join(' · ') || null;
  if (phone) {
    const ex = await db.prepare('SELECT id, name, company FROM leads WHERE phone = ?').bind(phone).first();
    if (ex) {
      await db.prepare(`INSERT INTO activities (kind, lead_id, subject, notes, user_id, at) VALUES ('ملاحظة', ?, 'إعادة تسجيل من قالب', ?, ?, datetime('now','+3 hours'))`)
        .bind(ex.id, note, user.id).run();
      return { entity: 'leads', id: ex.id, title: [ex.company, ex.name].filter(Boolean).join(' — '), duplicate: true };
    }
  }
  const r = await db.prepare(`INSERT INTO leads (name, company, phone, city, sector, source, status, interest, owner_id, next_followup, notes, created_by)
    VALUES (?,?,?,?,?,?,'جديد',?,?,?,?,?)`).bind(a.name || null, a.company || null, phone, a.city || null, a.sector || null, a.source || 'أخرى',
    a.interest || null, user.id, a.next_followup || addDays(today(), 1), note, user.id).run();
  return { entity: 'leads', id: r.meta.last_row_id, title: [a.company, a.name].filter(Boolean).join(' — ') };
}

async function runActivity(db, user, tpl, a) {
  const leadId = Number(a.lead);
  const lead = await db.prepare('SELECT id, name, company, status, owner_id FROM leads WHERE id = ?').bind(leadId).first();
  if (!lead) throw new HttpError(404, 'العميل المحتمل غير موجود');
  if (user.role === 'sales' && lead.owner_id && lead.owner_id !== user.id) throw new HttpError(403, 'هذا العميل مسند لزميل آخر');
  const r = await db.prepare(`INSERT INTO activities (kind, lead_id, subject, outcome, notes, user_id, next_step, next_date, at)
    VALUES (?,?,?,?,?,?,?,?, datetime('now','+3 hours'))`).bind(a.kind || 'مكالمة', leadId, a.kind || 'تواصل', a.outcome || null, a.notes || null,
    user.id, a.next_date ? 'متابعة' : null, a.next_date || null).run();
  const sets = []; const args = [];
  if (lead.status === 'جديد') sets.push("status = 'قيد التواصل'");
  if (a.outcome === 'تم الرد — مهتم' || a.outcome === 'حُجز موعد') sets.push("status = 'مهتم'");
  if (a.outcome === 'تم الرد — غير مهتم') sets.push("status = 'غير مهتم'");
  if (a.next_date) { sets.push('next_followup = ?'); args.push(a.next_date); }
  if (!lead.owner_id) { sets.push('owner_id = ?'); args.push(user.id); }
  if (sets.length) await db.prepare(`UPDATE leads SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...args, leadId).run();
  return { entity: 'activities', id: r.meta.last_row_id, title: `${a.kind || 'تواصل'} — ${[lead.company, lead.name].filter(Boolean).join(' — ')}`, lead_id: leadId };
}

async function runVisit(db, user, tpl, a) {
  const loc = a.location || {};
  const notes = [a.notes, a.contact && `صاحب القرار: ${a.contact}`].filter(Boolean).join(' · ') || null;
  let leadId = a.lead ? Number(a.lead) : null;
  const hot = ['حار', 'دافئ'].includes(a.interest) || ['تم الرد — مهتم', 'حُجز موعد', 'أُرسل عرض'].includes(a.outcome);
  if (!leadId && hot) {
    const phoneMatch = String(a.contact || '').match(/(?:\+?966|0)?5\d{8}/);
    const phone = phoneMatch ? normPhone(phoneMatch[0]) : null;
    const ex = phone ? await db.prepare('SELECT id FROM leads WHERE phone = ?').bind(phone).first('id') : null;
    if (ex) leadId = ex;
    else {
      const r = await db.prepare(`INSERT INTO leads (name, company, phone, city, source, status, interest, owner_id, next_followup, notes, created_by)
        VALUES (?,?,?,?,'زيارة ميدانية','مهتم',?,?,?,?,?)`).bind(String(a.contact || '').replace(/(?:\+?966|0)?5\d{8}/, '').trim() || null,
        a.place_name, phone, a.city || null, a.interest || null, user.id, addDays(today(), 2), notes, user.id).run();
      leadId = r.meta.last_row_id;
    }
  }
  const r = await db.prepare(`INSERT INTO visits (place_name, lead_id, city, lat, lng, accuracy, photo_id, outcome, interest, notes, user_id, at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?, datetime('now','+3 hours'))`).bind(a.place_name, leadId, a.city || null, loc.lat ?? null, loc.lng ?? null,
    loc.acc ?? null, a.photo ? Number(a.photo) : null, a.outcome || null, a.interest || null, notes, user.id).run();
  return { entity: 'visits', id: r.meta.last_row_id, title: a.place_name, lead_id: leadId, lead_created: !a.lead && !!leadId };
}

// إشعارات تغيّر حالة المهمة (تُستدعى بعد أي تعديل من المنصة أو البوت)
export async function taskChanged(db, env, actor, before, after) {
  if (!before || !after) return;
  const client = after.client_id ? (await db.prepare('SELECT name FROM clients WHERE id = ?').bind(after.client_id).first('name')) : '';
  const line = taskLine(after, client);
  const kb = openTaskKb(after.id);
  const to = new Set();
  const send = async (uid, text) => { if (uid && uid !== actor.id && !to.has(uid)) { to.add(uid); await notifyUser(db, env, uid, text, kb); } };
  if (after.assignee_id && after.assignee_id !== before.assignee_id) await send(after.assignee_id, `📥 أُسندت إليك مهمة من ${h(actor.name)}\n\n${line}`);
  if (after.status !== before.status) {
    if (after.status === 'مراجعة') await send(after.created_by, `👀 جاهزة للمراجعة — ${h(actor.name)}\n\n${line}`);
    if (after.status === 'تعديلات') await send(after.assignee_id, `🔁 مطلوب تعديلات (جولة ${after.revisions || 1}) — ${h(actor.name)}\n\n${line}`);
    if (after.status === 'منجزة') await send(after.created_by, `✅ أُنجزت — ${h(actor.name)}\n\n${line}`);
  }
}
