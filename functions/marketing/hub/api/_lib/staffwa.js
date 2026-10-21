// إدارة المهام عبر واتساب لأعضاء الفريق — على رقم التسويق نفسه (0563413040)
// المرسِل يُعرَّف من رقم جواله المسجّل في المنصة (users.phone) فيعمل بصلاحيات دوره، ولا تصل رسالته للرد الآلي للعملاء.
// أوامر مباشرة (مجانية بلا ذكاء): مساعدة · مهامي · المتأخرة · تقرير · تم 12 · بدء 12 · مراجعة 12 · ملاحظة 12 نص · تأجيل 12 غداً · رابط 12 https://…
// وأي رسالة حرة («خلصت تصميم شمس لاين»، «أضف مهمة تصميم بوستر لسدن بكرة») يفهمها الذكاء ويحوّلها لإجراء.
import { today, addDays, audit } from './core.js';
import { notifyUser, h as hx } from './telegram.js';
import { taskChanged, templatesFor, runTemplate, missingRequired } from './engine.js';
import { buildReport, toWA } from './reports.js';
import { aiJSON } from './ai.js';

const GRAPH = 'https://graph.facebook.com/v23.0';
const BOSS = ['admin', 'manager'];
const STATUS = ['جديدة', 'قيد التنفيذ', 'مراجعة', 'تعديلات', 'منجزة'];
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const AR = (s) => String(s || '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c));

async function graph(env, phoneId, payload) {
  try {
    const r = await fetch(`${env.WA_GRAPH_URL || GRAPH}/${phoneId}/messages`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.WA_TOKEN}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...payload }) });
    const d = await r.json().catch(() => ({})); return { ok: r.ok && !d.error, data: d };
  } catch (e) { return { ok: false, data: { error: { message: e.message } } }; }
}
const say = (env, ev, body) => graph(env, ev.phone_number_id, { to: ev.wa_id, type: 'text', text: { body: String(body).slice(0, 4000), preview_url: false } });
const buttons = (env, ev, body, btns) => graph(env, ev.phone_number_id, { to: ev.wa_id, type: 'interactive',
  interactive: { type: 'button', body: { text: String(body).slice(0, 1020) }, action: { buttons: btns.slice(0, 3).map(([id, title]) => ({ type: 'reply', reply: { id, title: cut(title, 20) } })) } } });
const listMsg = (env, ev, body, button, rows) => graph(env, ev.phone_number_id, { to: ev.wa_id, type: 'interactive',
  interactive: { type: 'list', body: { text: String(body).slice(0, 1020) }, action: { button: cut(button, 20), sections: [{ title: 'المهام', rows: rows.slice(0, 10).map(([id, title, desc]) => ({ id, title: cut(title, 24), description: cut(desc, 72) })) }] } } });

export async function findStaff(db, waId) {
  if (!db || !waId) return null;
  try { return await db.prepare('SELECT * FROM users WHERE active = 1 AND phone = ?').bind(String(waId)).first(); } catch { return null; }
}

const scope = (u) => (['admin', 'manager', 'account'].includes(u.role) ? { sql: '1=1', args: [] }
  : { sql: '(t.assignee_id = ? OR t.created_by = ? OR t.id IN (SELECT task_id FROM task_people WHERE user_id = ?))', args: [u.id, u.id, u.id] });
async function taskRow(db, u, id) {
  const sc = scope(u);
  return db.prepare(`SELECT t.*, c.name AS client, w.name AS who FROM tasks t LEFT JOIN clients c ON c.id = t.client_id LEFT JOIN users w ON w.id = t.assignee_id
    WHERE t.id = ? AND ${sc.sql}`).bind(id, ...sc.args).first();
}
async function myOpen(db, u, mode = 'mine') {
  const t = today();
  const where = mode === 'late' ? `t.status != 'منجزة' AND t.due_date < ? AND ${scope(u).sql}` : "t.status != 'منجزة' AND (t.assignee_id = ? OR t.id IN (SELECT task_id FROM task_people WHERE user_id = ?))";
  const args = mode === 'late' ? [t, ...scope(u).args] : [u.id, u.id];
  return (await db.prepare(`SELECT t.id, t.title, t.status, t.due_date, substr(t.description, 1, 90) AS info, c.name AS client, w.name AS who FROM tasks t LEFT JOIN clients c ON c.id = t.client_id
    LEFT JOIN users w ON w.id = t.assignee_id WHERE ${where} ORDER BY t.due_date IS NULL, t.due_date, t.id LIMIT 30`).bind(...args).all()).results;
}
const rel = (d) => { if (!d) return 'بلا موعد'; const n = Math.round((Date.parse(d) - Date.parse(today())) / 864e5); return n < 0 ? `متأخرة ${-n}ي` : n === 0 ? 'اليوم' : n === 1 ? 'غداً' : `بعد ${n}ي`; };

async function sendList(env, db, ev, u, mode = 'mine') {
  const rows = await myOpen(db, u, mode);
  const head = mode === 'late' ? '⚠️ المهام المتأخرة' : '📋 مهامك المفتوحة';
  if (!rows.length) return say(env, ev, `${head}: لا شيء 👌\nلإضافة مهمة اكتب مثلاً: «مهمة جديدة تصميم بوستر لعميل سدن موعدها الخميس».`);
  const text = `${head} (${rows.length})\n` + rows.slice(0, 15).map((t) => `#${t.id} ${cut(t.title, 50)}${t.client ? ` · ${cut(t.client, 18)}` : ''} — ${t.status} · ${rel(t.due_date)}${mode === 'late' ? ` · ${String(t.who || '').split(' ')[0]}` : ''}`).join('\n')
    + '\n\nاختر مهمة من القائمة، أو اكتب: «تم 12» · «بدء 12» · «مراجعة 12» · «تأجيل 12 غداً» · «ملاحظة 12 النص»';
  return listMsg(env, ev, text.slice(0, 1020), 'اختر مهمة', rows.map((t) => [`t:${t.id}`, `#${t.id} ${t.title}`, `${t.status} · ${rel(t.due_date)}${t.client ? ' · ' + t.client : ''}`]));
}
async function sendCard(env, db, ev, u, id) {
  const t = await taskRow(db, u, id);
  if (!t) return say(env, ev, `المهمة #${id} غير موجودة أو خارج صلاحيتك.`);
  let cl = []; try { cl = JSON.parse(t.checklist || '[]') || []; } catch { /* */ }
  const body = `📌 *${t.title}*  #${t.id}\n${t.client ? `🏷️ ${t.client}\n` : ''}👤 ${t.who || '—'} · 📅 ${t.due_date || '—'} (${rel(t.due_date)})\nالحالة: *${t.status}* · الأولوية: ${t.priority || 'عادية'}`
    + (cl.length ? `\nالخطوات: ${cl.filter((x) => x.d).length}/${cl.length}` : '') + (t.description ? `\n\n${cut(t.description, 600)}` : '') + (t.link ? `\n🔗 ${t.link}` : '')
    + `\n\nللملاحظة: «ملاحظة ${t.id} النص» · للتأجيل: «تأجيل ${t.id} غداً»`;
  const b = [];
  if (t.status !== 'منجزة') b.push([`s:${t.id}:4`, '✅ تم الإنجاز']);
  if (!['قيد التنفيذ', 'منجزة'].includes(t.status)) b.push([`s:${t.id}:1`, '▶️ بدء العمل']);
  if (!['مراجعة', 'منجزة'].includes(t.status)) b.push([`s:${t.id}:2`, '👀 للمراجعة']);
  if (b.length < 3) b.push(['menu:mine', '📋 مهامي']);
  return buttons(env, ev, body, b);
}

async function setStatus(env, db, ev, u, id, status) {
  const before = await taskRow(db, u, id);
  if (!before) return say(env, ev, `المهمة #${id} غير موجودة أو خارج صلاحيتك.`);
  if (!STATUS.includes(status)) return say(env, ev, 'الحالة غير معروفة. المتاح: ' + STATUS.join('، '));
  if (status === 'تعديلات' && !(BOSS.includes(u.role) || before.created_by === u.id)) return say(env, ev, 'طلب التعديلات لمنشئ المهمة أو الإدارة فقط.');
  if (before.status === status) return say(env, ev, `المهمة #${id} حالتها «${status}» أصلاً.`);
  const sets = ['status = ?']; const args = [status];
  if (status === 'منجزة') { sets.push('done_at = ?'); args.push(today()); } else sets.push('done_at = NULL');
  if (status === 'تعديلات') sets.push('revisions = COALESCE(revisions,0) + 1');
  await db.prepare(`UPDATE tasks SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...args, id).run();
  const after = await db.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
  await audit(db, u, 'update', 'tasks', id, `status → ${status} (واتساب)`);
  await taskChanged(db, env, u, before, after);
  return say(env, ev, `${status === 'منجزة' ? '✅' : '✔️'} #${id} «${cut(before.title, 60)}» ← ${status}`);
}
async function addNote(env, db, ev, u, id, text) {
  const t = await taskRow(db, u, id); if (!t) return say(env, ev, `المهمة #${id} غير موجودة أو خارج صلاحيتك.`);
  if (!String(text || '').trim()) return say(env, ev, `اكتب الملاحظة بعد الرقم: «ملاحظة ${id} النص».`);
  const stamp = `— ${today()} · ${u.name}: ${cut(text, 1500)}`;
  await db.prepare("UPDATE tasks SET description = TRIM(COALESCE(description,'') || char(10) || ?), updated_at = datetime('now') WHERE id = ?").bind(stamp, id).run();
  const other = [t.assignee_id, t.created_by].find((x) => x && x !== u.id);
  if (other) await notifyUser(db, env, other, `💬 ملاحظة من ${hx(u.name)} على:\n<b>${hx(t.title)}</b>\n\n${hx(cut(text, 800))}`, null, { kind: 'note', link: `#/tasks/${id}` });
  await audit(db, u, 'update', 'tasks', id, 'note (واتساب)');
  return say(env, ev, `💬 أُضيفت الملاحظة على #${id}.`);
}
async function setDue(env, db, ev, u, id, due) {
  const t = await taskRow(db, u, id); if (!t) return say(env, ev, `المهمة #${id} غير موجودة أو خارج صلاحيتك.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due || '')) return say(env, ev, `حدد الموعد: «تأجيل ${id} غداً» أو «تأجيل ${id} 3 أيام» أو «تأجيل ${id} 2026-11-05».`);
  await db.prepare("UPDATE tasks SET due_date = ?, updated_at = datetime('now') WHERE id = ?").bind(due, id).run();
  await audit(db, u, 'update', 'tasks', id, `due → ${due} (واتساب)`);
  if (t.created_by && t.created_by !== u.id) await notifyUser(db, env, t.created_by, `📅 غيّر ${hx(u.name)} موعد المهمة <b>${hx(t.title)}</b> إلى ${due}`, null, { kind: 'task_assigned', link: `#/tasks/${id}` });
  return say(env, ev, `📅 موعد #${id} أصبح ${due}.`);
}
async function setLink(env, db, ev, u, id, link) {
  const t = await taskRow(db, u, id); if (!t) return say(env, ev, `المهمة #${id} غير موجودة أو خارج صلاحيتك.`);
  if (!/^https?:\/\/\S+$/i.test(link || '')) return say(env, ev, `الصق رابطاً يبدأ بـ https:// بعد رقم المهمة.`);
  await db.prepare("UPDATE tasks SET link = ?, updated_at = datetime('now') WHERE id = ?").bind(link, id).run();
  await audit(db, u, 'update', 'tasks', id, 'link (واتساب)');
  return say(env, ev, `🔗 حُفظ الرابط على #${id}.`);
}
function parseDue(s) {
  s = AR(s).trim(); const t = today();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^(اليوم)$/.test(s)) return t;
  if (/^(غدا|غداً|بكرة|بكره)$/.test(s)) return addDays(t, 1);
  if (/^بعد\s*بكر/.test(s)) return addDays(t, 2);
  const m = s.match(/^(\d{1,2})\s*(يوم|ايام|أيام)?$/); if (m) return addDays(t, +m[1]);
  const w = s.match(/^(\d{1,2})\s*(اسبوع|أسبوع|اسابيع|أسابيع)$/); if (w) return addDays(t, 7 * +w[1]);
  return null;
}

const HELP = (u) => `أهلاً ${String(u.name).split(' ')[0]} 👋 — إدارة مهامك من واتساب:
• *مهامي* — مهامك المفتوحة (اختر منها للتعديل)
• *المتأخرة* — المتأخرة ${['admin', 'manager', 'account'].includes(u.role) ? 'في القطاع' : 'عليك'}
• *تقرير* — تقريرك الآن
• *تم 12* · *بدء 12* · *مراجعة 12* — تغيير الحالة
• *تأجيل 12 غداً* — تغيير الموعد
• *ملاحظة 12 النص* · *رابط 12 https://…*
• *مهمة جديدة* ثم الوصف — مثل: «مهمة جديدة تصميم بوستر اليوم الوطني لسدن موعدها الخميس»
ويمكنك الكتابة بأسلوبك («خلصت مهمة شمس لاين») وسأفهمها.`;

// يُستدعى من محرك واتساب لكل رسالة من رقم عضو في الفريق
export async function handleStaffMessage(env, ev, user) {
  const db = env.DB;
  const raw = String(ev.reply_id || '').trim();
  const text = AR(String(ev.text || '').trim());
  try {
    // ردود الأزرار والقوائم
    if (raw.startsWith('t:')) return sendCard(env, db, ev, user, +raw.slice(2));
    if (raw.startsWith('s:')) { const [, id, i] = raw.split(':'); return setStatus(env, db, ev, user, +id, STATUS[+i]); }
    if (raw === 'menu:mine') return sendList(env, db, ev, user);
    if (raw === 'menu:report') return say(env, ev, toWA(await buildReport(db, user, (new Date().getUTCHours() + 3) % 24 >= 13 ? 'pm' : 'am')));
    if (!text) return say(env, ev, HELP(user));

    let m;
    if (/^(مساعدة|مساعده|help|\?|؟|اوامر|أوامر|قائمة|قائمه|ابدأ|start|السلام عليكم|مرحبا|هلا)$/i.test(text)) {
      return buttons(env, ev, HELP(user), [['menu:mine', '📋 مهامي'], ['menu:report', '📊 تقريري']]);
    }
    if (/^(مهامي|مهام|1|١)$/.test(text)) return sendList(env, db, ev, user);
    if (/^(المتأخرة|المتاخرة|متأخرة|متاخرة)$/.test(text)) return sendList(env, db, ev, user, 'late');
    if (/^(تقرير|تقريري|التقرير|2|٢)$/.test(text)) return say(env, ev, toWA(await buildReport(db, user, (new Date().getUTCHours() + 3) % 24 >= 13 ? 'pm' : 'am')));
    if ((m = text.match(/^#?(\d+)$/))) return sendCard(env, db, ev, user, +m[1]);
    if ((m = text.match(/^(تم|انجزت|أنجزت|منجزة|خلصت|خلص)\s*#?(\d+)$/))) return setStatus(env, db, ev, user, +m[2], 'منجزة');
    if ((m = text.match(/^(بدء|ابدأ|بدأت|ابدا)\s*#?(\d+)$/))) return setStatus(env, db, ev, user, +m[2], 'قيد التنفيذ');
    if ((m = text.match(/^(مراجعة|مراجعه|للمراجعة)\s*#?(\d+)$/))) return setStatus(env, db, ev, user, +m[2], 'مراجعة');
    if ((m = text.match(/^(تعديلات|تعديل)\s*#?(\d+)$/))) return setStatus(env, db, ev, user, +m[2], 'تعديلات');
    if ((m = text.match(/^(ملاحظة|ملاحظه)\s*#?(\d+)\s+([\s\S]+)$/))) return addNote(env, db, ev, user, +m[2], m[3]);
    if ((m = text.match(/^(تأجيل|تاجيل|موعد)\s*#?(\d+)\s+(.+)$/))) return setDue(env, db, ev, user, +m[2], parseDue(m[3]));
    if ((m = text.match(/^(رابط)\s*#?(\d+)\s+(\S+)$/))) return setLink(env, db, ev, user, +m[2], m[3]);
    return aiCommand(env, db, ev, user, text);
  } catch (e) {
    console.error('staffwa', e);
    return say(env, ev, '⚠️ تعذّر تنفيذ الطلب: ' + cut(e.message, 200) + '\nاكتب «مساعدة» لعرض الأوامر.');
  }
}

// فهم الرسائل الحرة بالذكاء الاصطناعي → إجراء محدد (لا ينفذ إلا ما يسمح به دور المستخدم)
async function aiCommand(env, db, ev, user, text) {
  const tasks = await myOpen(db, user);
  const tpls = (await templatesFor(db, user)).filter((t) => (t.kind || 'task') === 'task').slice(0, 25);
  const { results: clients } = await db.prepare("SELECT id, name FROM clients WHERE status != 'منتهي' ORDER BY name LIMIT 80").all();
  const { results: users } = await db.prepare('SELECT id, name, role FROM users WHERE active = 1').all();
  const t = today();
  const sys = `أنت مساعد مهام لفريق «نُبل وابتكار للتسويق» على واتساب. حوّل رسالة العضو إلى إجراء واحد بصيغة JSON فقط:
{"action":"list|late|report|card|done|start|review|revisions|note|due|link|new|help|unknown","task_id":رقم أو null,"note":"","due":"YYYY-MM-DD أو null","link":"","template_id":رقم أو null,"answers":{},"reply":"رد قصير بالعربية عند unknown أو لطلب معلومة ناقصة"}
- اختر task_id من قائمة مهام العضو فقط بمطابقة المعنى (اسم العميل أو موضوع المهمة). إن احتمل أكثر من مهمة فاجعل action=unknown واسأله عن رقم المهمة في reply مع ذكر الخيارات.
- اليوم ${t} (توقيت الرياض، الأسبوع يبدأ الأحد). حوّل «بكرة/الخميس/بعد أسبوع» إلى تاريخ.
- action=new لإضافة مهمة: اختر template_id الأنسب واملأ answers بمفاتيح حقول القالب (العميل client = رقم العميل من القائمة أو اسمه نصاً، الموعد due، المكلّف assignee = رقم العضو). إن نقص حقل مطلوب فاجعل action=unknown واطلبه في reply.
- لا تخترع أرقام مهام أو قوالب أو عملاء غير موجودة.`;
  const usr = `العضو: ${user.name} (${user.role}, id ${user.id})
مهامه المفتوحة: ${tasks.map((x) => `#${x.id} ${cut(x.title, 70)}${x.client ? ' [' + x.client + ']' : ''}${x.info ? ' {' + cut(x.info, 80) + '}' : ''} (${x.status}, ${x.due_date || 'بلا موعد'})`).join(' | ') || 'لا شيء'}
القوالب المتاحة: ${tpls.map((x) => `${x.id}: ${x.name} — حقول: ${x.fields.map((f) => `${f.k}${f.req ? '*' : ''}(${f.t}:${cut(f.l, 25)})`).join(', ')}`).join(' || ') || 'لا شيء'}
العملاء: ${clients.map((c) => `${c.id}:${c.name}`).join('، ')}
الفريق: ${users.map((x) => `${x.id}:${x.name}`).join('، ')}
الرسالة: «${text}»`;
  let a;
  try { a = (await aiJSON(env, sys, usr, { max: 900, tier: 'fast' })).data || {}; } catch (e) { return say(env, ev, 'لم أفهم الطلب 🙏 اكتب «مساعدة» لعرض الأوامر.'); }
  const id = Number(a.task_id) || null;
  switch (a.action) {
    case 'list': return sendList(env, db, ev, user);
    case 'late': return sendList(env, db, ev, user, 'late');
    case 'report': return say(env, ev, toWA(await buildReport(db, user)));
    case 'help': return say(env, ev, HELP(user));
    case 'card': return id ? sendCard(env, db, ev, user, id) : say(env, ev, a.reply || 'أي مهمة تقصد؟ اكتب رقمها.');
    case 'done': return id ? setStatus(env, db, ev, user, id, 'منجزة') : say(env, ev, a.reply || 'أي مهمة؟ اكتب «تم» ورقمها.');
    case 'start': return id ? setStatus(env, db, ev, user, id, 'قيد التنفيذ') : say(env, ev, a.reply || 'أي مهمة؟');
    case 'review': return id ? setStatus(env, db, ev, user, id, 'مراجعة') : say(env, ev, a.reply || 'أي مهمة؟');
    case 'revisions': return id ? setStatus(env, db, ev, user, id, 'تعديلات') : say(env, ev, a.reply || 'أي مهمة؟');
    case 'note': return id ? addNote(env, db, ev, user, id, a.note) : say(env, ev, a.reply || 'على أي مهمة الملاحظة؟');
    case 'due': return id ? setDue(env, db, ev, user, id, a.due) : say(env, ev, a.reply || 'أي مهمة تريد تأجيلها؟');
    case 'link': return id ? setLink(env, db, ev, user, id, a.link) : say(env, ev, a.reply || 'لأي مهمة الرابط؟');
    case 'new': {
      const tpl = tpls.find((x) => x.id === Number(a.template_id));
      if (!tpl) return say(env, ev, a.reply || 'لم أحدد نوع المهمة — صفها أكثر أو أنشئها من المنصة.');
      const answers = a.answers && typeof a.answers === 'object' ? a.answers : {};
      const miss = missingRequired(tpl, answers);
      if (miss.length) return say(env, ev, `لإنشاء «${tpl.name}» أحتاج: ${miss.join('، ')} — أعد إرسال الطلب كاملاً.`);
      const out = await runTemplate(db, env, user, tpl, answers, 'واتساب');
      const tid = out?.id || out?.task_id || out?.row?.id;
      return say(env, ev, `➕ أُنشئت المهمة${tid ? ` #${tid}` : ''} من قالب «${tpl.name}»${out?.title ? `: ${out.title}` : ''}.\nلعرضها اكتب ${tid ? `«${tid}»` : '«مهامي»'}.`);
    }
    default: return say(env, ev, a.reply || 'لم أفهم الطلب 🙏 اكتب «مساعدة» لعرض الأوامر.');
  }
}
